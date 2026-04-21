import '@angular/compiler';
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { Chart, registerables } from 'chart.js';
import { initializeSDK } from '../app/core/services/azure-devops.service';
import { WorkloadWidgetComponent } from '../app/widgets/workload-widget/workload-widget.component';

Chart.register(...registerables);

async function main() {
  try {
    await initializeSDK();
  } catch (err) {
    document.body.textContent = 'SDK init failed';
    return;
  }
  bootstrapApplication(WorkloadWidgetComponent).catch((err) =>
    console.error('Workload widget bootstrap error:', err)
  );
}

main();
