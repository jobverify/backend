import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const loadBackyardCreatorsModule = async () => {
  try {
    return await import('../../scraper/backyardcreators/script.js')
  } catch {
    assert.fail('Expected Backyard Creators scraper module at ../../scraper/backyardcreators/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'backyardcreators',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Non-invasive electromagnetic platform</h1>
      <p>Pursuing hearing with steerable electromagnetic fields</p>
      <p>Backyard Creators is developing a non-invasive approach to restore hearing for severe-to-profound loss without surgery and without an internal implant.</p>
      <a href="/talk">Talk to us</a>
    </main>
  </body>
</html>
`

test('Backyard Creators validates the verified official homepage and first-party careers page', async () => {
  const backyardCreators = await loadBackyardCreatorsModule()

  assert.equal(backyardCreators.SOURCE, 'backyardcreators')
  assert.equal(backyardCreators.COMPANY, 'BACKYARD CREATORS')
  assert.equal(backyardCreators.HOMEPAGE_URL, 'https://www.backyardcreators.com/')
  assert.equal(backyardCreators.CAREERS_URL, 'https://www.backyardcreators.com/careers')
  assert.equal(backyardCreators.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(backyardCreators.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(backyardCreators.hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(backyardCreators.extractPublicJobs(careersHtml), [
    {
      title: 'Multiphysics Simulation Expert',
      company: 'BACKYARD CREATORS',
      department: 'Research & Development',
      location: null,
      city: null,
      country: 'India',
      jobId: 'backyardcreators-multiphysics-simulation-expert',
      requisitionId: 'backyardcreators-multiphysics-simulation-expert',
      sourceUrl: 'https://www.backyardcreators.com/careers',
      applyUrl: null,
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])
})

test('Backyard Creators run fetches the verified homepage and careers page and returns normalized public jobs', async () => {
  const backyardCreators = await loadBackyardCreatorsModule()
  const requestedUrls = []

  const jobs = await backyardCreators.createBackyardCreatorsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === backyardCreators.HOMEPAGE_URL) return homepageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === backyardCreators.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    backyardCreators.HOMEPAGE_URL,
    backyardCreators.CAREERS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'backyardcreators')
  assert.equal(jobs[0].company, 'BACKYARD CREATORS')
  assert.equal(jobs[0].title, 'Multiphysics Simulation Expert')
  assert.equal(jobs[0].normalizedTitle, 'Multiphysics Simulation Expert')
  assert.equal(jobs[0].engineeringDomain, 'Unknown')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].jobType, 'Unspecified')
  assert.equal(jobs[0].companyCareerPage, 'https://www.backyardcreators.com/careers')
  assert.equal(jobs[0].companyDomain, 'backyardcreators.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].sourceUrl, 'https://www.backyardcreators.com/careers')
  assert.equal(jobs[0].applyUrl, 'https://www.backyardcreators.com/careers')
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')
})

test('Backyard Creators returns [] when the current first-party homepage is live and the legacy careers route is now a 404', async () => {
  const backyardCreators = await loadBackyardCreatorsModule()

  const jobs = await backyardCreators.createBackyardCreatorsScraper().run({
    fetchText: async () => currentHomepageHtml,
    fetchPage: async (url) => {
      if (url === backyardCreators.CAREERS_URL) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Backyard Creators returns [] when the legacy careers route now renders the homepage shell without a public jobs surface', async () => {
  const backyardCreators = await loadBackyardCreatorsModule()

  const jobs = await backyardCreators.createBackyardCreatorsScraper().run({
    fetchText: async () => currentHomepageHtml,
    fetchPage: async (url) => {
      if (url === backyardCreators.CAREERS_URL) {
        return { status: 200, url, html: currentHomepageHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Backyard Creators provider registration covers the exact CSV company name without alias churn', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'backyardcreators')

  assert.ok(provider, 'Expected backyardcreators provider to be registered')
  assert.equal(provider.companyName, 'BACKYARD CREATORS')
  assert.equal(provider.companyCareerPage, 'https://www.backyardcreators.com/careers')
  assert.equal(provider.companyDomain, 'backyardcreators.com')
  assert.equal(provider.adapter, 'script')

  const report = generateCompanyCoverageReport({
    csvText: 'BACKYARD CREATORS,\n',
    catalog,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['BACKYARD CREATORS', 'backyardcreators', 'backyardcreators']],
  )
})

test('Backyard Creators fails closed when the verified homepage or careers surface drifts materially', async () => {
  const backyardCreators = await loadBackyardCreatorsModule()

  await assert.rejects(
    backyardCreators.createBackyardCreatorsScraper().run({
      fetchText: async (url) => {
        if (url === backyardCreators.HOMEPAGE_URL) {
          return homepageHtml.replace('Redefining Hearing Through', 'Unexpected Homepage')
        }
        return careersHtml
      },
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: careersHtml,
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    backyardCreators.createBackyardCreatorsScraper().run({
      fetchText: async () => homepageHtml,
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: careersHtml.replace('Research &amp; Development', 'Engineering'),
      }),
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    backyardCreators.createBackyardCreatorsScraper().run({
      fetchText: async () => homepageHtml,
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: careersHtml.replace(/border rounded-lg p-4 shadow hover:shadow-lg cursor-pointer transition duration-200 ease-in-out/g, 'career-card'),
      }),
    }),
    /verified first-party careers page/i,
  )
})
