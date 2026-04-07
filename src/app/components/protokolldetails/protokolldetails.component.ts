import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable, Subject, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { NgbTypeaheadModule, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { StateService } from '../../services/state.service';
import { PersonenService } from '../../services/personen.service';
import { ToastService } from '../../services/toast.service';
import { AppState, VorstandMitglied, Gast } from '../../models/state.model';
import { TagInputComponent } from '../shared/tag-input/tag-input.component';
import { StatusSwitchComponent } from '../shared/status-switch/status-switch.component';
import { TimeInputComponent } from '../shared/time-input/time-input.component';

@Component({
  selector: 'app-protokolldetails',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, NgbTypeaheadModule, TagInputComponent, StatusSwitchComponent, TimeInputComponent],
  templateUrl: './protokolldetails.component.html',
  animations: [
    trigger('badgeSwap', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(24px)' }),
        animate('700ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('500ms ease-in', style({ opacity: 0, transform: 'translateX(-18px)' }))
      ])
    ])
  ]
})
export class ProtokolldetailsComponent {
  readonly stateService = inject(StateService);
  readonly personenService = inject(PersonenService);
  private readonly toastService = inject(ToastService);

  /** Liest das Signal – Template bleibt unverändert (state.X) */
  get state(): AppState { return this.stateService.state(); }

  get collapsed(): Record<string, boolean> {
    return this.state._uiState.collapsedSections;
  }

  toggleSection(key: string): void {
    this.stateService.patch(s => {
      s._uiState.collapsedSections[key] = !s._uiState.collapsedSections[key];
    });
  }

  updateMeta(field: string, value: string): void {
    this.stateService.patch(s => { (s.meta as any)[field] = value; });
  }

  updateProtokollfuehrung(field: string, value: string): void {
    this.stateService.patch(s => { (s.meta.protokollfuehrung as any)[field] = value; });
  }

  updateNaechsteSitzung(field: string, value: string): void {
    this.stateService.patch(s => { (s.meta.naechsteSitzung as any)[field] = value; });
  }

  focusOrt$ = new Subject<string>();
  focusProtokollfuehrender$ = new Subject<string>();
  protokollfuehrendInputValue = '';

  searchOrte = (text$: Observable<string>) =>
    merge(text$.pipe(debounceTime(150), distinctUntilChanged()), this.focusOrt$).pipe(
      map(term => this.state.settings.orte.filter(
        o => !term.trim() || o.toLowerCase().includes(term.toLowerCase())
      ).sort())
    );

  addOrtToList(value: string): void {
    if (!value) return;
    this.stateService.patch(s => {
      if (!s.settings.orte.includes(value)) s.settings.orte.push(value);
    });
  }

  // Vorstand
  addVorstandMitglied(): void {
    this.stateService.patch(s => {
      s.vorstand.push({ nachname: '', vorname: '', kuerzel: '', status: 'anwesend', funktion: [] });
    });
  }

  removeVorstandMitglied(idx: number): void {
    const snapshot: VorstandMitglied = JSON.parse(JSON.stringify(this.state.vorstand[idx]));
    const label = [snapshot.vorname, snapshot.nachname].filter(Boolean).join(' ') || snapshot.kuerzel || 'Mitglied';
    const stateService = this.stateService;
    const toastService = this.toastService;
    stateService.patchNoHistory(s => { s.vorstand.splice(idx, 1); });
    toastService.info(`${label} wurde aus dem Vorstand entfernt.`, () => {
      stateService.patch(s => { s.vorstand.splice(idx, 0, snapshot); });
      toastService.info(`${label} wurde im Vorstand wiederhergestellt.`);
    });
  }

  updateVorstand(idx: number, field: string, value: any): void {
    this.stateService.patch(s => { (s.vorstand[idx] as any)[field] = value; });
  }

  dropVorstand(event: CdkDragDrop<VorstandMitglied[]>): void {
    this.stateService.patch(s => {
      moveItemInArray(s.vorstand, event.previousIndex, event.currentIndex);
    });
  }

  // Gaeste
  addGast(): void {
    this.stateService.patch(s => {
      s.gaeste.push({ nachname: '', vorname: '', kuerzel: '', funktion: [] });
    });
  }

  removeGast(idx: number): void {
    const snapshot: Gast = JSON.parse(JSON.stringify(this.state.gaeste[idx]));
    const label = [snapshot.vorname, snapshot.nachname].filter(Boolean).join(' ') || snapshot.kuerzel || 'Gast';
    const stateService = this.stateService;
    const toastService = this.toastService;
    stateService.patchNoHistory(s => { s.gaeste.splice(idx, 1); });
    toastService.info(`${label} wurde aus der Gästeliste entfernt.`, () => {
      stateService.patch(s => { s.gaeste.splice(idx, 0, snapshot); });
      toastService.info(`${label} wurde in der Gästeliste wiederhergestellt.`);
    });
  }

  updateGast(idx: number, field: string, value: any): void {
    this.stateService.patch(s => { (s.gaeste[idx] as any)[field] = value; });
  }

  dropGaeste(event: CdkDragDrop<Gast[]>): void {
    this.stateService.patch(s => {
      moveItemInArray(s.gaeste, event.previousIndex, event.currentIndex);
    });
  }

  getKuerzelSuggestions = (input: string, current: string[]) =>
    this.personenService.getKuerzelSuggestions(input, current);

  getFunktionSuggestions = (input: string, current: string[]) =>
    this.personenService.getRessortSuggestions(input, current);

  // ── Protokollführung Typeahead ────────────────────────
  searchProtokollfuehrender = (text$: Observable<string>) =>
    merge(text$.pipe(debounceTime(150), distinctUntilChanged()), this.focusProtokollfuehrender$).pipe(
      map(term => {
        const t = term.toLowerCase();
        return this.state.settings.personen
          .filter(p => !t ||
            (p.vorname + ' ' + p.nachname).toLowerCase().includes(t) ||
            (p.nachname + ' ' + p.vorname).toLowerCase().includes(t)
          )
          .map(p => [p.vorname, p.nachname].filter(Boolean).join(' '))
          .slice(0, 10);
      })
    );

  protokollfuehrendFormatter = (value: string) => value;

  onSelectProtokollfuehrender(event: NgbTypeaheadSelectItemEvent): void {
    event.preventDefault();
    this.updateProtokollfuehrung('name', event.item);
    this.protokollfuehrendInputValue = '';
  }

  onBlurProtokollfuehrender(): void {
    const validNames = this.state.settings.personen
      .map(p => [p.vorname, p.nachname].filter(Boolean).join(' '));
    setTimeout(() => {
      if (this.protokollfuehrendInputValue.trim() && validNames.includes(this.protokollfuehrendInputValue.trim())) {
        this.updateProtokollfuehrung('name', this.protokollfuehrendInputValue.trim());
      }
      this.protokollfuehrendInputValue = '';
    }, 200);
  }

  clearProtokollfuehrender(): void {
    this.updateProtokollfuehrung('name', '');
    this.protokollfuehrendInputValue = '';
  }
}
