import { Injectable } from '@angular/core';
import { AppState } from '../models/state.model';
import { StorageService } from './storage.service';
import { StateService } from './state.service';
import { marked } from 'marked';

marked.use({ breaks: true });

@Injectable({ providedIn: 'root' })
export class ExportService {

  constructor(
    private storage: StorageService,
    private stateService: StateService
  ) {}

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
    const html2pdf = (window as any)['html2pdf'];
    if (!html2pdf) {
      throw new Error('html2pdf nicht verfügbar. Bitte Seite neu laden.');
    }

    const state = this.stateService.state();
    const html = this.buildPrintHtml(state);
    const filenameBase = this.getFilenameBase();
    const pfDate = state.meta.protokollfuehrung?.datum
      ? this.formatDate(state.meta.protokollfuehrung.datum)
      : '';

    const opt = {
      margin: [0, 0, 0, 0],
      filename: filenameBase + '.pdf',
      image: { type: 'png' },
      html2canvas: { scale: 3, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    return html2pdf().set(opt).from(html, 'string').toPdf().get('pdf').then((pdf: any) => {
      const totalPages = pdf.internal.getNumberOfPages();
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(7);
      pdf.setTextColor(140, 140, 140);
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.2);
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.line(20, ph - 8, pw - 16, ph - 8);
        pdf.text(filenameBase, 20, ph - 4.5, { align: 'left' });
        pdf.text(pfDate, pw / 2, ph - 4.5, { align: 'center' });
        pdf.text(`Seite ${i} von ${totalPages}`, pw - 16, ph - 4.5, { align: 'right' });
      }
    }).save();
  }


  private getFilenameBase(): string {
    const m = this.stateService.state().meta;
    const datePart = m.datum ? m.datum.replace(/-/g, '') : '';
    return [datePart, m.titel || 'Protokoll', m.untertitel]
      .filter(Boolean).join(' ').replace(/[\/\\:*?"<>|]/g, '_');
  }

  private esc(s: string): string {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  buildPrintHtml(state: AppState): string {
    const m = state.meta;
    const logoSrc = m.logo
      ? (m.logo.startsWith('data:') ? m.logo : `data:image/jpeg;base64,${m.logo}`)
      : '';
    const dateStr = m.datum
      ? `${this.formatDate(m.datum)}, ${m.zeitVon || ''} bis ${m.zeitBis || ''} Uhr`
      : '';

    const vorstandRows = (state.vorstand || []).map(v => {
      const name = [v.vorname, v.nachname].filter(Boolean).join(' ');
      const funk = (v.funktion || []).join(', ');
      const dot = v.status === 'entschuldigt'
        ? `<span style="color:var(--rs);">●</span> entschuldigt`
        : `<span style="color:var(--g);">●</span> anwesend`;
      return `<tr><td>${this.esc(name)}</td><td>${this.esc(v.kuerzel)}</td><td>${this.esc(funk)}</td><td>${dot}</td></tr>`;
    }).join('');

    const gaesteRows = (state.gaeste || []).map(g => {
      const name = [g.vorname, g.nachname].filter(Boolean).join(' ');
      return `<tr><td>${this.esc(name)}</td><td>${this.esc(g.kuerzel||'')}</td><td>${this.esc((g.funktion||[]).join(', '))}</td></tr>`;
    }).join('');

    const pf = m.protokollfuehrung || { ort: '', datum: '', name: '' };
    const ns = m.naechsteSitzung || { datum: '', uhrzeit: '', adresse: '' };
    const nsDate = ns.datum ? this.formatDate(ns.datum) : '';
    const pfDate = pf.datum ? this.formatDate(pf.datum) : '';

    const pendenzCards = (state.pendenzen || [])
      .filter(p => p.status !== 'archiviert' && !p.archiviert)
      .map(p => {
        const isErledigt = p.status === 'erledigt' || (!!p.erledigt && !p.archiviert);
        const eintragRows = (p.eintraege || []).map(e =>
          `<div class="pe"><span class="ped">${this.esc(e.datum||'')}:</span> <span class="pet">${marked.parse(e.text||'') as string}</span></div>`
        ).join('');
        const z = (p.zustaendig || []).join(', ') || '–';
        const r = (p.ressort || []).join(', ') || '–';
        return `
          <div class="pp${isErledigt?' e':''}">
            <div class="pph"><span>${this.esc(p.titel||'(kein Titel)')}</span><span class="ppi">${this.esc(p.id||'')}</span></div>
            <div class="ppm">
              <div class="ppmi"><span class="k">Zuständig</span>${this.esc(z)}</div>
              <div class="ppmi"><span class="k">Ressort</span>${this.esc(r)}</div>
              <div class="ppmi"><span class="k">Eröffnet</span>${this.esc(this.formatDate(p.eroeffnet||'')||'–')}</div>
              <div class="ppmi"><span class="k">Erledigt</span>${p.erledigt?this.esc(this.formatDate(p.erledigt)):'–'}</div>
            </div>
            <div class="ppb">${eintragRows||'<em>Keine Einträge</em>'}</div>
          </div>`;
      }).join('');

    const css = `
      :root{--r:#8B1F1F;--b:#1a3a6b;--g:#27ae60;--rs:#c0392b;--w:#ffffff;--d:#333333;--gt:#666666;--gc:#aaaaaa;--ge:#e0e0e0;--gs:#f9f9f9;--gm:#555555;}
      body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;margin:0;}
      .pg{width:210mm;padding:18mm 18mm 16mm;margin:0 auto;background:var(--w);}
      .ph{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:3px solid var(--r);padding-bottom:12px;}
      .ph h1{font-size:28pt;font-weight:900;color:var(--r);line-height:1;margin:0;}
      .ph h2{font-size:14pt;font-weight:400;color:var(--d);margin-top:4px;}
      .logo{max-height:80px;max-width:160px;object-fit:contain;}
      .ib{margin-bottom:12px;}.ib .l{font-size:8pt;font-weight:700;text-transform:uppercase;color:var(--r);border-bottom:1px solid var(--r);padding-bottom:2px;margin-bottom:2px;}.ib .v{font-size:10pt;}
      .pt{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:9.5pt;}
      .ptl{font-size:9pt;font-weight:700;text-transform:uppercase;color:var(--r);border-bottom:1px solid var(--r);padding-bottom:2px;margin-bottom:4px;margin-top:18px;}
      .pt th{background:var(--r);color:var(--w);padding:4px 8px;text-align:left;font-size:8.5pt;}
      .pt td{padding:3px 8px;border-bottom:1px solid var(--ge);}
      .pt tr:nth-child(even) td{background:var(--gs);}
      .pfg{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px;padding-top:12px;}
      .sl{border-top:1px solid var(--d);margin-top:40px;padding-top:3px;font-size:8.5pt;color:var(--gt);}
      .pp{margin-bottom:16px;border-left:5px solid var(--r);break-inside:avoid;page-break-inside:avoid;}
      .pp.e{border-left-color:var(--b);}
      .pph{background:var(--r);color:var(--w);padding:6px 12px;display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:10pt;}
      .pp.e .pph{background:var(--b);}
      .ppi{font-family:monospace;font-size:9pt;background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:2px;}
      .ppm{display:grid;grid-template-columns:repeat(4,1fr);font-size:8.5pt;border:1px solid var(--gc);border-top:none;}
      .ppmi{padding:4px 8px;border-right:1px solid var(--gc);}.ppmi:last-child{border-right:none;}
      .ppmi .k{font-weight:700;color:var(--gm);font-size:7.5pt;display:block;}
      .ppb{padding:6px 10px;border:1px solid var(--gc);border-top:none;font-size:9pt;}
      .pe{margin-bottom:3px;}.ped{font-weight:bold;color:var(--r);}.pp.e .ped{color:var(--b);}
      .pet p{display:inline;margin:0;}.pet ul,.pet ol{margin:2px 0 2px 16px;}.pet li{margin-bottom:1px;}
    `;

    return `<html><head><meta charset="utf-8"><style>${css}</style></head><body>
      <div class="pg">
        <div class="ph">
          <div><h1>${this.esc(m.titel||'Protokoll')}</h1><h2>${this.esc(m.untertitel||'')}</h2></div>
          ${logoSrc?`<img src="${logoSrc}" class="logo" alt="Logo">`:''}
        </div>
        <div class="ib"><div class="l">Datum / Zeit</div><div class="v">${this.esc(dateStr)}</div></div>
        <div class="ib"><div class="l">Ort</div><div class="v">${this.esc(m.ort||'')}</div></div>
        ${vorstandRows?`<div class="ptl">Vorstand</div><table class="pt"><colgroup><col style="width:42%"><col style="width:12%"><col style="width:28%"><col style="width:18%"></colgroup><thead><tr><th>Name</th><th>Kürzel</th><th>Ressort / Funktion</th><th>Teilnahme</th></tr></thead><tbody>${vorstandRows}</tbody></table>`:''}
        ${gaesteRows?`<div class="ptl">Gäste</div><table class="pt"><colgroup><col style="width:42%"><col style="width:12%"><col style="width:46%"></colgroup><thead><tr><th>Name</th><th>Kürzel</th><th>Funktion</th></tr></thead><tbody>${gaesteRows}</tbody></table>`:''}
        <div class="pfg">
          <div>
            <div style="font-size:8pt;font-weight:700;color:var(--r);text-transform:uppercase;margin-bottom:6px;">Protokollführung</div>
            <div style="font-size:9pt;">${this.esc(pf.ort||'')}${pf.ort&&pfDate?', ':''}${this.esc(pfDate)}</div>
            <div class="sl">${this.esc(pf.name||'')}</div>
          </div>
          <div>
            <div style="font-size:8pt;font-weight:700;color:var(--r);text-transform:uppercase;margin-bottom:6px;">Nächste Sitzung</div>
            <div style="font-size:9pt;">${nsDate?this.esc(nsDate)+(ns.uhrzeit?', '+this.esc(ns.uhrzeit)+' Uhr':''):'–'}</div>
            ${ns.adresse?`<div style="font-size:9pt;margin-top:4px;">${this.esc(ns.adresse).replace(/\n/g,'<br>')}</div>`:''}
          </div>
        </div>
      </div>
      ${pendenzCards?`<div class="pg" style="break-before:page;page-break-before:always;">
        <div style="font-size:14pt;font-weight:bold;color:var(--r);border-bottom:2px solid var(--r);padding-bottom:8px;margin-bottom:16px;">Pendenzenliste</div>
        ${pendenzCards}
      </div>`:''}
    </body></html>`;
  }
}
