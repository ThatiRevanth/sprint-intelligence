/**
 * @file mock-data.js
 * Realistic mock data for local development testing.
 * Simulated date: 2026-07-29 (mid-sprint).
 */

export const MOCK_PROJECT = { name: 'Demo Project', id: 'proj-demo-001' };

export const MOCK_USER = {
  displayName: 'Alice Kumar',
  id: 'user-alice-001',
  uniqueName: 'alice.kumar@demo.org',
};

export const MOCK_TEAMS = [
  { id: 'team-alpha-001', name: 'Alpha Team', description: 'Main development team' },
  { id: 'team-beta-001',  name: 'Beta Team',  description: 'Secondary team' },
];

export const MOCK_TEAM_MEMBERS_RAW = [
  { displayName: 'Alice Kumar',  id: 'user-alice-001' },
  { displayName: 'Bob Singh',    id: 'user-bob-001'   },
  { displayName: 'Carol Martin', id: 'user-carol-001' },
  { displayName: 'Dave Chen',    id: 'user-dave-001'  },
  { displayName: 'Eve Williams', id: 'user-eve-001'   },
];

/* ── Iterations ──────────────────────────────────────── */

export const MOCK_ITERATIONS = [
  {
    id: 'iter-39', name: 'Sprint 39',
    path: 'Demo Project\\Alpha Team\\Sprint 39',
    attributes: { startDate: new Date('2026-05-20'), finishDate: new Date('2026-06-07'), timeFrame: 'past' },
  },
  {
    id: 'iter-40', name: 'Sprint 40',
    path: 'Demo Project\\Alpha Team\\Sprint 40',
    attributes: { startDate: new Date('2026-06-10'), finishDate: new Date('2026-06-28'), timeFrame: 'past' },
  },
  {
    id: 'iter-41', name: 'Sprint 41',
    path: 'Demo Project\\Alpha Team\\Sprint 41',
    attributes: { startDate: new Date('2026-06-30'), finishDate: new Date('2026-07-18'), timeFrame: 'past' },
  },
  {
    id: 'iter-42', name: 'Sprint 42',
    path: 'Demo Project\\Alpha Team\\Sprint 42',
    attributes: { startDate: new Date('2026-07-21'), finishDate: new Date('2026-08-08'), timeFrame: 'current' },
  },
];

/* ── Work items ──────────────────────────────────────── */

function assignee(name, id) {
  return { displayName: name, id, uniqueName: `${name.toLowerCase().replace(' ', '.')}@demo.org` };
}

const ALICE = assignee('Alice Kumar',  'user-alice-001');
const BOB   = assignee('Bob Singh',    'user-bob-001');
const CAROL = assignee('Carol Martin', 'user-carol-001');
const DAVE  = assignee('Dave Chen',    'user-dave-001');
const EVE   = assignee('Eve Williams', 'user-eve-001');

function daysAgo(n) {
  const d = new Date('2026-07-29T09:00:00Z');
  d.setDate(d.getDate() - n);
  return d;
}

function wi(id, type, title, state, who, pts, changedAgo = 1, tags = '', parentId = null) {
  const changed = daysAgo(changedAgo);
  const created = daysAgo(changedAgo + 8);
  const relations = parentId
    ? [{ rel: 'System.LinkTypes.Hierarchy-Reverse', url: `https://localhost/workItems/${parentId}`, attributes: {} }]
    : [];
  return {
    id,
    fields: {
      'System.Id': id,
      'System.Title': title,
      'System.State': state,
      'System.AssignedTo': who,
      'System.WorkItemType': type,
      'Microsoft.VSTS.Scheduling.StoryPoints': pts,
      'System.ChangedDate': changed.toISOString(),
      'System.CreatedDate': created.toISOString(),
      'System.Tags': tags,
      'Microsoft.VSTS.Common.Activity': type === 'Task' ? 'Development' : '',
      'System.IterationPath': 'Demo Project\\Alpha Team\\Sprint 42',
    },
    relations,
    _links: { html: { href: `https://dev.azure.com/demo/Demo+Project/_workitems/edit/${id}` } },
  };
}

export const MOCK_WORK_ITEMS = [
  /* Features ──────────────────────────────────────────── */
  wi(100, 'Feature', 'User Authentication',   'Active',      ALICE, 0, 6),
  wi(110, 'Feature', 'Payment Module',        'Active',      CAROL, 0, 5),
  wi(120, 'Feature', 'Performance & Quality', 'Active',      DAVE,  0, 4),

  /* PBIs under Feature 100 */
  wi(101, 'User Story', 'Login page redesign', 'In Progress', ALICE, 5, 1, '',       100),
  wi(102, 'User Story', 'OAuth integration',   'Active',      BOB,   8, 2, '',       100),

  /* Tasks under PBI 101 */
  wi(201, 'Task', 'Create login UI component', 'In Progress', ALICE, 0, 1, '', 101),
  wi(202, 'Task', 'Add form validation',        'Active',      ALICE, 0, 2, '', 101),
  /* Task under PBI 102 */
  wi(203, 'Task', 'OAuth flow implementation', 'Active',      BOB,   0, 3, '', 102),

  /* PBIs under Feature 110 */
  wi(111, 'Product Backlog Item', 'Checkout flow implementation', 'Blocked',      CAROL, 13, 3, 'blocker; critical', 110),
  wi(112, 'User Story',           'Order history view',          'In Progress',   CAROL,  5, 1, '',                  110),

  /* Tasks under PBI 111 */
  wi(210, 'Task', 'Payment gateway API integration', 'Blocked',      CAROL, 0, 3, 'blocker', 111),
  /* Tasks under PBI 112 */
  wi(211, 'Task', 'History API endpoint',            'In Progress',  CAROL, 0, 1, '',        112),

  /* PBIs under Feature 120 */
  wi(121, 'User Story', 'Backend query optimisation', 'In Progress', DAVE, 8, 1, '', 120),
  wi(130, 'User Story', 'E2E test framework setup',   'In Progress', EVE,  5, 2, '', 120),

  /* Tasks under PBI 121 */
  wi(220, 'Task', 'Index analysis script', 'In Progress', DAVE, 0, 1, '', 121),
  wi(221, 'Task', 'Query refactoring',      'Active',      DAVE, 0, 2, '', 121),
  /* Tasks under PBI 130 */
  wi(230, 'Task', 'Cypress configuration',  'In Progress', EVE, 0, 2, '', 130),
  wi(231, 'Task', 'Write first test suite', 'Active',      EVE, 0, 3, '', 130),

  /* Completed PBIs (velocity / summary) ─────────────── */
  wi(140, 'User Story', 'Sprint kickoff tasks',        'Closed', ALICE, 2, 8),
  wi(141, 'User Story', 'Design system audit',         'Closed', ALICE, 3, 6),
  wi(150, 'User Story', 'API documentation update',    'Closed', CAROL, 3, 5),
  wi(160, 'User Story', 'Performance baseline report', 'Closed', DAVE,  2, 7),
  wi(170, 'User Story', 'QA test plan document',       'Closed', EVE,   3, 6),

  /* Bugs ─────────────────────────────────────────────── */
  wi(501, 'Bug', 'Login page flicker on mobile',     'Active',      ALICE, 2, 2),
  wi(502, 'Bug', 'Cart not clearing after checkout', 'In Progress', CAROL, 3, 1, 'critical'),
];

export const MOCK_WORK_ITEM_IDS = MOCK_WORK_ITEMS.map(w => ({ id: w.id }));

/* ── Git repositories & PRs ──────────────────────────── */

export const MOCK_REPOSITORIES = [
  { id: 'repo-fe-001', name: 'frontend', project: { id: 'proj-demo-001', name: 'Demo Project' } },
  { id: 'repo-be-001', name: 'backend',  project: { id: 'proj-demo-001', name: 'Demo Project' } },
];

function prDate(daysAgo, hoursAgo = 0) {
  const d = new Date('2026-07-29T18:00:00Z');
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d;
}

// status 1 = Active, 3 = Completed
export const MOCK_PRS = {
  'repo-fe-001': [
    {
      pullRequestId: 42, status: 3,
      title: 'feat: login UI redesign & mobile layout',
      createdBy: { id: 'user-alice-001', displayName: 'Alice Kumar' },
      creationDate: prDate(4), closedDate: prDate(2),
      reviewers: [{ id: 'user-carol-001', displayName: 'Carol Martin', vote: 10 }],
    },
    {
      pullRequestId: 44, status: 3,
      title: 'fix: login page flicker on mobile',
      createdBy: { id: 'user-alice-001', displayName: 'Alice Kumar' },
      creationDate: prDate(2), closedDate: prDate(1),
      reviewers: [{ id: 'user-bob-001', displayName: 'Bob Singh', vote: 10 }],
    },
    {
      pullRequestId: 47, status: 1,
      title: 'feat: cypress E2E framework setup',
      createdBy: { id: 'user-eve-001', displayName: 'Eve Williams' },
      creationDate: prDate(1), closedDate: undefined,
      reviewers: [],
    },
  ],
  'repo-be-001': [
    {
      pullRequestId: 43, status: 3,
      title: 'feat: order history API endpoint',
      createdBy: { id: 'user-carol-001', displayName: 'Carol Martin' },
      creationDate: prDate(5), closedDate: prDate(3),
      reviewers: [{ id: 'user-dave-001', displayName: 'Dave Chen', vote: 10 }],
    },
    {
      pullRequestId: 45, status: 1,
      title: 'feat: OAuth flow & token refresh [author on leave]',
      createdBy: { id: 'user-bob-001', displayName: 'Bob Singh' },
      creationDate: prDate(3), closedDate: undefined,
      reviewers: [],
    },
    {
      pullRequestId: 46, status: 3,
      title: 'perf: DB index optimisation for history queries',
      createdBy: { id: 'user-dave-001', displayName: 'Dave Chen' },
      creationDate: prDate(3), closedDate: prDate(1),
      reviewers: [{ id: 'user-carol-001', displayName: 'Carol Martin', vote: 10 }],
    },
  ],
};

// PR review thread comments (for first-review time calculation)
export const MOCK_PR_THREADS = {
  42: [{ comments: [{ author: { id: 'user-carol-001' }, publishedDate: prDate(2, 16), isDeleted: false }] }],
  43: [{ comments: [{ author: { id: 'user-dave-001'  }, publishedDate: prDate(3, 20), isDeleted: false }] }],
  44: [{ comments: [{ author: { id: 'user-bob-001'   }, publishedDate: prDate(1, 4),  isDeleted: false }] }],
  46: [{ comments: [{ author: { id: 'user-carol-001' }, publishedDate: prDate(1, 20), isDeleted: false }] }],
};

/* ── Capacity ─────────────────────────────────────────── */

export const MOCK_CAPACITY = {
  teamMembers: [
    { teamMember: { displayName: 'Alice Kumar',  id: 'user-alice-001' }, activities: [{ capacityPerDay: 6, name: 'Development' }] },
    { teamMember: { displayName: 'Bob Singh',    id: 'user-bob-001'   }, activities: [{ capacityPerDay: 6, name: 'Development' }] },
    { teamMember: { displayName: 'Carol Martin', id: 'user-carol-001' }, activities: [{ capacityPerDay: 6, name: 'Development' }] },
    { teamMember: { displayName: 'Dave Chen',    id: 'user-dave-001'  }, activities: [{ capacityPerDay: 5, name: 'Development' }] },
    { teamMember: { displayName: 'Eve Williams', id: 'user-eve-001'   }, activities: [{ capacityPerDay: 6, name: 'Testing'     }] },
  ],
};

/* ── Extension data seed (written to localStorage on first run) ── */

export const EXTENSION_DATA_SEED = {
  // Leave Tracker data for Alpha Team
  'leave-tracker/proj-demo-001-Alpha_Team': {
    id: 'proj-demo-001-Alpha_Team',
    leaves: [
      { memberName: 'Bob Singh',  startDate: '2026-07-28', endDate: '2026-07-29', days: 2, note: 'Personal time off' },
      { memberName: 'Dave Chen',  startDate: '2026-08-05', endDate: '2026-08-08', days: 4, note: 'Family vacation'   },
    ],
    holidays: [
      { date: '2026-08-03', name: 'August Bank Holiday', region: 'UK' },
      { date: '2026-08-10', name: 'National Day',        region: 'IN' },
    ],
    regions: ['UK', 'IN'],
  },
};
