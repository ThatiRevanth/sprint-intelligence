import { SprintWorkItem, WorkItemGroup, HierarchyNode, WorkItemGroupParent, QaItem } from "../models";

const PARENT_TYPES = new Set([
  "User Story",
  "Product Backlog Item",
  "Bug",
  "Impediment",
  "Feature",
  "Epic",
]);

/**
 * Group work items under their parent PBI/Story/Bug.
 * - Items with parentId → grouped under parent header
 * - Parent-level items with no children → shown as standalone group
 * - Orphan items (no parentId, not parent-level type) → grouped together
 */
export function buildWorkItemGroups(
  activeItems: SprintWorkItem[],
  allItemsById: Map<number, SprintWorkItem>,
): WorkItemGroup[] {
  const parentLevelItems: SprintWorkItem[] = [];
  const childItems: SprintWorkItem[] = [];

  for (const item of activeItems) {
    if (item.parentId) {
      childItems.push(item);
    } else if (PARENT_TYPES.has(item.workItemType)) {
      parentLevelItems.push(item);
    } else {
      childItems.push(item);
    }
  }

  const childrenByParent = new Map<number | "orphan", SprintWorkItem[]>();
  for (const child of childItems) {
    const key = child.parentId ?? "orphan";
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(child);
  }

  const groups: WorkItemGroup[] = [];
  const usedParentIds = new Set<number>();

  // Collect all activeItem IDs for dedup
  const activeIds = new Set(activeItems.map((i) => i.id));

  // 1. Groups for children that have a parentId
  for (const [parentId, children] of childrenByParent) {
    if (parentId === "orphan") continue;
    const parentItem = allItemsById.get(parentId);
    usedParentIds.add(parentId);

    groups.push({
      parent: parentItem
        ? {
            id: parentItem.id,
            title: parentItem.title,
            workItemType: parentItem.workItemType,
            state: parentItem.state,
            storyPoints: parentItem.storyPoints,
            tags: parentItem.tags ?? [],
            url: parentItem.url,
            linkedPrs: parentItem.linkedPrs ?? [],
          }
        : {
            id: parentId,
            title: `Work Item #${parentId}`,
            workItemType: "Unknown",
            state: "Unknown",
            storyPoints: 0,
            tags: [],
            url: "",
            linkedPrs: [],
          },
      children,
    });
  }

  // Also mark items that appear as children (they shouldn't get standalone groups)
  const childIds = new Set(childItems.map((i) => i.id));

  // 2. Parent-level items that had no children AND aren't already shown as a child → standalone
  for (const parent of parentLevelItems) {
    if (!usedParentIds.has(parent.id) && !childIds.has(parent.id)) {
      groups.push({
        parent: {
          id: parent.id,
          title: parent.title,
          workItemType: parent.workItemType,
          state: parent.state,
          storyPoints: parent.storyPoints,
          tags: parent.tags ?? [],
          url: parent.url,
          linkedPrs: parent.linkedPrs ?? [],
        },
        children: [],
      });
    }
  }

  // 3. Orphan items (no parentId, not parent-level type)
  const orphans = childrenByParent.get("orphan");
  if (orphans && orphans.length > 0) {
    groups.push({ parent: null, children: orphans });
  }

  return groups;
}

/**
 * Build a full hierarchy tree (Epic → Feature → PBI → Task) from active items.
 * Each node links to its children; active items are marked with `isActiveItem`.
 * Requires `allItemsById` to be pre-enriched with all ancestor items.
 */
export function buildHierarchyTree(
  activeItems: SprintWorkItem[],
  allItemsById: Map<number, SprintWorkItem>,
): HierarchyNode[] {
  const activeSet = new Set(activeItems.map((i) => i.id));

  // For each active item, walk up parent chain to get the full ancestor path
  function getAncestorChain(item: SprintWorkItem): number[] {
    const chain: number[] = [];
    let current: SprintWorkItem | undefined = item;
    const visited = new Set<number>();
    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      chain.unshift(current.id);
      current = current.parentId
        ? allItemsById.get(current.parentId)
        : undefined;
    }
    return chain;
  }

  // Build tree via nested maps
  interface BuildNode {
    id: number;
    children: Map<number, BuildNode>;
  }
  const roots = new Map<number, BuildNode>();

  for (const item of activeItems) {
    const chain = getAncestorChain(item);
    let level = roots;
    for (const id of chain) {
      if (!level.has(id)) {
        level.set(id, { id, children: new Map() });
      }
      level = level.get(id)!.children;
    }
  }

  // Convert build nodes to HierarchyNode[]
  function toHierarchy(map: Map<number, BuildNode>): HierarchyNode[] {
    const result: HierarchyNode[] = [];
    for (const [id, buildNode] of map) {
      const wi = allItemsById.get(id);
      if (!wi) continue;
      result.push({
        item: {
          id: wi.id,
          title: wi.title,
          workItemType: wi.workItemType,
          state: wi.state,
          storyPoints: wi.storyPoints,
          tags: wi.tags ?? [],
          url: wi.url,
          linkedPrs: wi.linkedPrs ?? [],
        },
        childNodes: toHierarchy(buildNode.children),
        isActiveItem: activeSet.has(id),
        workItem: activeSet.has(id) ? wi : undefined,
      });
    }
    return result;
  }

  return toHierarchy(roots);
}

function isQaTask(item: SprintWorkItem): boolean {
  return item.workItemType === 'QA' || item.workItemType === 'QA Task';
}

/**
 * Walk a hierarchy tree and attach QA sibling items to each parent node.
 * QA items are work items with workItemType 'QA' (custom type)
 * that are children of nodes in the tree but not already shown as tree nodes.
 */
export function attachQaItems(
  hierarchy: HierarchyNode[],
  _memberItemIds: Set<number>,
  childrenByParentId: Map<number, SprintWorkItem[]>,
): void {
  // Collect all IDs already in the tree to avoid duplicates
  const treeIds = new Set<number>();
  const collectIds = (nodes: HierarchyNode[]) => {
    for (const n of nodes) {
      treeIds.add(n.item.id);
      collectIds(n.childNodes);
    }
  };
  collectIds(hierarchy);

  const walk = (nodes: HierarchyNode[]) => {
    for (const node of nodes) {
      const siblings = childrenByParentId.get(node.item.id) ?? [];
      const qaItems: QaItem[] = siblings
        .filter((s) => isQaTask(s) && !treeIds.has(s.id))
        .map((s) => ({
          id: s.id,
          title: s.title,
          state: s.state,
          assignedTo: s.assignedTo,
          tags: s.tags ?? [],
          url: s.url,
        }));
      if (qaItems.length > 0) {
        node.qaItems = qaItems;
      }
      walk(node.childNodes);
    }
  };
  walk(hierarchy);
}
