import {
  Component,
  Input,
  signal,
  inject,
  ElementRef,
  HostListener,
} from "@angular/core";

@Component({
  selector: "si-info-tooltip",
  standalone: true,
  template: `
        @if (trigger === 'click') {
        <span class="info-icon"
          (click)="toggle($event)">ℹ️</span>
        } @else {
        <span class="hover-target"
          (mouseenter)="onMouseEnter()"
          (mouseleave)="onMouseLeave()">
          <ng-content></ng-content>
        </span>
        }@if (open()) {
          <div class="tooltip-popover"
          (click)="$event.stopPropagation()"
          (mouseenter)="onMouseEnter()"
          (mouseleave)="onMouseLeave()"><div class="tooltip-content">{{ text }}</div>
        </div>}`,
  styles: [
    `
        :host {
            position: relative;
            display: inline-flex;
            align-items: center;
        }
        .info-icon {
            cursor: pointer;
            font-size: 14px;
            opacity: 0.6;
            transition: opacity 0.15s;
            user-select: none;
        }
        .info-icon:hover {
            opacity: 1;
        }
        .hover-target {
            display: inline;
            cursor: default;
        }
        .tooltip-popover {
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            z-index: 9999;
            min-width: 280px;
            max-width: 400px;
            padding: 12px 16px;
            background: var(--si-surface, #fff);
            border: 1px solid var(--si-border, #e0e0e0);
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
            font-size: 13px;
            line-height: 1.5;
            color: var(--si-text-primary, #333);
            white-space: normal;
            animation: tooltipFadeIn 0.15s ease;
        }
        @keyframes tooltipFadeIn {
            from {
                opacity: 0;
                transform: translateY(-4px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .tooltip-content {
            word-wrap: break-word;
        }`,
  ],
})
export class InfoTooltipComponent {
  @Input({ required: true }) text = "";
  @Input() trigger: 'click' | 'hover' = 'click';

  open = signal(false);

  private readonly el = inject(ElementRef);
  private hoverTimeout: any;

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.trigger === 'click') {
      this.open.set(!this.open());
    }
  }

  onMouseEnter(): void {
    if (this.trigger === 'hover') {
      clearTimeout(this.hoverTimeout);
      this.open.set(true);
    }
  }

  onMouseLeave(): void {
    if (this.trigger === 'hover') {
      this.hoverTimeout = setTimeout(() => this.open.set(false), 150);
    }
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: Event): void {
    if (this.open() && !this.el.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }
}
