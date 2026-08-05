/**
 * @file webpack.local.config.js
 *
 * Extends the standard webpack config with mock Azure DevOps SDK/API aliases so
 * you can run and test the full application locally in a browser without publishing
 * the extension to Azure DevOps.
 *
 * Usage:
 *   npm run dev:local
 *
 * Then open  http://localhost:4300  in your browser.
 *
 * How it works
 * ─────────────
 * Webpack's `resolve.alias` replaces the real Azure DevOps npm packages with
 * lightweight local mocks (src/local-dev/).  The Angular app, all components,
 * and all business-logic services run unmodified — only the external API calls
 * are intercepted.  Mock data is defined in src/local-dev/mock-data.js and
 * leave/holiday data is persisted to localStorage between page reloads.
 */

import baseConfigFn from './webpack.config.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const localConfig = (env, argv) => {
  const base = baseConfigFn(env ?? {}, argv ?? { mode: 'development' });

  // ── Replace Azure DevOps packages with local mocks ──────────────────────────
  // The `$` suffix on the root package makes it an exact-match alias so it does
  // not intercept sub-path imports like `azure-devops-extension-api/Git`.
  base.resolve.alias = {
    ...base.resolve.alias,
    'azure-devops-extension-sdk': resolve(__dirname, 'src/local-dev/mock-sdk.js'),
    'azure-devops-extension-api/WorkItemTracking': resolve(__dirname, 'src/local-dev/mock-api-wit.js'),
    'azure-devops-extension-api/Git':              resolve(__dirname, 'src/local-dev/mock-api-git.js'),
    'azure-devops-extension-api/Work':             resolve(__dirname, 'src/local-dev/mock-api-work.js'),
    'azure-devops-extension-api/Core':             resolve(__dirname, 'src/local-dev/mock-api-core.js'),
    'azure-devops-extension-api$':                 resolve(__dirname, 'src/local-dev/mock-api.js'),
  };

  // ── Dev-server tweaks for local use ─────────────────────────────────────────
  // Switch from HTTPS to HTTP so no self-signed certificate is needed.
  base.devServer = {
    ...base.devServer,
    server: 'http',
    port: 4300,
    open: true,              // auto-open browser tab
  };

  return base;
};

export default localConfig;
