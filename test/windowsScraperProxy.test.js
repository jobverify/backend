import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
const fixture = fileURLToPath(new URL('./fixtures/windowsScraperProxy.ps1', import.meta.url))
for (const scenario of ['system', 'explicit', 'disabled', 'direct', 'mixed', 'invalid', 'restore', 'node-child']) {
  test(`Windows scraper launcher: ${scenario}`, { skip: process.platform !== 'win32' }, () => {
    const child = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', fixture, '-Scenario', scenario],
      { encoding: 'utf8', windowsHide: true, timeout: 15000 })
    assert.equal(child.error, undefined)
    assert.equal(child.status, 0, child.stderr || child.stdout)
    assert.equal(JSON.parse(child.stdout.trim()).passed, true)
  })
}
