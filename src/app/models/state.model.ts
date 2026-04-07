export type TeilnahmeStatus = 'anwesend' | 'entschuldigt';
export type PendenzStatus = 'offen' | 'erledigt' | 'archiviert';
export type SortDir = 'asc' | 'desc';

export interface VorstandMitglied {
  nachname: string;
  vorname: string;
  kuerzel: string;
  status: TeilnahmeStatus;
  funktion: string[];
}

export interface Gast {
  nachname: string;
  vorname: string;
  kuerzel: string;
  funktion: string[];
}

export interface PendenzEintrag {
  datum: string;
  text: string;
}

export interface Pendenz {
  id: string;
  titel: string;
  zustaendig: string[];
  ressort: string[];
  eroeffnet?: string;
  erledigt?: string;
  eintraege: PendenzEintrag[];
  status?: PendenzStatus;
  archiviert?: boolean;
}

export interface MetaDaten {
  titel: string;
  untertitel: string;
  logo?: string;
  datum: string;
  zeitVon: string;
  zeitBis: string;
  ort: string;
  protokollfuehrung: { ort: string; datum: string; name: string; };
  naechsteSitzung: { datum: string; uhrzeit: string; adresse: string; };
}

export interface Person {
  kuerzel: string;
  vorname: string;
  nachname: string;
  funktion: string;
}

export interface Settings {
  orte: string[];
  personen: Person[];
}

export interface UiState {
  collapsedSections: Record<string, boolean>;
  sortVorstand: { col: string | null; dir: SortDir };
  sortGaeste: { col: string | null; dir: SortDir };
  sortPersonen: { col: string; dir: string };
}

export interface AppState {
  meta: MetaDaten;
  vorstand: VorstandMitglied[];
  gaeste: Gast[];
  pendenzen: Pendenz[];
  settings: Settings;
  _pendenzCounter: number;
  _pendenzCounterMonth: string;
  _uiState: UiState;
}

export function createDefaultState(): AppState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    meta: {
      titel: 'Protokoll',
      untertitel: '3. Vorstandssitzung 2026',
      datum: today,
      zeitVon: '18:00',
      zeitBis: '22:00',
      ort: '',
      protokollfuehrung: { ort: '', datum: today, name: '' },
      naechsteSitzung: { datum: '', uhrzeit: '', adresse: '' }
    },
    vorstand: [{ nachname: '', vorname: '', kuerzel: '', status: 'anwesend', funktion: [] }],
    gaeste: [],
    pendenzen: [],
    settings: { orte: [], personen: [] },
    _pendenzCounter: 0,
    _pendenzCounterMonth: '',
    _uiState: {
      collapsedSections: {},
      sortVorstand: { col: null, dir: 'asc' },
      sortGaeste: { col: null, dir: 'asc' },
      sortPersonen: { col: 'funktion', dir: 'vorstand' }
    }
  };
}
