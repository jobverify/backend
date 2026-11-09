import assert from 'node:assert/strict'
import test from 'node:test'

const loadNestDigitalModule = async () => {
  try {
    return await import('../../scraper/nestdigital/script.js')
  } catch {
    assert.fail('Expected NeST Digital scraper module at ../../scraper/nestdigital/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <section>
        <h1>Give Wings to your dreams at NeST Digital!</h1>
        <a href="https://careers.nestdigital.com/">EXPLORE NOW</a>
      </section>
      <section>
        <h2 class="elementor-heading-title elementor-size-default">Latest Jobs</h2>
        <div class="elementor-shortcode">Something went wrong: cURL error 28: Operation timed out after 5003 milliseconds with 0 bytes received</div>
      </section>
    </main>
  </body>
</html>
`

const careersConfigPayload = {
  status: 1,
  errors: '',
  results: {
    name: 'NeST Digital',
    career_text_heading: 'Next is Digital. Next is NeST',
    website: 'https://www.nestdigital.com/',
    career_filters: [
      { slug: 'departments', label: 'Departments', filter: true },
      { slug: 'job_types', label: 'Job Types', filter: true },
      { slug: 'locations', label: 'Locations', filter: true },
    ],
  },
}

const filterParamsPayload = {
  status: 1,
  errors: '',
  results: {
    locations: ['Bangalore', 'Kochi Ntp'],
    departments: ['General', 'Insurance Services'],
    job_types: [
      { value: 'full_time', label: 'Full Time' },
      { value: 'contract', label: 'Contract' },
    ],
  },
}

const jobsPayload = {
  status: 1,
  errors: '',
  results: {
    total: { value: 2, relation: 'eq' },
    hits: [
      {
        _source: {
          client: 'nestdigital',
          job: 2601,
          title: 'Senior Software Engineer - C++QT',
          location: 'Bangalore',
          department: 'General',
          entity: 'Nest Digital',
          job_type: 'Full Time',
        },
        sort: [1786712276000],
      },
      {
        _source: {
          client: 'nestdigital',
          job: 2581,
          title: 'Senior Software Engineer-SDET',
          location: 'Bangalore',
          department: 'General',
          entity: 'Nest Digital',
          job_type: 'Full Time',
        },
        sort: [1785475645000],
      },
    ],
  },
}

const detailPayloadById = {
  2601: {
    status: 1,
    errors: '',
    results: {
      id: 2601,
      title: 'Senior Software Engineer - C++QT',
      location: [{ city: 'Bangalore-Karnataka', country_code: null }],
      job_type: 'Full Time',
      department: 'General',
      description: '<p>Build advanced healthcare GUI software.</p>',
      skills: [' Linux', 'Yocto', 'Qml', 'QT ', 'C++'],
      experience: 5,
      max_experience: 8,
      job_publish_date: '2026-08-14T12:57:48.395023Z',
      job_board_urls: [
        {
          name: 'Career Page',
          url: 'https://careers.nestdigital.com/apply/?job=2601&source=1',
        },
      ],
    },
  },
  2581: {
    status: 1,
    errors: '',
    results: {
      id: 2581,
      title: 'Senior Software Engineer-SDET',
      location: [{ city: 'Bangalore-Karnataka', country_code: null }],
      job_type: 'Full Time',
      department: 'General',
      description: '<p>Drive SDET automation programs.</p>',
      skills: ['Selenium', 'Java'],
      experience: 4,
      max_experience: 7,
      job_publish_date: '2026-07-30T10:47:25.000000Z',
      job_board_urls: [
        {
          name: 'Career Page',
          url: 'https://careers.nestdigital.com/apply/?job=2581&source=1',
        },
      ],
    },
  },
}

test('NeST Digital scraper recognizes the official careers page and verified Zappyhire API contract', async () => {
  const nestDigital = await loadNestDigitalModule()

  assert.equal(nestDigital.SOURCE, 'nestdigital')
  assert.equal(nestDigital.COMPANY, 'NeST Digital')
  assert.equal(nestDigital.CAREERS_URL, 'https://nestdigital.com/career/')
  assert.equal(nestDigital.JOBS_HOST_URL, 'https://careers.nestdigital.com/')
  assert.equal(
    nestDigital.ZAPPYHIRE_API_ORIGIN,
    'https://nestdigital.zappyhire-multitenant-be-prod.zappyhire.com',
  )
  assert.equal(
    nestDigital.CONFIG_URL,
    'https://nestdigital.zappyhire-multitenant-be-prod.zappyhire.com/api/careers/configurations/',
  )
  assert.equal(
    nestDigital.FILTER_PARAMS_URL,
    'https://nestdigital.zappyhire-multitenant-be-prod.zappyhire.com/api/careers/filter-params/',
  )
  assert.equal(
    nestDigital.buildJobsApiUrl({ page: 2, pageSize: 25 }),
    'https://nestdigital.zappyhire-multitenant-be-prod.zappyhire.com/api/jobs/jobsearch/?page=2&page_size=25',
  )
  assert.equal(nestDigital.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(nestDigital.hasZappyhireConfigSignal(careersConfigPayload), true)
  assert.equal(nestDigital.hasZappyhireFilterParamsSignal(filterParamsPayload), true)
  assert.deepEqual(nestDigital.extractJobHits(jobsPayload), jobsPayload.results.hits)
})

test('run validates the official NeST Digital careers page and returns API-backed jobs', async () => {
  const nestDigital = await loadNestDigitalModule()

  const requestedTexts = []
  const requestedJson = []
  const jobs = await nestDigital.createNestDigitalScraper({
    pageSize: 25,
    now: () => '2026-08-17T19:45:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === nestDigital.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected NeST Digital text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === nestDigital.CONFIG_URL) return careersConfigPayload
      if (url === nestDigital.FILTER_PARAMS_URL) return filterParamsPayload
      if (url === nestDigital.buildJobsApiUrl({ page: 1, pageSize: 25 })) return jobsPayload
      if (url === nestDigital.buildJobDetailUrl(2601)) return detailPayloadById[2601]
      if (url === nestDigital.buildJobDetailUrl(2581)) return detailPayloadById[2581]
      throw new Error(`Unexpected NeST Digital JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [nestDigital.CAREERS_URL])
  assert.deepEqual(requestedJson, [
    nestDigital.CONFIG_URL,
    nestDigital.FILTER_PARAMS_URL,
    nestDigital.buildJobsApiUrl({ page: 1, pageSize: 25 }),
    nestDigital.buildJobDetailUrl(2601),
    nestDigital.buildJobDetailUrl(2581),
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer - C++QT',
    company: 'NeST Digital',
    department: 'General',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'nestdigital-2601',
    requisitionId: '2601',
    sourceUrl: 'https://careers.nestdigital.com/apply/?job=2601&source=1',
    applyUrl: 'https://careers.nestdigital.com/apply/?job=2601&source=1',
    employmentType: 'Full Time',
    experienceRequired: '5-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Linux', 'Yocto', 'Qml', 'QT', 'C++'],
    postingDate: '2026-08-14T12:57:48.395023Z',
    closingDate: null,
    jobDescription: 'Build advanced healthcare GUI software.',
    source: 'nestdigital',
    link: 'https://careers.nestdigital.com/apply/?job=2601&source=1',
    scrapedAt: '2026-08-17T19:45:00.000Z',
  })
  assert.equal(jobs[1].title, 'Senior Software Engineer-SDET')
  assert.equal(jobs[1].source, 'nestdigital')
})

test('NeST Digital respects cancellation before requesting any source page', async () => {
 const scraper = await loadNestDigitalModule(), reason = new Error('cancelled by caller')
 await assert.rejects(scraper.run({ signal: AbortSignal.abort(reason), fetchText: async () => { throw new Error('unexpected request') } }), error => error === reason)
})

test('NeST Digital bounds parallel detail work and preserves listing order', async () => {
 const scraper = await loadNestDigitalModule()
 let active = 0, peak = 0
 const jobs = await scraper.run({
  fetchText: async () => careersPageHtml,
  fetchJson: async (url, options) => {
   assert.ok(options.signal instanceof AbortSignal)
   if (url === scraper.CONFIG_URL) return careersConfigPayload
   if (url === scraper.FILTER_PARAMS_URL) return filterParamsPayload
   if (url === scraper.buildJobsApiUrl()) return jobsPayload
   const id = [2601, 2581].find(id => url === scraper.buildJobDetailUrl(id))
   assert.ok(id)
   active++; peak = Math.max(peak, active)
   await new Promise(resolve => setTimeout(resolve, id === 2601 ? 15 : 1))
   active--
   return detailPayloadById[id]
  },
 })
 assert.equal(peak, 2)
 assert.deepEqual(jobs.map(job => job.jobId), ['nestdigital-2601', 'nestdigital-2581'])
})

test('run fails closed when the careers page or Zappyhire payloads drift', async () => {
  const nestDigital = await loadNestDigitalModule()

  await assert.rejects(
    nestDigital.createNestDigitalScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified official public careers surface/i,
  )

  await assert.rejects(
    nestDigital.createNestDigitalScraper().run({
      fetchText: async () => careersPageHtml,
      fetchJson: async (url) => {
        if (url === nestDigital.CONFIG_URL) {
          return { status: 1, errors: '', results: { name: 'Unexpected' } }
        }
        throw new Error(`Unexpected NeST Digital JSON URL: ${url}`)
      },
    }),
    /configuration changed materially/i,
  )

  await assert.rejects(
    nestDigital.createNestDigitalScraper().run({
      fetchText: async () => careersPageHtml,
      fetchJson: async (url) => {
        if (url === nestDigital.CONFIG_URL) return careersConfigPayload
        if (url === nestDigital.FILTER_PARAMS_URL) return filterParamsPayload
        if (url === nestDigital.buildJobsApiUrl({ page: 1, pageSize: nestDigital.DEFAULT_PAGE_SIZE })) {
          return { status: 1, errors: '', results: { total: { value: 1, relation: 'eq' }, hits: [] } }
        }
        throw new Error(`Unexpected NeST Digital JSON URL: ${url}`)
      },
    }),
    /jobs api changed materially/i,
  )
})
