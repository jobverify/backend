import assert from 'node:assert/strict'
import test from 'node:test'

const loadCeiModule = async () => {
  try {
    return await import('../../scraper/cei/script.js')
  } catch {
    return null
  }
}

const careersPageHtml = `
  <html>
    <head>
      <title>Careers - CEI | Consulting. Solutions. Results.</title>
    </head>
    <body>
      <a href="/jobs/#/">Search jobs</a>
    </body>
  </html>
`

const appConfig = {
  companyName: 'CEI',
  companyUrl: 'https://ceiamerica.com',
  careersUrl: 'https://ceiamerica.com/careers',
  service: {
    batchSize: 500,
    corpToken: '3vcpe1',
    port: null,
    swimlane: '30',
    fields: [
      'id',
      'title',
      'publishedCategory(id,name)',
      'address(city,state,zip)',
      'employmentType',
      'dateLastPublished',
      'publicDescription',
      'isOpen',
      'isPublic',
      'isDeleted',
      'publishedZip',
      'salary',
      'salaryUnit',
      'onSite',
      'educationDegree',
    ],
  },
  additionalJobCriteria: {
    field: '[ FILTER FIELD HERE ]',
    values: ['[ FILTER VALUE HERE ]'],
    sort: '-dateLastPublished',
  },
}

const sampleJobsPayload = {
  total: 2,
  start: 0,
  count: 2,
  data: [
    {
      id: 20001,
      title: 'Senior Software Engineer',
      employmentType: 'Full Time',
      dateLastPublished: 1782000000000,
      publicDescription: '<p>Build enterprise integrations for the Chennai delivery center.</p><ul><li>Node.js</li><li>AWS</li></ul>',
      isOpen: true,
      isPublic: 1,
      isDeleted: false,
      onSite: 'Hybrid',
      educationDegree: 'Engineering',
      publishedCategory: {
        id: 100,
        name: 'Software Engineering',
      },
      address: {
        city: 'Chennai',
        state: 'Tamil Nadu',
        zip: '600001',
      },
    },
    {
      id: 20002,
      title: 'UX Designer',
      employmentType: 'Contract',
      dateLastPublished: 1782100000000,
      publicDescription: '<p>Support a Pittsburgh banking program.</p>',
      isOpen: true,
      isPublic: 1,
      isDeleted: false,
      onSite: 'On-Site',
      educationDegree: 'UX/UI',
      publishedCategory: {
        id: 101,
        name: 'Design',
      },
      address: {
        city: 'Pittsburgh',
        state: 'Pennsylvania',
        zip: '15222',
      },
    },
  ],
}

test('extractJobs keeps CEI roles scoped to India and maps them into the shared scraper fields', async () => {
  const cei = await loadCeiModule()
  assert.ok(cei)

  assert.equal(cei.hasCareerPageSignal(careersPageHtml), true)
  assert.equal(
    cei.buildBaseUrl(appConfig),
    'https://public-rest30.bullhornstaffing.com:443/rest-services/3vcpe1',
  )

  const searchUrl = cei.buildSearchUrl(appConfig)
  const parsedSearchUrl = new URL(searchUrl)

  assert.equal(parsedSearchUrl.origin, 'https://public-rest30.bullhornstaffing.com')
  assert.equal(parsedSearchUrl.pathname, '/rest-services/3vcpe1/search/JobOrder')
  assert.equal(parsedSearchUrl.searchParams.get('count'), '500')
  assert.equal(parsedSearchUrl.searchParams.get('sort'), '-dateLastPublished')
  assert.equal(parsedSearchUrl.searchParams.get('showTotalMatched'), 'true')
  assert.equal(parsedSearchUrl.searchParams.get('query'), '(isOpen:1) AND (isDeleted:0)')

  const jobs = cei.extractJobs(sampleJobsPayload, appConfig)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'CEI',
    department: 'Software Engineering',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    jobId: '20001',
    requisitionId: '20001',
    sourceUrl: 'https://cei.ai/jobs/#/jobs/20001',
    applyUrl: 'https://cei.ai/jobs/#/jobs/20001',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: 'Engineering',
    preferredQualification: null,
    requiredSkills: [
      'Node.js',
      'AWS',
    ],
    postingDate: '2026-06-21T00:00:00.000Z',
    closingDate: null,
    jobDescription: 'Build enterprise integrations for the Chennai delivery center. Node.js AWS',
    remoteStatus: 'Hybrid',
  })
})

test('run fetches the official CEI careers page and Bullhorn jobs feed, then decorates India matches', async () => {
  const cei = await loadCeiModule()
  assert.ok(cei)

  const requestedTexts = []
  const requestedJson = []
  const scraper = cei.createCeiScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === cei.CAREERS_PAGE_URL) return careersPageHtml
      if (url === cei.JOBS_PORTAL_URL) return '<script src="main-es2015.js"></script>'
      if (url === 'https://cei.ai/jobs/main-es2015.js') return 'const countries=[{code:"US",id:1,name:"United States",states:[]},{code:"IN",id:2262,name:"India",states:[]}];'
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === cei.APP_CONFIG_URL) return appConfig
      if (url === cei.buildSearchUrl(appConfig)) return sampleJobsPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [cei.CAREERS_PAGE_URL, cei.JOBS_PORTAL_URL, 'https://cei.ai/jobs/main-es2015.js', cei.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJson, [
    cei.APP_CONFIG_URL,
    cei.buildSearchUrl(appConfig),
    cei.buildSearchUrl(appConfig),
    cei.APP_CONFIG_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'cei')
  assert.equal(jobs[0].link, 'https://cei.ai/jobs/#/jobs/20001')
  assert.equal(jobs[0].company, 'CEI')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
