import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'si-release-card',
  standalone: true,
  templateUrl: './release-card.component.html',
  styleUrls: ['./release-card.component.scss'],
})
export class ReleaseCardComponent implements OnChanges {
  @Input() epicTitle = '';
  @Input() releaseType: 'major' | 'patch' = 'major';
  @Input() state = '';
  @Input() cycleTimeDays: number | null = null;
  @Input() itemsTotal = 0;
  @Input() itemsDone = 0;
  @Input() storyPointsTotal = 0;
  @Input() storyPointsDone = 0;
  @Input() impedimentCount = 0;
  @Input() impedimentsDone = 0;
  @Input() epicUrl = '';
  @Input() patchCount: number | null = null;
  @Input() majorGroup = '';
  @Input() fullCycleTimeDays: number | null = null;
  @Input() closedDate: Date | null = null;
  @Input() targetDate: Date | null = null;
  /** When true the card renders as a compact single row; click to expand full view. */
  @Input() compactMode = false;

  isExpanded = false;
  showDetails = false;

  ngOnChanges(changes: SimpleChanges): void {
    // When parent resets compactMode to true (e.g. "Collapse all"), fold the card back
    if (changes['compactMode']?.currentValue === true) {
      this.isExpanded = false;
    }
  }

  get isDone(): boolean {
    return this.state === 'Done' || this.state === 'Closed';
  }

  get hasSecondaryStats(): boolean {
    return this.storyPointsTotal > 0 ||
      (this.patchCount !== null && this.releaseType === 'major') ||
      this.fullCycleTimeDays !== null;
  }

  get targetDateLabel(): string {
    if (!this.targetDate) return '';
    return this.targetDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get releasedOnLabel(): string {
    if (!this.closedDate) return '';
    return this.closedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get monthYearLabel(): string {
    if (!this.majorGroup) return '';
    const [yearStr, monthStr] = this.majorGroup.split('.');
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return '';
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get progressPct(): number {
    const totalItems = this.itemsTotal + this.impedimentCount;
    const doneItems = this.itemsDone + this.impedimentsDone;
    return totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  }

  get spProgressPct(): number {
    return this.storyPointsTotal > 0 ? Math.round((this.storyPointsDone / this.storyPointsTotal) * 100) : 0;
  }
}
