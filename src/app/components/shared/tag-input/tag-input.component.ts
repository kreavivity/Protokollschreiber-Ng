import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tag-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tag-container" (click)="focusInput()">
      @for (tag of values; track tag) {
        <span class="tag">
          {{ tag }}
          @if (!readonly) {
            <button class="tag-remove" type="button" tabindex="-1" (click)="removeTag(tag); $event.stopPropagation()">×</button>
          }
        </span>
      }
      @if (!readonly) {
        <div style="position:relative;flex:1;min-width:80px;">
          <input
            #inputEl
            class="tag-input"
            [(ngModel)]="inputValue"
            (keydown)="onKeydown($event)"
            (input)="onInput()"
            (focus)="onFocus()"
            (blur)="onBlur()"
            [placeholder]="values.length === 0 ? placeholder : ''"
            autocomplete="off"
          >
          @if (suggestions.length > 0) {
            <div class="autocomplete-dropdown">
              @for (s of suggestions; track s; let i = $index) {
                <div class="autocomplete-item" [class.active]="i === activeIdx"
                  (mousedown)="selectSuggestion(s)">{{ s }}</div>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class TagInputComponent {
  @Input() values: string[] = [];
  @Input() placeholder = '';
  @Input() readonly = false;
  @Input() maxItems: number | null = null;
  @Input() getSuggestions: (input: string, current: string[]) => string[] = () => [];
  @Output() valuesChange = new EventEmitter<string[]>();

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;

  inputValue = '';
  suggestions: string[] = [];
  activeIdx = -1;

  focusInput(): void {
    this.inputEl?.nativeElement.focus();
  }

  onFocus(): void {
    this.suggestions = this.getSuggestions(this.inputValue, this.values);
    this.activeIdx = -1;
  }

  onInput(): void {
    this.suggestions = this.getSuggestions(this.inputValue, this.values);
    this.activeIdx = -1;
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (this.activeIdx >= 0 && this.suggestions[this.activeIdx]) {
        this.selectSuggestion(this.suggestions[this.activeIdx]);
        return;
      }
      const val = this.inputValue.trim().replace(/,$/, '');
      if (val && !this.values.includes(val)) {
        this.valuesChange.emit(this.maxItems === 1 ? [val] : [...this.values, val]);
      }
      this.inputValue = '';
      this.suggestions = [];
    } else if (e.key === 'Backspace' && !this.inputValue && this.values.length > 0) {
      this.valuesChange.emit(this.values.slice(0, -1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIdx = Math.min(this.activeIdx + 1, this.suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIdx = Math.max(this.activeIdx - 1, -1);
    } else if (e.key === 'Tab') {
      if (this.activeIdx >= 0 && this.suggestions[this.activeIdx]) {
        e.preventDefault();
        this.selectSuggestion(this.suggestions[this.activeIdx]);
      } else {
        this.suggestions = [];
        // Let focus move naturally; onBlur will commit typed value
      }
    }
  }

  onBlur(): void {
    setTimeout(() => {
      const val = this.inputValue.trim();
      if (val && !this.values.includes(val)) {
        this.valuesChange.emit(this.maxItems === 1 ? [val] : [...this.values, val]);
        this.inputValue = '';
      }
      this.suggestions = [];
    }, 150);
  }

  selectSuggestion(s: string): void {
    if (!this.values.includes(s)) {
      this.valuesChange.emit(this.maxItems === 1 ? [s] : [...this.values, s]);
    }
    this.inputValue = '';
    this.suggestions = [];
    this.activeIdx = -1;
  }

  removeTag(tag: string): void {
    this.valuesChange.emit(this.values.filter(v => v !== tag));
  }
}
