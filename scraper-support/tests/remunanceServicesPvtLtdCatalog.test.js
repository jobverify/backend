import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Remunance Services Pvt. Ltd. is present in the shared catalog when we restore the full-company dry-run set', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'remunanceservicespvtltd')

  assert.equal(provider?.source, 'remunanceservicespvtltd')
  assert.equal(provider?.companyName, 'Remunance Services Pvt. Ltd.')
  assert.equal(provider?.companyCareerPage, 'https://remunance.com/careers/')
  assert.equal(provider?.atsPlatform, 'elfsight-job-board')
  assert.equal(provider?.verifiedOn, '2026-09-13')
  assert.match(provider?.verifiedSurfaceSummary, /29 visible roles.*22 explicit India.*7 Remote/i)
})

test('Remunance Services Pvt. Ltd. matches company coverage from the shared scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Remunance Services Pvt. Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'remunanceservicespvtltd')
})

test('Remunance Services Pvt. Ltd. is runnable through the shared scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'remunanceservicespvtltd')

  assert.equal(scraper?.name, 'remunanceservicespvtltd')
})
