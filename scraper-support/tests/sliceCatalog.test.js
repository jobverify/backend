import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/slice/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/slice/catalog.js')
  } catch {
    assert.fail('Expected Slice catalog module at ../../scraper/slice/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/slice/script.js')
  } catch {
    assert.fail('Expected Slice scraper module at ../../scraper/slice/script.js')
  }
}

test('Slice local catalog captures the verified Indian-bank Kula inventory without alias churn', async () => {
  const {SLICE_CATALOG,default:defaultCatalog}=await loadCatalogModule()
  const slice=await loadScraperModule()
  const provider=hydrateProviderCatalogEntry(SLICE_CATALOG)
  assert.equal(defaultCatalog,SLICE_CATALOG)
  assert.equal(provider.source,'slice')
  assert.equal(provider.companyName,'Slice')
  assert.equal(provider.officialBrandName,'Slice')
  assert.equal(provider.adapter,'script')
  assert.equal(provider.companyCareerPage,'https://slice.bank.in/careers/')
  assert.equal(provider.officialBankOpenPositionsUrl,'https://slice.bank.in/careers/open-positions')
  assert.equal(provider.publicBoardUrl,'https://careers.kula.ai/slice?jobs=true')
  assert.equal(provider.jobsApiUrl,'https://careers.kula.ai/api/internal/ats_job_posts')
  assert.equal(provider.bankCompanyLegalName,'slice small finance bank ltd')
  assert.equal(provider.companyDomain,'slice.bank.in')
  assert.equal(provider.atsPlatform,'kula-public-api')
  assert.equal(provider.countryFilter,'India')
  assert.equal(provider.paginationStrategy,'native-api-99-item-pages-with-reported-count-and-page-completeness')
  assert.equal(provider.extractionStrategy,'verified-bank-kula-handoff+native-public-jobs+full-descriptions+explicit-india-office-filter')
  assert.equal(provider.parser,'custom-script')
  assert.equal(provider.normalizationProfile,'engineering-default')
  assert.equal(provider.verifiedOn,'2026-10-03')
  assert.equal(provider.verifiedPublicJobCount,40)
  assert.equal(provider.verifiedIndiaJobCount,40)
  assert.equal(provider.modulePath,modulePath)
  assert.match(provider.dryRunFile,/slice[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary,/2026-10-03/)
  assert.match(provider.verifiedSurfaceSummary,/slice small finance bank ltd/)
  assert.match(provider.verifiedSurfaceSummary,/count 40, page 1, pages 1/)
  assert.equal(provider.alternateCompanyCareerPage,undefined)
  assert.equal(Object.hasOwn(companyAliases,'Slice'),false)
  assert.equal(slice.PROVIDER_METADATA,SLICE_CATALOG)
})

test('Slice exact backlog row matches directly from local provider metadata', async () => {
  const { SLICE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Slice\n',
    catalog: [hydrateProviderCatalogEntry(SLICE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Slice', 'slice', 'Slice']],
  )
})

test('Slice hydrated local catalog stays script-runner compatible with the verified bank feed', async () => {
  const { SLICE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SLICE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Slice')
  assert.equal(provider.companyCareerPage, 'https://slice.bank.in/careers/')
  assert.equal(provider.companyDomain, 'slice.bank.in')
  assert.equal(provider.atsPlatform, 'kula-public-api')
  assert.match(provider.modulePath, /slice[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /slice[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
