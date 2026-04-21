# Sprint Intelligence & Flow Optimizer

A unified Azure DevOps extension that helps development teams improve sprint delivery predictability.

## Features

1. **Work Item Flow Dashboard** — Tasks by status with aging indicators
2. **Smart Blocker Detection** — Auto-flag stale tasks, blocked dependencies, pending PRs
3. **PR Cycle Time Tracker** — Time-to-review, time-to-merge, rework frequency
4. **Sprint Risk Score** — Dynamic 0-100 risk gauge (🟢 On Track / 🟡 At Risk / 🔴 Likely to Slip)
5. **Workload Balancer** — Story points per dev vs capacity with rebalance suggestions
6. **Auto Sprint Summary** — One-click Markdown/HTML report for managers

## Architecture

- **Frontend:** Angular 17 standalone components
- **Charts:** Chart.js via ng2-charts
- **SDK:** azure-devops-extension-sdk + azure-devops-extension-api
- **Extension:** Hub (under Boards) + 5 Dashboard Widgets
- **Data:** Client-side only — direct Azure DevOps REST API calls

## Setup

```bash
npm install
npm run build
```

## Package & Publish (Private)

1. Update `vss-extension.json` — set your `publisher` ID
2. Package:
   ```bash
   npm run package
   ```
3. Upload the `.vsix` from `./dist/` to your Azure DevOps org:
   - Go to `https://dev.azure.com/{org}/_settings/extensions`
   - Click "Upload extension" and select the `.vsix` file

## Required Azure DevOps Scopes

- `vso.work` — Read work items, queries, iterations, capacity
- `vso.code` — Read repositories, pull requests
- `vso.project` — Read project and team information

## Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── models/       # TypeScript interfaces
│   │   ├── services/     # Azure DevOps API wrappers
│   │   └── utils/        # Date and scoring utilities
│   ├── features/         # 6 hub feature components
│   └── widgets/          # 5 dashboard widget components
├── widgets/              # Widget entry point bootstraps
├── main.ts               # Hub entry point
└── styles.scss           # Global styles
```
