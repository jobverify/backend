import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sakon/script.js')

const careersHtml = `
  <html>
    <head>
      <title>Careers</title>
      <link rel="canonical" href="https://www.sakon.com/join-us" />
    </head>
    <body>
      <h1>Join the Team Powering the Intelligence Behind Global Telecom</h1>
      <h2>Ready to Join Us?</h2>
      <div>No job listing available. Please change the filters or the Search criteria.</div>
      <div>Let's Talk</div>
      <div>Global Presence, Local Impact</div>
    </body>
  </html>
`

const liveJobsHtml = `
  <html>
    <head>
      <title>Careers</title>
    </head>
    <body>
      <h1>Join the Team Powering the Intelligence Behind Global Telecom</h1>
      <article>
        <h3>Senior Data Analyst</h3>
        <p>Pune, India</p>
      </article>
    </body>
  </html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sakon/catalog.js')
  } catch {
    assert.fail('Expected Sakon catalog module at ../../scraper/sakon/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sakon/script.js')
  } catch {
    assert.fail('Expected Sakon scraper module at ../../scraper/sakon/script.js')
  }
}

test('Sakon local catalog captures the verified no-listings first-party careers page', async () => {
  const { SAKON_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAKON_CATALOG)

  assert.equal(defaultCatalog, SAKON_CATALOG)
  assert.equal(provider.source, 'sakon')
  assert.equal(provider.companyName, 'Sakon')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sakon.com/join-us')
  assert.equal(provider.companyDomain, 'sakon.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-join-us-page-with-empty-job-listing-state')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-join-us-page+verified-empty-job-listing-state+lets-talk-handoff-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /No job listing available/i)
})

test('Sakon scraper returns no jobs while the verified first-party page still exposes an empty listings state', async () => {
  const sakon = await loadScriptModule()

  assert.equal(sakon.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(sakon.hasEmptyListingSignal(careersHtml), true)

  const jobs = await sakon.createSakonScraper().run({
    fetchText: async () => careersHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Sakon scraper fails closed when the official careers page starts exposing live roles', async () => {
  const sakon = await loadScriptModule()

  await assert.rejects(
    sakon.createSakonScraper().run({
      fetchText: async () => liveJobsHtml,
    }),
    /Sakon verified empty careers state changed; review the scraper/,
  )
})
