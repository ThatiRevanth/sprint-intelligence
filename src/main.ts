import '@angular/compiler';
import 'zone.js';
import './styles.scss';
import { bootstrapApplication } from '@angular/platform-browser';
import { Chart, registerables } from 'chart.js';
import { DashboardComponent } from './app/features/dashboard/dashboard.component';
import { initializeSDK } from './app/core/services/azure-devops.service';

Chart.register(...registerables);

async function main() {
  try {
    await initializeSDK();
  } catch (err) {
    console.error('SDK init skipped (not running in Azure DevOps host):', err);
  }

  bootstrapApplication(DashboardComponent)
    .catch((err) => console.error('Bootstrap error:', err));
}

await main();
