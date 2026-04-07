import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeilnahmeStatus } from '../../../models/state.model';

@Component({
  selector: 'app-status-switch',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-switch" (click)="toggle()">
      <div class="status-switch-track" [class.anwesend]="value === 'anwesend'">
        <div class="status-switch-thumb"></div>
      </div>
      <span class="status-switch-label" [class.entschuldigt]="value === 'entschuldigt'">
        {{ value === 'anwesend' ? 'Anwesend' : 'Entschuldigt' }}
      </span>
    </div>
  `
})
export class StatusSwitchComponent {
  @Input() value: TeilnahmeStatus = 'anwesend';
  @Output() valueChange = new EventEmitter<TeilnahmeStatus>();

  toggle(): void {
    this.valueChange.emit(this.value === 'anwesend' ? 'entschuldigt' : 'anwesend');
  }
}
