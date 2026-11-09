import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/discord/catalog.js')
  } catch {
    assert.fail('Expected Discord catalog module at ../../scraper/discord/catalog.js')
  }
}

const loadDiscordModule = async () => {
  try {
    return await import('../../scraper/discord/script.js')
  } catch {
    assert.fail('Expected Discord scraper module at ../../scraper/discord/script.js')
  }
}

test('Discord local catalog captures the verified first-party careers page and three-board Greenhouse surface without aliases', async () => {
  const { DISCORD_CATALOG } = await loadCatalogModule()
  const discord = await loadDiscordModule()
  const hydratedProvider = hydrateProviderCatalogEntry(DISCORD_CATALOG)

  assert.equal(DISCORD_CATALOG.source, 'discord')
  assert.equal(DISCORD_CATALOG.companyName, 'Discord')
  assert.equal(DISCORD_CATALOG.adapter, 'script')
  assert.equal(DISCORD_CATALOG.modulePath, '../../scraper/discord/script.js')
  assert.equal(DISCORD_CATALOG.companyCareerPage, 'https://discord.com/careers')
  assert.equal(DISCORD_CATALOG.officialJobsRedirectUrl, 'https://discord.com/jobs')
  assert.equal(DISCORD_CATALOG.firstPartyJobDetailsBaseUrl, 'https://discord.com/jobs/')
  assert.equal(DISCORD_CATALOG.careersScriptUrl, 'https://discord.com/webflow-scripts/careersNew2025.js')
  assert.deepEqual(DISCORD_CATALOG.greenhouseBoardIds, [
    'discord',
    'discordinternational',
    'internationaleor',
  ])
  assert.deepEqual(DISCORD_CATALOG.greenhouseJobsApiUrls, [
    'https://api.greenhouse.io/v1/boards/discord/jobs',
    'https://api.greenhouse.io/v1/boards/discordinternational/jobs',
    'https://api.greenhouse.io/v1/boards/internationaleor/jobs',
  ])
  assert.equal(DISCORD_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(
    DISCORD_CATALOG.paginationStrategy,
    'three-verified-greenhouse-jobs-api-content-pages-aggregated',
  )
  assert.equal(
    DISCORD_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-careers-script+three-public-greenhouse-jobs-apis+first-party-job-route+greenhouse-apply-links',
  )
  assert.equal(DISCORD_CATALOG.parser, 'custom-script')
  assert.equal(DISCORD_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DISCORD_CATALOG.companyDomain, 'discord.com')
  assert.equal(DISCORD_CATALOG.verifiedOn, '2026-07-15')
  assert.match(DISCORD_CATALOG.verifiedSurfaceSummary, /https:\/\/discord\.com\/careers/i)
  assert.match(DISCORD_CATALOG.verifiedSurfaceSummary, /https:\/\/discord\.com\/webflow-scripts\/careersNew2025\.js/i)
  assert.match(
    DISCORD_CATALOG.verifiedSurfaceSummary,
    /https:\/\/api\.greenhouse\.io\/v1\/boards\/discord\/jobs\?content=true/i,
  )
  assert.match(
    DISCORD_CATALOG.verifiedSurfaceSummary,
    /https:\/\/api\.greenhouse\.io\/v1\/boards\/discordinternational\/jobs\?content=true/i,
  )
  assert.match(
    DISCORD_CATALOG.verifiedSurfaceSummary,
    /https:\/\/api\.greenhouse\.io\/v1\/boards\/internationaleor\/jobs\?content=true/i,
  )
  assert.match(DISCORD_CATALOG.verifiedSurfaceSummary, /\b57 live roles\b/i)
  assert.match(DISCORD_CATALOG.verifiedSurfaceSummary, /Account Executive - Tech/i)
  assert.match(
    DISCORD_CATALOG.verifiedSurfaceSummary,
    /Program Manager, Detection & Enforcement, Counter-Extremism/i,
  )
  assert.match(DISCORD_CATALOG.verifiedSurfaceSummary, /Regulatory Counsel, APAC/i)

  assert.match(hydratedProvider.modulePath, /discord[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Discord'), false)

  assert.equal(discord.PROVIDER_METADATA.source, DISCORD_CATALOG.source)
  assert.equal(discord.PROVIDER_METADATA.companyName, DISCORD_CATALOG.companyName)
  assert.deepEqual(discord.PROVIDER_METADATA.greenhouseBoardIds, DISCORD_CATALOG.greenhouseBoardIds)
})

test('Discord backlog row matches directly from the local provider metadata without alias churn', async () => {
  const { DISCORD_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Discord\n',
    catalog: [hydrateProviderCatalogEntry(DISCORD_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Discord', 'discord', 'Discord']],
  )
})

test('buildScrapers and company coverage resolve Discord from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'discord')
  const scraper = buildScrapers().find((item) => item.name === 'discord')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Discord')
  assert.equal(provider.companyCareerPage, 'https://discord.com/careers')
  assert.match(scraper.dryRunFile, /discord[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Discord\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Discord', 'discord', 'Discord']],
  )
})
