import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Kottackal Business Solutions Pvt. Ltd scraper module at ./script.js')
  }
}

test('Kottackal Business Solutions Pvt. Ltd sentinel pins the verified no-first-party-host surface', async () => {
  const kottackal = await loadModule()

  assert.equal(kottackal.SOURCE, 'kottackalbusinesssolutionspvtltd')
  assert.equal(kottackal.COMPANY, 'Kottackal Business Solutions Pvt. Ltd')
  assert.equal(kottackal.VERIFIED_ON, '2026-07-13')
  assert.equal(
    kottackal.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical company hostnames did not resolve.',
  )
  assert.deepEqual(kottackal.CAREER_HOSTS, [
    'kottackalbusinesssolutions.com',
    'www.kottackalbusinesssolutions.com',
    'kottackalbusinesssolutions.in',
    'www.kottackalbusinesssolutions.in',
    'kottackalbusinesssolutions.co.in',
    'www.kottackalbusinesssolutions.co.in',
    'kottackalbusinesssolutionspvtltd.com',
    'www.kottackalbusinesssolutionspvtltd.com',
    'kottackalbusinesssolutionspvtltd.in',
    'www.kottackalbusinesssolutionspvtltd.in',
    'kottackalbusinesssolutionspvtltd.co.in',
    'www.kottackalbusinesssolutionspvtltd.co.in',
  ])
  assert.equal(kottackal.hasResolvableFirstPartyHost([]), false)
  assert.equal(kottackal.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('Kottackal Business Solutions Pvt. Ltd sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const kottackal = await loadModule()
  const calls = []

  const jobs = await kottackal.createKottackalBusinessSolutionsScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [kottackal.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('Kottackal Business Solutions Pvt. Ltd sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const kottackal = await loadModule()

  await assert.rejects(
    kottackal.createKottackalBusinessSolutionsScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /Kottackal Business Solutions Pvt\. Ltd canonical first-party hosts now resolve/i,
  )
})
