import assert from 'node:assert/strict'
import test from 'node:test'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'
import { EMBITEL_TECHNOLOGIES_CATALOG } from '../../scraper/embiteltechnologies/catalog.js'

test('Embitel catalog exposes the verified first-party employer handoff and full native Workday inventory', () => {
  const provider = hydrateProviderCatalogEntry(EMBITEL_TECHNOLOGIES_CATALOG)
  assert.equal(provider.companyCareerPage, 'https://www.embitel.com/work-with-us')
  assert.equal(provider.openingsPageUrl, 'https://www.embitel.com/cariad-india-jobs')
  assert.equal(provider.jobsApiUrl, 'https://www.embitel.com/wp-admin/admin-ajax.php')
  assert.equal(provider.atsPlatform, 'first-party-ajax+workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedPublicOpeningCount, 320)
  assert.equal(provider.verifiedHiringOrganization, 'embIND Embitel Technologies (India) Private Limited')
  assert.match(provider.workdayJobsApiUrl, /Embitel_Technologies\/jobs$/)
  const report = generateCompanyCoverageReport({ csvText: 'Embitel Technologies\n', catalog: [provider] })
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
