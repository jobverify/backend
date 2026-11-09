import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('jobs exporter documents its read-only JSONL export command', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/exportJobsCollection.js', '--help'],
    { cwd: process.cwd(), encoding: 'utf8' },
  )

  assert.equal(result.status, 0)
  assert.match(result.stdout, /read-only/i)
  assert.match(result.stdout, /JSONL/i)
})
