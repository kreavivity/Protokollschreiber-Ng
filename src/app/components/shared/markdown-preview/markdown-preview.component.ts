import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AutoResizeDirective } from '../auto-resize.directive';
import { marked, Renderer } from 'marked';
import { StateService } from '../../../services/state.service';

marked.use({ breaks: true });

// Matches ![alt](data:... or any url)
const IMG_RE = /!\[([^\]]*)\]\((data:[^)]+|[^)]*)\)/g;

interface EditImage {
  key: string;   // e.g. "[Bild 1]"
  href: string;
  width: number; // 10–100 (percentage for display in slider)
}

interface PendenzSuggestion {
  id: string;
  titel: string;
}

@Component({
  selector: 'app-markdown-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoResizeDirective],
  template: `
    @if (!isEditing) {
      <div #previewEl
        class="eintrag-preview"
        [class.eintrag-preview-clickable]="!readonly"
        [innerHTML]="renderedHtml || ''"
        (click)="onPreviewClick($event)"
        [attr.tabindex]="readonly ? null : 0"
        (keydown.enter)="!readonly && startEdit()"
      ></div>
    } @else {
      <div class="eintrag-edit-wrapper" (focusout)="onWrapperFocusout($event)">
        <div style="position:relative;">
          <textarea
            #textareaEl
            class="eintrag-text"
            [value]="editValue"
            (input)="onInput($event)"
            (keydown)="onKeyDown($event)"
            (paste)="onPaste($event)"
            appAutoResize
          ></textarea>
          @if (mentionActive) {
            <div class="mention-dropdown">
              @for (s of mentionSuggestions; track s.id; let i = $index) {
                <div class="mention-item" [class.active]="i === mentionSelectedIndex"
                  (mousedown)="$event.preventDefault(); selectMention(s)">
                  <span class="mention-item-id">{{ s.id }}</span>
                  <span class="mention-item-title">{{ s.titel }}</span>
                </div>
              }
            </div>
          }
        </div>

        @if (editImages.length > 0) {
          <div class="md-img-panel">
            @for (img of editImages; track img.key) {
              <div class="md-img-panel-row">
                <img [src]="img.href" class="md-img-thumb" [alt]="img.key">
                <span class="md-img-panel-key">{{ img.key }}</span>
                <input type="range" min="10" max="100" [value]="img.width"
                  class="md-img-panel-slider"
                  (input)="img.width = +$any($event.target).value"
                  (change)="onImageResize(img, $any($event.target).value)">
                <span class="md-img-panel-label">{{ img.width }}%</span>
                <button type="button" class="md-img-panel-delete"
                  (mousedown)="$event.preventDefault()"
                  (click)="onImageDelete(img)">✕</button>
              </div>
            }
          </div>
        }
      </div>
    }
  `
})
export class MarkdownPreviewComponent implements OnChanges {
  @Input() value = '';
  @Input() readonly = false;
  @Output() valueChange = new EventEmitter<string>();
  /** Emits the value *before* the image was deleted — so the parent can offer undo. */
  @Output() imageDeleted = new EventEmitter<string>();
  /** Emits the pendenz ID when a pendenz-ref badge is clicked. */
  @Output() pendenzRefClicked = new EventEmitter<string>();

  @ViewChild('textareaEl') textareaEl?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('previewEl') previewEl?: ElementRef<HTMLDivElement>;

  isEditing = false;
  renderedHtml: SafeHtml = '';
  editValue = '';
  editImages: EditImage[] = [];

  // ── Mention state ──────────────────────────────────
  mentionActive = false;
  mentionText = '';
  mentionStart = 0;
  mentionSuggestions: PendenzSuggestion[] = [];
  mentionSelectedIndex = 0;

  private editImageMap = new Map<string, string>();
  private pendingEmits = new Set<string>();
  /** Container width captured just before entering edit mode (used for px→% conversion). */
  private containerWidth = 0;

  constructor(
    private ngZone: NgZone,
    private sanitizer: DomSanitizer,
    private stateService: StateService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      if (this.isEditing) {
        if (this.pendingEmits.has(this.value)) {
          this.pendingEmits.delete(this.value);
        } else {
          // External change (e.g. undo via toast) — rebuild edit state.
          this.rebuildEditState();
        }
      } else {
        this.render();
        if (!this.readonly && !this.value && !this.isEditing) {
          this.isEditing = true;
          this.editValue = '';
        }
      }
    }
  }

  private emit(value: string): void {
    this.pendingEmits.add(value);
    this.valueChange.emit(value);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private render(overrideValue?: string): void {
    const val = overrideValue ?? this.value;
    if (!val) { this.renderedHtml = this.sanitizer.bypassSecurityTrustHtml(''); return; }

    const renderer = new Renderer();

    renderer.table = (token: any) => {
      // Parse separator row (2nd line) to get relative column widths from dash counts
      const lines = (token.raw as string).split('\n').map((l: string) => l.trim()).filter(Boolean);
      const sepLine = lines.find((l: string) => /^[|: -]+$/.test(l)) ?? '';
      const sepCells = sepLine.replace(/^\||\|$/g, '').split('|');
      const dashCounts = sepCells.map((c: string) => Math.max((c.match(/-/g) ?? []).length, 1));
      const total = dashCounts.reduce((a: number, b: number) => a + b, 0) || 1;

      const colgroup = `<colgroup>${dashCounts.map(n =>
        `<col style="width:${Math.round(n / total * 100)}%">`
      ).join('')}</colgroup>`;

      const headerHtml = (token.header as any[]).map((cell: any) => {
        const align = cell.align ? ` style="text-align:${cell.align}"` : '';
        return `<th${align}>${marked.parseInline(cell.text ?? '') as string}</th>`;
      }).join('');

      const bodyHtml = (token.rows as any[][]).map((row: any[], ri: number) => {
        const cells = row.map((cell: any) => {
          const align = cell.align ? ` style="text-align:${cell.align}"` : '';
          return `<td${align}>${marked.parseInline(cell.text ?? '') as string}</td>`;
        }).join('');
        return `<tr${ri % 2 === 1 ? ' class="md-tr-alt"' : ''}>${cells}</tr>`;
      }).join('');

      return `<table class="md-table">${colgroup}<thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
    };

    renderer.image = ({ href, text }: { href: string; text: string; title: string | null }) => {
      const percentMatch = text?.match(/\|(\d+)$/);
      const natpxMatch  = text?.match(/\|natpx(\d+)$/);
      const cleanAlt = text?.replace(/\|(natpx\d+|\d+)$/, '') || 'Bild';

      let style: string;
      if (percentMatch) {
        style = `width:${percentMatch[1]}%;max-width:100%;`;
      } else if (natpxMatch) {
        style = `width:100%;max-width:${natpxMatch[1]}px;`;
      } else {
        style = `max-width:100%;width:auto;`;
      }
      return `<img src="${href}" alt="${cleanAlt}" style="${style}border-radius:4px;display:block;margin:4px 0">`;
    };

    // Pre-process pendenz references [#ID] → badge HTML (before marked parses)
    const pendenzen = this.stateService.state().pendenzen;
    const withRefs = val.replace(/\[#([A-Z][A-Z0-9]*)\]/g, (_, id: string) => {
      const p = pendenzen.find(x => x.id === id);
      const status = p?.status ?? (p?.archiviert ? 'archiviert' : p?.erledigt ? 'erledigt' : 'offen');
      const label = p
        ? `(${status}) ${id}${p.titel ? ': ' + this.escapeHtml(p.titel) : ''}`
        : id;
      const color = status === 'archiviert' ? 'var(--grau-mittel)'
                  : status === 'erledigt'   ? 'var(--blau)'
                  : p                       ? 'var(--rot)'
                  : 'var(--grau-dunkel)';
      const removeBtn = this.readonly
        ? ''
        : `<button class="pendenz-ref-remove" data-remove-ref="${id}" type="button">×</button>`;
      return `<span class="pendenz-ref-badge" data-pendenz-ref="${id}" style="background:${color}"><span class="pendenz-ref-text">${label}</span>${removeBtn}</span>`;
    });

    const processed = withRefs.replace(/\n{3,}/g, match =>
      '\n\n' + '\u00a0\n\n'.repeat(match.length - 2)
    );
    this.renderedHtml = this.sanitizer.bypassSecurityTrustHtml(
      marked.parse(processed, { renderer }) as string
    );
  }

  private rebuildEditState(): void {
    this.editImageMap = new Map();
    this.editImages = [];
    let counter = 1;
    this.editValue = this.value.replace(IMG_RE, (match, alt: string, src: string) => {
      const key = `[Bild ${counter++}]`;
      this.editImageMap.set(key, match);
      this.editImages.push({ key, href: src, width: this.altToPercent(alt) });
      return key;
    });
    setTimeout(() => {
      if (this.textareaEl) {
        this.textareaEl.nativeElement.value = this.editValue;
      }
    });
  }

  /**
   * Converts the stored alt text to a slider percentage.
   * - "|50"        → 50  (explicit percentage)
   * - "|natpx200"  → round(200 / containerWidth * 100), capped at 100
   * - no suffix    → 100
   */
  private altToPercent(alt: string): number {
    const percentMatch = alt?.match(/\|(\d+)$/);
    if (percentMatch) return +percentMatch[1];

    const natpxMatch = alt?.match(/\|natpx(\d+)$/);
    if (natpxMatch && this.containerWidth > 0) {
      return Math.min(100, Math.max(10, Math.round(+natpxMatch[1] / this.containerWidth * 100)));
    }

    return 100;
  }

  startEdit(): void {
    // Capture container width BEFORE switching to edit mode so the preview element exists.
    this.containerWidth = this.previewEl?.nativeElement.offsetWidth ?? 0;
    const previewHeight  = this.previewEl?.nativeElement.offsetHeight ?? 0;

    this.rebuildEditState();
    this.isEditing = true;
    setTimeout(() => {
      if (this.textareaEl) {
        const el = this.textareaEl.nativeElement;
        el.style.height = 'auto';
        el.style.height = Math.max(previewHeight, el.scrollHeight) + 'px';
        el.focus();
      }
    });
  }

  endEdit(): void {
    const expanded = this.expandPlaceholders(this.editValue);
    if (expanded !== this.value) {
      this.emit(expanded);
    }
    this.isEditing = false;
    this.mentionActive = false;
    if (expanded) {
      this.render(expanded);
    } else {
      this.renderedHtml = this.sanitizer.bypassSecurityTrustHtml('');
    }
  }

  onPreviewClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Remove button inside a badge
    const removeBtn = target.closest('[data-remove-ref]') as HTMLElement;
    if (removeBtn) {
      event.stopPropagation();
      if (!this.readonly) {
        const id = removeBtn.getAttribute('data-remove-ref')!;
        const newValue = this.value
          .replace(new RegExp(`\\[#${id}\\]`, 'g'), '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        this.emit(newValue);
        this.render(newValue);
      }
      return;
    }

    // Badge click → navigate to pendenz (works in readonly too)
    const badge = target.closest('[data-pendenz-ref]') as HTMLElement;
    if (badge) {
      event.stopPropagation();
      this.pendenzRefClicked.emit(badge.getAttribute('data-pendenz-ref')!);
      return;
    }

    // Normal click → start editing
    if (!this.readonly) {
      this.startEdit();
    }
  }

  onWrapperFocusout(e: FocusEvent): void {
    const related = e.relatedTarget as HTMLElement | null;
    const wrapper = e.currentTarget as HTMLElement;
    if (related && wrapper.contains(related)) return;
    this.endEdit();
  }

  // ── Mention / #-autocomplete ───────────────────────

  onKeyDown(e: KeyboardEvent): void {
    if (!this.mentionActive) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.mentionSelectedIndex = (this.mentionSelectedIndex + 1) % this.mentionSuggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.mentionSelectedIndex =
        (this.mentionSelectedIndex - 1 + this.mentionSuggestions.length) % this.mentionSuggestions.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.selectMention(this.mentionSuggestions[this.mentionSelectedIndex]);
    } else if (e.key === 'Escape') {
      this.mentionActive = false;
    }
  }

  selectMention(pendenz: PendenzSuggestion): void {
    if (!this.textareaEl) return;
    const textarea = this.textareaEl.nativeElement;
    const raw = textarea.value;
    const cursor = textarea.selectionStart ?? raw.length;
    const token = `[#${pendenz.id}]`;
    const newRaw = raw.substring(0, this.mentionStart) + token + raw.substring(cursor);
    this.editValue = newRaw;
    textarea.value = newRaw;
    const newCursor = this.mentionStart + token.length;
    textarea.setSelectionRange(newCursor, newCursor);
    this.mentionActive = false;
    this.emit(this.expandPlaceholders(newRaw));
  }

  onInput(e: Event): void {
    const raw = (e.target as HTMLTextAreaElement).value;
    const cursor = (e.target as HTMLTextAreaElement).selectionStart ?? raw.length;
    this.editValue = raw;

    // Detect #-mention: find last # before cursor that is preceded by start/whitespace
    const beforeCursor = raw.substring(0, cursor);
    const lastHash = beforeCursor.lastIndexOf('#');
    if (lastHash >= 0) {
      const afterHash = beforeCursor.substring(lastHash + 1);
      const charBefore = lastHash > 0 ? beforeCursor[lastHash - 1] : null;
      const validStart = charBefore === null || /\s/.test(charBefore);
      const validAfter = /^[A-Za-z0-9]*$/.test(afterHash);

      if (validStart && validAfter) {
        this.mentionStart = lastHash;
        this.mentionText = afterHash.toUpperCase();
        const all = this.stateService.state().pendenzen;
        this.mentionSuggestions = all
          .filter(p =>
            !this.mentionText ||
            (p.id ?? '').toUpperCase().includes(this.mentionText) ||
            (p.titel ?? '').toLowerCase().includes(this.mentionText.toLowerCase())
          )
          .slice(0, 8);
        this.mentionActive = this.mentionSuggestions.length > 0;
        this.mentionSelectedIndex = 0;
      } else {
        this.mentionActive = false;
      }
    } else {
      this.mentionActive = false;
    }

    this.emit(this.expandPlaceholders(raw));
  }

  /** Called once when the slider is released (change event). */
  onImageResize(img: EditImage, widthStr: string): void {
    const width = parseInt(widthStr, 10);
    img.width = width;

    const oldMarkdown = this.editImageMap.get(img.key);
    if (!oldMarkdown) return;
    // Convert any format (natpx or plain) to an explicit percentage
    const newMarkdown = oldMarkdown.replace(IMG_RE, (_match, alt: string, src: string) => {
      const cleanAlt = alt.replace(/\|(natpx\d+|\d+)$/, '');
      return `![${cleanAlt}|${width}](${src})`;
    });
    this.editImageMap.set(img.key, newMarkdown);
    this.emit(this.expandPlaceholders(this.editValue));
  }

  onImageDelete(img: EditImage): void {
    const oldValue = this.expandPlaceholders(this.editValue);

    this.editValue = this.editValue.split(img.key).join('').replace(/\n{3,}/g, '\n\n').trim();
    this.editImageMap.delete(img.key);
    this.editImages = this.editImages.filter(i => i.key !== img.key);

    const newValue = this.expandPlaceholders(this.editValue);
    this.emit(newValue);
    this.imageDeleted.emit(oldValue);

    setTimeout(() => this.textareaEl?.nativeElement.focus());
  }

  onPaste(e: ClipboardEvent): void {
    const image = Array.from(e.clipboardData?.items ?? [])
      .find(item => item.type.startsWith('image/'));
    if (!image) return;

    e.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Load as Image to read natural pixel width
      const img = new Image();
      img.onload = () => {
        this.ngZone.run(() => {
          const natW = img.naturalWidth;
          const markdown = `![image|natpx${natW}](${dataUrl})`;

          const currentExpanded = this.expandPlaceholders(this.editValue);
          const newVal = currentExpanded
            ? currentExpanded.trimEnd() + '\n\n' + markdown
            : markdown;

          this.emit(newVal);
          this.isEditing = false;
          this.render(newVal);
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(image.getAsFile()!);
  }

  private expandPlaceholders(text: string): string {
    let expanded = text;
    this.editImageMap.forEach((markdown, placeholder) => {
      expanded = expanded.split(placeholder).join(markdown);
    });
    return expanded;
  }
}
