import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) { console.log('.env already exists; credentials preserved.'); process.exit(0); }
const admin = randomBytes(24).toString('hex');
const app = randomBytes(24).toString('hex');
const auth = randomBytes(24).toString('hex');
writeFileSync('.env', `PORT=4310\nAPP_ORIGIN=http://localhost:4310\nPG_PORT=55432\nPOSTGRES_PASSWORD=${admin}\nAPP_DB_PASSWORD=${app}\nAUTH_DB_PASSWORD=${auth}\nBETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\nDATABASE_ADMIN_URL=postgresql://postgres:${admin}@localhost:55432/tenantflow\nDATABASE_URL=postgresql://tenantflow_app:${app}@localhost:55432/tenantflow\nAUTH_DATABASE_URL=postgresql://tenantflow_auth:${auth}@localhost:55432/tenantflow\n`, { mode: 0o600, flag: 'wx' });
console.log('Created local .env with random credentials. Next: npm run db:up && npm run db:migrate');
