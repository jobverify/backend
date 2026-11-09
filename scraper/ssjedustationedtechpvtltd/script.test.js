import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SSJ EduStation Edtech Pvt ltd scraper module at ./script.js')
  }
}

test('SSJ EduStation Edtech Pvt ltd sentinel pins the verified unresolved first-party surface from July 13, 2026', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'ssjedustationedtechpvtltd')
  assert.equal(scraper.COMPANY, 'SSJ EduStation Edtech Pvt ltd')
  assert.equal(scraper.VERIFIED_ON, '2026-07-13')
  assert.equal(
    scraper.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party public careers surface was discoverable on July 13, 2026, and the canonical SSJ EduStation hostnames did not resolve.',
  )
  assert.deepEqual(scraper.CAREER_HOSTS, [
    'ssjedustation.com',
    'www.ssjedustation.com',
    'ssjedustation.in',
    'www.ssjedustation.in',
    'ssjedustation.co.in',
    'www.ssjedustation.co.in',
    'ssjedustationedtech.com',
    'www.ssjedustationedtech.com',
    'ssjedustationedtech.in',
    'www.ssjedustationedtech.in',
    'ssjedustationedtech.co.in',
    'www.ssjedustationedtech.co.in',
  ])
  assert.equal(scraper.hasResolvableFirstPartyHost([]), false)
  assert.equal(scraper.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('SSJ EduStation Edtech Pvt ltd sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const scraper = await loadModule()
  const requestedHosts = []

  const jobs = await scraper.createSsjEduStationEdtechScraper().run({
    resolveHosts: async (hosts) => {
      requestedHosts.push([...hosts])
      return []
    },
  })

  assert.deepEqual(requestedHosts, [scraper.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('SSJ EduStation Edtech Pvt ltd sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createSsjEduStationEdtechScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /SSJ EduStation Edtech Pvt ltd canonical first-party hosts now resolve/i,
  )
})
