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
const RED_LIGHT = '#f3e9e9';
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
      ...this.buildHeader(m),
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

  private buildHeader(m: AppState['meta']): any[] {
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
      .filter(p => p.status !== 'archiviert');

    if (!aktive.length) return [];

    return [
      { text: '', pageBreak: 'before' },
      { text: 'Pendenzenliste', fontSize: 14, bold: true, color: RED, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 2, lineColor: RED }], margin: [0, 0, 0, 12] },
      ...aktive.map(p => this.buildPendenzCard(p))
    ];
  }

  private buildPendenzCard(p: Pendenz): any {
    const isErledigt = p.status === 'erledigt';
    const cardColor  = isErledigt ? BLUE : RED;

    const eintragItems = [...(p.eintraege || [])]
      .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))
      .map(e => ({
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

  // ─── Markdown → pdfmake (via marked AST) ───────────────────────────────────
  // DOM Parser konnte die Markdown-Formatierung im Export nicht korrekt darstellen
  
  private markdownToContent(md: string): any[] {
    const tokens = marked.lexer(this.preprocessPendenzRefs(md));
    return this.blockTokens(tokens);
  }

  /** Replaces [#H260221] with [(status) H260221: Titel](pref:H260221) so marked
   *  parses it as a link token that inlineToken() can render as a coloured badge. */
  private preprocessPendenzRefs(md: string): string {
    const pendenzen = this.stateService.state().pendenzen;
    return md.replace(/\[#([A-Z][A-Z0-9]*)\]/g, (_, id: string) => {
      const p = pendenzen.find(x => x.id === id);
      const status = p?.status ?? 'offen';
      const label = p
        ? `(${status}) ${id}${p.titel ? ': ' + p.titel : ''}`
        : `(?) ${id}`;
      return `[${label}](pref:${id})`;
    });
  }

  private blockTokens(tokens: any[]): any[] {
    const result: any[] = [];
    for (const token of tokens) {
      switch (token.type) {
        case 'paragraph':
          result.push(...this.paragraphToBlocks(token.tokens ?? []));
          break;
        case 'heading': {
          const sizes: Record<number, number> = { 1: 13, 2: 11, 3: 10, 4: 9, 5: 9, 6: 9 };
          result.push({
            text: this.inlineTokens(token.tokens ?? []),
            bold: true,
            fontSize: sizes[token.depth] ?? 9,
            margin: [0, 4, 0, 2]
          });
          break;
        }
        case 'list':
          result.push(this.buildList(token));
          break;
        case 'hr':
          result.push({
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: GREY_LINE }],
            margin: [0, 4, 0, 4]
          });
          break;
        case 'blockquote':
          result.push({ stack: this.blockTokens(token.tokens ?? []), margin: [6, 2, 0, 2], color: GREY_TEXT });
          break;
        case 'code':
          result.push({
            table: {
              widths: ['*'],
              body: [[{ text: token.text, fontSize: 8, color: '#000000', fillColor: RED_LIGHT }]]
            },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft:   () => 8,
              paddingRight:  () => 8,
              paddingTop:    () => 5,
              paddingBottom: () => 5
            },
            margin: [0, 2, 0, 6]
          });
          break;
        case 'table': {
          const alignMap: Record<string, string> = { left: 'left', center: 'center', right: 'right' };
          const widths = (token.header as any[]).map(() => '*');
          const headerRow = (token.header as any[]).map((cell: any, i: number) => ({
            text: this.inlineTokens(cell.tokens ?? []),
            bold: true,
            color: WHITE,
            fillColor: RED,
            alignment: alignMap[token.align?.[i]] ?? 'left',
            fontSize: 8.5
          }));
          const dataRows = (token.rows as any[][]).map((row, ri) =>
            row.map((cell: any, i: number) => ({
              text: this.inlineTokens(cell.tokens ?? []),
              alignment: alignMap[token.align?.[i]] ?? 'left',
              fontSize: 8.5,
              fillColor: ri % 2 !== 0 ? GREY_BG : null
            }))
          );
          result.push({
            table: { headerRows: 1, widths, body: [headerRow, ...dataRows] },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0,
              hLineColor: () => GREY_LINE,
              paddingLeft:   () => 6,
              paddingRight:  () => 6,
              paddingTop:    () => 3,
              paddingBottom: () => 3
            },
            margin: [0, 2, 0, 4]
          });
          break;
        }
        case 'space':
          break;
      }
    }
    return result;
  }

  private paragraphToBlocks(tokens: any[]): any[] {
    const result: any[] = [];
    let inlineBuffer: any[] = [];

    const flushInline = () => {
      if (inlineBuffer.length) {
        result.push({ text: this.inlineTokens(inlineBuffer), margin: [0, 0, 0, 2] });
        inlineBuffer = [];
      }
    };

    for (const token of tokens) {
      if (token.type === 'image') {
        flushInline();
        const href: string = token.href ?? '';
        if (href.startsWith('data:image')) {
          result.push({ image: href, width: 200, margin: [0, 2, 0, 4] });
        } else {
          result.push({ text: `[Bild: ${token.text || href}]`, color: BLUE, decoration: 'underline', link: href || undefined, margin: [0, 0, 0, 2] });
        }
      } else {
        inlineBuffer.push(token);
      }
    }
    flushInline();
    return result;
  }

  private buildList(token: any, margin = [0, 2, 0, 2]): any {
    const items = (token.items as any[]).map((item: any) => {
      const textTokens = (item.tokens as any[]).filter((t: any) => t.type === 'text');
      const subLists   = (item.tokens as any[]).filter((t: any) => t.type === 'list');

      const inlineText = this.inlineTokens(
        textTokens.flatMap((t: any) => t.tokens ?? [{ type: 'text', text: t.text ?? '' }])
      );

      if (subLists.length === 0) {
        return { text: inlineText };
      }
      return {
        stack: [
          { text: inlineText },
          ...subLists.map((sub: any) => this.buildList(sub, [0, 2, 0, 0]))
        ]
      };
    });
    return token.ordered
      ? { ol: items, margin }
      : { ul: items, margin };
  }

  private inlineTokens(tokens: any[]): any[] {
    return tokens.flatMap(t => this.inlineToken(t));
  }

  private inlineToken(
    token: any,
    styles: { bold?: true; italics?: true; decoration?: string; color?: string } = {}
  ): any[] {
    switch (token.type) {
      case 'text':
      case 'escape': {
        const t: string = token.text ?? '';
        if (!t) return [];
        return [Object.keys(styles).length ? { text: t, ...styles } : t];
      }
      case 'strong':
        return (token.tokens ?? []).flatMap((c: any) => this.inlineToken(c, { ...styles, bold: true }));
      case 'em':
        return (token.tokens ?? []).flatMap((c: any) => this.inlineToken(c, { ...styles, italics: true }));
      case 'del':
        return (token.tokens ?? []).flatMap((c: any) => this.inlineToken(c, { ...styles, decoration: 'lineThrough' }));
      case 'link': {
        // Pendenz-Referenz-Badge (aus preprocessPendenzRefs)
        if ((token.href as string)?.startsWith('pref:')) {
          const id = (token.href as string).slice(5);
          const p = this.stateService.state().pendenzen.find(x => x.id === id);
          const status = p?.status ?? 'offen';
          const bgColor = status === 'archiviert' ? '#aaaaaa'
                        : status === 'erledigt'   ? '#1a3a6b'
                        : p                       ? '#8B1F1F'
                        : '#666666';
          const label = token.text ?? id;
          return [{ text: ` ${label} `, color: WHITE, background: bgColor, fontSize: 8.5, ...styles }];
        }
        const linkText = (token.tokens ?? []).flatMap((c: any) =>
          this.inlineToken(c, { ...styles, color: BLUE, decoration: 'underline' })
        );
        return linkText.map((item: any) =>
          typeof item === 'string'
            ? { text: item, color: BLUE, decoration: 'underline', link: token.href }
            : { ...item, link: token.href }
        );
      }
      case 'codespan':
        return [{ text: ` ${token.text} `, fontSize: 8, color: '#000000', background: RED_LIGHT, ...styles }];
      case 'image': {
        const href: string = token.href ?? '';
        const alt: string  = token.text || href;
        if (href.startsWith('data:image')) {
          return [{ image: href, width: 200, ...styles }];
        }
        return [{ text: `[Bild: ${alt}]`, color: BLUE, decoration: 'underline', link: href || undefined, ...styles }];
      }
      case 'br':
        return ['\n'];
      default:
        return token.text ? [token.text] : [];
    }
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
