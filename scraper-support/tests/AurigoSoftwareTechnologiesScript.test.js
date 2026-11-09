import assert from 'node:assert/strict'
import test from 'node:test'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const searchShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aurigo Software Technologies Jobs</title>
  </head>
  <body>
    <a href="https://careers.aurigo.com/search/?locale=en_US&amp;previewLink=true&amp;referrerSave=false&amp;searchResultView=LIST" title="Job listings">Job listings</a>
    <button title="Search jobs">Search jobs</button>
    <script>
      var resultStyles = { currentLocale: 'en_US' };
      var CSRFToken = "token-123";
      var appParams = { locale: "en_US" };
    </script>
    <script src="/platform/js/j2w/min/j2w.searchManager.min.js?h=example"></script>
  </body>
</html>
`

const pageZeroPayload = {
  totalJobs: 12,
  jobSearchResult: [
    {
      response: {
        id: '2207',
        unifiedStandardTitle: 'Director of Product',
        unifiedUrlTitle: 'Director-of-Product',
        unifiedStandardStart: '4/3/26',
        unifiedStandardEnd: '8/28/26',
        division_obj: ['Product Management'],
        filter1: ['India'],
      },
    },
    {
      response: {
        id: '1535',
        unifiedStandardTitle: 'Senior Account Executive - Southeast',
        unifiedUrlTitle: 'Senior-Account-Executive-Southeast',
        unifiedStandardStart: '6/17/26',
        unifiedStandardEnd: '8/31/26',
        division_obj: ['Sales'],
        filter1: ['United States'],
      },
    },
  ],
}

const pageOnePayload = {
  totalJobs: 12,
  jobSearchResult: [
    {
      response: {
        id: '2314',
        unifiedStandardTitle: 'Software Engineer II',
        unifiedUrlTitle: 'Software-Engineer-II',
        unifiedStandardStart: '7/3/26',
        unifiedStandardEnd: '8/31/26',
        division_obj: ['Product Engineering'],
        filter1: ['India'],
      },
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/aurigo/script.js')
  } catch {
    assert.fail('Expected Aurigo Software Technologies scraper module at ../../scraper/aurigo/script.js')
  }
}

test('Aurigo Software Technologies helpers stay pinned to the verified first-party search shell and jobs API', async () => {
  const aurigo = await loadModule()

  assert.equal(aurigo.SOURCE, 'aurigo')
  assert.equal(aurigo.COMPANY, 'Aurigo Software Technologies')
  assert.equal(aurigo.CAREERS_URL, 'https://careers.aurigo.com/')
  assert.equal(
    aurigo.SEARCH_RESULTS_URL,
    'https://careers.aurigo.com/search/?locale=en_US&previewLink=true&referrerSave=false&searchResultView=LIST',
  )
  assert.equal(aurigo.JOBS_API_URL, 'https://careers.aurigo.com/services/recruiting/v1/jobs')
  assert.equal(aurigo.VERIFIED_ON, '2026-08-01')
  assert.equal(
    aurigo.pageRedirectsToAurigoError('https://careers.aurigo.com/errorpage/?errortype=Exception'),
    true,
  )
  assert.equal(aurigo.hasOfficialCareersSignal(searchShellHtml), true)
  assert.equal(aurigo.extractCsrfToken(searchShellHtml), 'token-123')
  assert.equal(aurigo.extractSearchLocale(searchShellHtml), 'en_US')
  assert.deepEqual(
    aurigo.buildJobsApiRequestPayload({ pageNumber: 1 }),
    {
      keywords: '',
      locale: 'en_US',
      location: '',
      pageNumber: 1,
      sortBy: 'recent',
    },
  )
  assert.equal(aurigo.hasExpectedJobsApiSignal(pageZeroPayload), true)
  assert.deepEqual(aurigo.extractJobsFromApiPayload(pageZeroPayload), [
    {
      title: 'Director of Product',
      company: 'Aurigo Software Technologies',
      department: 'Product Management',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '2207',
      requisitionId: '2207',
      sourceUrl: 'https://careers.aurigo.com/job/Director-of-Product/2207-en_US/',
      applyUrl: 'https://careers.aurigo.com/job/Director-of-Product/2207-en_US/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-04-03',
      closingDate: '2026-08-28',
      sourceDatePrecision: 'day',
      sourceClosingDateIsExact: false,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('Aurigo Software Technologies run validates the first-party search shell and paged jobs API', async () => {
  const aurigo = await loadModule()
  const requestedJson = []

  const jobs = await aurigo.createAurigoScraper({ maxPages: 3, maxJobs: 2 }).run({
    fetchText: async (url) => {
      assert.equal(url, aurigo.SEARCH_PAGE_URL)
      return searchShellHtml
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({
        url,
        body: JSON.parse(options.body),
        headers: options.headers,
      })

      const pageNumber = JSON.parse(options.body).pageNumber
      if (pageNumber === 0) return pageZeroPayload
      if (pageNumber === 1) return pageOnePayload
      return { totalJobs: 12, jobSearchResult: [] }
    },
    fetchPage: async (url) => ({
      finalUrl: 'https://careers.aurigo.com/errorpage/?errortype=Exception',
      html: `<html><body>Error page for ${url}</body></html>`,
    }),
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.deepEqual(
    requestedJson.map((entry) => ({
      url: entry.url,
      pageNumber: entry.body.pageNumber,
      locale: entry.body.locale,
      csrf: entry.headers['X-CSRF-Token'],
    })),
    [
      {
        url: aurigo.JOBS_API_URL,
        pageNumber: 0,
        locale: 'en_US',
        csrf: 'token-123',
      },
      {
        url: aurigo.JOBS_API_URL,
        pageNumber: 1,
        locale: 'en_US',
        csrf: 'token-123',
      },
      {
        url: aurigo.JOBS_API_URL,
        pageNumber: 2,
        locale: 'en_US',
        csrf: 'token-123',
      },
    ],
  )

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'aurigo')
  assert.equal(jobs[0].title, 'Director of Product')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].title, 'Software Engineer II')
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[0].scrapedAt, '2026-08-04T00:00:00.000Z')
})

test('Aurigo Software Technologies run fails closed when the verified search shell or jobs API drifts', async () => {
  const aurigo = await loadModule()

  await assert.rejects(
    aurigo.createAurigoScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified aurigo search shell/i,
  )

  await assert.rejects(
    aurigo.createAurigoScraper().run({
      fetchText: async () => searchShellHtml.replace('token-123', ''),
    }),
    /jobs api token/i,
  )

  await assert.rejects(
    aurigo.createAurigoScraper().run({
      fetchText: async () => searchShellHtml,
      fetchJson: async () => ({ totalJobs: 'oops', jobSearchResult: null }),
    }),
    /verified aurigo jobs api/i,
  )
})

const freshPayload = () => ({ totalJobs: 1, jobSearchResult: [{ response: {
  ...pageZeroPayload.jobSearchResult[0].response,
  unifiedStandardStart: '10/28/26', unifiedStandardEnd: '11/30/26',
} }] })
const roleUrl = 'https://careers.aurigo.com/job/Director-of-Product/2207-en_US/'
const employerDescription = '<h2>Responsibilities</h2><p>Lead product delivery, customer research, and engineering collaboration.</p><h2>Qualifications</h2><p>Five years of relevant product management experience and a technical degree are required.</p>'
const roleSchema = () => ({ '@type': 'JobPosting', title: 'Director of Product',
  hiringOrganization: { name: 'Aurigo Software Technologies' },
  identifier: { value: '2207' }, url: roleUrl, description: employerDescription,
})
const schemaHtml = schema => '<script type="application/ld+json">' + JSON.stringify(schema) + '</script>'
const freshOptions = () => ({ fetchText: async () => searchShellHtml,
  fetchJson: async () => freshPayload(), now: () => '2026-10-29T14:00:00.000Z' })

test('Aurigo default detail transport retains response proof for canonical employer-description recovery', async t => {
  const aurigo = await loadModule()
  let requests = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests++
    assert.equal(url, roleUrl)
    assert.ok(options.signal instanceof AbortSignal)
    const response = new Response(schemaHtml(roleSchema()), { status: 200,
      headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: roleUrl })
    return response
  })
  const [job] = await aurigo.createAurigoScraper().run(freshOptions())
  assert.equal(requests, 1)
  assert.equal(job.sourceDescription, employerDescription)
  assert.equal(hasSourceDescription(normalizeScrapedJob(job)), true)
  assert.equal(job.jobId, '2207')
  assert.equal(job.country, 'India')
  assert.equal(job.postingDate, '2026-10-28')
  assert.equal(job.closingDate, '2026-11-30')
})

test('Aurigo cannot recover canonical descriptions from redirects, failed responses or another role', async () => {
  const aurigo = await loadModule()
  for (const change of [
    { finalUrl: aurigo.CAREERS_URL }, { status: 403 },
    { schema: { ...roleSchema(), identifier: { value: '2314' } } },
    { schema: { ...roleSchema(), hiringOrganization: { name: 'Other employer' } } },
    { schema: { ...roleSchema(), title: 'Another role' } },
  ]) {
    const [job] = await aurigo.createAurigoScraper().run({ ...freshOptions(),
      fetchPage: async () => ({ status: change.status ?? 200,
        finalUrl: change.finalUrl ?? roleUrl, html: schemaHtml(change.schema ?? roleSchema()) }),
    })
    assert.equal(hasSourceDescription(normalizeScrapedJob(job)), false, JSON.stringify(change))
  }
  const [unverified] = await aurigo.createAurigoScraper().run({ ...freshOptions(),
    fetchPage: async () => ({ finalUrl: roleUrl, html: schemaHtml(roleSchema()) }),
  })
  assert.equal(hasSourceDescription(normalizeScrapedJob(unverified)), false, 'Missing transport proof remains unknown')
})

test('Aurigo propagates cancellation instead of returning a partial role after an aborted detail request', async () => {
  const aurigo = await loadModule()
  const controller = new AbortController(), reason = new Error('operator cancelled')
  await assert.rejects(aurigo.createAurigoScraper().run({ ...freshOptions(), signal: controller.signal,
    fetchPage: async () => { controller.abort(reason); throw reason },
  }), error => error === reason)
})

test('recovered Aurigo content survives persistence and passes actual public visibility', { timeout: 60000 }, async t => {
  const [{ default: mongoose }, { MongoMemoryServer }, { fileURLToPath }, { saveToDB },
    { applyPublicJobVisibility }] = await Promise.all([
    import('mongoose'), import('mongodb-memory-server'), import('node:url'),
    import('../utils/saveToDB.js'), import('../../src/utils/publicJobVisibility.js'),
  ])
  assert.equal(mongoose.connection.readyState, 0, 'Never reuse an application database')
  const mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  assert.match(mongo.getUri(), /^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false })
  const aurigo = await loadModule()
  const jobs = await aurigo.createAurigoScraper().run({ ...freshOptions(), fetchPage: async () => ({
    status: 200, finalUrl: roleUrl, html: schemaHtml(roleSchema()),
  }) })
  const now = new Date('2026-10-29T14:00:00.000Z')
  const first = await saveToDB(jobs, aurigo.SOURCE, { now, enrichPublicExperience: false,
    enqueueAlerts: false, descriptionRewriteMode: 'off', replaceExisting: false, refreshDatasetSummary: false })
  assert.equal(first.inserted, 1)
  const publicJobs = await mongoose.connection.db.collection('jobs')
    .find(applyPublicJobVisibility({ source: aurigo.SOURCE, status: 'active' }, {}, now)).toArray()
  assert.equal(publicJobs.length, 1)
  assert.equal(publicJobs[0].sourceDescription, employerDescription)
  assert.equal(publicJobs[0].sourceUrl, roleUrl)
  assert.equal(publicJobs[0].postedAt.toISOString(), '2026-10-28T00:00:00.000Z')
})
