import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers At Evoke – Work With Industry Leaders In A Thriving Culture</title>
  </head>
  <body>
    <h1>Join Our Team and Shape the Future of Transformation</h1>
    <a href="https://careers.evoketechnologies.com/">View Job Openings</a>
    <p>JOB OPENINGS</p>
    <p>Let’s Grow Together</p>
  </body>
</html>
`

const indiaHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India</title>
  </head>
  <body>
    <h1>India</h1>
    <p>Results 1 – 7 of 7 Page 1 of 1</p>
    <table>
      <tr>
        <td>4316</td>
        <td><a href="https://careers.evoketechnologies.com/job/Hyderabad-India/Technical-Associate---NETAngular/4316/">Technical Associate - .NET+Angular</a></td>
        <td>Hyderabad, India</td>
        <td>Jul 3, 2026</td>
      </tr>
      <tr>
        <td>4363</td>
        <td><a href="https://careers.evoketechnologies.com/job/Hyderabad-India/Senior-Technical-Associate/4363/">Senior Technical Associate</a></td>
        <td>Hyderabad, India</td>
        <td>Jun 24, 2026</td>
      </tr>
      <tr>
        <td>4212</td>
        <td><a href="https://careers.evoketechnologies.com/job/Hyderabad-India/TechnicalSolutions-Architect---AI/4212/">Technical/Solutions Architect - AI</a></td>
        <td>Hyderabad, India</td>
        <td>Jun 14, 2026</td>
      </tr>
    </table>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/evoketechnologies/catalog.js')
  } catch {
    assert.fail('Expected Evoke Technologies catalog module at ../../scraper/evoketechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/evoketechnologies/script.js')
  } catch {
    assert.fail('Expected Evoke Technologies scraper module at ../../scraper/evoketechnologies/script.js')
  }
}

test('Evoke Technologies local catalog captures the verified first-party India jobs contract', async () => {
  const { EVOKE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EVOKE_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, EVOKE_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'evoketechnologies')
  assert.equal(provider.companyName, 'Evoke Technologies')
  assert.equal(provider.officialBrandName, 'Evoke Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.evoketechnologies.com/careers/')
  assert.equal(provider.indiaJobsPageUrl, 'https://careers.evoketechnologies.com/go/India/733644/')
  assert.equal(provider.companyDomain, 'evoketechnologies.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-country-listing-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-handoff+country-listing-table',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Results 1 – 7 of 7 Page 1 of 1/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Associate - \.NET\+Angular/i)
})

test('Evoke Technologies hydrated local catalog stays script-runner compatible', async () => {
  const { EVOKE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EVOKE_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(typeof module.run, 'function')
})

test('Evoke Technologies helpers stay pinned to the verified careers handoff and India jobs table', async () => {
  const evoke = await loadScriptModule()

  assert.equal(evoke.SOURCE, 'evoketechnologies')
  assert.equal(evoke.COMPANY, 'Evoke Technologies')
  assert.equal(evoke.CAREERS_URL, 'https://www.evoketechnologies.com/careers/')
  assert.equal(evoke.INDIA_JOBS_URL, 'https://careers.evoketechnologies.com/go/India/733644/')
  assert.equal(evoke.VERIFIED_ON, '2026-07-18')
  assert.equal(evoke.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(evoke.extractIndiaJobs(indiaHtml), [
    {
      jobId: '4316',
      title: 'Technical Associate - .NET+Angular',
      location: 'Hyderabad, India',
      postingDate: 'Jul 3, 2026',
      sourceUrl: 'https://careers.evoketechnologies.com/job/Hyderabad-India/Technical-Associate---NETAngular/4316/',
    },
    {
      jobId: '4363',
      title: 'Senior Technical Associate',
      location: 'Hyderabad, India',
      postingDate: 'Jun 24, 2026',
      sourceUrl: 'https://careers.evoketechnologies.com/job/Hyderabad-India/Senior-Technical-Associate/4363/',
    },
    {
      jobId: '4212',
      title: 'Technical/Solutions Architect - AI',
      location: 'Hyderabad, India',
      postingDate: 'Jun 14, 2026',
      sourceUrl: 'https://careers.evoketechnologies.com/job/Hyderabad-India/TechnicalSolutions-Architect---AI/4212/',
    },
  ])
})

test('Evoke Technologies run validates the handoff and returns India openings', async () => {
  const evoke = await loadScriptModule()
  const requestedUrls = []
  const jobs = await evoke.createEvokeTechnologiesScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === evoke.CAREERS_URL) return careersHtml
      if (url === evoke.INDIA_JOBS_URL) return indiaHtml
      throw new Error(`Unexpected Evoke URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [evoke.CAREERS_URL, evoke.INDIA_JOBS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'evoketechnologies')
  assert.equal(jobs[0].companyCareerPage, evoke.CAREERS_URL)
  assert.equal(jobs[0].location, 'Hyderabad, India')
  assert.equal(jobs[0].postingDate, 'Jul 3, 2026')
})

test('Evoke Technologies fails closed when the verified first-party careers handoff changes materially', async () => {
  const evoke = await loadScriptModule()

  await assert.rejects(
    evoke.createEvokeTechnologiesScraper().run({
      fetchText: async (url) => (url === evoke.CAREERS_URL ? '<html><body><h1>Careers</h1></body></html>' : indiaHtml),
    }),
    /verified Evoke careers page/i,
  )
})
