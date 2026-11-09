import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadSpotifyCatalog = async () => {
  try {
    return await import('../../scraper/spotify/catalog.js')
  } catch {
    assert.fail('Expected Spotify catalog module at ../../scraper/spotify/catalog.js')
  }
}

test('Spotify catalog captures the verified first-party India zero-openings surface', async () => {
  const { SPOTIFY_PROVIDER, default: defaultCatalog } = await loadSpotifyCatalog()

  assert.equal(defaultCatalog, SPOTIFY_PROVIDER)
  assert.equal(SPOTIFY_PROVIDER.source, 'spotify')
  assert.equal(SPOTIFY_PROVIDER.companyName, 'Spotify')
  assert.equal(SPOTIFY_PROVIDER.adapter, 'script')
  assert.equal(SPOTIFY_PROVIDER.companyCareerPage, 'https://www.lifeatspotify.com/jobs')
  assert.equal(SPOTIFY_PROVIDER.companyDomain, 'lifeatspotify.com')
  assert.equal(SPOTIFY_PROVIDER.atsPlatform, 'official-first-party-careers-pages')
  assert.equal(SPOTIFY_PROVIDER.countryFilter, 'India')
  assert.equal(
    SPOTIFY_PROVIDER.paginationStrategy,
    'verified-first-party-careers-pages-with-global-and-mumbai-zero-openings-checks',
  )
  assert.equal(
    SPOTIFY_PROVIDER.extractionStrategy,
    'verified-lifeatspotify-jobs-zero-openings+verified-india-locations-page+verified-mumbai-zero-jobs+verified-faq-legitimacy-copy+return-empty',
  )
  assert.equal(SPOTIFY_PROVIDER.parser, 'custom-script')
  assert.equal(SPOTIFY_PROVIDER.normalizationProfile, 'engineering-default')
  assert.equal(SPOTIFY_PROVIDER.verifiedOn, '2026-07-25')
  assert.match(SPOTIFY_PROVIDER.verifiedSurfaceSummary, /lifeatspotify\.com\/jobs/i)
  assert.match(SPOTIFY_PROVIDER.verifiedSurfaceSummary, /find-your-team\/locations\/mumbai/i)
  assert.match(SPOTIFY_PROVIDER.verifiedSurfaceSummary, /0 jobs in all locations in all categories in all job types/i)
  assert.match(SPOTIFY_PROVIDER.verifiedSurfaceSummary, /no current India openings/i)
  assert.match(SPOTIFY_PROVIDER.modulePath, /spotify[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Spotify India'), false)
})

test('Spotify India backlog row matches directly from the local catalog metadata without an alias', async () => {
  const { SPOTIFY_PROVIDER } = await loadSpotifyCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Spotify India\n',
    catalog: [SPOTIFY_PROVIDER],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Spotify India', 'spotify', 'Spotify']],
  )
})

test('buildScrapers and company coverage resolve Spotify from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'spotify')
  const scraper = buildScrapers().find((item) => item.name === 'spotify')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Spotify')
  assert.equal(provider.companyCareerPage, 'https://lifeatspotify.com/jobs/research-scientist-personalization')
  assert.equal(provider.adapter, 'publicAts')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.boardToken, 'spotify')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.ok(provider.bindingEvidence.matchedLinks.some(link => link.startsWith('https://jobs.lever.co/spotify/')))
  assert.match(scraper.dryRunFile, /spotify[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Spotify India\nSpotify\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => item.source), ['spotify', 'spotify'])
})
