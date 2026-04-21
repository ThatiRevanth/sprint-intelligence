# Sprint Intelligence & Flow Optimizer

**Get real-time sprint health insights — all in one place.**

Sprint Intelligence adds a unified dashboard and a set of dashboard widgets to Azure DevOps that give your team instant visibility into sprint progress, blockers, PR cycle times, workload balance, and overall risk.

---

## Features

### Sprint Dashboard Hub

A full-page hub under **Boards → Sprint Intelligence** with seven integrated views:

- **Summary** — At-a-glance sprint completion, story points burned, and velocity trend. Export reports as Markdown or HTML.
- **Standup** — Team-by-team standup view with member grouping, presenter mode, and work item status grouped by parent hierarchy.
- **Flow** — Work item state distribution chart and aging item detection to surface items stuck in progress.
- **Blockers** — Automatic blocker detection across stale items, blocked dependencies, and pending PRs, ranked by severity.
- **PR Tracker** — Pull request cycle time analysis with per-PR merge time chart, reviewer stats, and stuck PR count.
- **Risk Score** — Composite sprint risk gauge (0–100) combining completion rate, blocker count, aging items, and remaining capacity.
- **Workload** — Team workload distribution with load ratios, overloaded/light-load member highlighting, and rebalance suggestions.

### Dashboard Widgets

Five widgets you can add to any Azure DevOps dashboard:

| Widget | Description |
|--------|-------------|
| **Sprint Risk Score** | Doughnut gauge showing the sprint risk score with on-track / at-risk / likely-to-slip status |
| **Sprint Blockers** | Blocker count with the top 3 blockers listed by severity |
| **PR Cycle Time** | Average merge time, stuck PR count, total PRs, and average rework iterations |
| **Workload Balance** | Horizontal bar chart of remaining points per team member, colored by load status |
| **Sprint Summary** | Completion stats, story point progress bar, and risk indicator |

---

## How It Works

Sprint Intelligence reads data from your existing Azure DevOps project using the standard REST APIs:

- **Work Item Tracking** — Queries sprint backlog items, states, assignments, and story points
- **Git** — Reads pull request data including review times, iterations, and merge status
- **Core / Work** — Gets team context, iteration details, and capacity information

No data leaves your Azure DevOps organization. The extension runs entirely in the browser and stores only minimal configuration (standup team groupings) using the Extension Data Service.

---

## Theme Support

Sprint Intelligence automatically adapts to your Azure DevOps theme — both **light** and **dark** modes are fully supported across the dashboard and all widgets.

---

## Getting Started

1. Install the extension from the Marketplace
2. Navigate to your project → **Boards** → **Sprint Intelligence**
3. The dashboard loads data from your current sprint automatically
4. Add widgets to any Azure DevOps dashboard via the widget catalog

---

## Permissions Required

| Scope | Reason |
|-------|--------|
| `vso.work` | Read work items, iterations, and team capacity |
| `vso.code` | Read pull request data and review information |
| `vso.project` | Read project and team context |

All scopes are **read-only**. The extension does not modify any work items, PRs, or project settings.

---

## Feedback & Support

Found a bug or have a feature request? Open an issue on the repository or reach out to the publisher.
