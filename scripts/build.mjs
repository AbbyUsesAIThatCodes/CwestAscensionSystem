import { createHash, randomUUID } from 'node:crypto';
import { closeSync, cpSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = p => JSON.parse(readFileSync(p, 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const args = process.argv.slice(2);
const flag = name => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const release = readJSON(join(root, 'release.json'));
const localDir = join(root, '.build');
mkdirSync(localDir, { recursive: true });
const pr = flag('--pr');
if (pr && !/^[1-9]\d*$/.test(pr)) throw new Error('--pr must be a positive integer.');
const sharedLedger = flag('--ledger');
if (pr && (!sharedLedger || !isAbsolute(sharedLedger))) {
  throw new Error('PR builds require --ledger /absolute/path on the single durable allocator. Use a local build when it is unavailable; do not invent an ordinal.');
}
const ledgerPath = pr ? sharedLedger : join(localDir, 'local-ledger.json');
mkdirSync(dirname(ledgerPath), { recursive: true });
const lockPath = `${ledgerPath}.lock`;
let lock;
for (let attempt = 0; attempt < 100; attempt++) {
  try { lock = openSync(lockPath, 'wx'); break; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
}
if (lock === undefined) throw new Error('Build allocator is busy. Never delete its lock while another builder is running.');
let reservation;
let ledger;
const writeLedger = () => {
  const tmp = `${ledgerPath}.${process.pid}.tmp`;
  const fd = openSync(tmp, 'w');
  writeFileSync(fd, `${JSON.stringify(ledger, null, 2)}\n`);
  // fsync makes a reserved ordinal durable before any artifact is produced.
  // Atomic rename protects readers from partial JSON.
  fsyncSync(fd);
  closeSync(fd);
  renameSync(tmp, ledgerPath);
};
try {
  ledger = existsSync(ledgerPath) ? readJSON(ledgerPath) : { session: randomUUID().slice(0, 8), scopes: {}, reservations: [] };
  const scope = pr ? `pr-${pr}` : `local-${ledger.session}`;
  const ordinal = (ledger.scopes[scope] || 0) + 1;
  ledger.scopes[scope] = ordinal;
  const sourceRevision = git('rev-parse', 'HEAD');
  const sourceDirty = Boolean(git('status', '--porcelain', '--untracked-files=all'));
  const inputs = ['public', 'server', 'scripts', 'tests', 'package.json', 'release.json', 'README.md', 'docs', 'AGENTS.md'];
  const fingerprint = createHash('sha256');
  function hashPath(path, label) {
    const stat = readdirSafe(path);
    if (stat) for (const child of stat) hashPath(join(path, child), `${label}/${child}`);
    else { fingerprint.update(label); fingerprint.update('\0'); fingerprint.update(readFileSync(path)); }
  }
  function readdirSafe(path) { try { return readdirSync(path).sort(); } catch (e) { if (e.code === 'ENOTDIR') return null; throw e; } }
  for (const input of inputs) if (existsSync(join(root, input))) hashPath(join(root, input), input);
  const builtAt = new Date().toISOString();
  const stamp = builtAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const id = `${release.version}_${release.codenameSlug}_${scope}_build-${String(ordinal).padStart(3, '0')}_${stamp}_g${sourceRevision.slice(0, 12)}${sourceDirty ? '-dirty' : ''}`;
  reservation = { id, version: release.version, codename: release.codename, status: 'reserved', scope, pr: pr ? Number(pr) : null, ordinal, builtAt, sourceRevision, sourceDirty, sourceFingerprint: fingerprint.digest('hex'), target: 'node24-web', prHead: process.env.CWEST_PR_HEAD || null };
  ledger.reservations.push(reservation);
  writeLedger();
  console.log(`BUILD START ${id}`);
  const out = join(root, 'dist', id);
  mkdirSync(out, { recursive: true });
  for (const input of inputs) if (existsSync(join(root, input))) cpSync(join(root, input), join(out, input), { recursive: true });
  const manifest = { ...reservation, status: 'built' };
  mkdirSync(join(out, 'public'), { recursive: true });
  const contents = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(join(out, 'build-info.json'), contents);
  writeFileSync(join(out, 'public', 'build-info.json'), contents);
  writeFileSync(join(out, 'BUILD_REPORT.md'), `# CWEST Build Report\n\n${id}\n\n- Status: development prototype\n- Source: ${sourceRevision}${sourceDirty ? ' (dirty; fingerprint in manifest)' : ''}\n- Built At (UTC): ${builtAt}\n- Scope: ${scope}\n- Ordinal: ${ordinal}\n- Release Codename: ${release.codename || 'Not assigned'}\n- Target: Node.js 24 web application\n\nThis is an immutable build identity, not a deployment or school-readiness certification. Run the tests against this artifact before use.\n`);
  reservation.status = 'built';
  reservation.completedAt = new Date().toISOString();
  reservation.output = out;
  writeLedger();
  writeFileSync(join(localDir, 'latest.json'), contents);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## CWEST Build\n\n${id}\n\nSource: ${sourceRevision}\n`, { flag: 'a' });
  console.log(`BUILD SUCCESS ${id}\nOUTPUT ${out}`);
} catch (error) {
  if (reservation) { reservation.status = 'failed'; reservation.error = error.message; try { writeLedger(); } catch {} console.error(`BUILD FAILURE ${reservation.id}`); }
  throw error;
} finally {
  closeSync(lock);
  rmSync(lockPath);
}
