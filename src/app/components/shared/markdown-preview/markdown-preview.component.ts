import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoResizeDirective } from '../auto-resize.directive';
import { marked } from 'marked';

marked.use({ breaks: true });

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
        (click)="!readonly && startEdit()"
        [attr.tabindex]="readonly ? null : 0"
        (focus)="!readonly && startEdit()"
        (keydown.enter)="!readonly && startEdit()"
      ></div>
    } @else {
      <textarea
        #textareaEl
        class="eintrag-text"
        [value]="value"
        (input)="onInput($event)"
        (blur)="endEdit()"
        (paste)="onPaste($event)"
        appAutoResize
      ></textarea>
    }
  `
})
export class MarkdownPreviewComponent implements OnChanges {
  @Input() value = '';
  @Input() readonly = false;
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('textareaEl') textareaEl?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('previewEl') previewEl?: ElementRef<HTMLDivElement>;

  isEditing = false;
  renderedHtml = '';

  constructor(private ngZone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.render();
      if (!this.readonly && !this.value && !this.isEditing) {
        this.isEditing = true;
      }
    }
  }

  private render(): void {
    if (!this.value) { this.renderedHtml = ''; return; }
    // Jede zusätzliche Leerzeile (ab der zweiten) als sichtbaren nbsp-Paragraph rendern,
    // da marked mehrere Leerzeilen zu einem einzigen Absatzumbruch kollabiert.
    const processed = this.value.replace(/\n{3,}/g, match =>
      '\n\n' + '\u00a0\n\n'.repeat(match.length - 2)
    );
    this.renderedHtml = marked.parse(processed) as string;
  }

  startEdit(): void {
    const previewHeight = this.previewEl?.nativeElement.offsetHeight ?? 0;
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
    this.isEditing = false;
    this.render();
  }

  onInput(e: Event): void {
    const val = (e.target as HTMLTextAreaElement).value;
    this.valueChange.emit(val);
  }

  onPaste(e: ClipboardEvent): void {
    const image = Array.from(e.clipboardData?.items ?? [])
      .find(item => item.type.startsWith('image/'));
    if (!image) return;

    e.preventDefault();
    const el = this.textareaEl!.nativeElement;
    const selStart = el.selectionStart;
    const selEnd   = el.selectionEnd;

    const reader = new FileReader();
    reader.onload = () => {
      this.ngZone.run(() => {
        const dataUrl  = reader.result as string;
        const markdown = `![image](${dataUrl})`;
        const newVal   = this.value.slice(0, selStart) + markdown + this.value.slice(selEnd);

        this.valueChange.emit(newVal);
        // Direkt in Vorschau wechseln, da Textarea kein Bild anzeigen kann
        this.renderedHtml = marked.parse(newVal) as string;
        this.isEditing = false;
      });
    };
    reader.readAsDataURL(image.getAsFile()!);
  }
}
