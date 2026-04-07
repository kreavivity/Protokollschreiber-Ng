# Protokollschreiber

Eine Angular-Webanwendung zum Erstellen und Verwalten von Vereinsprotokollen mit integrierter Pendenz-Verwaltung. Läuft vollständig im Browser – kein Server, keine Registrierung.

---

## Features

### Protokoll

- Datum, Uhrzeit (Von/Bis), Ort, Protokollführung und nächste Sitzung erfassen
- Vorstand- und Gästeliste mit Drag & Drop sortieren
- Anwesenheit je Person mit Status-Toggle (anwesend / entschuldigt) verwalten
- Logo hochladen für den PDF-Export

### Pendenzen

- Pendenzen mit Titel, Zuständigem, Ressort und chronologischen Einträgen führen
- Einträge unterstützen Markdown-Formatierung (fett, kursiv, Listen)
- Status: offen → erledigt → archiviert
- Filterung nach Status (Offen, Erledigt, Archiv) mit Zähler-Badge
- Sortierung nach Ressort, Zuständig oder H-Nummer
- Sidebar mit klickbaren Schnellsprung-Badges; bei Gruppen-Sortierung mit Anzahl zugeordneter Pendenzen
- Suche nach H-Nummer, Titel, Kürzel, Vor-/Nachname oder Ressort

### Export

- **PDF** — Protokoll und Pendenzenliste als formatiertes Druckdokument (via html2pdf.js)
- **JSON** — Vollständige Datensicherung; kann für eine neue Sitzung wiederhergestellt werden

### Einstellungen

- Zentrale Personenliste (Kürzel, Vor-/Nachname, Funktion) — wird für Typeahead in Pendenzen verwendet
- Sitzungsorte verwalten
- Logo für den PDF-Export hinterlegen

### Komfort

- **Automatisches Speichern** im Browser-LocalStorage nach jeder Änderung
- **Undo** — Letzte 5 Änderungen mit `Ctrl+Z` rückgängig machen
- **Toast-Undo** — Gelöschte Pendenzen und Einträge kurzzeitig wiederherstellen
- Typeahead für Zuständige und Ressorts

---

## Technologie

| Paket | Version | Verwendung |
| --- | --- | --- |
| [Angular](https://angular.dev) | 21 | Framework (Standalone Components, Signals, `@for`/`@if`) |
| [ng-bootstrap](https://ng-bootstrap.github.io) | 20 | Modals, Toasts, Typeahead, Tooltips, Pagination |
| [Bootstrap](https://getbootstrap.com) | 5 | CSS-Framework |
| [Angular CDK](https://material.angular.io/cdk) | 21 | Drag & Drop |
| [marked](https://marked.js.org) | 17 | Markdown-Rendering in Pendenz-Einträgen |
| [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) | 0.10 | PDF-Export (via CDN) |

---

## Lokale Entwicklung

```bash
npm install
ng serve
```

App unter `http://localhost:4200/` aufrufen.

## Build

```bash
ng build
```

Build-Artefakte werden im Verzeichnis `dist/` ausgegeben.

---

## Projektstruktur

```text
src/app/
├── components/
│   ├── editor/              # Haupt-Shell mit Toolbar, Tabs und Export-Buttons
│   ├── protokolldetails/    # Formular für Protokollmetadaten und Teilnehmerlisten
│   ├── pendenzen/           # Pendenzenliste mit Toolbar, Filter, Sidebar
│   │   └── pendenz-card/    # Einzelne Pendenz-Karte mit Einträgen und Aktionen
│   ├── einstellungen/       # Einstellungs-Modal (Personen, Orte, Logo)
│   ├── start/               # Startseite (Neu erstellen / JSON laden)
│   └── shared/              # Wiederverwendbare UI-Komponenten
├── services/
│   ├── state.service.ts     # Zentraler App-State (Signal-basiert, Undo-History)
│   ├── storage.service.ts   # LocalStorage-Persistenz
│   ├── export.service.ts    # PDF- und JSON-Export
│   ├── personen.service.ts  # Suche und Auflösung von Personen-Kürzeln
│   └── toast.service.ts     # Toast-Benachrichtigungen
└── models/
    └── state.model.ts       # TypeScript-Interfaces für den gesamten App-State
```

---

## Issues & Feedback

Fehler gefunden oder Erweiterungswunsch? → [GitHub Issues](https://github.com/kreavivity/Protokollschreiber-Ng/issues)
