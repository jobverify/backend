import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

for (const source of ['hyperscience', 'huntress']) {
  test(`registered ${source} scraper validates captured employer binding and native posting feed`, async () => {
    const folder = new URL(`../scraper/${source}/fixtures/current-20261029/`, import.meta.url)
    const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
    const records = new Map(manifest.requests.map(receipt => {
      const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, folder)))
      assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
      return [receipt.requestedURL, { ...receipt, body: body.toString('utf8') }]
    }))
    const provider = getScraperCatalog().find(provider => provider.source === source)
    const requested = []
    const jobs = await createCatalogScraper(provider).run({
      fetchPage: async url => {
        const response = records.get(url)
        assert.ok(response, `Uncaptured employer resource: ${url}`)
        return { status: response.status, url: response.finalURL, html: response.body }
      },
      fetchJson: async url => {
        requested.push(url)
        const response = records.get(url)
        assert.ok(response, `Uncaptured native feed: ${url}`)
        const payload = JSON.parse(response.body)
        assert.ok(payload.jobs.length > 0)
        if (source === 'huntress') {
          assert.deepEqual([...new Set(payload.jobs.map(job => job.company_name))], ['Huntress Labs'])
          assert.deepEqual(provider.nativeEmployerNames, ['Huntress Labs'])
        } else assert.equal(payload.jobs[0].title, 'Technical Deployment Lead')
        return payload
      },
    })
    assert.equal(requested.length, 1)
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(provider.verifiedIndiaJobCount, null)
    assert.equal(provider.verifiedPublicJobCount, null)
  })
}
