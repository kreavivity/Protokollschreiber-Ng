import { Injectable, inject } from '@angular/core';
import { AppState, Pendenz } from '../models/state.model';
import { StorageService } from './storage.service';
import { StateService } from './state.service';
import { marked } from 'marked';

marked.use({ breaks: true });

const RED    = '#8B1F1F';
const BLUE   = '#1a3a6b';
const WHITE  = '#ffffff';
const GREEN  = '#27ae60';
const RED_SOFT  = '#c0392b';
const GREY_TEXT = '#666666';
const GREY_LINE = '#e0e0e0';
const GREY_BG   = '#f9f9f9';
const GREY_MID  = '#555555';
const GREY_CELL = '#aaaaaa';

// Seitenmaße A4 in pt (595.28 × 841.89)
// Ränder: links 18 mm ≈ 51 pt, rechts 16 mm ≈ 45 pt → Inhaltsbreite ≈ 499 pt
const CONTENT_WIDTH = 499;

@Injectable({ providedIn: 'root' })
export class ExportService {

  private readonly storage = inject(StorageService);
  private readonly stateService = inject(StateService);

  downloadJSON(): void {
    const data = this.storage.sanitizeForExport(this.stateService.state());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.getFilenameBase() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async downloadPDF(): Promise<void> {
    const [pdfMakeMod, vfsMod] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts')
    ]);
    const pdfMake = (pdfMakeMod as any).default ?? pdfMakeMod;
    const vfs    = (vfsMod as any).default ?? vfsMod;
    pdfMake.addVirtualFileSystem(vfs);

    const state        = this.stateService.state();
    const filenameBase = this.getFilenameBase();
    const docDef       = this.buildPdfmakeDoc(state, filenameBase);

    await pdfMake.createPdf(docDef).download(filenameBase + '.pdf');
  }

  // ─── Dokument-Definition ────────────────────────────────────────────────────

  private buildPdfmakeDoc(state: AppState, filenameBase: string): any {
    const m      = state.meta;
    const pfDate = m.protokollfuehrung?.datum ? this.formatDate(m.protokollfuehrung.datum) : '';
    const dateStr = m.datum
      ? `${this.formatDate(m.datum)}, ${m.zeitVon || ''} bis ${m.zeitBis || ''} Uhr`
      : '';

    const content: any[] = [
      ...this.buildHeader(m, dateStr),
      ...this.buildInfoBlocks(m, dateStr),
      ...this.buildVorstandTable(state),
      ...this.buildGaesteTable(state),
      ...this.buildSignatureSection(m, pfDate),
      ...this.buildPendenzenSection(state),
    ];

    return {
      pageSize: 'A4',
      pageMargins: [51, 45, 45, 48],
      footer: this.buildFooter(filenameBase, pfDate),
      content,
      fonts: {
        Roboto: {
          normal:      'Roboto-Regular.ttf',
          bold:        'Roboto-Medium.ttf',
          italics:     'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        }
      },
      defaultStyle: { font: 'Roboto', fontSize: 10, color: '#000000' }
    };
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(m: AppState['meta'], dateStr: string): any[] {
    const logoSrc = m.logo
      ? (m.logo.startsWith('data:') ? m.logo : `data:image/jpeg;base64,${m.logo}`)
      : null;

    return [
      {
        columns: [
          {
            stack: [
              { text: m.titel || 'Protokoll', fontSize: 22, bold: true, color: RED },
              { text: m.untertitel || '', fontSize: 12, color: '#333333', margin: [0, 3, 0, 0] }
            ]
          },
          logoSrc
            ? { image: logoSrc, width: 80, alignment: 'right', margin: [0, 0, 0, 0] }
            : { text: '' }
        ],
        margin: [0, 0, 0, 8]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 3, lineColor: RED }], margin: [0, 0, 0, 10] }
    ];
  }

  // ─── Info-Blöcke ────────────────────────────────────────────────────────────

  private buildInfoBlocks(m: AppState['meta'], dateStr: string): any[] {
    const blocks: any[] = [];
    if (dateStr) {
      blocks.push(this.infoBlock('DATUM / ZEIT', dateStr));
    }
    if (m.ort) {
      blocks.push(this.infoBlock('ORT', m.ort));
    }
    return blocks;
  }

  private infoBlock(label: string, value: string): any {
    return {
      stack: [
        { text: label, fontSize: 7, bold: true, color: RED, margin: [0, 0, 0, 1] },
        { text: value, fontSize: 10 }
      ],
      margin: [0, 0, 0, 8]
    };
  }

  // ─── Vorstand-Tabelle ────────────────────────────────────────────────────────

  private buildVorstandTable(state: AppState): any[] {
    if (!state.vorstand?.length) return [];

    const headerRow = ['Name', 'Kürzel', 'Ressort / Funktion', 'Teilnahme']
      .map(t => ({ text: t, bold: true, color: WHITE, fontSize: 8.5 }));

    const dataRows = state.vorstand.map((v, i) => {
      const name = [v.vorname, v.nachname].filter(Boolean).join(' ');
      const funk = (v.funktion || []).join(', ');
      const entschuldigt = v.status === 'entschuldigt';
      const bg = i % 2 !== 0 ? GREY_BG : null;
      return [
        { text: name,  fontSize: 9.5, fillColor: bg },
        { text: v.kuerzel, fontSize: 9.5, fillColor: bg },
        { text: funk,  fontSize: 9.5, fillColor: bg },
        { text: entschuldigt ? '● entschuldigt' : '● anwesend',
          color: entschuldigt ? RED_SOFT : GREEN, fontSize: 9.5, fillColor: bg }
      ];
    });

    return [
      this.sectionLabel('Vorstand'),
      {
        table: { widths: ['42%', '12%', '28%', '18%'], body: [headerRow, ...dataRows] },
        layout: this.tableLayout(RED),
        margin: [0, 0, 0, 10]
      }
    ];
  }

  // ─── Gäste-Tabelle ──────────────────────────────────────────────────────────

  private buildGaesteTable(state: AppState): any[] {
    if (!state.gaeste?.length) return [];

    const headerRow = ['Name', 'Kürzel', 'Funktion']
      .map(t => ({ text: t, bold: true, color: WHITE, fontSize: 8.5 }));

    const dataRows = state.gaeste.map((g, i) => {
      const name = [g.vorname, g.nachname].filter(Boolean).join(' ');
      const bg = i % 2 !== 0 ? GREY_BG : null;
      return [
        { text: name, fontSize: 9.5, fillColor: bg },
        { text: g.kuerzel || '', fontSize: 9.5, fillColor: bg },
        { text: (g.funktion || []).join(', '), fontSize: 9.5, fillColor: bg }
      ];
    });

    return [
      this.sectionLabel('Gäste'),
      {
        table: { widths: ['42%', '12%', '46%'], body: [headerRow, ...dataRows] },
        layout: this.tableLayout(RED),
        margin: [0, 0, 0, 10]
      }
    ];
  }

  // ─── Protokollführung / Nächste Sitzung ─────────────────────────────────────

  private buildSignatureSection(m: AppState['meta'], pfDate: string): any[] {
    const pf = m.protokollfuehrung || { ort: '', datum: '', name: '' };
    const ns = m.naechsteSitzung  || { datum: '', uhrzeit: '', adresse: '' };
    const nsDate   = ns.datum ? this.formatDate(ns.datum) : '';
    const pfLocDat = [pf.ort, pfDate].filter(Boolean).join(', ');
    const nsDateUhr = nsDate
      ? nsDate + (ns.uhrzeit ? ', ' + ns.uhrzeit + ' Uhr' : '')
      : '–';

    return [{
      columns: [
        {
          stack: [
            { text: 'PROTOKOLLFÜHRUNG', fontSize: 7, bold: true, color: RED, margin: [0, 0, 0, 4] },
            { text: pfLocDat, fontSize: 9 },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: '#333333' }], margin: [0, 30, 0, 2] },
            { text: pf.name || '', fontSize: 8.5, color: GREY_TEXT }
          ]
        },
        {
          stack: [
            { text: 'NÄCHSTE SITZUNG', fontSize: 7, bold: true, color: RED, margin: [0, 0, 0, 4] },
            { text: nsDateUhr, fontSize: 9 },
            ns.adresse ? { text: ns.adresse, fontSize: 9, margin: [0, 4, 0, 0] } : { text: '' }
          ]
        }
      ],
      margin: [0, 16, 0, 0]
    }];
  }

  // ─── Pendenzenliste ──────────────────────────────────────────────────────────

  private buildPendenzenSection(state: AppState): any[] {
    const aktive = (state.pendenzen || [])
      .filter(p => p.status !== 'archiviert' && !p.archiviert);

    if (!aktive.length) return [];

    return [
      { text: '', pageBreak: 'before' },
      { text: 'Pendenzenliste', fontSize: 14, bold: true, color: RED, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 2, lineColor: RED }], margin: [0, 0, 0, 12] },
      ...aktive.map(p => this.buildPendenzCard(p))
    ];
  }

  private buildPendenzCard(p: Pendenz): any {
    const isErledigt = p.status === 'erledigt' || (!!p.erledigt && !p.archiviert);
    const cardColor  = isErledigt ? BLUE : RED;

    const eintragItems = (p.eintraege || []).map(e => ({
      columns: [
        { text: (this.formatDate(e.datum || '') || e.datum || '') + ':', bold: true, color: cardColor, width: 'auto', fontSize: 9, margin: [0, 0, 5, 0] },
        { stack: this.markdownToContent(e.text || ''), width: '*', fontSize: 9 }
      ],
      margin: [0, 0, 0, 3]
    }));

    const headerCell = {
      columns: [
        { text: p.titel || '(kein Titel)', bold: true, color: WHITE, fontSize: 10, width: '*' },
        { text: p.id || '', color: WHITE, fontSize: 9, alignment: 'right', width: 'auto' }
      ],
      fillColor: cardColor,
      margin: [10, 5, 10, 5]
    };

    const metaCell = {
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [[
          this.metaCell('Zuständig', (p.zustaendig || []).join(', ') || '–'),
          this.metaCell('Ressort',   (p.ressort    || []).join(', ') || '–'),
          this.metaCell('Eröffnet',  this.formatDate(p.eroeffnet || '') || '–'),
          this.metaCell('Erledigt',  p.erledigt ? this.formatDate(p.erledigt) : '–')
        ]]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: (i: number) => (i > 0 && i < 4) ? 0.5 : 0,
        vLineColor: () => GREY_CELL,
        paddingLeft:   () => 8,
        paddingRight:  () => 8,
        paddingTop:    () => 4,
        paddingBottom: () => 4
      }
    };

    const eintragCell = {
      stack: eintragItems.length
        ? eintragItems
        : [{ text: 'Keine Einträge', italics: true, fontSize: 9, color: GREY_TEXT }],
      margin: [10, 5, 10, 6]
    };

    return {
      stack: [{
        table: {
          widths: ['*'],
          body: [[headerCell], [metaCell], [eintragCell]]
        },
        layout: {
          hLineWidth: (i: number) => (i === 0 || i === 3) ? 0 : 0.5,
          vLineWidth: (i: number) => i === 0 ? 4 : 0,
          vLineColor: () => cardColor,
          hLineColor: () => GREY_CELL
        }
      }],
      unbreakable: true,
      margin: [0, 0, 0, 12]
    };
  }

  private metaCell(label: string, value: string): any {
    return {
      stack: [
        { text: label, fontSize: 7.5, bold: true, color: GREY_MID },
        { text: value, fontSize: 8.5 }
      ]
    };
  }

  // ─── Footer ─────────────────────────────────────────────────────────────────

  private buildFooter(filenameBase: string, pfDate: string): (page: number, pages: number) => any {
    return (currentPage: number, pageCount: number) => ({
      margin: [51, 4, 45, 0],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.2, lineColor: '#c8c8c8' }] },
        {
          columns: [
            { text: filenameBase, fontSize: 7, color: GREY_TEXT },
            { text: pfDate,       fontSize: 7, color: GREY_TEXT, alignment: 'center' },
            { text: `Seite ${currentPage} von ${pageCount}`, fontSize: 7, color: GREY_TEXT, alignment: 'right' }
          ],
          margin: [0, 2, 0, 0]
        }
      ]
    });
  }

  // ─── Markdown → pdfmake ─────────────────────────────────────────────────────

  private markdownToContent(md: string): any[] {
    const html   = marked.parse(md) as string;
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, 'text/html');
    return this.nodesToContent(doc.body.childNodes);
  }

  private nodesToContent(nodes: NodeList): any[] {
    const result: any[] = [];
    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent?.trim();
        if (t) result.push({ text: t });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el  = node as Element;
        const tag = el.tagName.toLowerCase();
        if (tag === 'p') {
          result.push({ text: this.inlineNodes(el.childNodes), margin: [0, 0, 0, 2] });
        } else if (tag === 'ul') {
          result.push({ ul: this.listItems(el), margin: [0, 2, 0, 2] });
        } else if (tag === 'ol') {
          result.push({ ol: this.listItems(el), margin: [0, 2, 0, 2] });
        } else {
          const t = el.textContent?.trim();
          if (t) result.push({ text: t });
        }
      }
    });
    return result;
  }

  private inlineNodes(nodes: NodeList): any[] {
    const result: any[] = [];
    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent;
        if (t) result.push(t);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el  = node as Element;
        const tag = el.tagName.toLowerCase();
        const inner = this.inlineNodes(el.childNodes);
        if (tag === 'strong' || tag === 'b') {
          result.push({ text: inner, bold: true });
        } else if (tag === 'em' || tag === 'i') {
          result.push({ text: inner, italics: true });
        } else {
          result.push({ text: inner });
        }
      }
    });
    return result;
  }

  private listItems(el: Element): any[] {
    return Array.from(el.querySelectorAll('li'))
      .map(li => ({ text: this.inlineNodes(li.childNodes) }));
  }

  // ─── Shared Layouts ─────────────────────────────────────────────────────────

  private tableLayout(headerColor: string): any {
    return {
      fillColor:     (row: number) => row === 0 ? headerColor : null,
      hLineWidth:    () => 0.5,
      vLineWidth:    () => 0,
      hLineColor:    () => GREY_LINE,
      paddingLeft:   () => 8,
      paddingRight:  () => 8,
      paddingTop:    () => 3,
      paddingBottom: () => 3
    };
  }

  private sectionLabel(text: string): any {
    return {
      text,
      fontSize: 9, bold: true, color: RED,
      margin: [0, 10, 0, 3]
    };
  }

  // ─── Hilfsmethoden ──────────────────────────────────────────────────────────

  private getFilenameBase(): string {
    const m = this.stateService.state().meta;
    const datePart = m.datum ? m.datum.replace(/-/g, '') : '';
    return [datePart, m.titel || 'Protokoll', m.untertitel]
      .filter(Boolean).join(' ').replace(/[\/\\:*?"<>|]/g, '_');
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }
}
