import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Gayathri Health Care Solutions scraper module at ./script.js')
  }
}

test('Gayathri Health Care Solutions sentinel pins the verified no-first-party-host surface from July 13, 2026', async () => {
  const gayathri = await loadModule()

  assert.equal(gayathri.SOURCE, 'gayathrihealthcaresolutions')
  assert.equal(gayathri.COMPANY, 'Gayathri Health Care Solutions')
  assert.equal(gayathri.VERIFIED_ON, '2026-07-13')
  assert.equal(
    gayathri.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical Gayathri Health Care Solutions hostnames did not resolve.',
  )
  assert.deepEqual(gayathri.CAREER_HOSTS, [
    'gayathrihealthcaresolutions.com',
    'www.gayathrihealthcaresolutions.com',
    'gayathrihealthcaresolutions.in',
    'www.gayathrihealthcaresolutions.in',
    'gayathrihealthcaresolutions.co.in',
    'www.gayathrihealthcaresolutions.co.in',
    'gayathrihealthcare.com',
    'www.gayathrihealthcare.com',
    'gayathrihealthcare.in',
    'www.gayathrihealthcare.in',
  ])
  assert.equal(gayathri.hasResolvableFirstPartyHost([]), false)
  assert.equal(gayathri.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('Gayathri Health Care Solutions sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const gayathri = await loadModule()
  const calls = []

  const jobs = await gayathri.createGayathriHealthCareSolutionsScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [gayathri.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('Gayathri Health Care Solutions sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const gayathri = await loadModule()

  await assert.rejects(
    gayathri.createGayathriHealthCareSolutionsScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /Gayathri Health Care Solutions canonical first-party hosts now resolve/i,
  )
})
