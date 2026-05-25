import {
  Component,
  ElementRef,
  HostListener,
  inject,
  output,
  signal,
  computed,
  effect,
} from "@angular/core";
import type { TeamSettingsIteration } from "azure-devops-extension-api/Work";
import {
  getSelectedTeamContext,
  teamSwitchCount,
} from "../../core/services/team-selection.service";
import {
  getTeamIterations,
  getCurrentIteration,
} from "../../core/services/iteration.service";

@Component({
  selector: "si-sprint-selector",
  standalone: true,
  templateUrl: './sprint-selector.component.html',
  styleUrls: ['./sprint-selector.component.scss'],
})
export class SprintSelectorComponent {
  sprintChange = output<TeamSettingsIteration>();

  iterations = signal<TeamSettingsIteration[]>([]);
  selectedIteration = signal<TeamSettingsIteration | null>(null);
  currentIteration = signal<TeamSettingsIteration | null>(null);
  loading = signal(true);
  open = signal(false);

  isCurrentSprint = computed(() => {
    const selected = this.selectedIteration();
    const current = this.currentIteration();
    if (!selected || !current) return true;
    return selected.id === current.id;
  });

  private readonly elRef = inject(ElementRef);

  private readonly teamEffect = effect(() => {
    teamSwitchCount();
    this.loadIterations();
  });

  private async loadIterations(): Promise<void> {
    this.loading.set(true);
    try {
      const teamContext = await getSelectedTeamContext();
      const [allIterations, current] = await Promise.all([
        getTeamIterations(teamContext),
        getCurrentIteration(teamContext),
      ]);

      // Sort: most recent first
      const sorted = [...allIterations].sort((a, b) => {
        const aStart = a.attributes?.startDate
          ? new Date(a.attributes.startDate).getTime()
          : 0;
        const bStart = b.attributes?.startDate
          ? new Date(b.attributes.startDate).getTime()
          : 0;
        return bStart - aStart;
      });

      this.iterations.set(sorted);
      this.currentIteration.set(current);

      // Default to current sprint on load
      if (current) {
        this.selectedIteration.set(current);
        this.sprintChange.emit(current);
      } else if (sorted.length > 0) {
        this.selectedIteration.set(sorted[0]);
        this.sprintChange.emit(sorted[0]);
      }
    } catch {
      this.iterations.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  toggle(): void {
    this.open.set(!this.open());
  }

  close(): void {
    this.open.set(false);
  }

  pick(iteration: TeamSettingsIteration): void {
    this.selectedIteration.set(iteration);
    this.sprintChange.emit(iteration);
    this.close();
  }

  isCurrent(iteration: TeamSettingsIteration): boolean {
    return iteration.id === this.currentIteration()?.id;
  }

  isSelected(iteration: TeamSettingsIteration): boolean {
    return iteration.id === this.selectedIteration()?.id;
  }

  formatDateRange(iteration: TeamSettingsIteration): string {
    const start = iteration.attributes?.startDate;
    const end = iteration.attributes?.finishDate;
    if (!start || !end) return "";
    const fmt = (d: Date | string) => {
      const date = new Date(d);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    };
    return `${fmt(start)} – ${fmt(end)}`;
  }

  @HostListener("document:click", ["$event"])
  onDocClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener("document:keydown", ["$event"])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.open()) {
      this.close();
    }
  }
}
