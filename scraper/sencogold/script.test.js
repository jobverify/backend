import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createSencoGoldScraper,
  hasVerifiedFormOnlySurface,
} from './script.js'

const verifiedCareerPage = `
  <html><head><title>Career - Senco Gold</title></head><body>
    <h1>Career</h1><h2>Join Us</h2>
    <label>Applying for position</label><label>CV Upload</label>
  </body></html>
`

test('Senco Gold matches the exact company name through the shared catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSenco Gold\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName]),
    [['Senco Gold', SOURCE, COMPANY]],
  )
})

test('Senco Gold retains the legacy form recognizer while current CV intake stays incomplete', async () => {
  assert.equal(
    hasVerifiedFormOnlySurface({ status: 200, url: CAREERS_URL, html: verifiedCareerPage }),
    true,
  )
  assert.equal(
    hasVerifiedFormOnlySurface({
      status: 200,
      url: CAREERS_URL,
      html: `${verifiedCareerPage}<article>Current openings: Sales Associate</article>`,
    }),
    false,
  )

  const jobs = await createSencoGoldScraper().run({
    fetchPage: async () => ({status:200,url:CAREERS_URL,html:gunzipSync(readFileSync(new URL('./test-data/current-20261103/career.html.gz',import.meta.url))).toString('utf8')}),
  })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('Senco Gold preserves a certificate failure instead of a successful empty return', async () => {
  await assert.rejects(createSencoGoldScraper().run({
    fetchPage: async () => {
      const error = new Error('fetch failed')
      error.cause = new Error('certificate has expired')
      throw error
    },
  }),error=>error.cause?.message==='certificate has expired')
})
