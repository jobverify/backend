import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Nuro resolves by exact name and retains verified native no-India evidence through its provider', async () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Nuro\n2,"Nuro Inc."\n3,Neuro\n',
    catalog,
  })
  const scraper = buildScrapers().find((item) => item.name === 'nuro')

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Nuro', 'nuro']],
  )
  assert.equal(report.unmatchedCount, 2)
  assert.ok(scraper, 'Expected an exact Nuro scraper registration')
  assert.equal(scraper.provider.companyName, 'Nuro')
  assert.equal(scraper.provider.companyDomain, 'nuro.ai')
  const fixture = name => JSON.parse(readFileSync(new URL(`../../scraper/nuro/fixtures/${name}.json`, import.meta.url), 'utf8'))
  const responses = [fixture('careers-response'), fixture('jobs-response'), ...fixture('client-api-responses')]
  const jobs = await scraper.run({ fetchImpl: async url => {
    const response = responses.find(item => item.url === url)
    if (!response) throw new Error('Unrecorded unrelated client script')
    return { status: response.status, url, text: async () => response.body, json: async () => JSON.parse(response.body) }
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 101)
})
