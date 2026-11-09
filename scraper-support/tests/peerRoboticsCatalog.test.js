import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Peer Robotics as a verified Wellfound handoff provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'peerrobotics')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Peer Robotics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wellfound')
  assert.equal(provider.companyCareerPage, 'https://peerrobotics.ai/about')
  assert.equal(provider.companyDomain, 'peerrobotics.ai')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-about-hiring-handoff-plus-readable-wellfound-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-hiring-handoff+verified-wellfound-public-board-listing-extraction',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedIndiaJobCount, 1)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/peerrobotics\.ai\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/wellfound\.com\/company\/peer-robotics\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /View 1 job/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Hardware Systems Engineer/i)
  assert.match(provider.modulePath, /peerrobotics[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Peer Robotics lane without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'peerrobotics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'peerrobotics')
  assert.equal(scraper.provider.atsPlatform, 'wellfound')
  assert.match(scraper.dryRunFile, /peerrobotics[\\/]jobs\.json$/i)
})
