import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { StateService } from '../../services/state.service';
import { ExportService } from '../../services/export.service';
import { ToastService } from '../../services/toast.service';
import { EinstellungenComponent } from '../einstellungen/einstellungen.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [RouterOutlet, NgbTooltipModule],
  templateUrl: './editor.component.html'
})
export class EditorComponent {
  readonly saveVisible = signal(false);
  activeTab: 'protokoll' | 'pendenzen' = 'protokoll';

  private readonly stateService = inject(StateService);
  private readonly exportService = inject(ExportService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly modal = inject(NgbModal);

  readonly pendenzCount = computed(() => this.stateService.state().pendenzen.length);

  private saveTimer: any;
  private skipInitialState = true;

  constructor() {
    this.activeTab = this.router.url.includes('pendenzen') ? 'pendenzen' : 'protokoll';

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.activeTab = e.url.includes('pendenzen') ? 'pendenzen' : 'protokoll';
    });

    effect(() => {
      this.stateService.state(); // Signal verfolgen
      if (this.skipInitialState) { this.skipInitialState = false; return; }
      this.saveVisible.set(true);
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveVisible.set(false), 2000);
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      event.preventDefault();
      const undoResult = this.toastService.triggerLatestUndo();
      if (undoResult === 'triggered') return;
      if (undoResult === 'expired') {
        this.toastService.info(`Rückgängig machen ist zeitlich limitiert auf ${this.toastService.lastUndoDelaySecs} Sekunden.`);
        return;
      }
      if (this.stateService.undo()) {
        this.toastService.info('Letzte Änderung rückgängig gemacht.');
      } else {
        this.toastService.info('Keine weiteren Änderungen zum Rückgängigmachen.');
      }
    }
  }

  goToStart(): void {
    this.router.navigate(['/start']);
  }

  switchTab(tab: 'protokoll' | 'pendenzen'): void {
    this.activeTab = tab;
    this.router.navigate(['/editor', tab]);
  }

  openSettings(): void {
    this.modal.open(EinstellungenComponent, { size: 'lg', centered: true, scrollable: true });
  }

  exportJSON(): void {
    this.exportService.downloadJSON();
    this.toastService.success('JSON wurde erfolgreich heruntergeladen und steht unter Downloads zur Verfügung.');
  }

  async exportPDF(): Promise<void> {
    const loadingToast = this.toastService.show('PDF wird erstellt…', 'info', 30000);
    try {
      await this.exportService.downloadPDF();
      this.toastService.remove(loadingToast);
      this.toastService.success('PDF wurde erfolgreich heruntergeladen.');
    } catch (err: any) {
      this.toastService.remove(loadingToast);
      this.toastService.danger('Fehler bei der PDF-Erstellung: ' + err.message);
      return;
    }

    const ref = this.modal.open(ConfirmDialogComponent, { centered: true });
    ref.componentInstance.title        = 'JSON auch herunterladen?';
    ref.componentInstance.message      = 'Soll zu Sicherungszwecken die JSON-Datei auch heruntergeladen werden?';
    ref.componentInstance.confirmLabel = 'Ja, JSON herunterladen';
    ref.componentInstance.confirmClass = 'btn-secondary';
    const confirmed = await ref.result.catch(() => false);
    if (confirmed) {
      this.exportService.downloadJSON();
      this.toastService.success('JSON wurde heruntergeladen.');
    }
  }
}
