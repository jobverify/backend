import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nimapinfotech/script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Nimap Infotech - Careers & Opportunities</title>
  </head>
  <body>
    <h1>Start your journey</h1>
    <a href="https://nimapinfotech.com/life-at-nimap-infotech/">Life at Nimap Infotech</a>
    <a href="https://therecruiter.co.in/career/1" target="_blank">Open Positions</a>
    <a href="https://nimapinfotech.com/careers/">Careers</a>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nimapinfotech/catalog.js')
  } catch {
    assert.fail('Expected Nimap Infotech catalog module at ../../scraper/nimapinfotech/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/nimapinfotech/script.js')
  } catch {
    assert.fail('Expected Nimap Infotech scraper module at ../../scraper/nimapinfotech/script.js')
  }
}

test('Nimap Infotech local catalog records the verified external-handoff no-first-party-jobs state', async () => {
  const { NIMAP_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NIMAP_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, NIMAP_INFOTECH_CATALOG)
  assert.equal(provider.source, 'nimapinfotech')
  assert.equal(provider.companyName, 'Nimap Infotech')
  assert.equal(provider.officialBrandName, 'Nimap Infotech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://nimapinfotech.com/careers/')
  assert.equal(provider.companyDomain, 'nimapinfotech.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-external-handoff-no-first-party-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-validation')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell+external-open-positions-handoff+no-first-party-job-cards-return-empty')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /therecruiter\.co\.in\/career\/1/i)
})

test('Nimap Infotech exact backlog row resolves from the local catalog', async () => {
  const { NIMAP_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nimap Infotech\n',
    catalog: [hydrateProviderCatalogEntry(NIMAP_INFOTECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Nimap Infotech sentinel returns [] while the official page only hands off to a non-first-party board', async () => {
  const nimap = await loadScriptModule()
  const jobs = await nimap.run({
    fetchText: async (url) => {
      assert.equal(url, nimap.CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Nimap Infotech sentinel fails closed if same-domain public job cards appear', async () => {
  const nimap = await loadScriptModule()

  await assert.rejects(
    nimap.run({
      fetchText: async () => '<html><body><h1>Open Positions</h1><a href="https://nimapinfotech.com/careers/senior-engineer/">Senior Engineer</a></body></html>',
    }),
    /first-party jobs surface/i,
  )
})
