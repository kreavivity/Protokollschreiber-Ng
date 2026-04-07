import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.render();
      if (!this.readonly && !this.value && !this.isEditing) {
        this.isEditing = true;
      }
    }
  }

  private render(): void {
    this.renderedHtml = this.value ? (marked.parse(this.value) as string) : '';
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
}
