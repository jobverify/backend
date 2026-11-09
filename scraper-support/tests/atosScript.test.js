import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const embeddedPayload = {
  page: 1,
  limit: 6,
  total: 4,
  pages: 1,
  results: [
    {
      id: '549481',
      title: 'SENIOR CONSULTANT',
      t: '',
      date: 'Jul 14, 2026',
      url: 'https://jobs.atos.net/job/Chennai-SENIOR-CONSULTANT/1414665233/?feedId=365901&utm_source=CareerSite&utm_campaign=Atos_CorpSite',
      exp: '1',
      brand: '1',
    },
    {
      id: '549167',
      title: 'Accessibility Certified Tester',
      t: '',
      date: 'Jul 13, 2026',
      url: 'https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/?feedId=365901&utm_source=CareerSite&utm_campaign=Atos_CorpSite',
      exp: '1',
      brand: '1',
    },
    {
      id: '544493',
      title: 'Senior Consultant',
      t: '',
      date: 'Jul 13, 2026',
      url: 'https://jobs.atos.net/job/Pune-Senior-Consultant/1414405133/?feedId=365901&utm_source=CareerSite&utm_campaign=Atos_CorpSite',
      exp: '1',
      brand: '1',
    },
    {
      id: '549560',
      title: 'AI Transformation Program Leader',
      t: '',
      date: 'Jul 13, 2026',
      url: 'https://jobs.atos.net/job/London-AI-Transformation-Program-Leader/1414440233/?feedId=365901&utm_source=CareerSite&utm_campaign=Atos_CorpSite',
      exp: '1',
      brand: '1',
    },
  ],
  support: {
    city: {
      '25': {
        city_id: '25',
        city: 'London',
        n: '',
        country_id: 'GB',
        country: 'United Kingdom',
        region: '',
      },
      '59': {
        city_id: '59',
        city: 'Pune',
        n: '',
        country_id: 'IN',
        country: 'India',
        region: '',
      },
      '63': {
        city_id: '63',
        city: 'Chennai',
        n: '',
        country_id: 'IN',
        country: 'India',
        region: '',
      },
      '94': {
        city_id: '94',
        city: 'Bangalore',
        n: '',
        country_id: 'IN',
        country: 'India',
        region: '',
      },
    },
    locations: {
      '544493': ['59'],
      '549167': ['94'],
      '549481': ['63'],
      '549560': ['25'],
    },
  },
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join us - Atos</title>
  </head>
  <body>
    <main>
      <h1>Join us now</h1>
      <section>
        <h2>Explore opportunities</h2>
        <p>Search by job title</p>
        <p>Country / Region</p>
      </section>
      <script>window['atosjobs_QaKbEnir']=${JSON.stringify(embeddedPayload)};</script>
      <script src="https://atos.net/wp-content/plugins/jobs-atos-net/js/jobs.js"></script>
    </main>
  </body>
</html>
`

const invalidCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join us - Atos</title>
  </head>
  <body>
    <main>
      <h1>Join us now</h1>
      <p>Explore opportunities</p>
    </main>
  </body>
</html>
`

const invalidPayloadHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join us - Atos</title>
  </head>
  <body>
    <main>
      <h1>Join us now</h1>
      <section>
        <h2>Explore opportunities</h2>
        <p>Search by job title</p>
        <p>Country / Region</p>
      </section>
      <script>window['atosjobs_QaKbEnir']={"page":1,"limit":6,"total":1,"pages":1,"results":[{"id":"1","title":"Broken","date":"Jul 15, 2026","url":"https://example.com/job/1","exp":"1","brand":"1"}],"support":{"city":{}}};</script>
      <script src="https://atos.net/wp-content/plugins/jobs-atos-net/js/jobs.js"></script>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/atos/script.js')
  } catch {
    assert.fail('Expected Atos scraper module at ../../scraper/atos/script.js')
  }
}

test('Atos constants and parsers stay pinned to the verified first-party embedded jobs contract', async () => {
  const atos = await loadModule()

  assert.equal(atos.COMPANY_NAME, 'Atos')
  assert.equal(atos.SOURCE, 'atos')
  assert.equal(atos.COUNTRY_FILTER, 'India')
  assert.equal(atos.CAREERS_URL, 'https://atos.net/en/join-us')
  assert.equal(
    atos.JOBS_WIDGET_SCRIPT_URL,
    'https://atos.net/wp-content/plugins/jobs-atos-net/js/jobs.js',
  )
  assert.equal(atos.PUBLIC_JOB_DETAIL_HOST, 'https://jobs.atos.net/')
  assert.equal(
    atos.VERIFIED_INDIA_JOB_URL,
    'https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/',
  )
  assert.equal(atos.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(atos.extractEmbeddedJobsPayload(officialCareersHtml), embeddedPayload)
  assert.deepEqual(
    atos.extractJobsFromPayload(embeddedPayload, FIXED_SCRAPED_AT),
    [
      {
        jobId: '549481',
        title: 'SENIOR CONSULTANT',
        company: 'Atos',
        department: null,
        location: 'Chennai, India',
        city: 'Chennai',
        state: null,
        country: 'India',
        sourceUrl: 'https://jobs.atos.net/job/Chennai-SENIOR-CONSULTANT/1414665233/',
        applyUrl: 'https://jobs.atos.net/job/Chennai-SENIOR-CONSULTANT/1414665233/',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: 'Jul 14, 2026',
        closingDate: null,
        jobDescription: null,
        requisitionId: '549481',
        source: 'atos',
        link: 'https://jobs.atos.net/job/Chennai-SENIOR-CONSULTANT/1414665233/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: '549167',
        title: 'Accessibility Certified Tester',
        company: 'Atos',
        department: null,
        location: 'Bangalore, India',
        city: 'Bangalore',
        state: null,
        country: 'India',
        sourceUrl: 'https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/',
        applyUrl: 'https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: 'Jul 13, 2026',
        closingDate: null,
        jobDescription: null,
        requisitionId: '549167',
        source: 'atos',
        link: 'https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: '544493',
        title: 'Senior Consultant',
        company: 'Atos',
        department: null,
        location: 'Pune, India',
        city: 'Pune',
        state: null,
        country: 'India',
        sourceUrl: 'https://jobs.atos.net/job/Pune-Senior-Consultant/1414405133/',
        applyUrl: 'https://jobs.atos.net/job/Pune-Senior-Consultant/1414405133/',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: 'Jul 13, 2026',
        closingDate: null,
        jobDescription: null,
        requisitionId: '544493',
        source: 'atos',
        link: 'https://jobs.atos.net/job/Pune-Senior-Consultant/1414405133/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('run validates the verified first-party careers page and extracts Atos India jobs from the embedded payload', async () => {
  const atos = await loadModule()
  const requestedUrls = []

  const jobs = await atos.createAtosScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === atos.CAREERS_URL) return officialCareersHtml

      throw new Error(`Unexpected Atos URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [atos.CAREERS_URL])
  assert.deepEqual(
    jobs.map((job) => ({
      jobId: job.jobId,
      title: job.title,
      location: job.location,
      city: job.city,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        jobId: '549481',
        title: 'SENIOR CONSULTANT',
        location: 'Chennai, India',
        city: 'Chennai',
        source: 'atos',
        link: 'https://jobs.atos.net/job/Chennai-SENIOR-CONSULTANT/1414665233/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: '549167',
        title: 'Accessibility Certified Tester',
        location: 'Bangalore, India',
        city: 'Bangalore',
        source: 'atos',
        link: 'https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Atos scraper fails closed when the verified careers shell or embedded payload drifts materially', async () => {
  const atos = await loadModule()

  await assert.rejects(
    atos.createAtosScraper().run({
      fetchText: async () => invalidCareersHtml,
    }),
    /verified public careers surface/i,
  )

  await assert.rejects(
    atos.createAtosScraper().run({
      fetchText: async () => invalidPayloadHtml,
    }),
    /verified embedded jobs payload|verified public job detail surface/i,
  )
})
