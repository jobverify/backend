import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/modeln/script.js')

const careersHtml = `
  <html>
    <head>
      <title>Careers | Model N</title>
    </head>
    <body>
      <section>
        <a>View Positions</a>
        <h2>Open Positions</h2>
        <div>Filter by location</div>
        <div>Filter by department</div>
        <div>Filter by team</div>
        <div>Filter by work type</div>
        <div>Clear all</div>
        <div id="lever-no-results" style="display: none;">No results</div>
        <div id="lever-jobs-container"></div>
        <script src="https://jobs.lever.co/embed/index.js"></script>
        <script>window.leverJobsOptions = { accountName: 'modeln' }</script>
      </section>
    </body>
  </html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/modeln/catalog.js')
  } catch {
    assert.fail('Expected Model N catalog module at ../../scraper/modeln/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/modeln/script.js')
  } catch {
    assert.fail('Expected Model N scraper module at ../../scraper/modeln/script.js')
  }
}

test('Model N local catalog captures the current official Lever feed', async () => {
  const { MODEL_N_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MODEL_N_CATALOG)

  assert.equal(defaultCatalog, MODEL_N_CATALOG)
  assert.equal(provider.source, 'modeln')
  assert.equal(provider.companyName, 'Model N')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.modeln.com/company/careers/')
  assert.equal(provider.companyDomain, 'modeln.com')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'lever-public-postings-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-embed+lever-public-postings-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-02')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Lever/i)
  assert.equal(provider.leverApiUrl, 'https://api.lever.co/v0/postings/modeln?mode=json')
})

test('Model N scraper extracts India roles despite a hidden No results placeholder', async () => {
  const modelN = await loadScriptModule()

  assert.equal(modelN.hasOfficialCareersSignal(careersHtml), true)

  const jobs = await modelN.createModelNScraper().run({
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: careersHtml,
    }),
    fetchJson: async (url) => {
      assert.equal(url, modelN.LEVER_API_URL)
      return [
        { id: 'us-id', text: 'US Engineer', categories: { location: 'Remote, US' }, hostedUrl: 'https://jobs.lever.co/modeln/us-id' },
        { id: 'india-id', text: 'Employee Experience Specialist', categories: { location: 'Hyderabad India' }, hostedUrl: 'https://jobs.lever.co/modeln/india-id', applyUrl: 'https://jobs.lever.co/modeln/india-id/apply', descriptionPlain: 'Help employees succeed.' },
      ]
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Employee Experience Specialist')
  assert.equal(jobs[0].location, 'Hyderabad India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('Model N scraper rejects an unverified embed and invalid India posting URL', async () => {
  const modelN = await loadScriptModule()

  await assert.rejects(
    modelN.createModelNScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: careersHtml.replace("accountName: 'modeln'", "accountName: 'other'"),
      }),
      fetchJson: async () => [],
    }),
    /verified Lever embed/,
  )
  await assert.rejects(
    modelN.createModelNScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: careersHtml }),
      fetchJson: async () => [{ id: 'india-id', text: 'India Engineer', categories: { location: 'Hyderabad India' }, hostedUrl: 'https://jobs.lever.co/other/india-id' }],
    }),
    /trusted Lever job URL/,
  )
})
