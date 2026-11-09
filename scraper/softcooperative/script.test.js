import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Soft Co-operative scraper module at ./script.js')
  }
}

test('Soft Co-operative sentinel pins the verified absent first-party surface', async () => {
  const softCooperative = await loadModule()

  assert.equal(softCooperative.SOURCE, 'softcooperative')
  assert.equal(softCooperative.COMPANY, 'Soft Co-operative')
  assert.equal(softCooperative.VERIFIED_ON, '2026-07-13')
  assert.equal(
    softCooperative.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical Soft Co-operative hostnames did not resolve.',
  )
  assert.deepEqual(softCooperative.CAREER_HOSTS, [
    'soft.coop',
    'www.soft.coop',
    'softcooperative.coop',
    'www.softcooperative.coop',
    'softcooperative.com',
    'www.softcooperative.com',
  ])
  assert.equal(softCooperative.hasResolvableFirstPartyHost([]), false)
  assert.equal(softCooperative.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('Soft Co-operative sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const softCooperative = await loadModule()
  const calls = []

  const jobs = await softCooperative.createSoftCooperativeScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [softCooperative.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('Soft Co-operative sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const softCooperative = await loadModule()

  await assert.rejects(
    softCooperative.createSoftCooperativeScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /Soft Co-operative canonical first-party hosts now resolve/i,
  )
})
