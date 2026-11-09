import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Diya Edulabs Pvt.Ltd. scraper module at ./script.js')
  }
}

test('Diya Edulabs Pvt.Ltd. sentinel pins the verified no-first-party-host surface from July 13, 2026', async () => {
  const diya = await loadModule()

  assert.equal(diya.SOURCE, 'diyaedulabspvtltd')
  assert.equal(diya.COMPANY, 'Diya Edulabs Pvt.Ltd.')
  assert.equal(diya.VERIFIED_ON, '2026-07-13')
  assert.equal(
    diya.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical Diya Edulabs hostnames did not resolve.',
  )
  assert.deepEqual(diya.CAREER_HOSTS, [
    'diyaedulabs.com',
    'www.diyaedulabs.com',
    'diyaedulabs.in',
    'www.diyaedulabs.in',
    'diyaedulabs.co.in',
    'www.diyaedulabs.co.in',
  ])
  assert.equal(diya.hasResolvableFirstPartyHost([]), false)
  assert.equal(diya.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('Diya Edulabs Pvt.Ltd. sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const diya = await loadModule()
  const calls = []

  const jobs = await diya.createDiyaEdulabsScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [diya.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('Diya Edulabs Pvt.Ltd. sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const diya = await loadModule()

  await assert.rejects(
    diya.createDiyaEdulabsScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /Diya Edulabs Pvt\.Ltd\. canonical first-party hosts now resolve/i,
  )
})
