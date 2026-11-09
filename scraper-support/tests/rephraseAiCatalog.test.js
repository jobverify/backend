import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rephraseai/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rephraseai/catalog.js')
  } catch {
    assert.fail('Expected Rephrase.ai catalog module at ../../scraper/rephraseai/catalog.js')
  }
}

test('Rephrase.ai local catalog captures the verified exact-name first-party no-public-careers surface', async () => {
  const {
    REPHRASE_AI_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, REPHRASE_AI_CATALOG)
  assert.equal(REPHRASE_AI_CATALOG.source, 'rephraseai')
  assert.equal(REPHRASE_AI_CATALOG.companyName, 'Rephrase.ai')
  assert.equal(REPHRASE_AI_CATALOG.officialBrandName, 'Rephrase AI')
  assert.equal(REPHRASE_AI_CATALOG.adapter, 'script')
  assert.equal(REPHRASE_AI_CATALOG.modulePath, modulePath)
  assert.equal(REPHRASE_AI_CATALOG.dryRunFile, 'rephraseai/jobs.json')
  assert.equal(REPHRASE_AI_CATALOG.officialHomepageUrl, 'https://www.rephraseai.com/')
  assert.equal(REPHRASE_AI_CATALOG.aboutPageUrl, 'https://www.rephraseai.com/about')
  assert.equal(REPHRASE_AI_CATALOG.companyCareerPage, 'https://www.rephraseai.com/careers')
  assert.equal(REPHRASE_AI_CATALOG.jobsPageUrl, 'https://www.rephraseai.com/jobs')
  assert.equal(REPHRASE_AI_CATALOG.companyDomain, 'rephraseai.com')
  assert.equal(REPHRASE_AI_CATALOG.atsPlatform, 'official-company-site-blocked-by-vercel-security-checkpoint')
  assert.equal(REPHRASE_AI_CATALOG.countryFilter, 'India')
  assert.equal(REPHRASE_AI_CATALOG.paginationStrategy, 'sitewide-vercel-security-checkpoint-on-homepage-and-common-careers-routes')
  assert.equal(
    REPHRASE_AI_CATALOG.extractionStrategy,
    'verified-homepage-vercel-checkpoint+verified-about-careers-jobs-vercel-checkpoints+return-empty',
  )
  assert.equal(REPHRASE_AI_CATALOG.parser, 'custom-script')
  assert.equal(REPHRASE_AI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(REPHRASE_AI_CATALOG.verifiedOn, '2026-08-13')
  assert.equal(REPHRASE_AI_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Thursday, August 13, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.rephraseai\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.rephraseai\.com\/about/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.rephraseai\.com\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.rephraseai\.com\/jobs/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /HTTP 429/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Vercel Security Checkpoint/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs inventory/i)
})
