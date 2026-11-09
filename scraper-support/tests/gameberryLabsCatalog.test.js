import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const gameberryLabsModulePath = path.resolve(currentDir, '../../scraper/gameberrylabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/gameberrylabs/catalog.js')
  } catch {
    assert.fail('Expected Gameberry Labs catalog module at ../../scraper/gameberrylabs/catalog.js')
  }
}

const loadGameberryLabsModule = async () => {
  try {
    return await import('../../scraper/gameberrylabs/script.js')
  } catch {
    assert.fail('Expected Gameberry Labs scraper module at ../../scraper/gameberrylabs/script.js')
  }
}

test('Gameberry Labs local catalog captures the verified homepage careers handoff and no-public-jobs contract', async () => {
  const { GAMEBERRY_LABS_CATALOG } = await loadCatalogModule()
  const gameberryLabs = await loadGameberryLabsModule()

  assert.equal(GAMEBERRY_LABS_CATALOG.source, 'gameberrylabs')
  assert.equal(GAMEBERRY_LABS_CATALOG.companyName, 'Gameberry Labs')
  assert.equal(GAMEBERRY_LABS_CATALOG.officialBrandName, 'Gameberry Labs')
  assert.equal(GAMEBERRY_LABS_CATALOG.adapter, 'script')
  assert.equal(GAMEBERRY_LABS_CATALOG.homepageUrl, 'https://gameberrylabs.com/')
  assert.equal(GAMEBERRY_LABS_CATALOG.companyCareerPage, 'https://gameberrylabs.com/jobs')
  assert.equal(GAMEBERRY_LABS_CATALOG.externalHandoffUrl, 'https://gameberry.keka.com/careers')
  assert.equal(GAMEBERRY_LABS_CATALOG.companyDomain, 'gameberrylabs.com')
  assert.equal(GAMEBERRY_LABS_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(GAMEBERRY_LABS_CATALOG.countryFilter, 'India')
  assert.equal(GAMEBERRY_LABS_CATALOG.paginationStrategy, 'single-first-party-homepage-with-external-keka-handoff')
  assert.equal(
    GAMEBERRY_LABS_CATALOG.extractionStrategy,
    'verified-first-party-homepage+verified-jobs-redirect+external-keka-handoff-no-verifiable-public-job-records',
  )
  assert.equal(GAMEBERRY_LABS_CATALOG.parser, 'custom-script')
  assert.equal(GAMEBERRY_LABS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GAMEBERRY_LABS_CATALOG.verifiedOn, '2026-07-15')
  assert.match(GAMEBERRY_LABS_CATALOG.dryRunFile, /gameberrylabs[\\/]jobs\.json$/i)
  assert.equal(GAMEBERRY_LABS_CATALOG.modulePath, gameberryLabsModulePath)
  assert.match(GAMEBERRY_LABS_CATALOG.verifiedSurfaceSummary, /https:\/\/gameberrylabs\.com\//i)
  assert.match(GAMEBERRY_LABS_CATALOG.verifiedSurfaceSummary, /https:\/\/gameberrylabs\.com\/jobs/i)
  assert.match(GAMEBERRY_LABS_CATALOG.verifiedSurfaceSummary, /https:\/\/gameberry\.keka\.com\/careers/i)
  assert.match(GAMEBERRY_LABS_CATALOG.verifiedSurfaceSummary, /timed out during direct probe/i)
  assert.match(GAMEBERRY_LABS_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(gameberryLabs.PROVIDER_METADATA.source, GAMEBERRY_LABS_CATALOG.source)
  assert.equal(gameberryLabs.PROVIDER_METADATA.companyName, GAMEBERRY_LABS_CATALOG.companyName)
  assert.equal(gameberryLabs.PROVIDER_METADATA.companyCareerPage, GAMEBERRY_LABS_CATALOG.companyCareerPage)
})

test('Gameberry Labs exact backlog row resolves directly from local provider metadata without aliases', async () => {
  const { GAMEBERRY_LABS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Gameberry Labs\n',
    catalog: [GAMEBERRY_LABS_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Gameberry Labs', 'gameberrylabs', 'Gameberry Labs']],
  )
})
