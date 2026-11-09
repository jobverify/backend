import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { nextCareersGreenhouseFeeds } from '../scraper-support/utils/nextCareersGreenhouseFeed.js'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const fixtureDir = new URL('../scraper/blockchaincom/fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureDir), 'utf8'))
const records = new Map(manifest.requests.map(receipt => {
  const body = gunzipSync(readFileSync(new URL(receipt.filename, fixtureDir)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return [receipt.requestedURL, { ...receipt, body: body.toString('utf8') }]
}))
const page = records.get('https://www.blockchain.com/en/careers').body
const chunk = [...records.values()].find(row => /\/pages\/careers-[a-f\d]+\.js$/.test(row.requestedURL))
const endpoint = 'https://api.greenhouse.io/v1/boards/blockchain/departments'

test('captured current Next careers route registers the same module that calls the native Greenhouse API', () => {
  assert.deepEqual(nextCareersGreenhouseFeeds(readNativeDocument(page), chunk.requestedURL, chunk.body), [endpoint])
})

test('a different route, detached module, non-careers bundle or quoted API endpoint cannot establish a binding', () => {
  assert.deepEqual(nextCareersGreenhouseFeeds(readNativeDocument(page.replace('"page":"/careers"', '"page":"/blog"')), chunk.requestedURL, chunk.body), [])
  assert.deepEqual(nextCareersGreenhouseFeeds(readNativeDocument(page), chunk.requestedURL.replace('/pages/careers-', '/polyfills-'), chunk.body), [])
  for (const body of [chunk.body.replace('return r(33539)', 'return r(999999)'),
    chunk.body.replace('(0,L.fetch)("https://api.greenhouse.io', '(0,L.lookup)("https://api.greenhouse.io'),
    `const historicalExample = ${JSON.stringify(endpoint)};`]) {
    assert.notEqual(body, chunk.body)
    assert.deepEqual(nextCareersGreenhouseFeeds(readNativeDocument(page), chunk.requestedURL, body), [])
  }
})

test('production Blockchain.com scraper validates the complete captured native feed without asserting whole-company scope', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'blockchaincom')
  const requested = []
  const jobs = await createCatalogScraper(provider).run({
    fetchPage: async url => {
      const response = records.get(url)
      return response ? { status: response.status, url: response.finalURL, html: response.body } : { status: 404, url, html: '' }
    },
    fetchJson: async url => {
      requested.push(url)
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/blockchain/jobs?content=true')
      return JSON.parse(records.get(url).body)
    },
  })
  assert.equal(requested.length, 1)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
