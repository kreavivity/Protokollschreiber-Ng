import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appAutoResize]',
  standalone: true
})
export class AutoResizeDirective {
  constructor(private el: ElementRef<HTMLTextAreaElement>) {}

  @HostListener('input')
  onInput(): void {
    this.resize();
  }

  resize(): void {
    const el = this.el.nativeElement;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
}
