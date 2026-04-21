import '@angular/compiler';
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { initializeSDK } from '../app/core/services/azure-devops.service';
import { SummaryWidgetComponent } from '../app/widgets/summary-widget/summary-widget.component';

async function main() {
  try {
    await initializeSDK();
  } catch (err) {
    document.body.textContent = 'SDK init failed';
    return;
  }
  bootstrapApplication(SummaryWidgetComponent).catch((err) =>
    console.error('Summary widget bootstrap error:', err)
  );
}

main();
