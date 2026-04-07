import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { StateService } from '../../services/state.service';
import { ToastService } from '../../services/toast.service';
import { AppState, Person } from '../../models/state.model';

type EinstellungsTab = 'personen' | 'ort' | 'logo';

@Component({
  selector: 'app-einstellungen',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbNavModule],
  templateUrl: './einstellungen.component.html'
})
export class EinstellungenComponent {
  readonly activeModal = inject(NgbActiveModal);
  readonly stateService = inject(StateService);
  private readonly toastService = inject(ToastService);

  activeTab: EinstellungsTab = 'personen';

  /** Liest das Signal – Template bleibt unverändert (state.X) */
  get state(): AppState { return this.stateService.state(); }

  // Sitzungsorte
  addOrt(): void { this.stateService.patch(s => { s.settings.orte.push(''); }); }
  updateOrt(idx: number, value: string): void {
    this.stateService.patch(s => { s.settings.orte[idx] = value; });
  }
  removeOrt(idx: number): void {
    const snapshot = this.state.settings.orte[idx];
    const stateService = this.stateService;
    const toastService = this.toastService;
    stateService.patchNoHistory(s => { s.settings.orte.splice(idx, 1); });
    toastService.info(`Sitzungsort «${snapshot || '(leer)'}» wurde entfernt.`, () => {
      stateService.patch(s => { s.settings.orte.splice(idx, 0, snapshot); });
      toastService.info(`Sitzungsort «${snapshot || '(leer)'}» wurde wiederhergestellt.`);
    });
  }

  // Personen
  addPerson(): void {
    this.stateService.patch(s => { s.settings.personen.push({ kuerzel: '', vorname: '', nachname: '', funktion: '' }); });
  }
  updatePerson(idx: number, field: keyof Person, value: string): void {
    this.stateService.patch(s => { (s.settings.personen[idx] as any)[field] = value; });
  }
  removePerson(idx: number): void {
    const snapshot: Person = JSON.parse(JSON.stringify(this.state.settings.personen[idx]));
    const stateService = this.stateService;
    const toastService = this.toastService;
    stateService.patchNoHistory(s => { s.settings.personen.splice(idx, 1); });
    const label = [snapshot.vorname, snapshot.nachname].filter(Boolean).join(' ') || snapshot.kuerzel || 'Person';
    toastService.info(`${label} wurde aus der Personenliste entfernt.`, () => {
      stateService.patch(s => { s.settings.personen.splice(idx, 0, snapshot); });
      toastService.info(`${label} wurde in der Personenliste wiederhergestellt.`);
    });
  }

  getPendenzCount(kuerzel: string): number {
    if (!kuerzel) return 0;
    return this.stateService.getPendenzCountByPerson()[kuerzel] || 0;
  }

  // Logo
  loadLogo(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target!.result as string;
      this.stateService.patch(s => { s.meta.logo = data; });
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    const snapshot = this.state.meta.logo;
    const stateService = this.stateService;
    const toastService = this.toastService;
    stateService.patchNoHistory(s => { delete s.meta.logo; });
    toastService.info('Logo wurde entfernt.', () => {
      stateService.patch(s => { s.meta.logo = snapshot; });
      toastService.info('Logo wurde wiederhergestellt.');
    });
  }
}
