import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { StorageService } from '../../services/storage.service';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { createDefaultState } from '../../models/state.model';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './start.component.html'
})
export class StartComponent implements OnInit {
  hasData = false;

  constructor(
    private router: Router,
    private storage: StorageService,
    private stateService: StateService,
    private toastService: ToastService,
    private modal: NgbModal
  ) {}

  ngOnInit(): void {
    this.hasData = this.storage.hasData();
  }

  neuAnhandVorlage(): void {
    this.stateService.init(createDefaultState());
    this.router.navigate(['/editor']);
  }

  fortfahren(): void {
    const saved = this.storage.load();
    if (saved) {
      this.stateService.init(saved);
    } else {
      this.stateService.init(createDefaultState());
    }
    this.router.navigate(['/editor']);
  }

  triggerImport(): void {
    (document.getElementById('jsonImportInput') as HTMLInputElement)?.click();
  }

  async importJSON(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const modalRef = this.modal.open(ConfirmDialogComponent, { centered: true });
    modalRef.componentInstance.title = 'JSON importieren';
    modalRef.componentInstance.message = 'Das aktuelle Dokument wird komplett ersetzt. Fortfahren?';
    modalRef.componentInstance.confirmLabel = 'Importieren';

    try {
      await modalRef.result;
    } catch {
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target!.result as string);
        const migrated = this.storage.migrate(parsed);
        this.stateService.init(migrated);
        this.stateService.syncPersonenFromVorstandGaeste();
        this.stateService.saveNow();
        this.router.navigate(['/editor']);
      } catch (err: any) {
        this.toastService.danger('Ungültige JSON-Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }
}
