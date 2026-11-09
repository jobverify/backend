import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <html>
    <head><title>C3iHub | Deep Tech Innovation Hub</title></head>
    <body>
      <a href="/careers">Careers</a>
      <p>We support startups and researchers building deep-tech products.</p>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Careers | C3iHub</title>
      <script src="/_nuxt/index.10f9b0ae.js"></script>
    </head>
    <body>
      <section id="khembedjobs"></section>
      <a href="https://c3ihub.keka.com/careers/jobdetails/70895">AI Engineer</a>
      <p>&copy; 2026 Keka Hire. Powered by <a href="https://www.keka.com">Keka</a></p>
    </body>
  </html>
`

const careersBundleJs = `
  window.khConfig = {
    identifier: "dd611ad5-7644-482c-be5e-7b45edf7d767",
    domain: "https://c3ihub.keka.com/careers/",
    targetContainer: "#khembedjobs"
  };
`

const currentShellHtml = `
  <html>
    <head>
      <title>C3iHub</title>
      <script type="module" src="/_nuxt/entry.0af88220.js"></script>
    </head>
    <body><div id="__nuxt"></div></body>
  </html>
`

const currentEntryBundleJs = `
  export default [
    { name: "careers-old-jobRole-jobID-apply", path: "/careers-old/:jobRole/:jobID/apply" },
    { name: "careers", path: "/careers" }
  ]
`

const activeJobsPayload = [
  {
    id: '70895',
    title: 'AI Engineer',
    departmentName: 'Engineering',
    description: 'Build applied AI systems for incubation partners.',
    experience: '2+ years',
    skillNames: ['Python', 'LLMs'],
    jobType: 2,
    publishedOn: '2026-07-05T08:30:00.000Z',
    jobLocations: [
      {
        city: 'Hyderabad',
        state: 'TS',
        countryCode: 'IN',
        countryName: 'India',
        name: 'Hyderabad',
      },
    ],
  },
  {
    id: '90001',
    title: 'Research Associate',
    departmentName: 'Research',
    description: 'Support overseas partnerships.',
    experience: '1+ years',
    skillNames: ['Research'],
    jobType: 2,
    publishedOn: '2026-07-03T10:00:00.000Z',
    jobLocations: [
      {
        city: 'Boston',
        state: 'MA',
        countryCode: 'US',
        countryName: 'United States',
        name: 'Boston',
      },
    ],
  },
]

const loadModule = async () => import('../../scraper/c3ihub/script.js')

test('C3iHub verifies the official homepage and extracts the first-party Keka jobs config from the careers surface', async () => {
  const c3ihub = await loadModule()

  assert.equal(c3ihub.SOURCE, 'c3ihub')
  assert.equal(c3ihub.COMPANY, 'C3iHub')
  assert.equal(c3ihub.HOMEPAGE_URL, 'https://c3ihub.org/')
  assert.equal(c3ihub.CAREERS_URL, 'https://c3ihub.org/careers')
  assert.equal(c3ihub.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(c3ihub.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(c3ihub.extractCareersBundlePath(careersHtml), '/_nuxt/index.10f9b0ae.js')
  assert.deepEqual(c3ihub.extractCareerConfig(careersBundleJs), {
    identifier: 'dd611ad5-7644-482c-be5e-7b45edf7d767',
    domain: 'https://c3ihub.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    c3ihub.buildActiveJobsUrl(c3ihub.extractCareerConfig(careersBundleJs)),
    'https://c3ihub.keka.com/careers/api/embedjobs/default/active/dd611ad5-7644-482c-be5e-7b45edf7d767',
  )
})

test('C3iHub accepts the current first-party shell and falls back to the verified Keka active jobs endpoint', async () => {
  const c3ihub = await loadModule()

  assert.equal(c3ihub.hasOfficialHomepageSignal(currentShellHtml), true)
  assert.equal(c3ihub.hasVerifiedCareersPageSignal(currentShellHtml), true)
  assert.equal(c3ihub.extractCareersBundlePath(currentShellHtml), '/_nuxt/entry.0af88220.js')

  const requestedTexts = []
  const requestedJson = []
  const jobs = await c3ihub.createC3iHubScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === c3ihub.HOMEPAGE_URL) return currentShellHtml
      if (url === c3ihub.CAREERS_URL) return currentShellHtml
      if (url === 'https://c3ihub.org/_nuxt/entry.0af88220.js') return currentEntryBundleJs

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === 'https://c3ihub.keka.com/careers/api/embedjobs/default/active/dd611ad5-7644-482c-be5e-7b45edf7d767') {
        return activeJobsPayload
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    c3ihub.HOMEPAGE_URL,
    c3ihub.CAREERS_URL,
    'https://c3ihub.org/_nuxt/entry.0af88220.js',
  ])
  assert.deepEqual(requestedJson, [
    'https://c3ihub.keka.com/careers/api/embedjobs/default/active/dd611ad5-7644-482c-be5e-7b45edf7d767',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'AI Engineer')
})

test('C3iHub keeps only India jobs from the verified Keka feed and decorates runner output', async () => {
  const c3ihub = await loadModule()

  const extractedJobs = c3ihub.extractSearchResults(activeJobsPayload, {
    domain: 'https://c3ihub.keka.com/careers/',
  })

  assert.equal(extractedJobs.length, 1)
  assert.deepEqual(extractedJobs[0], {
    title: 'AI Engineer',
    company: 'C3iHub',
    department: 'Engineering',
    location: 'Hyderabad, TS, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: '70895',
    requisitionId: '70895',
    sourceUrl: 'https://c3ihub.keka.com/careers/jobdetails/70895',
    applyUrl: 'https://c3ihub.keka.com/careers/jobdetails/70895',
    employmentType: 'Full Time',
    experienceRequired: '2+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Python', 'LLMs'],
    postingDate: '2026-07-05',
    closingDate: null,
    jobDescription: 'Build applied AI systems for incubation partners.',
  })

  const requestedTexts = []
  const requestedJson = []
  const jobs = await c3ihub.createC3iHubScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === c3ihub.HOMEPAGE_URL) return homepageHtml
      if (url === c3ihub.CAREERS_URL) return careersHtml
      if (url === 'https://c3ihub.org/_nuxt/index.10f9b0ae.js') return careersBundleJs

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === 'https://c3ihub.keka.com/careers/api/embedjobs/default/active/dd611ad5-7644-482c-be5e-7b45edf7d767') {
        return activeJobsPayload
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    c3ihub.HOMEPAGE_URL,
    c3ihub.CAREERS_URL,
    'https://c3ihub.org/_nuxt/index.10f9b0ae.js',
  ])
  assert.deepEqual(requestedJson, [
    'https://c3ihub.keka.com/careers/api/embedjobs/default/active/dd611ad5-7644-482c-be5e-7b45edf7d767',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'c3ihub')
  assert.equal(jobs[0].link, 'https://c3ihub.keka.com/careers/jobdetails/70895')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
