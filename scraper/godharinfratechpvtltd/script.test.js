import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Godhar Infratech Pvt ltd scraper module at ./script.js')
  }
}

test('Godhar Infratech Pvt ltd sentinel pins the verified no-first-party-host surface from July 13, 2026', async () => {
  const godhar = await loadModule()

  assert.equal(godhar.SOURCE, 'godharinfratechpvtltd')
  assert.equal(godhar.COMPANY, 'Godhar Infratech Pvt ltd')
  assert.equal(godhar.VERIFIED_ON, '2026-07-13')
  assert.equal(
    godhar.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical Godhar Infratech hostnames did not resolve.',
  )
  assert.deepEqual(godhar.CAREER_HOSTS, [
    'godharinfratech.com',
    'www.godharinfratech.com',
    'godharinfratech.in',
    'www.godharinfratech.in',
    'godharinfratech.co.in',
    'www.godharinfratech.co.in',
  ])
  assert.equal(godhar.hasResolvableFirstPartyHost([]), false)
  assert.equal(godhar.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('Godhar Infratech Pvt ltd sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const godhar = await loadModule()
  const calls = []

  const jobs = await godhar.createGodharInfratechScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [godhar.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('Godhar Infratech Pvt ltd sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const godhar = await loadModule()

  await assert.rejects(
    godhar.createGodharInfratechScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /Godhar Infratech Pvt ltd canonical first-party hosts now resolve/i,
  )
})
