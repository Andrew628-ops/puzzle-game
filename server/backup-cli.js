import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const destination = process.argv[2];
if (!destination) {
  console.error('Usage: npm run backup -- data/backups/puzzlemind.sqlite');
  process.exit(1);
}
const source = resolve(process.env.DATA_DIR || './data', 'puzzlemind.sqlite');
const target = resolve(destination);
if (!existsSync(source)) {
  console.error('Database not found. Set DATA_DIR to the existing application database directory.');
  process.exit(1);
}
if (existsSync(target)) {
  console.error('Destination already exists. Choose a new backup filename.');
  process.exit(1);
}
// Snapshots contain private account data. Keep them outside public assets and source control.
process.umask(0o077);
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try {
  db.exec('PRAGMA busy_timeout=5000');
  // Includes committed WAL contents even while the app is running.
  db.prepare('VACUUM INTO ?').run(target);
  console.log(`Database backup saved to ${target}`);
} finally {
  db.close();
}
