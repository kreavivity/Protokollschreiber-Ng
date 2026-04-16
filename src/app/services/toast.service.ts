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

  private _lastUndoCreatedAt = 0;
  private _lastUndoDelay = 10000;

  get lastUndoDelaySecs(): number { return Math.round(this._lastUndoDelay / 1000); }

  show(message: string, type: Toast['type'] = 'info', delay = 10000, undoAction?: () => void): Toast {
    const toast: Toast = { message, type, delay, undoAction };
    if (undoAction) {
      this._lastUndoCreatedAt = Date.now();
      this._lastUndoDelay = delay;
    }
    this.toasts.update(t => [...t, toast]);
    return toast;
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

  /**
   * Triggers the most recently added undo action if still available.
   * Returns 'triggered' if an action was executed, 'expired' if it
   * recently timed out, or 'none' if there was no pending undo.
   */
  triggerLatestUndo(): 'triggered' | 'expired' | 'none' {
    const withUndo = this.toasts().filter(t => t.undoAction);
    if (withUndo.length > 0) {
      const latest = withUndo[withUndo.length - 1];
      latest.undoAction!();
      this.remove(latest);
      this._lastUndoCreatedAt = 0;
      return 'triggered';
    }
    if (this._lastUndoCreatedAt > 0) {
      const age = Date.now() - this._lastUndoCreatedAt;
      this._lastUndoCreatedAt = 0;
      if (age < this._lastUndoDelay + 3000) return 'expired';
    }
    return 'none';
  }
}
