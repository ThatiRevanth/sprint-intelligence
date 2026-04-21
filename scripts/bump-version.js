const fs = require('fs');
const path = require('path');

const files = ['package.json', 'vss-extension.json', 'vss-extension.dev.json'];
const root = path.resolve(__dirname, '..');

for (const file of files) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) continue;

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const parts = content.version.split('.').map(Number);
    parts[2] += 1;
    content.version = parts.join('.');

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
    console.log(`${file} → ${content.version}`);
}
