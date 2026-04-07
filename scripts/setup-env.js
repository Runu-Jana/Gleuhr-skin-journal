/**
 * setup-env.js
 * Copies .env.example → .env (root and client/) if the target doesn't exist yet.
 * Run with: npm run setup
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const pairs = [
  [path.join(root, '.env.example'), path.join(root, '.env')],
  [path.join(root, 'client', '.env.example'), path.join(root, 'client', '.env')],
];

let anyCreated = false;

for (const [src, dest] of pairs) {
  if (!fs.existsSync(src)) {
    console.warn(`[setup-env] WARNING: ${src} not found, skipping.`);
    continue;
  }
  if (fs.existsSync(dest)) {
    console.log(`[setup-env] ${path.relative(root, dest)} already exists — skipping.`);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log(`[setup-env] Created ${path.relative(root, dest)} from ${path.relative(root, src)}`);
  anyCreated = true;
}

if (anyCreated) {
  console.log('\n[setup-env] Done. Open the .env files and fill in your real values before starting the app.\n');
} else {
  console.log('\n[setup-env] All .env files already present.\n');
}
