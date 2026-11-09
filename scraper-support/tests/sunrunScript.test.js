import assert from 'node:assert/strict'
import test from 'node:test'
import { statSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import * as sunrun from '../../scraper/sunrun/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Sunrun honors cancellation and bounds ignored-signal native requests', async () => {
  const controller = new AbortController(); controller.abort(Error('stop Sunrun'))
  await assert.rejects(sunrun.run({ signal: controller.signal, fetchJson: async () => assert.fail('must not fetch') }), /stop Sunrun/)
  await assert.rejects(sunrun.run({ timeoutMs: 20, fetchPage: () => new Promise(() => {}) }), /timed out/i)
})

test('Sunrun import with parent dry-run flag performs no persistence', () => {
  const artifact = 'scraper/sunrun/jobs.json', before = statSync(artifact).mtimeMs
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "process.argv.push('--dry-run'); await import('./scraper/sunrun/script.js'); console.log('import-only')"], { cwd: process.cwd(), encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'import-only')
  assert.equal(statSync(artifact).mtimeMs, before)
})

