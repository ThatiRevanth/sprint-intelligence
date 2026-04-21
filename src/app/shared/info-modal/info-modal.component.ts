import { Component, Input, signal, HostListener } from "@angular/core";

@Component({
  selector: "si-info-modal",
  standalone: true,
  template: `
        <button class="help-btn" (click)="open($event)" title="How is this calculated?">?</button>@if (visible()) {
        <div class="modal-backdrop" (click)="close()">
        	<div class="modal-panel" (click)="$event.stopPropagation()">
        		<div class="modal-header">
        			<h3>{{ title }}</h3>
        			<button class="modal-close" (click)="close()">✕</button>
        		</div>
        		<div class="modal-body">
        			<ng-content></ng-content>
        		</div>
        	</div>
        </div>}`,
  styles: [
    `
        .help-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            padding: 0;
            font-size: 14px;
            font-weight: 700;
            line-height: 1;
            color: var(--si-text-secondary, #666);
            background: var(--si-surface, #fff);
            border: 1px solid var(--si-border, #e0e0e0);
            border-radius: 50%;
            cursor: pointer;
            transition:
                background 0.15s,
                border-color 0.15s,
                color 0.15s;
        }
        .help-btn:hover {
            color: var(--si-primary, #0078d4);
            border-color: var(--si-primary, #0078d4);
            background: var(--si-primary-tint, #e6f2ff);
        }
        .modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 9000;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.45);
            animation: fadeIn 0.15s ease;
        }
        .modal-panel {
            width: 90%;
            max-width: 560px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            background: var(--si-surface, #fff);
            border: 1px solid var(--si-border, #e0e0e0);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
            animation: slideUp 0.2s ease;
        }
        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--si-border, #e0e0e0);
            h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--si-text-primary, #333);
            }
        }
        .modal-close {
            background: none;
            border: none;
            font-size: 18px;
            color: var(--si-text-secondary, #666);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.15s;
        }
        .modal-close:hover {
            background: var(--si-surface-hover, #f0f0f0);
        }
        .modal-body {
            padding: 20px;
            overflow-y: auto;
            font-size: 13px;
            line-height: 1.7;
            color: var(--si-text-primary, #333);
        }
        .modal-body h4 {
            margin: 16px 0 8px;
            font-size: 14px;
            font-weight: 600;
            color: var(--si-text-primary, #333);
        }
        .modal-body h4:first-child {
            margin-top: 0;
        }
        .modal-body p {
            margin: 4px 0 8px;
        }
        .modal-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0 12px;
            font-size: 12px;
        }
        .modal-body th,
        .modal-body td {
            padding: 6px 10px;
            text-align: left;
            border-bottom: 1px solid var(--si-border-light, #eee);
        }
        .modal-body th {
            font-weight: 600;
            background: var(--si-surface-secondary, #fafafa);
        }
        .modal-body code {
            padding: 2px 5px;
            font-size: 12px;
            background: var(--si-surface-secondary, #f5f5f5);
            border-radius: 4px;
        }
        .modal-body .score-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 12px;
        }
        .modal-body .badge-green {
            color: #107c10;
            background: color-mix(in srgb, #107c10 15%, var(--si-surface, #fff));
        }
        .modal-body .badge-yellow {
            color: #ff8c00;
            background: color-mix(in srgb, #ff8c00 15%, var(--si-surface, #fff));
        }
        .modal-body .badge-red {
            color: #e81123;
            background: color-mix(in srgb, #e81123 15%, var(--si-surface, #fff));
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(12px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }`,
  ],
})
export class InfoModalComponent {
  @Input({ required: true }) title = "";

  visible = signal(false);

  open(event: Event): void {
    event.stopPropagation();
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  @HostListener("document:keydown.escape")
  onEscape(): void {
    if (this.visible()) this.close();
  }
}
