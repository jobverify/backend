import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/amplelogic/script.js')

const careersHtml = `
  <html>
    <head>
      <title>Careers at AmpleLogic | Join AI-Powered Pharma Software Company | Jobs & Internships</title>
    </head>
    <body>
      <section>
        <h2>Find Your Role</h2>
        <article class="job-card">
          <h3>Lead Generation Executive</h3>
          <p>Hyderabad, India</p>
          <p>Full-time</p>
          <p>1-4 years</p>
          <button>Apply Now</button>
          <button>View Details</button>
        </article>
        <article class="job-card">
          <h3>Electronic Lab Notebook (ELN) Domain Expert</h3>
          <p>Hyderabad</p>
          <p>Full-time</p>
          <p>4+Years</p>
          <button>Apply Now</button>
          <button>View Details</button>
        </article>
      </section>
    </body>
  </html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/amplelogic/catalog.js')
  } catch {
    assert.fail('Expected AmpleLogic catalog module at ../../scraper/amplelogic/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/amplelogic/script.js')
  } catch {
    assert.fail('Expected AmpleLogic scraper module at ../../scraper/amplelogic/script.js')
  }
}

test('AmpleLogic local catalog captures the verified first-party careers cards', async () => {
  const { AMPLELOGIC_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AMPLELOGIC_CATALOG)

  assert.equal(defaultCatalog, AMPLELOGIC_CATALOG)
  assert.equal(provider.source, 'amplelogic')
  assert.equal(provider.companyName, 'AmpleLogic')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.amplelogic.com/careers')
  assert.equal(provider.companyDomain, 'amplelogic.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-cards')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+first-party-job-cards+same-page-apply-cta',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Generation Executive/i)
  assert.match(provider.verifiedSurfaceSummary, /Electronic Lab Notebook \(ELN\) Domain Expert/i)
})

test('AmpleLogic scraper extracts same-page first-party job cards', async () => {
  const ampleLogic = await loadScriptModule()

  assert.equal(ampleLogic.hasOfficialCareersSignal(careersHtml), true)

  const cards = ampleLogic.extractJobCards(careersHtml)
  assert.equal(cards.length, 2)
  assert.deepEqual(
    cards.map((card) => [card.title, card.location, card.employmentType, card.experience]),
    [
      ['Lead Generation Executive', 'Hyderabad, India', 'Full-time', '1-4 years'],
      ['Electronic Lab Notebook (ELN) Domain Expert', 'Hyderabad', 'Full-time', '4+Years'],
    ],
  )

  const jobs = await ampleLogic.createAmpleLogicScraper().run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.country, job.sourceUrl]),
    [
      ['Lead Generation Executive', 'Hyderabad, India', 'India', 'https://www.amplelogic.com/careers#lead-generation-executive'],
      ['Electronic Lab Notebook (ELN) Domain Expert', 'Hyderabad, India', 'India', 'https://www.amplelogic.com/careers#electronic-lab-notebook-eln-domain-expert'],
    ],
  )
})
