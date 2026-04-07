import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="modal-header">
      <h5 class="modal-title">{{ title }}</h5>
      <button type="button" class="btn-close" (click)="modal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <p class="mb-0">{{ message }}</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" (click)="modal.dismiss()">Abbrechen</button>
      <button type="button" [class]="'btn ' + confirmClass" (click)="modal.close(true)">{{ confirmLabel }}</button>
    </div>
  `
})
export class ConfirmDialogComponent {
  @Input() title = 'Bestätigung';
  @Input() message = '';
  @Input() confirmLabel = 'Bestätigen';
  @Input() confirmClass = 'btn-danger';

  constructor(public modal: NgbActiveModal) {}
}
