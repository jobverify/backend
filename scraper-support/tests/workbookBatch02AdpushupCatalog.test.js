import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { isVerifiedEmptyEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('AdPushup preserves historical catalog metadata and reads current incomplete context', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'adpushup')
  const scraper = buildScrapers().find((item) => item.name === 'adpushup')

  assert.ok(provider)
  assert.ok(scraper)

  assert.equal(provider.companyName, 'AdPushup')
  assert.equal(provider.companyCareerPage, 'https://www.adpushup.com/careers/')
  assert.equal(provider.companyDomain, 'adpushup.com')
  assert.equal(provider.atsPlatform, 'verified-first-party-careers-empty-result')
  assert.equal(provider.paginationStrategy, 'verified-careers-snapshot-empty-result')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-surface+zero-public-job-snapshot+return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, new RegExp(`[\\\\/]${provider.source}[\\\\/]script\\.js$`, 'i'))

  assert.equal(scraper.provider.modulePath, provider.modulePath)
  const folder = new URL('./fixtures/adpushupPublicReads20261107C35/', import.meta.url)
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder)))
  const receipt = manifest.records[0]
  const body = gunzipSync(fs.readFileSync(new URL(receipt.bodyFile, folder)))
  const requests = []
  const jobs = await scraper.run({
    now: () => '2026-11-07T03:00:00.000Z',
    fetchPage: async (url, init) => {
      requests.push(url)
      assert.equal(init.method, 'GET')
      assert.equal(init.redirect, 'manual')
      assert.equal(init.credentials, 'omit')
      assert.equal(url, 'https://www.adpushup.com/careers/')
      return { url: receipt.finalUrl, requestedUrl: receipt.requestedUrl, status: receipt.status,
        headers: structuredClone(receipt.headers), bodyBase64: body.toString('base64'),
        sourceRequestedAt: receipt.sourceRequestedAt, sourceCompletedAt: receipt.sourceCompletedAt,
        sourceHttpDate: receipt.sourceHttpDate, originalReceipt: structuredClone(receipt) }
    },
  })
  assert.deepEqual(requests, ['https://www.adpushup.com/careers/'])
  assert.deepEqual(jobs, [])
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.firstParty, true)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.pagesFetched, 1)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.verifiedAt, null)
  assert.equal(isVerifiedEmptyEvidence(inventory), false)
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.responses[0].sha256, '7b2c9ec2f3cb277507b52920ad9797c668a7b7396bafc54ee273af3ca41fbbbf')
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-07T02:47:14.927Z')
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-07T02:47:28.124Z')
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  for (const key of ['companyGlobalTotal', 'companyIndiaTotal', 'nativeReportedTotal', 'nativeIndiaTotal']) {
    assert.equal(audit[key], null)
  }
  assert.equal(audit.sourceMetadata.verifiedOn, null)
  assert.equal(audit.sourceMetadata.verifiedPublicJobCount, null)
  assert.equal(audit.sourceMetadata.verifiedIndiaJobCount, null)
})
