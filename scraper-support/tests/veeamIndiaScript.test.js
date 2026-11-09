import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../native-sources/cisVeeam/fixtures/actual-http-20261031.json.gz', import.meta.url))))
const pages = new Map(fixture.pages.map(page => [page.receipt.url, page]))
for (const source of ['cyberinfrastructure', 'veeamindia']) {
  test(source + ': effective registry is discovery-only and clears obsolete static verification', async () => {
    const provider = getScraperCatalog().find(value => value.source === source)
    assert.ok(provider);assert.equal(provider.adapter, 'script')
    assert.equal(provider.verifiedOn, null);assert.equal(provider.verifiedInventoryStatus, 'unverified')
    assert.equal(provider.sourceScopeComplete, false);assert.equal(provider.lifecycleCleanupAllowed, false)
    assert.equal(provider.verifiedIndiaJobCount, null);assert.equal(provider.verifiedPublicJobCount, null)
    assert.equal(provider.zeroResultPolicy, 'coverage-gap')
    assert.equal(provider.normalizationProfile, 'engineering-default')
    const audits = [], requests = []
    const jobs = await createCatalogScraper(provider).run({
      fetchPage: async url => {
        requests.push(url);const page = pages.get(url);assert.ok(page, 'Only genuine declared GETs: ' + url)
        return { url, status: page.receipt.status, headers: page.receipt.responseHeaders, bodyBase64: page.bodyBase64 }
      }, onAudit: audit => audits.push(audit), now: () => '2026-10-31T10:00:00.000Z',
    })
    assert.equal(jobs.length, source === 'cyberinfrastructure' ? 116 : 11)
    assert.equal(audits.length, 1);assert.equal(audits[0].observations.length, source === 'cyberinfrastructure' ? 116 : 14)
    assert.ok(requests.every(url => url.startsWith('https://')))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    for (const job of jobs) {
      assert.equal(job.source, source);assert.equal(job.country, 'India')
      const normalized = normalizeScrapedJob(job, provider)
      assert.equal(normalized.sourceDescription, job.jobDescription)
      assert.equal(normalized.country, 'India')
    }
  })
}

test('Veeam India original backlog identity remains a direct catalog match', () => {
  const report = generateCompanyCoverageReport({ csvText: 'Veeam India\n', catalog: getScraperCatalog(), aliasMap: {} })
  assert.equal(report.matchedCount, 1);assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'veeamindia')
})
