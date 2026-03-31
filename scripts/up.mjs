import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = new URL('../', import.meta.url);
const composePath = new URL('../infra/compose/docker-compose.yml', import.meta.url);
const envExamplePath = new URL('../.env.example', import.meta.url);

await fs.access(composePath);
await fs.access(envExamplePath);

const envPath = path.join(process.cwd(), '.env');
let envPresent = false;
try {
  await fs.access(envPath);
  envPresent = true;
} catch {
  envPresent = false;
}

console.log('[sofia] compose stack is present');
console.log(`[sofia] repo root: ${new URL(rootDir).pathname.replace(/\//g, path.sep).replace(/^[\\]?([A-Za-z]:)/, '$1')}`);
console.log(`[sofia] env file: ${envPresent ? '.env present' : '.env missing, copy from .env.example'}`);
console.log('[sofia] recommended bootstrap sequence:');
console.log('  1. docker compose -f infra/compose/docker-compose.yml up -d postgres redis api web admin');
console.log('  2. node apps/sofia-api/scripts/migrate.js');
console.log('  3. optional worker: node scripts/worker-loop.mjs');
console.log('  4. optional approval poller: node scripts/approval-poller-loop.mjs');
console.log('  5. node apps/sofia-api/scripts/doctor.js');
console.log('  6. node apps/sofia-api/scripts/smoke.js');
console.log('  7. open http://127.0.0.1:3000 for Sofia Web and http://127.0.0.1:3001 for Sofia Admin');
