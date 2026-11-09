import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/oneassist/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/oneassist/catalog.js')
  } catch {
    assert.fail('Expected OneAssist catalog module at ../../scraper/oneassist/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/oneassist/script.js')
  } catch {
    assert.fail('Expected OneAssist scraper module at ../../scraper/oneassist/script.js')
  }
}

test('OneAssist local catalog captures the verified broken first-party careers-subdomain sentinel state', async () => {
  const { ONE_ASSIST_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const oneAssist = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(ONE_ASSIST_CATALOG)

  assert.equal(defaultCatalog, ONE_ASSIST_CATALOG)
  assert.equal(provider.source, 'oneassist')
  assert.equal(provider.companyName, 'OneAssist')
  assert.equal(provider.officialBrandName, 'OneAssist')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://oneassist.in/')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
  )
  assert.equal(
    provider.officialCareersPageUrl,
    'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
  )
  assert.equal(provider.companyDomain, 'oneassist.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-footer-handoff-plus-broken-first-party-careers-subdomain-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-footer-link+verified-broken-first-party-careers-subdomain-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /oneassist[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/oneassist\.in\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/careers\.oneassist\.in\/\?utm_source=website&utm_medium=website_footer&utm_campaign=footer/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Active domain connection for this domain not found/i)
  assert.match(provider.verifiedSurfaceSummary, /ERR_TLS_CERT_ALTNAME_INVALID/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OneAssist'), false)

  assert.equal(oneAssist.PROVIDER_METADATA.source, ONE_ASSIST_CATALOG.source)
  assert.equal(oneAssist.PROVIDER_METADATA.companyName, ONE_ASSIST_CATALOG.companyName)
  assert.equal(oneAssist.PROVIDER_METADATA.officialCareersPageUrl, ONE_ASSIST_CATALOG.officialCareersPageUrl)
})

test('OneAssist exact backlog row matches directly from local provider metadata', async () => {
  const { ONE_ASSIST_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OneAssist\n',
    catalog: [hydrateProviderCatalogEntry(ONE_ASSIST_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OneAssist', 'oneassist', 'OneAssist']],
  )
})

test('getScraperCatalog exposes OneAssist as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'oneassist')
  const scraper = buildScrapers().find((item) => item.name === 'oneassist')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'OneAssist')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OneAssist'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'OneAssist\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OneAssist', 'oneassist', 'OneAssist']],
  )
})

test('OneAssist hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { ONE_ASSIST_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ONE_ASSIST_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'OneAssist')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
  )
  assert.equal(provider.companyDomain, 'oneassist.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /oneassist[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /oneassist[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
