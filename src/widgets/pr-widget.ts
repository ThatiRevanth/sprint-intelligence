import '@angular/compiler';
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { initializeSDK } from '../app/core/services/azure-devops.service';
import { PrWidgetComponent } from '../app/widgets/pr-widget/pr-widget.component';

async function main() {
  try {
    await initializeSDK();
  } catch (err) {
    document.body.textContent = 'SDK init failed';
    return;
  }
  bootstrapApplication(PrWidgetComponent).catch((err) =>
    console.error('PR widget bootstrap error:', err)
  );
}

main();
