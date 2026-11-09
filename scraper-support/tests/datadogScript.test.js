import assert from 'node:assert/strict'
import test from 'node:test'

const loadDatadogModule = async () => {
  try {
    return await import('../../scraper/datadog/script.js')
  } catch {
    assert.fail('Expected Datadog scraper module at ../../scraper/datadog/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings | Datadog Careers</title>
    <meta
      name="description"
      content="We&#39;re building a platform that engineers love to use. Join us, and help usher in the future."
    >
    <link rel="canonical" href="https://careers.datadoghq.com/all-jobs/" />
  </head>
  <body search="true">
    <main>
      <div id="job-openings"></div>
    </main>
    <script type="text/javascript" src="/assets/scripts/main-ME2CAVKL.js" charset="utf-8" defer="defer"></script>
  </body>
</html>
`

const mainBundleJs = `
var Hh=P((kve,xR)=>{xR.exports={
  base_url:"https://careers.datadoghq.com/",
  jobs_per_page:10,
  TYPESENSE_PUBLIC_KEY:"1Hwq7hntXp211hKvRS3CSI2QSU7w2gFm",
  TYPESENSE_HOST:"gk6e3zbyuntvc5dap",
  TYPESENSE_COLLECTION:"careers_alias"
}});
`

const pageOnePayload = {
  found: 3,
  hits: [
    {
      document: {
        absolute_url: 'https://careers.datadoghq.com/detail/7531575/?gh_jid=7531575',
        department: 'Sales',
        description:
          'Sales Development Representative Build pipeline with technical buyers and partner with account executives. &amp;nbsp; Grow your sales career at Datadog.',
        early_career: false,
        id: 'doc-7531575',
        internal_job_id: 101,
        job_id: 7531575,
        language: 'en',
        last_mod: '2026-07-12T10:00:00-04:00',
        location_string: 'Bangalore, India',
        multi_location: false,
        rel_url: '?gh_jid=7531575',
        team: 'Sales Development',
        time_type: ['Individual Contributor'],
        title: 'Sales Development Representative',
      },
    },
    {
      document: {
        absolute_url: 'https://careers.datadoghq.com/detail/8003073/?gh_jid=8003073',
        department: 'Marketing',
        description:
          'Associate Field Marketing Manager Drive campaigns and events across India while partnering closely with regional sales teams.',
        early_career: false,
        id: 'doc-8003073',
        internal_job_id: 102,
        job_id: 8003073,
        language: 'en',
        last_mod: '2026-07-13T11:30:00-04:00',
        location_string: 'Bangalore, India',
        multi_location: false,
        rel_url: '?gh_jid=8003073',
        team: 'Field Marketing',
        time_type: ['Individual Contributor'],
        title: 'Associate Field Marketing Manager',
      },
    },
  ],
}

const pageTwoPayload = {
  found: 3,
  hits: [
    {
      document: {
        absolute_url: 'https://careers.datadoghq.com/detail/7650688/?gh_jid=7650688',
        department: 'Technical Solutions',
        description:
          'Enterprise Customer Success Manager Partner with strategic customers in India and guide post-sales adoption.',
        early_career: false,
        id: 'doc-7650688',
        internal_job_id: 103,
        job_id: 7650688,
        language: 'en',
        last_mod: '2026-07-13T12:45:00-04:00',
        location_string: 'Delhi, India',
        multi_location: false,
        rel_url: '?gh_jid=7650688',
        team: 'Customer Success',
        time_type: ['Individual Contributor'],
        title: 'Enterprise Customer Success Manager',
      },
    },
  ],
}

test('Datadog validates the official careers shell and public Typesense bundle config', async () => {
  const datadog = await loadDatadogModule()

  assert.equal(datadog.SOURCE, 'datadog')
  assert.equal(datadog.COMPANY, 'Datadog')
  assert.equal(datadog.CAREERS_URL, 'https://careers.datadoghq.com/all-jobs/')
  assert.equal(datadog.TYPESENSE_HOST, 'https://gk6e3zbyuntvc5dap.a1.typesense.net')
  assert.equal(datadog.TYPESENSE_COLLECTION, 'careers_alias')
  assert.equal(datadog.TYPESENSE_PUBLIC_KEY, '1Hwq7hntXp211hKvRS3CSI2QSU7w2gFm')
  assert.equal(datadog.QUERY_BY, 'title')
  assert.equal(datadog.FILTER_BY, 'location_string:India')
  assert.equal(datadog.DEFAULT_JOBS_PER_PAGE, 10)
  assert.equal(datadog.hasOfficialCareersSurface(careersHtml), true)
  assert.equal(
    datadog.extractMainScriptUrl(careersHtml),
    'https://careers.datadoghq.com/assets/scripts/main-ME2CAVKL.js',
  )
  assert.deepEqual(datadog.extractTypesenseConfig(mainBundleJs), {
    publicKey: '1Hwq7hntXp211hKvRS3CSI2QSU7w2gFm',
    host: 'https://gk6e3zbyuntvc5dap.a1.typesense.net',
    collection: 'careers_alias',
    jobsPerPage: 10,
  })
  assert.equal(datadog.hasOfficialMainBundleConfig(mainBundleJs), true)
  assert.equal(
    datadog.buildTypesenseSearchUrl(2, 2),
    'https://gk6e3zbyuntvc5dap.a1.typesense.net/collections/careers_alias/documents/search?q=*&query_by=title&filter_by=location_string%3AIndia&page=2&per_page=2',
  )
})

test('normalizeJob converts Datadog Typesense documents into the shared job shape', async () => {
  const datadog = await loadDatadogModule()
  const document = pageOnePayload.hits[0].document

  assert.deepEqual(datadog.extractSearchSummary(pageOnePayload), {
    found: 3,
    hits: pageOnePayload.hits,
  })
  assert.deepEqual(datadog.extractSearchDocuments(pageOnePayload), [
    pageOnePayload.hits[0].document,
    pageOnePayload.hits[1].document,
  ])

  const normalized = datadog.normalizeJob(document, {
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(normalized, {
    jobId: '7531575',
    requisitionId: '7531575',
    title: 'Sales Development Representative',
    company: 'Datadog',
    department: 'Sales',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://careers.datadoghq.com/detail/7531575/?gh_jid=7531575',
    applyUrl: 'https://careers.datadoghq.com/detail/7531575/?gh_jid=7531575',
    sourceUrl: 'https://careers.datadoghq.com/detail/7531575/?gh_jid=7531575',
    source: 'datadog',
    employmentType: null,
    experienceRequired: null,
    jobDescription:
      'Sales Development Representative Build pipeline with technical buyers and partner with account executives. Grow your sales career at Datadog.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-12T10:00:00-04:00',
    closingDate: null,
    scrapedAt: '2026-07-14T00:00:00.000Z',
  })
})

test('run validates the official Datadog surface and paginates the public India search results', async () => {
  const datadog = await loadDatadogModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []
  const scraper = datadog.createDatadogScraper({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === datadog.CAREERS_URL) return careersHtml
      if (url === 'https://careers.datadoghq.com/assets/scripts/main-ME2CAVKL.js') return mainBundleJs

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === datadog.buildTypesenseSearchUrl(1, 2)) return pageOnePayload
      if (url === datadog.buildTypesenseSearchUrl(2, 2)) return pageTwoPayload

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    jobsPerPage: 2,
    now: () => '2026-07-14T00:00:00.000Z',
  })

  const jobs = await scraper.run()

  assert.deepEqual(requestedTextUrls, [
    datadog.CAREERS_URL,
    'https://careers.datadoghq.com/assets/scripts/main-ME2CAVKL.js',
  ])
  assert.deepEqual(requestedJsonUrls, [
    datadog.buildTypesenseSearchUrl(1, 2),
    datadog.buildTypesenseSearchUrl(2, 2),
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'Datadog')
  assert.equal(jobs[0].source, 'datadog')
  assert.equal(jobs[1].title, 'Associate Field Marketing Manager')
  assert.equal(jobs[2].city, 'Delhi')
})

test('Datadog fails closed when the official careers shell, main bundle config, or search payload drifts', async () => {
  const datadog = await loadDatadogModule()

  await assert.rejects(
    datadog.createDatadogScraper({
      fetchText: async (url) => {
        if (url === datadog.CAREERS_URL) {
          return '<html><head><title>Careers</title></head><body><h1>Jobs</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }).run(),
    /official careers surface/i,
  )

  await assert.rejects(
    datadog.createDatadogScraper({
      fetchText: async (url) => {
        if (url === datadog.CAREERS_URL) return careersHtml
        if (url === 'https://careers.datadoghq.com/assets/scripts/main-ME2CAVKL.js') {
          return mainBundleJs.replace('careers_alias', 'different_collection')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }).run(),
    /official main bundle/i,
  )

  await assert.rejects(
    datadog.createDatadogScraper({
      fetchText: async (url) => {
        if (url === datadog.CAREERS_URL) return careersHtml
        if (url === 'https://careers.datadoghq.com/assets/scripts/main-ME2CAVKL.js') return mainBundleJs

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => ({ found: 3 }),
    }).run(),
    /hits\[\]/i,
  )
})
