import { Component, Input, signal, OnChanges, SimpleChanges } from "@angular/core";
import { WorkItemGroup, HierarchyNode, LinkedPr, QaItem } from "../../core/models";
import { InfoTooltipComponent } from "../info-tooltip/info-tooltip.component";

interface FlatTreeRow {
  node: HierarchyNode;
  depth: number;
  hasChildren: boolean;
  qaItem?: QaItem;
  mismatchTooltip?: string;
}

@Component({
  selector: "si-work-item-groups",
  standalone: true,
  imports: [InfoTooltipComponent],
  template: require("./work-item-group.component.html"),
  styles: [require("./work-item-group.component.scss")],
})
export class WorkItemGroupComponent implements OnChanges {
  @Input({ required: true }) groups: WorkItemGroup[] = [];
  @Input() hierarchy: HierarchyNode[] = [];
  @Input() defaultCollapsed = false;

  collapsedIds = signal(new Set<number>());
  /** Collapsed group indices for flat groups mode */
  collapsedGroups = signal(new Set<number>());

  private initialized = false;

  ngOnChanges(changes: SimpleChanges): void {
    // Apply default collapsed state when groups/hierarchy first arrive
    if (!this.initialized && (changes['groups'] || changes['hierarchy'])) {
      const ids = new Set<number>();
      if (this.hierarchy.length > 0) {
        const walk = (nodes: HierarchyNode[]) => {
          for (const n of nodes) {
            const hasChildren = n.childNodes.length > 0 || (n.qaItems?.length ?? 0) > 0;
            const isInProgress = n.item.state === 'In Progress';
            const hasActiveChild = n.childNodes.some(c => c.item.state === 'In Progress')
              || (n.qaItems?.some(q => q.state !== 'Done' && q.state !== 'Closed') ?? false);
            // Expand if node or any child is In Progress; collapse otherwise
            if (hasChildren && !isInProgress && !hasActiveChild) {
              ids.add(n.item.id);
            }
            walk(n.childNodes);
          }
        };
        walk(this.hierarchy);
        this.collapsedIds.set(ids);
      }
      if (this.groups.length > 0 && this.defaultCollapsed) {
        const indices = new Set<number>();
        this.groups.forEach((g, i) => {
          if (g.children.length > 0) indices.add(i);
        });
        this.collapsedGroups.set(indices);
      }
      this.initialized = true;
    }
  }

  toggleCollapse(id: number): void {
    const s = new Set(this.collapsedIds());
    if (s.has(id)) {
      // Expanding: also expand all descendant nodes
      s.delete(id);
      const expandDescendants = (nodes: HierarchyNode[]) => {
        for (const n of nodes) {
          s.delete(n.item.id);
          expandDescendants(n.childNodes);
        }
      };
      const findAndExpand = (nodes: HierarchyNode[]) => {
        for (const n of nodes) {
          if (n.item.id === id) {
            expandDescendants(n.childNodes);
            return;
          }
          findAndExpand(n.childNodes);
        }
      };
      findAndExpand(this.hierarchy);
    } else {
      s.add(id);
    }
    this.collapsedIds.set(s);
  }

  isCollapsed(id: number): boolean {
    return this.collapsedIds().has(id);
  }

  toggleGroupCollapse(index: number): void {
    const s = new Set(this.collapsedGroups());
    if (s.has(index)) s.delete(index);
    else s.add(index);
    this.collapsedGroups.set(s);
  }

  isGroupCollapsed(index: number): boolean {
    return this.collapsedGroups().has(index);
  }

  // Workflow order for parent types (PBI/Bug): New → Approved → Committed → Done
  private readonly parentWorkflow: Record<string, number> = {
    'New': 0, 'Approved': 1, 'Committed': 2, 'Done': 3, 'Closed': 3,
  };
  // Workflow order for child types (Task): To Do → In Progress → Done
  private readonly taskWorkflow: Record<string, number> = {
    'To Do': 0, 'New': 0, 'In Progress': 1, 'Done': 2, 'Closed': 2,
  };
  // Maps task progress to minimum expected parent state
  private readonly taskToParentMin: Record<string, string> = {
    'In Progress': 'Committed',
    'Done': 'Committed',
    'Closed': 'Committed',
  };

  private isInProgress(state: string): boolean {
    return state === 'In Progress';
  }

  private isDone(state: string): boolean {
    return state === 'Done' || state === 'Closed';
  }

  flattenTree(): FlatTreeRow[] {
    const rows: FlatTreeRow[] = [];
    const walk = (nodes: HierarchyNode[], depth: number) => {
      // Sort: In Progress first, then others, Done/Closed last
      const sorted = [...nodes].sort((a, b) => {
        const aOrder = this.isInProgress(a.item.state) ? 0 : this.isDone(a.item.state) ? 2 : 1;
        const bOrder = this.isInProgress(b.item.state) ? 0 : this.isDone(b.item.state) ? 2 : 1;
        return aOrder - bOrder;
      });
      for (const node of sorted) {
        const hasRealChildren = node.childNodes.length > 0;
        const hasQaItems = (node.qaItems?.length ?? 0) > 0;
        const hasChildren = hasRealChildren || hasQaItems;
        rows.push({ node, depth, hasChildren, mismatchTooltip: this.getStatusMismatch(node) });
        if (!this.isCollapsed(node.item.id)) {
          if (hasRealChildren) {
            walk(node.childNodes, depth + 1);
          }
          if (hasQaItems) {
            for (const qa of node.qaItems!) {
              rows.push({ node, depth: depth + 1, hasChildren: false, qaItem: qa });
            }
          }
        }
      }
    };
    walk(this.hierarchy, 0);
    return rows;
  }

  getRowTrackId(row: FlatTreeRow): string | number {
    return row.qaItem ? `qa-${row.qaItem.id}` : row.node.item.id;
  }

  getQaAssigneeLabel(qa: QaItem): string {
    if (qa.assignedTo && qa.assignedTo !== 'Unassigned') {
      if (qa.state === 'To Do' || qa.state === 'New') {
        return 'Needs Dev Attention';
      }
      return qa.assignedTo;
    }
    return qa.state === 'Test' ? 'Yet to be picked' : 'Ready for Test';
  }

  /**
   * Check if a parent node's state is behind its children's progress.
   * Returns a tooltip string if mismatch found, otherwise undefined.
   */
  private getStatusMismatch(node: HierarchyNode): string | undefined {
    if (node.childNodes.length === 0) return undefined;
    const parentOrder = this.parentWorkflow[node.item.state];
    if (parentOrder === undefined) return undefined; // unknown state, skip

    for (const child of node.childNodes) {
      const minParent = this.taskToParentMin[child.item.state];
      if (!minParent) continue; // child is To Do/New, no issue
      const minParentOrder = this.parentWorkflow[minParent];
      if (minParentOrder !== undefined && parentOrder < minParentOrder) {
        return `Parent is '${node.item.state}' but child ${child.item.workItemType} #${child.item.id} is '${child.item.state}' — update parent to '${minParent}'`;
      }
    }
    return undefined;
  }

  getStateClass(state: string): string {
    switch (state) {
      case "In Progress":
        return "state-progress";
      case "Blocked":
        return "state-blocked";
      case "New":
      case "To Do":
        return "state-new";
      case "Done":
      case "Closed":
        return "state-done";
      case "Approved":
        return "state-approved";
      default:
        return "";
    }
  }

  /** Build PR web URL using the repo's actual project for cross-project PRs */
  getPrUrl(pr: LinkedPr, itemUrl: string): string | null {
    if (!itemUrl) return null;
    // Extract org base: https://dev.azure.com/{org}
    const orgMatch = itemUrl.match(/^(https:\/\/[^/]+\/[^/]+)\//);
    if (!orgMatch) return null;
    const orgBase = orgMatch[1];
    // Use repo's project if resolved, otherwise fall back to the work item's project
    const projectMatch = itemUrl.match(/^https:\/\/[^/]+\/[^/]+\/([^/]+)\//);
    const project = pr.repoProject || (projectMatch ? projectMatch[1] : '');
    const repo = pr.repoName || pr.repoId;
    if (!project || !repo) return null;
    return `${orgBase}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repo)}/pullrequest/${pr.id}`;
  }

  onPrClick(event: Event): void {
    event.stopPropagation();
  }

  openLink(url: string | undefined, event: Event): void {
    // Don't navigate if clicking a PR badge (it has its own href)
    if ((event.target as HTMLElement).closest('.pr-badge')) return;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  getTypeClass(type: string): string {
    switch (type) {
      case "User Story":
      case "Product Backlog Item":
        return "type-story";
      case "Task":
        return "type-task";
      case "QA":
      case "QA Task":
      case "Test Case":
      case "Test Plan":
      case "Test Suite":
        return "type-qa";
      case "Bug":
        return "type-bug";
      case "Impediment":
        return "type-impediment";
      case "Feature":
        return "type-feature";
      case "Epic":
        return "type-epic";
      default:
        return "";
    }
  }
}
