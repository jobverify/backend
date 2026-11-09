import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
    <meta name="description" content="Foundation Models for Search" />
  </head>
  <body>
    <main>
      <h1>Come build the best search engine in the world</h1>
      <section>
        <h2>Supporting Our Team</h2>
        <h3>Visa sponsorship</h3>
        <p>We believe in supporting global talent and are committed to sponsoring visas for exceptional candidates.</p>
        <h3>Remote work</h3>
        <p>We are a fully in-person team, with a few exceptions for certain roles.</p>
      </section>
    </main>
    <script src="/_next/static/chunks/app/careers/page-081cdf0c040ae1c4.js" async=""></script>
    <footer>EXA LABS INC.</footer>
  </body>
</html>
`

const careersBundleJs = `
let r={SF:"San Francisco",NYC:"New York City",SG:"Singapore"},l=[
  {position:"Software Engineer, Backend",locations:[r.SF],jobDetailsLink:"https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318",group:"engineering"},
  {position:"Founding Account Executive - NYC",locations:[r.NYC],jobDetailsLink:"https://jobs.ashbyhq.com/exa/e3e0cd05-d71a-491d-a553-2a991741915c",group:"gtm"},
  {position:"People Operations Generalist",locations:[r.SG],jobDetailsLink:"https://jobs.ashbyhq.com/exa/11cd06ca-db50-4821-a920-07071f8ce0b4",group:"people"}
];
`

const nonIndiaAshbyPayload = {
  jobs: [
    {
      id: '41eb773d-9909-422c-b6b8-5bbdc407d318',
      title: 'Software Engineer, Backend',
      department: 'Engineering',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'San Francisco, California',
      secondaryLocations: [],
      publishedAt: '2025-06-26T18:15:33.066+00:00',
      isListed: true,
      isRemote: false,
      workplaceType: 'OnSite',
      address: {
        postalAddress: {
          addressRegion: 'California',
          addressCountry: 'United States',
          addressLocality: 'San Francisco',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318',
      applyUrl: 'https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318/application',
      descriptionHtml: '<p>Build backend systems for Exa.</p>',
    },
    {
      id: '11cd06ca-db50-4821-a920-07071f8ce0b4',
      title: 'People Operations Generalist',
      department: 'People',
      team: 'People',
      employmentType: 'FullTime',
      location: 'Singapore',
      secondaryLocations: [],
      publishedAt: '2026-06-12T00:00:00.000+00:00',
      isListed: true,
      isRemote: false,
      workplaceType: null,
      address: {
        postalAddress: {
          addressCountry: 'Singapore',
          addressLocality: 'Singapore',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/exa/11cd06ca-db50-4821-a920-07071f8ce0b4',
      applyUrl: 'https://jobs.ashbyhq.com/exa/11cd06ca-db50-4821-a920-07071f8ce0b4/application',
      descriptionHtml: '<p>Run Exa people operations in Singapore.</p>',
    },
  ],
}

const indiaAshbyPayload = {
  jobs: [
    {
      id: 'exa-india-role',
      title: 'Developer Advocate',
      department: 'Engineering',
      team: 'Engineering',
      employmentType: 'FullTime',
      location: 'Bengaluru, India',
      secondaryLocations: [],
      publishedAt: '2026-07-15T09:30:00.000+00:00',
      isListed: true,
      isRemote: false,
      workplaceType: 'OnSite',
      address: {
        postalAddress: {
          addressRegion: 'Karnataka',
          addressCountry: 'India',
          addressLocality: 'Bengaluru',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/exa/exa-india-role',
      applyUrl: 'https://jobs.ashbyhq.com/exa/exa-india-role/application',
      descriptionHtml: '<p>Support Exa developers in India.</p>',
    },
    nonIndiaAshbyPayload.jobs[0],
  ],
}

const loadExaModule = async () => {
  try {
    return await import('../../scraper/exa/script.js')
  } catch {
    assert.fail('Expected Exa scraper module at ../../scraper/exa/script.js')
  }
}

test('Exa helpers pin the verified careers page, bundle handoff, and Ashby endpoints', async () => {
  const exa = await loadExaModule()

  assert.equal(exa.SOURCE, 'exa')
  assert.equal(exa.COMPANY, 'Exa')
  assert.equal(exa.OFFICIAL_BRAND_NAME, 'Exa')
  assert.equal(exa.VERIFIED_ON, '2026-07-15')
  assert.equal(exa.HOMEPAGE_URL, 'https://exa.ai/')
  assert.equal(exa.CAREERS_URL, 'https://exa.ai/careers')
  assert.equal(
    exa.CAREERS_BUNDLE_URL,
    'https://exa.ai/_next/static/chunks/app/careers/page-081cdf0c040ae1c4.js',
  )
  assert.equal(exa.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/exa')
  assert.equal(
    exa.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/exa',
  )
  assert.equal(exa.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    exa.extractVerifiedCareersBundleUrl(careersHtml),
    'https://exa.ai/_next/static/chunks/app/careers/page-081cdf0c040ae1c4.js',
  )
  assert.equal(exa.hasVerifiedCareersBundleSignal(careersBundleJs), true)
})

test('Exa extractAshbyJobs keeps India jobs and excludes non-India jobs from the verified Ashby payload shape', async () => {
  const exa = await loadExaModule()
  const jobs = exa.extractAshbyJobs(indiaAshbyPayload)

  assert.deepEqual(jobs, [
    {
      title: 'Developer Advocate',
      company: 'Exa',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'exa-india-role',
      requisitionId: 'exa-india-role',
      sourceUrl: 'https://jobs.ashbyhq.com/exa/exa-india-role',
      applyUrl: 'https://jobs.ashbyhq.com/exa/exa-india-role/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15T09:30:00.000+00:00',
      closingDate: null,
      jobDescription: '<p>Support Exa developers in India.</p>',
    },
  ])
})

test('run validates the verified first-party Exa careers surface and returns [] when no India roles are listed', async () => {
  const exa = await loadExaModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await exa.createExaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === exa.CAREERS_URL) return careersHtml
      if (url === exa.CAREERS_BUNDLE_URL) return careersBundleJs

      throw new Error(`Unexpected Exa text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return nonIndiaAshbyPayload
    },
  })

  assert.deepEqual(requestedTexts, [
    exa.CAREERS_URL,
    exa.CAREERS_BUNDLE_URL,
  ])
  assert.deepEqual(requestedJson, [exa.ASHBY_JOB_BOARD_URL])
  assert.deepEqual(jobs, [])
})

test('run returns normalized India jobs when the verified Exa Ashby feed includes India roles', async () => {
  const exa = await loadExaModule()

  const jobs = await exa.createExaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === exa.CAREERS_URL) return careersHtml
      if (url === exa.CAREERS_BUNDLE_URL) return careersBundleJs

      throw new Error(`Unexpected Exa text URL: ${url}`)
    },
    fetchJson: async () => indiaAshbyPayload,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Developer Advocate',
      company: 'Exa',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'exa-india-role',
      requisitionId: 'exa-india-role',
      sourceUrl: 'https://jobs.ashbyhq.com/exa/exa-india-role',
      applyUrl: 'https://jobs.ashbyhq.com/exa/exa-india-role/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15T09:30:00.000+00:00',
      closingDate: null,
      jobDescription: '<p>Support Exa developers in India.</p>',
      source: 'exa',
      link: 'https://jobs.ashbyhq.com/exa/exa-india-role/application',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('run fails closed when the verified Exa careers page, bundle handoff, or Ashby payload drift', async () => {
  const exa = await loadExaModule()

  await assert.rejects(
    exa.createExaScraper().run({
      fetchText: async (url) => {
        if (url === exa.CAREERS_URL) {
          return careersHtml.replace('Come build the best search engine in the world', 'Build with Exa')
        }

        throw new Error(`Unexpected Exa text URL: ${url}`)
      },
      fetchJson: async () => nonIndiaAshbyPayload,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    exa.createExaScraper().run({
      fetchText: async (url) => {
        if (url === exa.CAREERS_URL) {
          return careersHtml.replace(
            '/_next/static/chunks/app/careers/page-081cdf0c040ae1c4.js',
            '/_next/static/chunks/app/about/page-other.js',
          )
        }

        throw new Error(`Unexpected Exa text URL: ${url}`)
      },
      fetchJson: async () => nonIndiaAshbyPayload,
    }),
    /verified careers bundle handoff/i,
  )

  await assert.rejects(
    exa.createExaScraper().run({
      fetchText: async (url) => {
        if (url === exa.CAREERS_URL) return careersHtml
        if (url === exa.CAREERS_BUNDLE_URL) {
          return careersBundleJs.replace('https://jobs.ashbyhq.com/exa/', 'https://jobs.ashbyhq.com/other/')
        }

        throw new Error(`Unexpected Exa text URL: ${url}`)
      },
      fetchJson: async () => nonIndiaAshbyPayload,
    }),
    /verified careers bundle no longer matches/i,
  )

  await assert.rejects(
    exa.createExaScraper().run({
      fetchText: async (url) => {
        if (url === exa.CAREERS_URL) return careersHtml
        if (url === exa.CAREERS_BUNDLE_URL) return careersBundleJs

        throw new Error(`Unexpected Exa text URL: ${url}`)
      },
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified jobs array/i,
  )
})
