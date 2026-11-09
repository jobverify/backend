import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected InMovidu Technologies Pvt Ltd scraper module at ./script.js')
  }
}

test('InMovidu Technologies Pvt Ltd sentinel pins the verified no-first-party-host surface', async () => {
  const inmovidu = await loadModule()

  assert.equal(inmovidu.SOURCE, 'inmovidutechnologiespvtltd')
  assert.equal(inmovidu.COMPANY, 'InMovidu Technologies Pvt Ltd')
  assert.equal(inmovidu.VERIFIED_ON, '2026-07-13')
  assert.equal(
    inmovidu.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical InMovidu hostnames did not resolve.',
  )
  assert.deepEqual(inmovidu.CAREER_HOSTS, [
    'inmovidu.com',
    'www.inmovidu.com',
    'inmovidu.in',
    'www.inmovidu.in',
    'inmovidutechnologies.com',
    'www.inmovidutechnologies.com',
    'inmovidutechnologies.in',
    'www.inmovidutechnologies.in',
  ])
  assert.equal(inmovidu.hasResolvableFirstPartyHost([]), false)
  assert.equal(inmovidu.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('InMovidu Technologies Pvt Ltd sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const inmovidu = await loadModule()
  const calls = []

  const jobs = await inmovidu.createInMoviduTechnologiesPvtLtdScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [inmovidu.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('InMovidu Technologies Pvt Ltd sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const inmovidu = await loadModule()

  await assert.rejects(
    inmovidu.createInMoviduTechnologiesPvtLtdScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /InMovidu Technologies Pvt Ltd canonical first-party hosts now resolve/i,
  )
})
