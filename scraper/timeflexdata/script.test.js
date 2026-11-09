import assert from 'node:assert/strict'
import test from 'node:test'

const loadTimeFlexDataModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected TimeFlex Data scraper module at ./script.js')
  }
}

test('TimeFlex Data sentinel pins the verified no-first-party-host surface', async () => {
  const timeflexdata = await loadTimeFlexDataModule()

  assert.equal(timeflexdata.SOURCE, 'timeflexdata')
  assert.equal(timeflexdata.COMPANY, 'TimeFlex Data')
  assert.equal(timeflexdata.VERIFIED_ON, '2026-07-13')
  assert.equal(
    timeflexdata.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical company hostnames did not resolve.',
  )
  assert.deepEqual(timeflexdata.CAREER_HOSTS, [
    'timeflexdata.com',
    'www.timeflexdata.com',
    'timeflexdata.in',
    'www.timeflexdata.in',
  ])
  assert.equal(timeflexdata.hasResolvableFirstPartyHost([]), false)
  assert.equal(timeflexdata.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('TimeFlex Data sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const timeflexdata = await loadTimeFlexDataModule()
  const calls = []

  const jobs = await timeflexdata.createTimeFlexDataScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [timeflexdata.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('TimeFlex Data sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const timeflexdata = await loadTimeFlexDataModule()

  await assert.rejects(
    timeflexdata.createTimeFlexDataScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /TimeFlex Data canonical first-party hosts now resolve/i,
  )
})
