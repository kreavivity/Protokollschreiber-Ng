import { Injectable } from '@angular/core';
import { AppState } from '../models/state.model';

const STORAGE_KEY = 'protokollschreiber_state';

@Injectable({ providedIn: 'root' })
export class StorageService {

  load(): AppState | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return this.migrate(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  save(state: AppState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  hasData(): boolean {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  sanitizeForExport(state: AppState): Partial<AppState> {
    const s: any = JSON.parse(JSON.stringify(state));
    delete s._uiState;
    if (s.settings) delete s.settings.logo;
    return s;
  }

  migrate(raw: any): AppState {
    const s: AppState = raw;
    if (!s.meta) s.meta = {} as any;
    if (!s.vorstand) s.vorstand = [];
    if (!s.gaeste) s.gaeste = [];
    if (!s.pendenzen) s.pendenzen = [];
    if (s._pendenzCounter === undefined) s._pendenzCounter = 0;
    if (s._pendenzCounterMonth === undefined) s._pendenzCounterMonth = '';
    if (!s.meta.naechsteSitzung) s.meta.naechsteSitzung = { datum: '', uhrzeit: '', adresse: '' };
    if (!s.meta.protokollfuehrung) s.meta.protokollfuehrung = { ort: '', datum: '', name: '' };

    // _uiState is never imported — always rebuild fresh
    s._uiState = {
      collapsedSections: {},
      sortVorstand: { col: null, dir: 'asc' },
      sortGaeste: { col: null, dir: 'asc' },
      sortPersonen: { col: 'funktion', dir: 'vorstand' }
    };

    if (!s.settings) s.settings = { orte: [], personen: [] };
    if (!s.settings.personen) s.settings.personen = [];
    if (!s.settings.orte) s.settings.orte = [];

    (s.vorstand || []).forEach((v: any) => {
      if (!Array.isArray(v.funktion)) v.funktion = v.funktion ? [v.funktion] : [];
      if (!v.status) v.status = 'anwesend';
    });
    (s.gaeste || []).forEach((g: any) => {
      if (!Array.isArray(g.funktion)) g.funktion = g.funktion ? [g.funktion] : [];
    });
    (s.pendenzen || []).forEach((p: any) => {
      if (!Array.isArray(p.zustaendig)) p.zustaendig = p.zustaendig ? [p.zustaendig] : [];
      if (!Array.isArray(p.ressort)) p.ressort = p.ressort ? [p.ressort] : [];
      if (!p.eintraege) p.eintraege = [];
      (p.eintraege || []).forEach((e: any) => {
        if (e.datum && typeof e.datum === 'string') {
          // Strip time component from ISO timestamps (e.g. "2026-03-28T00:00:00" → "2026-03-28")
          if (e.datum.length > 10) e.datum = e.datum.slice(0, 10);
          // Convert DD.MM.YYYY → YYYY-MM-DD
          const dmy = e.datum.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (dmy) e.datum = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
        }
      });
      if (!p.status) {
        if (p.archiviert) p.status = 'archiviert';
        else if (p.erledigt) p.status = 'erledigt';
        else p.status = 'offen';
      }
    });

    return s;
  }
}
