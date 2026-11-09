import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('OptiSol Business Solutions persists dry-run results to jobs.json when --dry-run is requested', async () => {
  const optisol = await loadModule()
  assert.ok(optisol, 'OptiSol Business Solutions scraper module should load')

  const jobs = [{ title: 'Solution Architect' }]
  const calls = []

  await optisol.persistScrapeResults({
    argv: ['node', 'script.js', '--dry-run'],
    runImpl: async () => jobs,
    saveToFileImpl: async (savedJobs, filePath) => {
      calls.push({ type: 'file', savedJobs, filePath })
    },
    saveToDBImpl: async () => {
      calls.push({ type: 'db' })
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].type, 'file')
  assert.deepEqual(calls[0].savedJobs, jobs)
  assert.match(calls[0].filePath, /optisolbusinesssolutions[\\/]jobs\.json$/i)
})

test('OptiSol Business Solutions saves to the DB when --dry-run is not requested', async () => {
  const optisol = await loadModule()
  assert.ok(optisol, 'OptiSol Business Solutions scraper module should load')

  const jobs = [{ title: 'Senior Sales Development Representative' }]
  const calls = []

  await optisol.persistScrapeResults({
    argv: ['node', 'script.js'],
    runImpl: async () => jobs,
    saveToFileImpl: async () => {
      calls.push({ type: 'file' })
    },
    saveToDBImpl: async (savedJobs, source) => {
      calls.push({ type: 'db', savedJobs, source })
    },
  })

  assert.deepEqual(calls, [{
    type: 'db',
    savedJobs: jobs,
    source: 'optisolbusinesssolutions',
  }])
})
