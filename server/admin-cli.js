import { db } from './database.js';
import { randomUUID } from 'node:crypto';
const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error('Usage: npm run admin -- existing-player@example.com');
  process.exit(1);
}
const user = db.prepare('SELECT id,username,role,suspended FROM users WHERE email=?').get(email);
if (!user) {
  console.error(
    'Account not found. Create a normal account first, then run this command on the server.',
  );
  process.exit(1);
}
if (user.suspended) {
  console.error('Restore the suspended account before granting administrator access.');
  process.exit(1);
}
if (user.role === 'admin') {
  console.log(`${user.username} is already an administrator.`);
  process.exit(0);
}
db.exec('BEGIN IMMEDIATE');
try {
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(user.id);
  db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').run(
    randomUUID(),
    null,
    'admin.grant',
    user.id,
    'Administrator access granted by the server owner using the local CLI.',
    new Date().toISOString(),
  );
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
console.log(
  `Administrator access granted to ${user.username}. Refresh PuzzleMind to open Admin studio.`,
);
