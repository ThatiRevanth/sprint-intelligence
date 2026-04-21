import {
  Component,
  OnInit,
  signal,
  computed,
  HostListener,
  ElementRef,
  inject,
} from "@angular/core";
import {
  teams,
  selectedTeam,
  teamsLoading,
  teamSelectorDisabled,
  selectTeam,
  initTeams,
  TeamInfo,
} from "../../core/services/team-selection.service";

@Component({
  selector: "si-team-selector",
  standalone: true,
  template: require("./team-selector.component.html"),
  styles: [require("./team-selector.component.scss")],
})
export class TeamSelectorComponent implements OnInit {
  teams = teams;
  selected = selectedTeam;
  loading = teamsLoading;
  disabled = teamSelectorDisabled;
  open = signal(false);
  search = signal("");

  filteredTeams = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.teams();
    return this.teams().filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  });

  private readonly elRef = inject(ElementRef);

  ngOnInit(): void {
    initTeams();
  }

  toggle(): void {
    if (this.disabled()) return;
    this.open.set(!this.open());
    if (this.open()) {
      this.search.set("");
    }
  }

  close(): void {
    this.open.set(false);
    this.search.set("");
  }

  pick(team: TeamInfo): void {
    selectTeam(team);
    this.close();
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
