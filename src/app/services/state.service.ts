import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { AppState, Pendenz, createDefaultState } from '../models/state.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class StateService {

  private readonly _state = signal<AppState>(createDefaultState());

  /** Signal – direkt in Templates und computed() nutzbar */
  readonly state = this._state.asReadonly();

  /** Observable – für RxJS-Interop (z.B. ngb-typeahead) */
  readonly state$ = toObservable(this._state);

  private _history: AppState[] = [];
  private _pauseHistory = false;

  constructor(private storage: StorageService) {}

  get canUndo(): boolean {
    return this._history.length > 0;
  }

  init(state: AppState): void {
    this._history = [];
    this._state.set(state);
    this.storage.save(state);
  }

  patch(updater: (s: AppState) => void): void {
    if (!this._pauseHistory) {
      this._history.push(JSON.parse(JSON.stringify(this._state())));
      if (this._history.length > 5) this._history.shift();
    }
    const s: AppState = JSON.parse(JSON.stringify(this._state()));
    updater(s);
    this._state.set(s);
    this.saveDebounced();
  }

  /** Patch ohne History-Eintrag (für Löschungen mit eigenem Toast-Undo, und interne Änderungen) */
  patchNoHistory(updater: (s: AppState) => void): void {
    const s: AppState = JSON.parse(JSON.stringify(this._state()));
    updater(s);
    this._state.set(s);
    this.saveDebounced();
  }

  undo(): boolean {
    const prev = this._history.pop();
    if (!prev) return false;
    this._pauseHistory = true;
    this._state.set(prev);
    this.saveDebounced();
    this._pauseHistory = false;
    return true;
  }

  private _saveTimer: any;
  saveDebounced(): void {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.storage.save(this._state()), 500);
  }

  saveNow(): void {
    clearTimeout(this._saveTimer);
    this.storage.save(this._state());
  }

  generatePendenzId(): string {
    const d = this.state().meta.datum
      ? new Date(this.state().meta.datum + 'T00:00:00')
      : new Date();
    const year = String(d.getFullYear()).slice(-2);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const prefix = `H${year}${month}`;
    const usedIds = new Set(this.state().pendenzen.map(p => p.id));
    if (![...usedIds].some(id => id?.startsWith(prefix))) {
      this.patchNoHistory(s => { s._pendenzCounter = 0; });
    }
    let counter = this.state()._pendenzCounter;
    let candidate: string;
    do {
      counter++;
      candidate = prefix + String(counter).padStart(2, '0');
    } while (usedIds.has(candidate));
    this.patchNoHistory(s => { s._pendenzCounter = counter; });
    return candidate;
  }

  getKuerzelList(): string[] {
    const set = new Set<string>();
    this.state().settings.personen.forEach(p => { if (p.kuerzel) set.add(p.kuerzel); });
    this.state().vorstand.forEach(v => { if (v.kuerzel) set.add(v.kuerzel); });
    this.state().gaeste.forEach(g => { if (g.kuerzel) set.add(g.kuerzel); });
    return [...set].sort();
  }

  getRessortList(): string[] {
    const set = new Set<string>();
    this.state().settings.personen.forEach(p => { if (p.funktion) set.add(p.funktion); });
    this.state().vorstand.forEach(v => v.funktion.forEach(f => { if (f) set.add(f); }));
    return [...set].sort();
  }

  syncPersonenFromVorstandGaeste(): void {
    const s = this.state();
    [...s.vorstand, ...s.gaeste].forEach(m => {
      if (!m.vorname?.trim() && !m.nachname?.trim()) return;
      const exists = s.settings.personen.some(p =>
        p.vorname.trim().toLowerCase() === (m.vorname || '').trim().toLowerCase() &&
        p.nachname.trim().toLowerCase() === (m.nachname || '').trim().toLowerCase()
      );
      if (!exists) {
        const funktion = Array.isArray(m.funktion) ? (m.funktion[0] || '') : '';
        this.patch(st => {
          st.settings.personen.push({ kuerzel: m.kuerzel || '', vorname: m.vorname || '', nachname: m.nachname || '', funktion });
        });
      }
    });
  }

  getPendenzCountByPerson(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.state().pendenzen.forEach(p => {
      (p.zustaendig || []).forEach(k => { if (k) counts[k] = (counts[k] || 0) + 1; });
    });
    return counts;
  }
}
