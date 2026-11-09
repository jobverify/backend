import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'neostats',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')

const currentClientLoadedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | NeoStats</title>
    <meta
      name="description"
      content="Join NeoStats and help shape the future of data and AI consulting. Explore open roles across data, analytics, risk, sales, and operations."
    />
  </head>
  <body>
    <section id="career-options" aria-busy="true">
      <p>Current Openings</p>
      <h2>Open Roles</h2>
      <p>Explore open roles across banking, data, cards & analytics transformations.</p>
      <p class="sr-only" aria-live="polite">Loading open roles</p>
    </section>
  </body>
</html>
`

const loadNeostatsModule = async () => {
  try {
    return await import('../../scraper/neostats/script.js')
  } catch {
    assert.fail('Expected Neostats scraper module at ../../scraper/neostats/script.js')
  }
}

test('Neostats sentinels recognize the verified homepage and first-party careers page', async () => {
  const neostats = await loadNeostatsModule()

  assert.equal(neostats.SOURCE, 'neostats')
  assert.equal(neostats.COMPANY, 'NeoStats')
  assert.equal(neostats.HOMEPAGE_URL, 'https://neostats.ai/')
  assert.equal(neostats.CAREERS_URL, 'https://neostats.ai/careers')
  assert.equal(neostats.JOBS_API_URL, 'https://neostats.ai/api/careers/jobs')
  assert.equal(neostats.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(neostats.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(neostats.hasOfficialCareersSignal(currentClientLoadedCareersHtml), true)
  assert.equal(neostats.hasClientLoadedJobsSignal(currentClientLoadedCareersHtml), true)
})

test('Neostats extracts the current public role cards and narrows them to India jobs', async () => {
  const neostats = await loadNeostatsModule()

  const cards = neostats.extractOpenRoleCards(careersHtml)
  const jobs = neostats.extractIndiaJobOpenings(careersHtml)

  assert.equal(cards.length, 12)
  assert.deepEqual(
    cards.slice(0, 3).map((card) => ({
      title: card.title,
      department: card.department,
      location: card.location,
      experienceRequired: card.experienceRequired,
      region: card.region,
      remoteStatus: card.remoteStatus,
    })),
    [
      {
        title: 'Data Scientist – Retail Banking Analytics',
        department: 'Data & Analytics',
        location: 'UAE',
        experienceRequired: '5+ years',
        region: 'Middle East',
        remoteStatus: 'Onsite',
      },
      {
        title: 'Dataiku Developer',
        department: 'Data & Analytics',
        location: 'Bangalore or Chennai',
        experienceRequired: '4+ years',
        region: 'South Asia',
        remoteStatus: 'Onsite',
      },
      {
        title: 'Data Scientist / Data Analyst',
        department: 'Data & Analytics',
        location: 'Bangalore',
        experienceRequired: '3+ years',
        region: 'South Asia',
        remoteStatus: 'Onsite',
      },
    ],
  )

  assert.equal(jobs.length, 4)
  assert.deepEqual(
    (({
      title,
      department,
      location,
      city,
      country,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      experienceRequired,
      remoteStatus,
      requiredSkills,
    }) => ({
      title,
      department,
      location,
      city,
      country,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      experienceRequired,
      remoteStatus,
      requiredSkills,
    }))(jobs[0]),
    {
      title: 'Dataiku Developer',
      department: 'Data & Analytics',
      location: 'Bangalore or Chennai, India',
      city: null,
      country: 'India',
      jobId: 'dataiku-developer-bangalore-or-chennai',
      requisitionId: 'dataiku-developer-bangalore-or-chennai',
      sourceUrl: 'https://neostats.ai/careers',
      applyUrl: 'https://neostats.ai/careers',
      experienceRequired: '4+ years',
      remoteStatus: 'On-site',
      requiredSkills: [],
    },
  )
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Dataiku Developer',
      'Data Scientist / Data Analyst',
      'Data Analyst / Python Developer',
      'Operation Lead',
    ],
  )
})

test('Neostats normalizes an extracted India opening into the shared scraper contract', async () => {
  const neostats = await loadNeostatsModule()

  const opening = neostats.extractIndiaJobOpenings(careersHtml)[0]
  const normalized = normalizeScrapedJob(opening, {
    source: 'neostats',
    companyName: 'NeoStats',
    companyCareerPage: 'https://neostats.ai/careers',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
  })

  assert.equal(normalized.company, 'NeoStats')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('Neostats run verifies the trusted surfaces and returns the current India openings', async () => {
  const neostats = await loadNeostatsModule()
  const requestedUrls = []

  const jobs = await neostats.createNeostatsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === neostats.HOMEPAGE_URL) return homepageHtml
      if (url === neostats.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    neostats.HOMEPAGE_URL,
    neostats.CAREERS_URL,
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].company, 'NeoStats')
  assert.equal(jobs[0].source, 'neostats')
  assert.equal(jobs[0].link, 'https://neostats.ai/careers')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Neostats preserves existing jobs when the current client-loaded jobs API is unavailable', async () => {
  const neostats = await loadNeostatsModule()
  const requestedText = []
  const requestedApis = []

  const jobs = await neostats.createNeostatsScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedText.push(url)

      if (url === neostats.HOMEPAGE_URL) return homepageHtml
      if (url === neostats.CAREERS_URL) return currentClientLoadedCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJobsApi: async (url) => {
      requestedApis.push(url)
      return {
        status: 503,
        body: '{"error":"Unable to load openings right now."}',
        json: { error: 'Unable to load openings right now.' },
      }
    },
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, neostats.JOBS_API_URL)
  assert.equal(evidence?.listingComplete, false)
  assert.deepEqual(requestedText, [neostats.HOMEPAGE_URL, neostats.CAREERS_URL])
  assert.deepEqual(requestedApis, [neostats.JOBS_API_URL])
})

test('Neostats reads current client-loaded jobs and keeps only India locations', async () => {
  const neostats = await loadNeostatsModule()
  const jobs = await neostats.createNeostatsScraper({ now: () => '2026-10-03T00:00:00.000Z' }).run({
    fetchText: async (url) => url === neostats.HOMEPAGE_URL ? homepageHtml : currentClientLoadedCareersHtml,
    fetchJobsApi: async () => ({ status: 200, json: [
      { id: 'role-india', slug: 'data-engineer-india', title: 'Data Engineer', location: 'Bengaluru, India', department: 'Data', experience: '4+ years', mode: 'Hybrid', employmentType: 'Full Time', about: 'Build data platforms.', responsibilities: ['Develop pipelines'], requirements: ['SQL'] },
      { id: 'role-uae', slug: 'sales-uae', title: 'Sales Lead', location: 'Riyadh, Saudi Arabia', department: 'Sales', experience: '5+ years', mode: 'Onsite', employmentType: 'Contract', about: 'Sell services.', responsibilities: [], requirements: [] },
    ] }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Data Engineer')
  assert.equal(jobs[0].jobId, 'role-india')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].jobDescription, 'Build data platforms. Develop pipelines SQL')
  assert.equal(jobs[0].source, 'neostats')
  assert.equal(jobs[0].scrapedAt, '2026-10-03T00:00:00.000Z')
})

test('Neostats rejects malformed client-loaded job records', async () => {
  const neostats = await loadNeostatsModule()
  await assert.rejects(neostats.createNeostatsScraper().run({
    fetchText: async (url) => url === neostats.HOMEPAGE_URL ? homepageHtml : currentClientLoadedCareersHtml,
    fetchJobsApi: async () => ({ status: 200, json: [{ title: 'Unknown', location: 'India' }] }),
  }), /jobs API payload/i)
})

test('Neostats fails closed when the verified homepage or careers page contract changes', async () => {
  const neostats = await loadNeostatsModule()

  await assert.rejects(
    neostats.createNeostatsScraper().run({
      fetchText: async (url) => {
        if (url === neostats.HOMEPAGE_URL) {
          return homepageHtml.replace('href="/careers"', 'href="/about"')
        }

        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    neostats.createNeostatsScraper().run({
      fetchText: async (url) => {
        if (url === neostats.HOMEPAGE_URL) return homepageHtml
        if (url === neostats.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public careers page/i,
  )
})
