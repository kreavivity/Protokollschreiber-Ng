import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { StateService } from '../../services/state.service';
import { AppState, Pendenz } from '../../models/state.model';
import { PendenzCardComponent } from './pendenz-card/pendenz-card.component';

type FilterStatus = 'offen' | 'erledigt' | 'archiviert';
type SortKey = 'ressort' | 'zustaendig' | 'id';

@Component({
  selector: 'app-pendenzen',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbTooltipModule, PendenzCardComponent],
  templateUrl: './pendenzen.component.html'
})
export class PendenzenComponent {
  private readonly stateService = inject(StateService);

  /** Liest das Signal – Template bleibt unverändert (state.X) */
  get state(): AppState { return this.stateService.state(); }

  activeFilters: Set<FilterStatus> = new Set(['offen', 'erledigt']);
  searchText = '';
  sortBy: SortKey = 'ressort';
  sortDirs: { ressort: 'asc' | 'desc' | 'protokoll'; zustaendig: 'asc' | 'desc'; id: 'asc' | 'desc' } = {
    ressort: 'protokoll', zustaendig: 'asc', id: 'asc'
  };
  activePendenzId: string | null = null;

  @HostListener('window:scroll')
  onScroll(): void {
    const offset = 220;
    for (const p of this.filteredPendenzen) {
      const el = document.getElementById('pendenz-' + p.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= offset && rect.bottom > offset) {
          this.activePendenzId = p.id ?? null;
          return;
        }
      }
    }
  }

  getStatus(p: Pendenz): FilterStatus {
    if (p.status) return p.status;
    if (p.archiviert) return 'archiviert';
    if (p.erledigt) return 'erledigt';
    return 'offen';
  }

  setSortBy(key: SortKey): void {
    if (this.sortBy === key) {
      if (key === 'ressort') {
        const cycle = ['asc', 'desc', 'protokoll'] as const;
        const idx = cycle.indexOf(this.sortDirs.ressort);
        this.sortDirs = { ...this.sortDirs, ressort: cycle[(idx + 1) % cycle.length] };
      } else if (key === 'zustaendig') {
        this.sortDirs = { ...this.sortDirs, zustaendig: this.sortDirs.zustaendig === 'asc' ? 'desc' : 'asc' };
      } else {
        this.sortDirs = { ...this.sortDirs, id: this.sortDirs.id === 'asc' ? 'desc' : 'asc' };
      }
    } else {
      this.sortBy = key;
      this.activePendenzId = null;
    }
  }

  getSortIcon(key: SortKey): string {
    if (key === 'ressort' && this.sortDirs.ressort === 'protokoll') return '⇌';
    return (this.sortDirs[key] as string) === 'asc' ? '↓' : '↑';
  }

  get ressortOrder(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const v of this.state.vorstand) {
      for (const f of (v.funktion || [])) {
        if (f && !seen.has(f)) { seen.add(f); result.push(f); }
      }
    }
    return result;
  }

  toggleFilter(status: FilterStatus): void {
    const next = new Set(this.activeFilters);
    if (next.has(status)) {
      if (next.size > 1) next.delete(status);
    } else {
      next.add(status);
    }
    this.activeFilters = next;
  }

  isFilterActive(status: FilterStatus): boolean {
    return this.activeFilters.has(status);
  }

  get filteredPendenzen(): Pendenz[] {
    let list = this.state.pendenzen.filter(p => this.activeFilters.has(this.getStatus(p)));
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      list = list.filter(p =>
        (p.id || '').toLowerCase().includes(q) ||
        (p.titel || '').toLowerCase().includes(q) ||
        (p.zustaendig || []).some(z =>
          z.toLowerCase().includes(q) || this.getPersonLabel(z).toLowerCase().includes(q)
        ) ||
        (p.ressort || []).some(r => r.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      if (this.sortBy === 'id') {
        const cmp = (a.id || '').localeCompare(b.id || '');
        return this.sortDirs.id === 'asc' ? cmp : -cmp;
      }
      if (this.sortBy === 'zustaendig') {
        const cmp = this.getVorname(a.zustaendig?.[0] || '').localeCompare(this.getVorname(b.zustaendig?.[0] || ''));
        return this.sortDirs.zustaendig === 'asc' ? cmp : -cmp;
      }
      if (this.sortBy === 'ressort') {
        if (this.sortDirs.ressort === 'protokoll') {
          const order = this.ressortOrder;
          const rankA = order.indexOf(a.ressort?.[0] || '');
          const rankB = order.indexOf(b.ressort?.[0] || '');
          return (rankA === -1 ? Infinity : rankA) - (rankB === -1 ? Infinity : rankB);
        }
        const cmp = (a.ressort?.[0] || '').localeCompare(b.ressort?.[0] || '');
        return this.sortDirs.ressort === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }

  countByStatus(status: FilterStatus): number {
    return this.state.pendenzen.filter(p => this.getStatus(p) === status).length;
  }

  getBadgeColor(p: Pendenz): string {
    const status = this.getStatus(p);
    if (status === 'offen') return 'var(--rot)';
    if (status === 'erledigt') return 'var(--blau)';
    return 'var(--grau-mittel)';
  }

  get ressortGroups(): { label: string; ressort: string; firstId: string; count: number }[] {
    const seen = new Map<string, { label: string; ressort: string; firstId: string; count: number }>();
    for (const p of this.filteredPendenzen) {
      const r = p.ressort?.[0] ?? '';
      if (!seen.has(r)) {
        seen.set(r, { label: r || '(kein Ressort)', ressort: r, firstId: p.id ?? '', count: 1 });
      } else {
        seen.get(r)!.count++;
      }
    }
    return Array.from(seen.values());
  }

  isRessortGroupActive(ressort: string): boolean {
    if (!this.activePendenzId) return false;
    const active = this.filteredPendenzen.find(p => p.id === this.activePendenzId);
    return (active?.ressort?.[0] ?? '') === ressort;
  }

  get zustaendigGroups(): { label: string; kuerzel: string; firstId: string; count: number }[] {
    const seen = new Map<string, { label: string; kuerzel: string; firstId: string; count: number }>();
    for (const p of this.filteredPendenzen) {
      const k = p.zustaendig?.[0] ?? '';
      if (!seen.has(k)) {
        seen.set(k, { label: this.getPersonLabel(k), kuerzel: k, firstId: p.id ?? '', count: 1 });
      } else {
        seen.get(k)!.count++;
      }
    }
    return Array.from(seen.values());
  }

  isZustaendigGroupActive(kuerzel: string): boolean {
    if (!this.activePendenzId) return false;
    const active = this.filteredPendenzen.find(p => p.id === this.activePendenzId);
    return (active?.zustaendig?.[0] ?? '') === kuerzel;
  }

  private getVorname(kuerzel: string): string {
    if (!kuerzel) return '';
    const vm = this.state.vorstand.find(v => v.kuerzel === kuerzel);
    if (vm) return vm.vorname || vm.nachname || kuerzel;
    const p = this.state.settings.personen.find(p => p.kuerzel === kuerzel);
    if (p) return p.vorname || p.nachname || kuerzel;
    return kuerzel;
  }

  getSortTooltip(key: SortKey): string {
    if (key === 'ressort') {
      return '↓ = A–Z  |  ↑ = Z–A  |  ⇌ = Reihenfolge gemäss Vorstandsliste\nErneuter Klick wechselt den Modus.';
    }
    if (key === 'zustaendig') {
      return '↓ = Vorname A–Z  |  ↑ = Vorname Z–A\nErneuter Klick wechselt die Richtung.';
    }
    return '↓ = aufsteigend (H-001 zuerst)  |  ↑ = absteigend\nErneuter Klick wechselt die Richtung.';
  }

  private getPersonLabel(kuerzel: string): string {
    if (!kuerzel) return '(unbekannt)';
    const vm = this.state.vorstand.find(v => v.kuerzel === kuerzel);
    if (vm) return `(${kuerzel}) ${vm.vorname} ${vm.nachname}`.trim();
    const p = this.state.settings.personen.find(p => p.kuerzel === kuerzel);
    if (p) return `(${kuerzel}) ${p.vorname} ${p.nachname}`.trim();
    return kuerzel;
  }

  scrollToPendenz(id: string | undefined): void {
    if (!id) return;
    this.activePendenzId = id;
    document.getElementById('pendenz-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  addPendenz(): void {
    const id = this.stateService.generatePendenzId();
    const today = new Date().toISOString().slice(0, 10);
    this.stateService.patch(s => {
      s.pendenzen.push({
        id, titel: '', zustaendig: [], ressort: [],
        eroeffnet: today, eintraege: [{ datum: today, text: '' }], status: 'offen'
      });
    });
    setTimeout(() => {
      document.getElementById('pendenz-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}
