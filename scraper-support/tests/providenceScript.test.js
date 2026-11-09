import assert from 'node:assert/strict'
import test from 'node:test'

const loadProvidenceModule = async () => {
  try {
    return await import('../../scraper/providence/script.js')
  } catch {
    assert.fail('Expected Providence scraper module at ../../scraper/providence/script.js')
  }
}

const SEARCH_PAGE_1 = {
  featured_jobs: [],
  jobs: [
    {
      buid: 14582,
      city_exact: 'Eureka',
      company_exact: 'Providence',
      country_exact: 'United States',
      date_added: '2026-07-09T00:47:10Z',
      date_updated: '2026-07-09T00:47:10Z',
      description: '**Description** Mammography Technologist role supporting imaging services.',
      guid: '91396DC936874E5990A51A9570F63AF1',
      job_category: 'Diagnostic Imaging',
      job_function: 'Clinical Care',
      job_shift: 'Day',
      job_type: 'Full time',
      location_exact: 'Eureka, CA',
      other: '{"paylow":"49.80","payhigh":"63.78","careertrack":"Clinical Professional","workplacetype":"On-site","department":"7800 MAMMO OIC","worklocation":"St Joseph Hospital Eureka"}',
      reqid: '444977',
      state_short_exact: 'CA',
      title_exact: 'Mammography Technologist - Mammography OIC',
      title_slug: 'mammography-technologist-mammography-oic',
    },
    {
      buid: 53254,
      city_exact: 'Lubbock',
      company_exact: 'Covenant Health',
      country_exact: 'United States',
      date_added: '2026-07-08T18:30:00Z',
      date_updated: '2026-07-08T18:30:00Z',
      description: '**Description** Financial Analyst role supporting reimbursement operations.',
      guid: 'A6B6D31E8D344A35A2572A0C504F89E3',
      job_category: 'Finance Operations',
      job_function: 'Finance',
      job_shift: 'Day',
      job_type: 'Full time',
      location_exact: 'Lubbock, TX',
      other: '{"careertrack":"Business Professional","workplacetype":"On-site","department":"8009 FINANCE","worklocation":"Covenant Medical Center"}',
      reqid: '445123',
      state_short_exact: 'TX',
      title_exact: 'Financial Analyst',
      title_slug: 'financial-analyst',
    },
  ],
  meta: {
    canonical: '/jobs/',
    filters: [],
    request_country: 'IN',
    rss: '/jobs/feeds/rss',
    source: 'solr',
  },
  pagination: {
    has_more_pages: true,
    offset: '0',
    page: 1,
    page_size: 2,
    total: 3,
    total_pages: 2,
  },
}

const SEARCH_PAGE_2 = {
  featured_jobs: [],
  jobs: [
    {
      buid: 59189,
      city_exact: 'Seattle',
      company_exact: 'Providence Medical Group',
      country_exact: 'United States',
      date_added: '2026-07-07T14:15:00Z',
      date_updated: '2026-07-07T14:15:00Z',
      description: '**Description** Family Medicine physician role with an external provider apply surface.',
      guid: 'B62B8C299D9E44CFB289D6642A1496E1',
      job_category: 'Provider',
      job_function: 'Provider',
      job_shift: 'Day',
      job_type: 'Full time',
      location_exact: 'Seattle, WA',
      other: '{"careertrack":"Provider","workplacetype":"On-site","department":"PMG PRIMARY CARE","worklocation":"PMG Seattle"}',
      reqid: '445777',
      state_short_exact: 'WA',
      title_exact: 'Family Medicine Physician',
      title_slug: 'family-medicine-physician',
    },
  ],
  meta: {
    canonical: '/jobs/?page=2',
    filters: [],
    request_country: 'IN',
    rss: '/jobs/feeds/rss?page=2',
    source: 'solr',
  },
  pagination: {
    has_more_pages: false,
    offset: '2',
    page: 2,
    page_size: 2,
    total: 3,
    total_pages: 2,
  },
}

test('Providence URL builders stay on the verified official careers and Jobsyn search surfaces', async () => {
  const {
    API_BASE_URL,
    APPLY_BASE_URL,
    CAREERS_PAGE_URL,
    buildApplyUrl,
    buildJobUrl,
    buildSearchUrl,
  } = await loadProvidenceModule()

  assert.equal(CAREERS_PAGE_URL, 'https://providence.jobs/jobs/')
  assert.equal(API_BASE_URL, 'https://prod-search-api.jobsyn.org/api/v1/solr/search')
  assert.equal(APPLY_BASE_URL, 'https://evac.fa.us2.oraclecloud.com/fscmUI/faces/deeplink?objType=IRC_RECRUITING&action=ICE_JOB_DETAILS_RESP&objKey=pRequisitionNo=')
  assert.equal(
    buildSearchUrl(),
    'https://prod-search-api.jobsyn.org/api/v1/solr/search?source=solr&x-origin=providence.jobs&num_items=40&page=1&offset=0&use_solr_filters=true',
  )
  assert.equal(
    buildSearchUrl({ page: 2, pageSize: 20 }),
    'https://prod-search-api.jobsyn.org/api/v1/solr/search?source=solr&x-origin=providence.jobs&num_items=20&page=2&offset=20&use_solr_filters=true',
  )
  assert.equal(
    buildJobUrl({
      location_exact: 'Eureka, CA',
      title_slug: 'mammography-technologist-mammography-oic',
      guid: '91396DC936874E5990A51A9570F63AF1',
    }),
    'https://providence.jobs/eureka-ca/mammography-technologist-mammography-oic/91396DC936874E5990A51A9570F63AF1/job/',
  )
  assert.equal(
    buildApplyUrl({ buid: 53254, reqid: '445123', guid: 'A6B6D31E8D344A35A2572A0C504F89E3' }),
    'https://evac.fa.us2.oraclecloud.com/fscmUI/faces/deeplink?objType=IRC_RECRUITING&action=ICE_JOB_DETAILS_RESP&objKey=pRequisitionNo=445123',
  )
  assert.equal(
    buildApplyUrl({ buid: 59189, guid: 'B62B8C299D9E44CFB289D6642A1496E1' }),
    'https://rr.jobsyn.org/B62B8C299D9E44CFB289D6642A1496E110',
  )
})

test('extractSearchResults normalizes Providence Jobsyn records and preserves verified apply handoffs', async () => {
  const {
    extractPaginationSummary,
    extractSearchResults,
  } = await loadProvidenceModule()

  const jobs = extractSearchResults(SEARCH_PAGE_1)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Mammography Technologist - Mammography OIC',
    company: 'Providence',
    department: 'Diagnostic Imaging',
    location: 'Eureka, CA, United States',
    city: 'Eureka',
    state: 'CA',
    country: 'United States',
    jobId: '91396DC936874E5990A51A9570F63AF1',
    requisitionId: '444977',
    sourceUrl: 'https://providence.jobs/eureka-ca/mammography-technologist-mammography-oic/91396DC936874E5990A51A9570F63AF1/job/',
    applyUrl: 'https://providence.jobs/eureka-ca/mammography-technologist-mammography-oic/91396DC936874E5990A51A9570F63AF1/job/',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09T00:47:10Z',
    closingDate: null,
    jobDescription: '**Description** Mammography Technologist role supporting imaging services.',
  })
  assert.deepEqual(jobs[1], {
    title: 'Financial Analyst',
    company: 'Covenant Health',
    department: 'Finance Operations',
    location: 'Lubbock, TX, United States',
    city: 'Lubbock',
    state: 'TX',
    country: 'United States',
    jobId: 'A6B6D31E8D344A35A2572A0C504F89E3',
    requisitionId: '445123',
    sourceUrl: 'https://providence.jobs/lubbock-tx/financial-analyst/A6B6D31E8D344A35A2572A0C504F89E3/job/',
    applyUrl: 'https://evac.fa.us2.oraclecloud.com/fscmUI/faces/deeplink?objType=IRC_RECRUITING&action=ICE_JOB_DETAILS_RESP&objKey=pRequisitionNo=445123',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-08T18:30:00Z',
    closingDate: null,
    jobDescription: '**Description** Financial Analyst role supporting reimbursement operations.',
  })

  assert.deepEqual(extractPaginationSummary(SEARCH_PAGE_1), {
    page: 1,
    pageSize: 2,
    totalPages: 2,
    hasMore: true,
  })
})

test('run paginates the Providence Jobsyn search API and decorates shared runner fields', async () => {
  const {
    buildSearchUrl,
    createProvidenceSolrScraper: createProvidenceScraper,
  } = await loadProvidenceModule()

  const requests = []
  const scraper = createProvidenceScraper({ maxPages: 2, maxJobs: 3 })

  const jobs = await scraper.run({
    fetchJson: async (url, options) => {
      requests.push({ url, options })

      if (url === buildSearchUrl({ page: 1 })) return SEARCH_PAGE_1
      if (url === buildSearchUrl({ page: 2 })) return SEARCH_PAGE_2

      throw new Error(`Unexpected Providence URL: ${url}`)
    },
  })

  assert.deepEqual(
    requests.map((request) => request.url),
    [
      buildSearchUrl({ page: 1 }),
      buildSearchUrl({ page: 2 }),
    ],
  )
  assert.deepEqual(
    requests.map((request) => request.options?.headers?.['X-Origin'] ?? null),
    ['providence.jobs', 'providence.jobs'],
  )

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'providence')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(
    jobs[1].applyUrl,
    'https://evac.fa.us2.oraclecloud.com/fscmUI/faces/deeplink?objType=IRC_RECRUITING&action=ICE_JOB_DETAILS_RESP&objKey=pRequisitionNo=445123',
  )
  assert.equal(
    jobs[2].applyUrl,
    'https://rr.jobsyn.org/B62B8C299D9E44CFB289D6642A1496E110',
  )
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})
