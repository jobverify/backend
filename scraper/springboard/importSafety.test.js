import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'

test('springboard import ignores an unrelated runner dry-run flag without network or persistence', () => {
  const moduleUrl = new URL('./script.js', import.meta.url).href
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import fs from 'node:fs';
    const forbidden = kind => { process.stderr.write('Unexpected import ' + kind); process.exit(42); };
    process.argv = ['node', 'unrelated-runner.js', '--dry-run'];
    globalThis.fetch = () => forbidden('network');
    fs.writeFileSync = () => forbidden('persistence');
    fs.mkdirSync = () => forbidden('directory write');
    fs.promises.writeFile = async () => forbidden('async persistence');
    await import(${JSON.stringify(moduleUrl)});
    console.log('imported');
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'imported')
})
