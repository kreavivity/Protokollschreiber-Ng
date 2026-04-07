import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { NgbModal, NgbPaginationModule, NgbTooltipModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable, Subject, merge } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { Pendenz, PendenzEintrag } from '../../../models/state.model';
import { StateService } from '../../../services/state.service';
import { PersonenService } from '../../../services/personen.service';
import { ToastService } from '../../../services/toast.service';
import { MarkdownPreviewComponent } from '../../shared/markdown-preview/markdown-preview.component';

@Component({
  selector: 'app-pendenz-card',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbPaginationModule, NgbTooltipModule, NgbTypeaheadModule, MarkdownPreviewComponent],
  templateUrl: './pendenz-card.component.html',
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
export class PendenzCardComponent implements OnInit, OnChanges {
  @Input() pendenz!: Pendenz;
  collapsed = false;
  page = 1;
  readonly pageSize = 3;

  zustaendigDisplay = '';
  zustaendigInputValue = '';
  ressortDisplay = '';
  ressortInputValue = '';
  focusZustaendig$ = new Subject<string>();
  focusRessort$ = new Subject<string>();

  constructor(
    public stateService: StateService,
    public personenService: PersonenService,
    private toastService: ToastService,
    private modal: NgbModal
  ) {}

  ngOnInit(): void {
    this.collapsed = this.stateService.state()._uiState.collapsedSections['p_' + this.pendenz.id] || false;
    this.zustaendigDisplay = this.pendenz.zustaendig[0] || '';
    this.ressortDisplay = this.pendenz.ressort[0] || '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pendenz'] && !changes['pendenz'].firstChange) {
      this.zustaendigDisplay = this.pendenz.zustaendig[0] || '';
      this.ressortDisplay = this.pendenz.ressort[0] || '';
    }
  }

  get isArchiviert(): boolean {
    return this.pendenz.status === 'archiviert' || !!this.pendenz.archiviert;
  }

  get isErledigt(): boolean {
    return this.pendenz.status === 'erledigt' || (!!this.pendenz.erledigt && !this.isArchiviert);
  }

  get pagedEntries(): { entry: PendenzEintrag; originalIndex: number }[] {
    const reversed = [...this.pendenz.eintraege]
      .map((e, i) => ({ entry: e, originalIndex: i }))
      .reverse();
    const start = (this.page - 1) * this.pageSize;
    return reversed.slice(start, start + this.pageSize);
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.stateService.patch(s => {
      s._uiState.collapsedSections['p_' + this.pendenz.id] = this.collapsed;
    });
  }

  private patch(fn: (p: Pendenz) => void): void {
    this.stateService.patch(s => {
      const p = s.pendenzen.find(x => x.id === this.pendenz.id);
      if (p) fn(p);
    });
  }

  private recalcDates(p: Pendenz): void {
    const dates = p.eintraege.map(e => e.datum).filter(Boolean).sort();
    p.eroeffnet = dates.length ? dates[0] : '';
    if (p.status === 'erledigt') {
      p.erledigt = dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10);
    }
  }

  updateTitel(value: string): void { this.patch(p => { p.titel = value; }); }
  updateZustaendig(values: string[]): void { this.patch(p => { p.zustaendig = values; }); }
  updateRessort(values: string[]): void { this.patch(p => { p.ressort = values; }); }

  // ── Zuständig Typeahead ──────────────────────────────
  searchZustaendig = (text$: Observable<string>) =>
    merge(text$.pipe(debounceTime(150), distinctUntilChanged()), this.focusZustaendig$).pipe(
      map(term => this.personenService.searchPersonenByName(term))
    );

  resultFormatterZustaendig = (kuerzel: string): string =>
    this.personenService.getPersonLabel(kuerzel);

  onSelectZustaendig(event: any): void {
    event.preventDefault();
    const kuerzel = event.item as string;
    this.zustaendigDisplay = kuerzel;
    this.zustaendigInputValue = '';
    this.updateZustaendig([kuerzel]);
    const funktion = this.personenService.getPersonFunktion(kuerzel);
    if (funktion) {
      this.ressortDisplay = funktion;
      this.updateRessort([funktion]);
    }
  }

  onBlurZustaendig(): void {
    setTimeout(() => {
      const entered = this.zustaendigInputValue.trim();
      if (entered && this.personenService.isValidKuerzel(entered)) {
        this.zustaendigDisplay = entered;
        this.updateZustaendig([entered]);
        const funktion = this.personenService.getPersonFunktion(entered);
        if (funktion) {
          this.ressortDisplay = funktion;
          this.updateRessort([funktion]);
        }
      }
      this.zustaendigInputValue = '';
    }, 200);
  }

  // ── Ressort Typeahead ────────────────────────────────
  searchRessort = (text$: Observable<string>) =>
    merge(text$.pipe(debounceTime(150), distinctUntilChanged()), this.focusRessort$).pipe(
      map(term => this.personenService.getRessortSuggestions(term, []))
    );

  onSelectRessort(event: any): void {
    event.preventDefault();
    const ressort = event.item as string;
    this.ressortDisplay = ressort;
    this.ressortInputValue = '';
    this.updateRessort([ressort]);
  }

  onBlurRessort(): void {
    setTimeout(() => { this.ressortInputValue = ''; }, 200);
  }

  clearZustaendig(): void {
    this.zustaendigDisplay = '';
    this.zustaendigInputValue = '';
    this.updateZustaendig([]);
  }

  clearRessort(): void {
    this.ressortDisplay = '';
    this.ressortInputValue = '';
    this.updateRessort([]);
  }

  // ── Aktionen ─────────────────────────────────────────
  markErledigt(): void {
    const wasArchiviert = this.isArchiviert;
    this.patch(p => { p.status = 'erledigt'; p.archiviert = false; this.recalcDates(p); });
    this.toastService.success(
      wasArchiviert
        ? `Pendenz ${this.pendenz.id} wurde als erledigt wiederhergestellt.`
        : `Pendenz ${this.pendenz.id} wurde als erledigt markiert.`
    );
  }

  markOffen(): void {
    this.patch(p => { p.status = 'offen'; p.erledigt = undefined; });
    this.toastService.info(`Pendenz ${this.pendenz.id} wurde als offen markiert.`);
  }

  markArchiviert(): void {
    this.patch(p => { p.status = 'archiviert'; p.archiviert = true; this.recalcDates(p); });
    this.toastService.info(`Pendenz ${this.pendenz.id} wurde archiviert.`);
  }

  async deletePendenz(): Promise<void> {
    const id = this.pendenz.id;
    const modalRef = this.modal.open(ConfirmDialogComponent, { centered: true });
    modalRef.componentInstance.title = 'Pendenz löschen';
    modalRef.componentInstance.message = `Pendenz ${id} wirklich löschen?`;
    modalRef.componentInstance.confirmLabel = 'Löschen';
    try { await modalRef.result; } catch { return; }
    const snapshot = JSON.parse(JSON.stringify(this.pendenz));
    let insertIdx = -1;
    this.stateService.patchNoHistory(s => {
      insertIdx = s.pendenzen.findIndex(x => x.id === id);
      if (insertIdx >= 0) s.pendenzen.splice(insertIdx, 1);
    });
    const toastService = this.toastService;
    toastService.info(`Pendenz ${id} wurde gelöscht.`, () => {
      this.stateService.patch(s => { s.pendenzen.splice(insertIdx, 0, snapshot); });
      toastService.info(`Pendenz ${id} wurde wiederhergestellt.`);
    });
  }

  addEintrag(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.patch(p => {
      p.eintraege.push({ datum: today, text: '' });
      this.recalcDates(p);
    });
    this.page = 1;
  }

  removeEintrag(idx: number): void {
    const snapshot = JSON.parse(JSON.stringify(this.pendenz.eintraege[idx]));
    this.stateService.patchNoHistory(s => {
      const p = s.pendenzen.find(x => x.id === this.pendenz.id);
      if (p) { p.eintraege.splice(idx, 1); this.recalcDates(p); }
    });
    const toastService = this.toastService;
    toastService.info(`Eintrag vom ${snapshot.datum || '–'} wurde gelöscht.`, () => {
      this.patch(p => { p.eintraege.splice(idx, 0, snapshot); this.recalcDates(p); });
      toastService.info(`Eintrag vom ${snapshot.datum || '–'} wurde wiederhergestellt.`);
    });
  }

  updateEintragDatum(idx: number, value: string): void {
    this.patch(p => { p.eintraege[idx].datum = value; this.recalcDates(p); });
  }

  updateEintragText(idx: number, value: string): void {
    this.patch(p => { p.eintraege[idx].text = value; this.recalcDates(p); });
  }
}
