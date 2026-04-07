import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  type: 'success' | 'info' | 'danger';
  delay: number;
  undoAction?: () => void;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: Toast['type'] = 'info', delay = 10000, undoAction?: () => void): void {
    this.toasts.update(t => [...t, { message, type, delay, undoAction }]);
  }

  info(message: string, undoAction?: () => void): void {
    this.show(message, 'info', 10000, undoAction);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  danger(message: string, undoAction?: () => void): void {
    this.show(message, 'danger', 10000, undoAction);
  }

  remove(toast: Toast): void {
    this.toasts.update(t => t.filter(x => x !== toast));
  }
}
