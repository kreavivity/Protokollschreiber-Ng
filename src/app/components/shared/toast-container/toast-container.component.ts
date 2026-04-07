import { Component } from '@angular/core';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastService, Toast } from '../../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [NgbToastModule],
  template: `
    <div aria-live="polite" aria-atomic="true" class="app-toast-container">
      @for (toast of toastService.toasts(); track toast) {
        <ngb-toast
          [autohide]="true"
          [delay]="toast.delay"
          [class]="'app-toast app-toast--' + toast.type"
          (hidden)="toastService.remove(toast)">
          <ng-template ngbToastHeader>
            <span class="app-toast__msg">{{ toast.message }}</span>
            @if (toast.undoAction) {
              <a href="#" class="app-toast__undo ms-2" (click)="undo($event, toast)">Rückgängig</a>
            }
          </ng-template>
        </ngb-toast>
      }
    </div>
  `,
  styles: [`
    .app-toast-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 380px;
    }
    :host ::ng-deep .app-toast {
      border: none;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      font-size: 13px;
    }
    :host ::ng-deep .app-toast--info .toast-header    { background: var(--grau-mittel); color: var(--text); border: none; }
    :host ::ng-deep .app-toast--success .toast-header { background: var(--blau); color: var(--weiss); border: none; }
    :host ::ng-deep .app-toast--danger .toast-header  { background: var(--rot); color: var(--weiss); border: none; }
    :host ::ng-deep .app-toast .toast-body { display: none; }
    :host ::ng-deep .toast-header .btn-close { filter: invert(1) grayscale(100%) brightness(200%); }
    .app-toast__msg { flex: 1; }
    .app-toast__undo {
      color: var(--text);
      font-weight: 700;
      text-decoration: underline;
      white-space: nowrap;
    }
    .app-toast__undo:hover { color: var(--rot); }
  `]
})
export class ToastContainerComponent {
  constructor(public toastService: ToastService) {}

  undo(event: Event, toast: Toast): void {
    event.preventDefault();
    toast.undoAction!();
    this.toastService.remove(toast);
  }
}
