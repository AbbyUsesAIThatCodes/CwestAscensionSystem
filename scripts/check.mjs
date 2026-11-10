import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function visit(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) visit(path);
    else if (/\.(mjs|js)$/.test(path)) {
      const check = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (check.status !== 0) process.exit(check.status || 1);
    }
  }
}
for (const dir of ['server', 'scripts', 'public', 'tests']) visit(dir);
console.log('Syntax checks passed.');
