import '@angular/compiler';
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { initializeSDK } from '../app/core/services/azure-devops.service';
import { BlockersWidgetComponent } from '../app/widgets/blockers-widget/blockers-widget.component';

async function main() {
  try {
    await initializeSDK();
  } catch (err) {
    document.body.textContent = 'SDK init failed';
    return;
  }
  bootstrapApplication(BlockersWidgetComponent).catch((err) =>
    console.error('Blockers widget bootstrap error:', err)
  );
}

await main();
