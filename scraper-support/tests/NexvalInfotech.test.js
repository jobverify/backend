import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers } from '../providers/index.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nexvalinfotech/script.js')
const dryRunFilePath = path.resolve(currentDir, '../../scraper/nexvalinfotech/jobs.json')

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI-First Mortgage BPO, Products &amp; Cloud Services</title>
    <link rel="canonical" href="https://www.nexval.ai" />
  </head>
  <body>
    <h1>AI-First Mortgage BPO &amp; Cloud Services</h1>
    <p>Venture into the new age of AI.</p>
    <p>Nexval streamlines mortgage workflows, optimizes processes, and turns data into decisions.</p>
    <a href="https://www.calendly.com/nexval/book-demo">Book a Demo</a>
    <p>Contact Nexval</p>
    <a href="https://www.linkedin.com/company/nexval/">LinkedIn</a>
  </body>
</html>
`

const blockedCareersRoute = (url) => ({
  status: 403,
  url,
  html: '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>',
})

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nexvalinfotech/catalog.js')
  } catch {
    assert.fail('Expected Nexval Infotech catalog module at ../../scraper/nexvalinfotech/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/nexvalinfotech/script.js')
  } catch {
    assert.fail('Expected Nexval Infotech scraper module at ../../scraper/nexvalinfotech/script.js')
  }
}

test('Nexval Infotech local catalog records the verified August 3, 2026 blocked careers sentinel on the live domain', async () => {
  const { NEXVAL_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NEXVAL_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, NEXVAL_INFOTECH_CATALOG)
  assert.equal(provider.source, 'nexvalinfotech')
  assert.equal(provider.companyName, 'Nexval Infotech')
  assert.equal(provider.officialBrandName, 'Nexval')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.nexval.ai/')
  assert.equal(provider.companyCareerPage, 'https://www.nexval.ai/careers/')
  assert.equal(provider.legacyCareerPageUrl, 'https://nexval.com/careers/')
  assert.equal(provider.companyDomain, 'nexval.ai')
  assert.equal(provider.atsPlatform, 'current-own-locale-product-publisher-recruitment-unknown')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'exact-own-root307-current-locale-whole-corporate-model-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'whole-current-locale-product-demo-and-form-context+old-unlinked-careers-routes-historical-only+native-employment-and-company-inventory-unqualified',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /nexval\.ai/i)
  assert.match(provider.verifiedSurfaceSummary, /403/i)
  assert.match(provider.verifiedSurfaceSummary, /AccessDenied|Access Denied/i)
  assert.match(provider.verifiedSurfaceSummary, /nexval\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /timed out|timeout|unreachable/i)
  assert.match(provider.verifiedSurfaceSummary, /no longer publishes a trustworthy public jobs surface/i)
})

test('Nexval Infotech exact backlog row resolves from the local catalog', async () => {
  const { NEXVAL_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nexval Infotech\n',
    catalog: [hydrateProviderCatalogEntry(NEXVAL_INFOTECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Nexval Infotech runner catalog resolves the dry-run file inside the current workspace', () => {
  const scraper = buildScrapers().find((entry) => entry.name === 'nexvalinfotech')

  assert.ok(scraper)
  assert.equal(scraper.dryRunFile, dryRunFilePath)
  assert.equal(scraper.provider.verifiedOn, '2026-08-03')
  assert.equal(
    scraper.provider.extractionStrategy,
    'whole-current-locale-product-demo-and-form-context+old-unlinked-careers-routes-historical-only+native-employment-and-company-inventory-unqualified',
  )
})

test('Nexval Infotech constants stay pinned to the verified August 3, 2026 blocked careers routes', async () => {
  const nexval = await loadScriptModule()

  assert.deepEqual(nexval.VERIFICATION_URLS, [
    nexval.CAREERS_URL,
    'https://www.nexval.ai/career/',
    'https://www.nexval.ai/jobs/',
    'https://www.nexval.ai/join-us/',
  ])
  assert.equal(nexval.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    nexval.hasBlockedCareersRouteSignal(blockedCareersRoute(nexval.CAREERS_URL)),
    true,
  )
})





test('Current acquisition rejects historical body-only fetchPage fixtures without returning an empty inventory',async()=>{const source=await loadScriptModule();let calls=0;await assert.rejects(source.createNexvalInfotechScraper().run({fetchPage:async()=>{calls++;return ({...blockedCareersRoute('https://www.nexval.ai/careers/'),html:homepageHtml})}}),/metadata-aware fetchImpl/);assert.equal(calls,0)})
