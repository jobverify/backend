import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const currentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings - Tanisha Systems Inc.</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <p>You can view our most current openings below on this page.</p>
    <section class="opening">
      <div class="summary">
        <h2>Software Developer</h2>
        <p>99 Wood Avenue S., Suite 308, Iselin, NJ 08830</p>
        <p>6 Openings</p>
        <p>Start Date:03/24/2026</p>
      </div>
      <div class="detail">
        <h3>Job Opening for Software Developer (6 Openings)</h3>
        <p>Date: 03/24/2026 -04/23/2026</p>
        <p>Job Locations: Iselin, NJ or unanticipated client sites within the U.S.</p>
      </div>
    </section>
    <section class="opening">
      <div class="summary">
        <h2>Project Manager</h2>
        <p>99 Wood Avenue S., Suite 308, Iselin, NJ 08830</p>
        <p>1 Openings</p>
        <p>Start Date: 10/01/2025</p>
      </div>
      <div class="detail">
        <h3>Job Opening for Project Manager (1 Openings)</h3>
        <p>Date: Start Date: 10/01/2025</p>
        <p>Job Locations: Iselin, NJ, but relocation possible.</p>
      </div>
    </section>
    <section class="opening">
      <div class="summary">
        <h2>Software Architect</h2>
        <p>NYC or client sites across the U.S.</p>
        <p>6 Openings (F/T)</p>
        <p>Start Date : 12-08-2025</p>
      </div>
      <div class="detail">
        <h3>Software Architect</h3>
        <p>Job Locations: Iselin, NJ, but relocation possible.</p>
      </div>
    </section>
  </body>
</html>
`

const liveCurrentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings - Tanisha Systems Inc.</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <p>You can view our most current openings below on this page.</p>
    <div>
      <h2>Software Developer</h2>
      <p>99 Wood Avenue S., Suite 308, Iselin, NJ 08830</p>
      <p>6 Openings</p>
      <p>Start Date:03/24/2026</p>
      <a href="#software-developer">Click to explore this job</a>
      <h3>Job Opening for Software Developer (6 Openings)</h3>
      <p>Job Locations: Iselin, NJ or unanticipated client sites within the U.S.</p>
    </div>
    <div>
      <h2>Business Analyst</h2>
      <p>99 Wood Avenue S., Suite 308, Iselin, NJ 08830</p>
      <p>1 Opening</p>
      <p>Start Date:01/13/2026</p>
      <a href="#business-analyst">Click to explore this job</a>
      <h3>Business Analyst (1 Opening)</h3>
      <p>Job Locations: Iselin, NJ or unanticipated client sites within the U.S.</p>
    </div>
    <div>
      <h2>Software Engineer</h2>
      <p>99 Wood Avenue S., Suite 308, Iselin, NJ 08830</p>
      <p>1 Openings</p>
      <p>Start Date:09/08/2025</p>
      <a href="#software-engineer">Click to explore this job</a>
      <h3>Software Engineer (1 Openings)</h3>
      <p>Job Locations: New York, NY or unanticipated client sites within the U.S.</p>
    </div>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tanishasystems/catalog.js')
  } catch {
    assert.fail('Expected Tanisha Systems catalog module at ../../scraper/tanishasystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tanishasystems/script.js')
  } catch {
    assert.fail('Expected Tanisha Systems scraper module at ../../scraper/tanishasystems/script.js')
  }
}

test('Tanisha Systems local catalog captures the verified first-party current openings contract', async () => {
  const { TANISHA_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TANISHA_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, TANISHA_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'tanishasystems')
  assert.equal(provider.companyName, 'Tanisha Systems')
  assert.equal(provider.officialBrandName, 'Tanisha Systems Inc.')
  assert.equal(provider.companyCareerPage, 'https://www.tanishasystems.com/currentopenings.html')
  assert.equal(provider.companyDomain, 'tanishasystems.com')
  assert.equal(provider.atsPlatform, 'first-party-static-openings-page')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'single-first-party-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-static-openings-page+inline-opening-blocks',
  )
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.verifiedSurfaceSummary, /Software Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Analyst/i)
})

test('Tanisha Systems helpers stay pinned to the verified current openings page', async () => {
  const tanisha = await loadScriptModule()

  assert.equal(tanisha.SOURCE, 'tanishasystems')
  assert.equal(tanisha.COMPANY, 'Tanisha Systems')
  assert.equal(tanisha.CAREERS_URL, 'https://www.tanishasystems.com/currentopenings.html')
  assert.equal(tanisha.VERIFIED_ON, '2026-08-05')
  assert.equal(tanisha.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)
  assert.deepEqual(tanisha.extractCurrentOpenings(currentOpeningsHtml), [
    {
      title: 'Software Developer',
      location: 'Iselin, NJ or unanticipated client sites within the U.S.',
      sourceUrl: 'https://www.tanishasystems.com/currentopenings.html#software-developer',
      jobId: 'software-developer',
      openingsCount: 6,
    },
    {
      title: 'Project Manager',
      location: 'Iselin, NJ, but relocation possible.',
      sourceUrl: 'https://www.tanishasystems.com/currentopenings.html#project-manager',
      jobId: 'project-manager',
      openingsCount: 1,
    },
    {
      title: 'Software Architect',
      location: 'Iselin, NJ, but relocation possible.',
      sourceUrl: 'https://www.tanishasystems.com/currentopenings.html#software-architect',
      jobId: 'software-architect',
      openingsCount: 6,
    },
  ])
})

test('Tanisha Systems run validates the first-party openings page and returns the verified public openings', async () => {
  const tanisha = await loadScriptModule()
  const jobs = await tanisha.createTanishaSystemsScraper({
    now: () => '2026-08-05T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, tanisha.CAREERS_URL)
      return liveCurrentOpeningsHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'tanishasystems')
  assert.equal(jobs[0].location, 'Iselin, NJ or unanticipated client sites within the U.S.')
  assert.equal(jobs[0].country, 'United States')
  assert.equal(jobs[0].companyDomain, 'tanishasystems.com')
  assert.equal(jobs[1].title, 'Business Analyst')
  assert.equal(jobs[2].location, 'New York, NY or unanticipated client sites within the U.S.')
})

test('Tanisha Systems fails closed when the verified current openings shell changes materially', async () => {
  const tanisha = await loadScriptModule()

  await assert.rejects(
    tanisha.createTanishaSystemsScraper().run({
      fetchText: async () => '<html><body><h1>Join Us</h1></body></html>',
    }),
    /verified Tanisha Systems current openings page/i,
  )
})

test('Tanisha Systems returns an empty result when the live current openings page times out', async () => {
  const tanisha = await loadScriptModule()

  const jobs = await tanisha.createTanishaSystemsScraper().run({
    fetchText: async () => {
      const error = new TypeError('fetch failed')
      error.cause = {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted address: www.tanishasystems.com:443, timeout: 10000ms)',
      }
      throw error
    },
  })

  assert.deepEqual(jobs, [])
})
