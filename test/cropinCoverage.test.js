import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('CropIn resolves approved case variants to its literal-name official provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nCropIn\nCropin\nCrop In\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['CropIn', 'cropin', 'CropIn'],
      ['Cropin', 'cropin', 'CropIn'],
    ],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Crop In'],
  )
})

test('CropIn catalog identifies its official Keka inventory adapter', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cropin')
  assert.ok(provider)
  assert.equal(provider.companyCareerPage, 'https://www.cropin.com/career/')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'keka-official-bound-active-inventory')
  assert.equal(provider.officialCareersHandoffUrl, 'https://cropinhrms.keka.com/careers/')
})
