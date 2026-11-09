import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('tricentis.workday import ignores an unrelated runner dry-run flag without network or persistence', () => {
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

test('Tricentis standalone execution preserves raw jobs and selects dry-run or database persistence', () => {
  const moduleUrl = new URL('./script.js', import.meta.url)
  for (const dryRun of [false, true]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      import { registerHooks } from 'node:module';
      const engine = 'export const runWorkdayScraper = async () => [{ title: "Native role", sourceField: "raw value" }];';
      const persistence = 'export const saveToFile = (jobs, path) => console.log(JSON.stringify({mode:"file",jobs,path})); export const saveToDB = async (jobs, source) => console.log(JSON.stringify({mode:"database",jobs,source}));';
      registerHooks({ resolve(specifier, context, nextResolve) {
        if (specifier.endsWith('/myworkday/engine.js')) return {url:'data:text/javascript,' + encodeURIComponent(engine),shortCircuit:true};
        if (specifier.endsWith('/utils/saveToDB.js')) return {url:'data:text/javascript,' + encodeURIComponent(persistence),shortCircuit:true};
        return nextResolve(specifier, context);
      }});
      globalThis.fetch = () => { throw Error('Standalone test must not use network'); };
      process.argv = ['node', ${JSON.stringify(fileURLToPath(moduleUrl))}, ...${JSON.stringify(dryRun ? ['--dry-run'] : [])}];
      await import(${JSON.stringify(moduleUrl.href)});
    `], { encoding: 'utf8', timeout: 5000 })
    assert.equal(result.error, undefined, result.error?.message)
    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.stdout.trim(), 'The actual standalone script must invoke persistence')
    const saved = JSON.parse(result.stdout)
    assert.deepEqual(saved.jobs, [{ title: 'Native role', sourceField: 'raw value' }])
    assert.equal(saved.mode, dryRun ? 'file' : 'database')
    if (dryRun) assert.equal(saved.path, fileURLToPath(new URL('./jobs.json', import.meta.url)))
    else assert.equal(saved.source, 'tricentis')
  }
})
