import { Component, signal, HostListener } from '@angular/core';

export interface ConfirmDialogButton {
  label: string;
  style?: 'primary' | 'danger' | 'secondary';
  action: () => void;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  buttons: ConfirmDialogButton[];
}

@Component({
  selector: 'si-confirm-dialog',
  standalone: true,
  template: `
    @if (visible()) {
    <div class="dialog-backdrop" (click)="dismiss()">
      <div class="dialog-panel" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h3>{{ options().title }}</h3>
          <button class="dialog-close" (click)="dismiss()">✕</button>
        </div>
        <div class="dialog-body">
          <p>{{ options().message }}</p>
        </div>
        <div class="dialog-footer">
          @for (btn of options().buttons; track btn.label) {
          <button class="dialog-btn" [class]="'dialog-btn-' + (btn.style ?? 'secondary')"
            (click)="handleClick(btn)">{{ btn.label }}</button>
          }
        </div>
      </div>
    </div>
    }
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      animation: fadeIn 0.15s ease;
    }
    .dialog-panel {
      width: 90%;
      max-width: 420px;
      background: var(--si-surface, #fff);
      border: 1px solid var(--si-border, #e0e0e0);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
      animation: slideUp 0.2s ease;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--si-border, #e0e0e0);
      h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--si-text-primary, #333); }
    }
    .dialog-close {
      background: none;
      border: none;
      font-size: 18px;
      color: var(--si-text-secondary, #666);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.15s;
    }
    .dialog-close:hover { background: var(--si-surface-hover, #f0f0f0); }
    .dialog-body {
      padding: 20px;
      p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--si-text-primary, #333); }
    }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 20px 16px;
    }
    .dialog-btn {
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: filter 0.15s, background 0.15s;
    }
    .dialog-btn-secondary {
      background: var(--si-surface, #fff);
      color: var(--si-text-primary, #333);
      border: 1px solid var(--si-border, #e0e0e0);
    }
    .dialog-btn-secondary:hover { background: var(--si-surface-secondary, #fafafa); }
    .dialog-btn-primary {
      background: var(--si-primary, #0078d4);
      color: var(--si-surface, #fff);
      border: none;
    }
    .dialog-btn-primary:hover { filter: brightness(1.1); }
    .dialog-btn-danger {
      background: var(--si-danger, #e81123);
      color: var(--si-surface, #fff);
      border: none;
    }
    .dialog-btn-danger:hover { filter: brightness(1.1); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  `],
})
export class ConfirmDialogComponent {
  visible = signal(false);
  options = signal<ConfirmDialogOptions>({ title: '', message: '', buttons: [] });

  open(opts: ConfirmDialogOptions): void {
    this.options.set(opts);
    this.visible.set(true);
  }

  dismiss(): void {
    this.visible.set(false);
  }

  handleClick(btn: ConfirmDialogButton): void {
    this.visible.set(false);
    btn.action();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) this.dismiss();
  }
}
