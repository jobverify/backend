import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createStoreysRealEstateScraper, HOMEPAGE_URL } from './script.js'

const currentCareersUrl = 'https://storeys.ae/careers.html'
const home = await readFile(new URL('./fixtures/current-home.html', import.meta.url), 'utf8')
const careers = await readFile(new URL('./fixtures/current-careers.html', import.meta.url), 'utf8')
const page = (url, html) => ({ status: 200, url, contentType: 'text/html', html })
const runCurrent = (homeHtml = home, careersHtml = careers, effectiveUrl = currentCareersUrl) => {
  const requested = []
  const result = createStoreysRealEstateScraper().run({ fetchPage: async url => {
    requested.push(url)
    if (url === HOMEPAGE_URL) return page('https://storeys.ae/', homeHtml)
    if (url === currentCareersUrl) return page(effectiveUrl, careersHtml)
    throw new Error('Unexpected URL: ' + url)
  } })
  return { requested, result }
}

test('Restored Storeys UAE resume intake remains inventory-unavailable with incomplete evidence', async () => {
  const { requested, result } = runCurrent()
  await assert.rejects(result, error => {
    assert.equal(error.code, 'STOREYS_INVENTORY_UNAVAILABLE')
    assert.equal(error.softFailure, true)
    assert.equal(error.abortRetries, true)
    assert.equal(error.failureKind, 'upstream_inventory_unavailable')
    assert.match(error.message, /generic UAE resume intake/i)
    assert.match(error.message, /role-level public job inventory remains unverified/i)
    assert.equal(error.inventoryEvidence.status, 'discovery-only')
    assert.equal(error.inventoryEvidence.firstParty, true)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    assert.equal(error.inventoryEvidence.pagesFetched, 2)
    assert.ok(Date.parse(error.inventoryEvidence.verifiedAt))
    return true
  })
  assert.deepEqual(requested, [HOMEPAGE_URL, currentCareersUrl])
})

test('Storeys resume classification rejects changed identity and off-domain redirects', async () => {
  await assert.rejects(runCurrent(home.replaceAll('Storeys Real Estate', 'Other Real Estate')).result, /official homepage/i)
  await assert.rejects(runCurrent(home, careers.replaceAll('hiring@storeys.ae', 'hiring@elsewhere.example')).result, /careers.*verified/i)
  await assert.rejects(runCurrent(home, careers, 'https://elsewhere.example/careers.html').result, /careers.*verified/i)
})

test('Storeys new role signals cannot be dismissed as generic resume intake', async () => {
  const concreteRole = careers + '<h2>Current Openings</h2><a href="/jobs/india-agent">India Agent</a><script type="application/ld+json">{"@type":"JobPosting","title":"India Agent"}</script>'
  await assert.rejects(runCurrent(home, concreteRole).result, error => error.code !== 'STOREYS_INVENTORY_UNAVAILABLE' && /careers.*verified/i.test(error.message))
})
