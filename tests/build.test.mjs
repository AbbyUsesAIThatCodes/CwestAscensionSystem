import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

function run(args = []) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['scripts/build.mjs', ...args]);
    let output = '';
    child.stdout.on('data', b => output += b);
    child.stderr.on('data', b => output += b);
    child.on('close', code => resolve({ code, output }));
  });
}

test('concurrent builds allocate unique identities and propagate one immutable manifest', async () => {
  const results = await Promise.all([run(), run()]);
  const ids = [];
  for (const result of results) {
    assert.equal(result.code, 0, result.output);
    const out = result.output.match(/^OUTPUT (.+)$/m)[1];
    const manifest = JSON.parse(readFileSync(join(out, 'build-info.json'), 'utf8'));
    ids.push(manifest.id);
    assert.match(result.output, new RegExp(`BUILD SUCCESS ${manifest.id}`));
    assert.equal(basename(out), manifest.id);
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'public/build-info.json'), 'utf8')), manifest);
    assert.ok(readFileSync(join(out, 'BUILD_REPORT.md'), 'utf8').includes(manifest.id));
    assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/);
    assert.match(manifest.sourceFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(new Date(manifest.builtAt).toISOString(), manifest.builtAt);
    assert.match(manifest.scope, /^local-/);
    assert.equal(JSON.parse(readFileSync(join(out, 'build-info.json'), 'utf8')).id, manifest.id, 'Reusing an artifact retains its identity');
  }
  assert.notEqual(ids[0], ids[1]);
});

test('PR identity cannot be invented without a durable explicit allocator', async () => {
  const result = await run(['--pr', '7']);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /single durable allocator/);
});
