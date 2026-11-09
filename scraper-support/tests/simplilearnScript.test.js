import assert from 'node:assert/strict'
import test from 'node:test'

const loadSimplilearnModule = async () => {
  try {
    return await import('../../scraper/simplilearn/script.js')
  } catch {
    assert.fail('Expected Simplilearn scraper module at ../../scraper/simplilearn/script.js')
  }
}

const careersHtml = `
  <html lang="en">
    <head>
      <title>Careers at Simplilearn</title>
    </head>
    <body>
      <h1>Careers at Simplilearn</h1>
      <p>Build the future of digital upskilling with us.</p>
      <a href="https://www.simplilearn.com/job-openings">View job openings</a>
    </body>
  </html>
`

const jobOpeningsHtml = `
  <html lang="en">
    <head>
      <title>Job Openings | Simplilearn</title>
    </head>
    <body>
      <h1>Job Openings</h1>
      <div class="brand">Simplilearn</div>
      <p>Explore current opportunities across teams.</p>
    </body>
  </html>
`

const listingPayload = [
  {
    id: 8101,
    link: 'https://www.simplilearn.com/job-openings/senior-product-manager/',
    title: {
      rendered: 'Senior Product Manager',
    },
    content: {
      rendered: '<p>Own learner engagement experiments across the catalog.</p>',
    },
    class_list: [
      'type-awsm_job_openings',
      'job-category-product',
      'job-location-bengaluru',
      'job-type-full-time',
    ],
  },
  {
    id: 8102,
    link: 'https://www.simplilearn.com/job-openings/inside-sales-specialist/',
    title: {
      rendered: 'Inside Sales Specialist',
    },
    content: {
      rendered: '<p>Guide learners to the right upskilling path.</p>',
    },
    class_list: [
      'type-awsm_job_openings',
      'job-category-sales',
      'job-location-bangalore',
      'job-type-remote',
    ],
  },
]

test('Simplilearn AWSM helpers stay on the verified official public surfaces and map listing rows into shared fields', async () => {
  const simplilearn = await loadSimplilearnModule()

  assert.equal(simplilearn.CAREERS_URL, 'https://www.simplilearn.com/careers')
  assert.equal(simplilearn.JOB_OPENINGS_URL, 'https://www.simplilearn.com/job-openings')
  assert.equal(simplilearn.CAREERS_API_URL, 'https://www.simplilearn.com/wp-json/wp/v2/awsm_job_openings')
  assert.equal(typeof simplilearn.hasOfficialCareersSignal, 'function')
  assert.equal(typeof simplilearn.hasOfficialJobOpeningsSignal, 'function')
  assert.equal(typeof simplilearn.buildSearchUrl, 'function')
  assert.equal(typeof simplilearn.extractSearchResults, 'function')
  assert.equal(typeof simplilearn.createSimplilearnScraper, 'function')
  assert.equal(typeof simplilearn.run, 'function')

  assert.equal(simplilearn.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(simplilearn.hasOfficialJobOpeningsSignal(jobOpeningsHtml), true)
  assert.equal(
    simplilearn.buildSearchUrl(1),
    'https://www.simplilearn.com/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=100&page=1',
  )

  const jobs = simplilearn.extractSearchResults(listingPayload)

  assert.deepEqual(jobs[0], {
    title: 'Senior Product Manager',
    company: 'Simplilearn',
    department: 'Product',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '8101',
    requisitionId: '8101',
    sourceUrl: 'https://www.simplilearn.com/job-openings/senior-product-manager/',
    applyUrl: 'https://www.simplilearn.com/job-openings/senior-product-manager/',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Own learner engagement experiments across the catalog.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].location, 'Bangalore, India')
  assert.equal(jobs[1].employmentType, 'Remote')
  assert.equal(jobs[1].remoteStatus, 'Remote')
})

test('run returns no jobs when Simplilearn exposes the verified empty WP Job Openings feed', async () => {
  const simplilearn = await loadSimplilearnModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await simplilearn.createSimplilearnScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === simplilearn.CAREERS_URL) return careersHtml
      if (url === simplilearn.JOB_OPENINGS_URL) return jobOpeningsHtml
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === simplilearn.buildSearchUrl(1)) return []
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    'https://www.simplilearn.com/careers',
    'https://www.simplilearn.com/job-openings',
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://www.simplilearn.com/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=100&page=1',
  ])
  assert.deepEqual(jobs, [])
})

test('run paginates Simplilearn REST listings and decorates runner fields when openings exist', async () => {
  const simplilearn = await loadSimplilearnModule()
  const requestedJsonUrls = []

  const jobs = await simplilearn.createSimplilearnScraper({ pageSize: 2 }).run({
    fetchText: async (url) => {
      if (url === simplilearn.CAREERS_URL) return careersHtml
      if (url === simplilearn.JOB_OPENINGS_URL) return jobOpeningsHtml
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === simplilearn.buildSearchUrl(1, 2)) return listingPayload
      if (url === simplilearn.buildSearchUrl(2, 2)) return []
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-10T06:00:00.000Z',
  })

  assert.deepEqual(requestedJsonUrls, [
    'https://www.simplilearn.com/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=2&page=1',
    'https://www.simplilearn.com/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=2&page=2',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'simplilearn')
  assert.equal(jobs[0].link, 'https://www.simplilearn.com/job-openings/senior-product-manager/')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T06:00:00.000Z')
})

test('run fails closed when the Simplilearn public careers surfaces change', async () => {
  const simplilearn = await loadSimplilearnModule()

  await assert.rejects(
    simplilearn.createSimplilearnScraper().run({
      fetchText: async (url) => {
        if (url === simplilearn.CAREERS_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    simplilearn.createSimplilearnScraper().run({
      fetchText: async (url) => {
        if (url === simplilearn.CAREERS_URL) return careersHtml
        if (url === simplilearn.JOB_OPENINGS_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified official job openings surface/i,
  )

  await assert.rejects(
    simplilearn.createSimplilearnScraper().run({
      fetchText: async (url) => {
        if (url === simplilearn.CAREERS_URL) return careersHtml
        if (url === simplilearn.JOB_OPENINGS_URL) return jobOpeningsHtml
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0 }),
    }),
    /verified wp job openings feed/i,
  )
})


const loadCeipalFixtures = async () => {
  const { readFile } = await import('node:fs/promises')
  const read = name => readFile(new URL('../../scraper/simplilearn/fixtures/' + name, import.meta.url), 'utf8')
  return {
    openingsHtml: await read('job-openings-current.html'),
    embedHtml: await read('ceipal-embed.html'),
    pages: JSON.parse(await read('ceipal-listing-pages.json')),
    details: JSON.parse(await read('ceipal-public-details.json')),
  }
}
const ceipalOptions = (fixtures, calls = []) => ({
  now: () => '2026-10-08T19:00:00.000Z',
  fetchText: async url => {
    calls.push({ url, method: 'GET' })
    if (url === 'https://www.simplilearn.com/careers') return careersHtml
    if (url === 'https://www.simplilearn.com/job-openings') return fixtures.openingsHtml
    if (url.startsWith('https://jobsapi.ceipal.com/APISource/v1/index.html?')) return fixtures.embedHtml
    throw new Error('Unexpected HTML URL: ' + url)
  },
  fetchJson: async (url, options = {}) => {
    calls.push({ url, options })
    if (url.includes('/wp-json/')) throw new Error('HTTP 404 retired WP API')
    const parsed = new URL(url)
    if (parsed.pathname.endsWith('/CareerPortalJobPostings/')) {
      assert.equal(options.method, 'POST')
      assert.equal(options.body.get('method'), 'CareerPortalJobPostings')
      assert.equal(options.body.get('cp_id'), 'Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09')
      assert.equal(options.body.get('from_career_portal'), '1')
      return structuredClone(fixtures.pages[Number(parsed.searchParams.get('page')) - 1])
    }
    const id = decodeURIComponent(parsed.pathname.split('/').at(-2))
    assert.equal(options.method || 'GET', 'GET')
    assert.equal(parsed.searchParams.get('from_career_portal'), '1')
    assert.equal(parsed.searchParams.get('cp_id'), 'Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09')
    if (!fixtures.details[id]) throw new Error('Unexpected detail API URL: ' + url)
    return structuredClone(fixtures.details[id])
  },
})

test('Simplilearn follows its official CEIPAL migration, completes all three pages and verifies all 57 details', async () => {
  const simplilearn = await loadSimplilearnModule()
  const fixtures = await loadCeipalFixtures()
  const calls = []
  const jobs = await simplilearn.run(ceipalOptions(fixtures, calls))
  assert.equal(jobs.length, 57)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 57)
  assert.equal(jobs.every(job => job.country === 'India' && job.company === 'Simplilearn' && job.source === 'simplilearn'), true)
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 3)
  assert.equal(calls.filter(call => call.url.startsWith('https://careerapi.ceipal.com/')).length, 60)
  assert.equal(calls.some(call => call.url.includes('/wp-json/')), false)
  assert.equal(jobs.every(job => job.sourceUrl.startsWith('https://jobsapi.ceipal.com/APISource/v1/index.html?') && new URL(job.sourceUrl).searchParams.get('job_id') === job.jobId), true)
  assert.equal(jobs.find(job => job.requisitionId === 'JPC - 155').city, null)
  assert.equal(jobs.find(job => job.requisitionId === 'JPC - 155').location, 'India')
  assert.equal(jobs.find(job => job.requisitionId === 'JPC - 75').location, 'Karnataka, India')
  assert.equal(jobs.find(job => job.requisitionId === 'JPC - 32').city, 'Bangalore')
  assert.deepEqual(jobs.find(job => job.requisitionId === 'JPC - 32').locations, ['Bengaluru, KA, 560001, India', 'Hsr Layout, KA, 560102, India'])
  assert.equal(jobs.filter(job => job.jobDescription).length, 50)
  assert.equal(jobs.find(job => job.requisitionId === 'JPC - 155').jobDescription, 'Sr. Operations Officer')
  assert.equal(jobs.find(job => job.requisitionId === 'JPC - 155').experienceRequired, '1-3 years')
  assert.equal(jobs.every(job => job.scrapedAt === '2026-10-08T19:00:00.000Z'), true)
})

test('Simplilearn rejects foreign or changed CEIPAL employer handoff identifiers before API reads', async () => {
  const simplilearn = await loadSimplilearnModule()
  const fixtures = await loadCeipalFixtures()
  for (const mutate of [
    html => html.replace('src="https://jobsapi.ceipal.com/', 'src="https://example.org/'),
    html => html.replace('api_key=NDlYd05RTlF2REZhaHVnTEdjT294dz09', 'api_key=foreign-board'),
    html => html.replace('cp_id=Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09', 'cp_id=foreign-portal'),
    html => html.replace('href="https://www.simplilearn.com/job-openings"', 'href="https://example.org/jobs"'),
  ]) {
    const options = ceipalOptions({ ...fixtures, openingsHtml: mutate(fixtures.openingsHtml) })
    let apiReads = 0
    options.fetchJson = async () => { apiReads++; throw new Error('Unexpected API request') }
    await assert.rejects(simplilearn.run(options), /CEIPAL|handoff|identity|portal/i)
    assert.equal(apiReads, 0)
  }
})

test('Simplilearn fails rather than returning a partial CEIPAL inventory for count, page, next URL, or duplicate drift', async () => {
  const simplilearn = await loadSimplilearnModule()
  const fixtures = await loadCeipalFixtures()
  for (const mutate of [
    pages => { pages[2].results.pop() },
    pages => { pages[1].count += 1 },
    pages => { pages[1].page_number = 1 },
    pages => { pages[0].next = 'https://example.org/page2' },
    pages => { pages[1].results[0] = pages[0].results[0] },
    pages => { pages[0].results[0].id = '' },
  ]) {
    const pages = structuredClone(fixtures.pages)
    mutate(pages)
    await assert.rejects(simplilearn.run(ceipalOptions({ ...fixtures, pages })), /inventory|pagination|page|identity|count|duplicate/i)
  }
})

test('Simplilearn propagates CEIPAL listing and detail HTTP failures', async () => {
  const simplilearn = await loadSimplilearnModule()
  const fixtures = await loadCeipalFixtures()
  for (const failedDetail of [false, true]) {
    const options = ceipalOptions(fixtures)
    const fetchJson = options.fetchJson
    options.fetchJson = async (url, request) => {
      if (failedDetail === !new URL(url).pathname.endsWith('/CareerPortalJobPostings/')) throw new Error('HTTP 503 CEIPAL unavailable')
      return fetchJson(url, request)
    }
    await assert.rejects(simplilearn.run(options), /HTTP 503/)
  }
})

test('Simplilearn rejects CEIPAL detail employer, requisition, title, and country conflicts', async () => {
  const simplilearn = await loadSimplilearnModule()
  const fixtures = await loadCeipalFixtures()
  for (const mutate of [
    detail => { detail.company_url = 'www.other-employer.com' },
    detail => { detail.job_code = 'JPC - 999' },
    detail => { detail.public_job_title = 'Unrelated role' },
    detail => { detail.country = 'United States' },
  ]) {
    const details = structuredClone(fixtures.details)
    mutate(details[fixtures.pages[0].results[0].id])
    await assert.rejects(simplilearn.run(ceipalOptions({ ...fixtures, details })), /employer|detail|requisition|conflict/i)
  }
})

test('Simplilearn accepts only an explicitly complete empty CEIPAL response and honors cancellation', async () => {
  const simplilearn = await loadSimplilearnModule()
  const fixtures = await loadCeipalFixtures()
  const empty = { count: 0, num_pages: 0, limit: 20, page_number: 1, page_count: 0, next: null, previous: null, results: [] }
  assert.deepEqual(await simplilearn.run(ceipalOptions({ ...fixtures, pages: [empty] })), [])
  const reason = new Error('source cancelled')
  await assert.rejects(simplilearn.run({ ...ceipalOptions(fixtures), signal: AbortSignal.abort(reason) }), error => error === reason)
  const controller = new AbortController()
  const options = ceipalOptions({ ...fixtures, pages: [empty] })
  options.signal = controller.signal
  options.fetchJson = async () => { controller.abort(reason); return empty }
  await assert.rejects(simplilearn.run(options), error => error === reason)
})

test('Simplilearn reports the verified CEIPAL portal rejection as an upstream failure without retrying or returning empty jobs', async t => {
  const simplilearn = await loadSimplilearnModule()
  const fixtures = await loadCeipalFixtures()
  const { readFile } = await import('node:fs/promises')
  const rejectedPortal = await readFile(new URL('../../scraper/simplilearn/fixtures/ceipal-portal-denied.json', import.meta.url), 'utf8')
  const { classifyScraperError } = await import('../utils/failureClassification.js')
  const { withRetry } = await import('../utils/retry.js')
  const options = ceipalOptions(fixtures)
  delete options.fetchJson
  let requests = 0
  t.mock.method(globalThis, 'fetch', async url => {
    requests += 1
    assert.equal(url, simplilearn.buildCeipalListingUrl(1))
    return new Response(rejectedPortal, { status: 400, headers: { 'Content-Type': 'application/json' } })
  })
  // Keep the real outer wrapper to verify that transport failure metadata survives it.
  await assert.rejects(withRetry(() => simplilearn.run(options), { attempts: 1, label: 'simplilearn' }), error => {
    assert.deepEqual(classifyScraperError(error), {
      softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied',
    })
    assert.equal(error.abortRetries, true)
    assert.match(error.message, /CEIPAL.*HTTP 400.*Career Portal/i)
    return true
  })
  assert.equal(requests, 1)
})

test('Simplilearn keeps unrelated HTTP 400 responses as hard contract failures', async t => {
  const simplilearn = await loadSimplilearnModule()
  const fixtures = await loadCeipalFixtures()
  const { classifyScraperError } = await import('../utils/failureClassification.js')
  const options = ceipalOptions(fixtures)
  delete options.fetchJson
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    status: 400, message: 'Required field is missing',
  }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
  await assert.rejects(simplilearn.run(options), error => {
    assert.equal(classifyScraperError(error).softFailure, false)
    assert.equal(classifyScraperError(error).failureKind, 'parser_or_contract_error')
    return true
  })
})
