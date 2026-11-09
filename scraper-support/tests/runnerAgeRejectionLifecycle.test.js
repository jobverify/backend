import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./fixtures/runnerAgeRejections.js', import.meta.url))
for (const parallel of [false, true]) {
  for (const dryRun of [false, true]) {
    for (const scenario of ['positive', 'all-old', 'persistence-pending', 'source-failure']) {
      test(`${parallel ? 'parallel' : 'sequential'} ${dryRun ? 'dry' : 'live'} age diagnostics: ${scenario}`, () => {
        const child = spawnSync(process.execPath, [fixture, scenario,
          ...(parallel ? ['--parallel'] : []), ...(dryRun ? ['--dry-run'] : [])], { encoding: 'utf8', timeout: 20_000 })
        assert.equal(child.error, undefined)
        assert.equal(child.status, 0, child.stderr || child.stdout)
        const state = JSON.parse(child.stdout)
        assert.equal(state.error, null)
        assert.equal(state.started, 1)
        assert.equal(state.startupClears, 0)
        const result = state.summary['age-fixture']
        assert.equal(result.success, !['persistence-pending', 'source-failure'].includes(scenario))
        assert.equal(result.filteredOld ?? null, scenario === 'source-failure' ? null : 2)
        assert.equal(result.rawRecords ?? null, scenario === 'source-failure' ? null : scenario === 'all-old' ? 2 : 3)
        assert.equal(result.eligibleJobs ?? null, scenario === 'source-failure' ? null : scenario === 'all-old' ? 0 : 1)
        assert.notEqual(result.zeroJobEvidence, 'verified-empty')
        if (!dryRun) {
          assert.equal(state.history['age-fixture'].filteredOld ?? null, result.filteredOld ?? null)
          assert.equal(state.statuses[0].filteredOld ?? null, result.filteredOld ?? null)
          if (scenario === 'all-old') assert.equal(state.authoritativeEmpty, false)
        }
        if (scenario === 'persistence-pending') {
          assert.equal(state.checkpoint.completedCount, 0)
        } else {
          assert.equal(state.checkpoint.completed['age-fixture'].result.filteredOld ?? null, result.filteredOld ?? null)
        }
      })
    }
  }
}
