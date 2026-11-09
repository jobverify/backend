import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildWorkdayAppliedFacets } from '../myworkday/engine.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const INDIA_FACET_ID = 'c4f78be1a8f14da0ab49ce1162348a5e'

test('registers Michelin India (P) Ltd. against the official recruitment page and Workday board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'michelinindiapltd')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Michelin India (P) Ltd.')
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://recrutement.michelin.fr/')
  assert.equal(provider.companyDomain, 'recrutement.michelin.fr')
  assert.equal(provider.locationCountry, INDIA_FACET_ID)
  assert.equal(
    provider.baseUrl,
    'https://michelinhr.wd3.myworkdayjobs.com/fr-FR/Michelin?Location_Country=c4f78be1a8f14da0ab49ce1162348a5e',
  )
})

test('buildScrapers exposes a runnable Michelin India Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'michelinindiapltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /michelinindiapltd.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'michelinindiapltd')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Michelin India local Workday config switches the scraper onto the jobs API with the verified India country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/michelinindiapltd.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://michelinhr.wd3.myworkdayjobs.com/wday/cxs/michelinhr/Michelin/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://michelinhr.wd3.myworkdayjobs.com/fr-FR/Michelin',
  )
  assert.equal(config.countryFacetParameter, 'Location_Country')

  assert.deepEqual(
    buildWorkdayAppliedFacets(
      'https://michelinhr.wd3.myworkdayjobs.com/fr-FR/Michelin?Location_Country=c4f78be1a8f14da0ab49ce1162348a5e',
      INDIA_FACET_ID,
      config.countryFacetParameter,
    ),
    {
      Location_Country: [INDIA_FACET_ID],
    },
  )
})

test('generateCompanyCoverageReport resolves the CSV row Michelin India (P) Ltd. to the Michelin Workday provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Michelin India (P) Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [['Michelin India (P) Ltd.', 'michelinindiapltd', 'Michelin India (P) Ltd.']],
  )
})
