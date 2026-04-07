import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbTimepickerModule, NgbTimeStruct } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-time-input',
  standalone: true,
  imports: [FormsModule, NgbTimepickerModule],
  template: `
    <ngb-timepicker
      [(ngModel)]="time"
      (ngModelChange)="onTimeChange($event)"
      [minuteStep]="5"
      [seconds]="false"
      size="small">
    </ngb-timepicker>
  `,
  styles: [`
    :host ::ng-deep .ngb-tp {
      flex-direction: row;
      align-items: center;
      gap: 2px;
    }
    :host ::ng-deep .ngb-tp-input-container {
      width: 4rem;
    }
    :host ::ng-deep .ngb-tp-input {
      font-size: 13px;
      padding: 2px 4px;
      height: 28px;
    }
    :host ::ng-deep .btn-link {
      padding: 1px 6px;
      font-size: 11px;
      line-height: 1;
      color: var(--rot);
    }
    :host ::ng-deep .btn-link:hover {
      color: var(--rot);
    }
    :host ::ng-deep .ngb-tp-spacer {
      width: auto;
      padding: 0 1px;
    }
  `]
})
export class TimeInputComponent implements OnChanges {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  time: NgbTimeStruct | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      const parts = (this.value || '').split(':');
      if (parts.length === 2 && parts[0] !== '') {
        this.time = { hour: parseInt(parts[0]), minute: parseInt(parts[1]), second: 0 };
      } else {
        this.time = { hour: 8, minute: 0, second: 0 };
      }
    }
  }

  onTimeChange(t: NgbTimeStruct | null): void {
    if (t) {
      const h = String(t.hour).padStart(2, '0');
      const m = String(t.minute).padStart(2, '0');
      this.valueChange.emit(`${h}:${m}`);
    } else {
      this.valueChange.emit('');
    }
  }
}
