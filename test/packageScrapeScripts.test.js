import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(
  readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
)

for (const scriptName of [
  'scrape',
  'scrape:dry',
  'scrape:parallel',
  'scrape:parallel:dry',
  'scrape:parallel:dry:monitored',
  'scrape:csv',
]) {
  test(`${scriptName} enables system CA support`, () => {
    assert.match(packageJson.scripts[scriptName], /^node --use-system-ca\b/)
  })
}
