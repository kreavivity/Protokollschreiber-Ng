import { Injectable } from '@angular/core';
import { StateService } from './state.service';

@Injectable({ providedIn: 'root' })
export class PersonenService {
  constructor(private stateService: StateService) {}

  getKuerzelSuggestions(input: string, excludeValues: string[] = []): string[] {
    return this.stateService.getKuerzelList()
      .filter(k => !excludeValues.includes(k) && k.toLowerCase().includes(input.toLowerCase()));
  }

  getRessortSuggestions(input: string, excludeValues: string[] = []): string[] {
    return this.stateService.getRessortList()
      .filter(r => !excludeValues.includes(r) && r.toLowerCase().includes(input.toLowerCase()));
  }

  getOrteSuggestions(input: string): string[] {
    return (this.stateService.state().settings.orte || [])
      .filter(o => o.toLowerCase().includes(input.toLowerCase()));
  }

  /** Search persons by Kürzel, Vorname or Nachname — returns list of unique Kürzel. */
  searchPersonenByName(input: string): string[] {
    const term = (input || '').toLowerCase();
    const seen = new Set<string>();
    const result: string[] = [];
    const add = (kuerzel: string, vorname: string, nachname: string) => {
      if (!kuerzel || seen.has(kuerzel)) return;
      if (!term || kuerzel.toLowerCase().includes(term)
          || (vorname || '').toLowerCase().includes(term)
          || (nachname || '').toLowerCase().includes(term)) {
        seen.add(kuerzel);
        result.push(kuerzel);
      }
    };
    const s = this.stateService.state();
    s.settings.personen.forEach(p => add(p.kuerzel, p.vorname, p.nachname));
    s.vorstand.forEach(v => add(v.kuerzel, v.vorname, v.nachname));
    s.gaeste.forEach(g => add(g.kuerzel, g.vorname, g.nachname));
    return result.sort();
  }

  /** Returns display label "Kürzel Vorname Nachname" for a given Kürzel. */
  getPersonLabel(kuerzel: string): string {
    const s = this.stateService.state();
    const p = [...s.settings.personen, ...s.vorstand, ...s.gaeste].find(x => x.kuerzel === kuerzel);
    if (!p) return kuerzel;
    return [kuerzel, p.vorname, p.nachname].filter(Boolean).join(' ');
  }

  /** Returns true if the given kuerzel exists in the persons list. */
  isValidKuerzel(kuerzel: string): boolean {
    return this.stateService.getKuerzelList().includes(kuerzel);
  }

  /** Returns the Funktion/Ressort for a given Kürzel from settings.personen (primary source). */
  getPersonFunktion(kuerzel: string): string {
    const p = this.stateService.state().settings.personen.find(x => x.kuerzel === kuerzel);
    if (p?.funktion) return p.funktion;
    const v = this.stateService.state().vorstand.find(x => x.kuerzel === kuerzel);
    return v?.funktion?.[0] || '';
  }
}
