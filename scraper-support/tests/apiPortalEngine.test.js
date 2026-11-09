import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  createPaginationState,
  getNextPageRequest,
  updatePaginationState,
} from '../apiPortal/pagination.js'
import {
  expandTemplate,
  getMappedFieldValue,
  getValueAtPath,
  normalizeApiPortalConfig,
} from '../apiPortal/providerConfig.js'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../providers/apiPortalTemplates.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'apiPortal',
)

const readFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('Eightfold HTTP-success envelope may contain its blank message/body error sentinel', async () => {
 const provider = expandApiPortalProviderTemplate({ source: 'eightfold-test', companyName: 'Example',
  companyCareerPage: 'https://example.eightfold.ai/careers', countryFilter: 'India', atsPlatform: 'eightfold',
  template: 'eightfold', templateOptions: { host: 'example.eightfold.ai', domain: 'example.com' } })
 const payload = { status: 200, error: { message: '', body: '' }, data: { positions: [], count: 0 } }
 assert.deepEqual(await runApiPortalScraper({ provider, fetchJson: async () => payload }), [])
 for (const change of [
  { error: { message: 'denied', body: '' } }, { error: { message: '', body: 'unavailable' } },
  { error: { message: '', body: '', code: 'failed' } }, { status: 500 }, { success: false },
 ]) await assert.rejects(runApiPortalScraper({ provider, fetchJson: async () => ({ ...payload, ...change }) }), /upstream error/)
 await assert.rejects(runApiPortalScraper({ provider: { ...provider, atsPlatform: 'other' }, fetchJson: async () => payload }), /upstream error/)
})

test('Eightfold offsets advance by returned rows when the server caps the requested page size', async () => {
 const provider = expandApiPortalProviderTemplate({ source: 'eightfold-capped', companyName: 'Example',
  companyCareerPage: 'https://example.eightfold.ai/careers', countryFilter: 'India', atsPlatform: 'eightfold',
  template: 'eightfold', templateOptions: { host: 'example.eightfold.ai', domain: 'example.com' } })
 provider.config.detail.enabled = false
 provider.config.mapping.sourceUrl = 'publicUrl'
 provider.config.mapping.applyUrl = 'publicUrl'
 const offsets = []
 const jobs = await runApiPortalScraper({ provider, fetchJson: async url => {
  const offset = Number(new URL(url).searchParams.get('start')); offsets.push(offset)
  assert.equal(new URL(url).searchParams.get('limit'), '50')
  return { data: { positions: offset < 2 ? [{ id: offset + 1, name: 'Engineer ' + offset, locations: ['Bengaluru, India'], publicUrl: 'https://example.eightfold.ai/careers/job/' + (offset + 1) }] : [], count: 2 } }
 } })
 assert.deepEqual(offsets, [0, 1])
 assert.equal(jobs.length, 2)
})

test('Eightfold uses explicit timestamp ordering and preserves a configured sort', async () => {
 for (const sortBy of [undefined, 'relevance']) {
  const provider = expandApiPortalProviderTemplate({ source: 'eightfold-sort', companyName: 'Example',
   companyCareerPage: 'https://example.eightfold.ai/careers', atsPlatform: 'eightfold', template: 'eightfold',
   templateOptions: { host: 'example.eightfold.ai', domain: 'example.com', ...(sortBy ? { sortBy } : {}) } })
  await runApiPortalScraper({ provider, fetchJson: async url => {
   assert.equal(new URL(url).searchParams.get('sort_by'), sortBy || 'timestamp')
   return { data: { positions: [], count: 0 } }
  } })
 }
})

test('normalizeApiPortalConfig expands defaults for a direct API provider', () => {
  const config = normalizeApiPortalConfig({
    discovery: {
      careerPageUrl: 'https://careers.example.com/jobs',
      listingApiUrl: 'https://careers.example.com/api/jobs',
      mode: 'direct',
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: 25,
      resultsPath: 'jobs',
      hasMorePath: 'hasMore',
    },
    mapping: {
      title: 'title',
      location: 'location.displayName',
      jobId: 'id',
      applyUrl: 'applyUrl',
    },
  })

  assert.equal(config.discovery.mode, 'direct')
  assert.equal(config.request.method, 'GET')
  assert.equal(config.pagination.strategy, 'offset-limit')
  assert.equal(config.detail.enabled, false)
})

test('Eightfold template uses a larger default page size to reduce deep pagination request volume', async () => {
  const seenUrls = []
  const provider = expandApiPortalProviderTemplate({
    source: 'qualcomm',
    companyName: 'Qualcomm',
    companyCareerPage: 'https://careers.qualcomm.com/careers',
    countryFilter: 'India',
    atsPlatform: 'eightfold',
    template: 'eightfold',
    templateOptions: {
      host: 'careers.qualcomm.com',
      domain: 'qualcomm.com',
    },
  })

  await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      seenUrls.push(url)
      return {
        data: {
          positions: [],
          count: 0,
        },
      }
    },
  })

  assert.equal(seenUrls.length, 1)
  assert.equal(new URL(seenUrls[0]).searchParams.get('limit'), '50')
})

test('runApiPortalScraper stays HTTP-only and reports blocked Eightfold GET APIs as failures', async () => {
  let browserFallbackUsed = false
  const provider = expandApiPortalProviderTemplate({
    source: 'browser-eightfold',
    companyName: 'Browser Eightfold Corp',
    companyCareerPage: 'https://browser-eightfold.example/careers',
    countryFilter: 'India',
    atsPlatform: 'eightfold',
    template: 'eightfold',
    templateOptions: {
      host: 'browser-eightfold.example',
      domain: 'browser-eightfold.example',
    },
  })

  await assert.rejects(runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchBrowserJson: async () => {
      browserFallbackUsed = true
      throw new Error('Browser fallback should not run in the API-only engine')
    },
  }), /HTTP 403/)

  assert.equal(browserFallbackUsed, false)
})

test('runApiPortalScraper propagates hard-blocked Eightfold inventory without synthetic jobs', async () => {
  const provider = expandApiPortalProviderTemplate({
    source: 'blocked-eightfold',
    companyName: 'Blocked Eightfold Corp',
    companyCareerPage: 'https://blocked-eightfold.example/careers',
    countryFilter: 'India',
    atsPlatform: 'eightfold',
    template: 'eightfold',
    templateOptions: {
      host: 'blocked-eightfold.example',
      domain: 'blocked-eightfold.example',
    },
  })

  await assert.rejects(runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      throw new Error(`HTTP 403 for ${url}`)
    },
  }), /HTTP 403/)
})

test('getValueAtPath resolves nested JSON paths without throwing for missing nodes', () => {
  const payload = {
    jobs: [
      {
        id: 'job-1',
        location: { displayName: 'Bengaluru, India' },
      },
    ],
  }

  assert.equal(getValueAtPath(payload, 'jobs.0.id'), 'job-1')
  assert.equal(getValueAtPath(payload, 'jobs.0.location.displayName'), 'Bengaluru, India')
  assert.equal(getValueAtPath(payload, 'jobs.0.missing.field'), null)
})

test('getMappedFieldValue supports metadata selectors and value maps', () => {
  const payload = {
    metadata: [
      { name: 'Requisition Type', value: 'Service Contract' },
      { name: 'Requisition Location', value: 'Pune, India' },
    ],
  }

  assert.equal(
    getMappedFieldValue(payload, {
      path: 'metadata',
      find: { key: 'name', value: 'Requisition Type' },
      valuePath: 'value',
      valueMap: {
        'Service Contract': 'Contract',
        Intern: 'Internship',
      },
    }),
    'Contract',
  )

  assert.equal(
    getMappedFieldValue(payload, {
      path: 'metadata',
      find: { key: 'name', value: 'Requisition Location' },
      valuePath: 'value',
    }),
    'Pune, India',
  )
})

test('getMappedFieldValue supports template selectors with runtime values', () => {
  const payload = {
    id: 'job-42',
    meta: {
      companyId: 'main',
    },
  }

  assert.equal(
    getMappedFieldValue(payload, {
      strategy: 'template',
      template: 'https://careers.example.com/{{companyId}}/jobs/{{jobId}}',
      values: {
        companyId: 'meta.companyId',
        jobId: 'id',
      },
    }),
    'https://careers.example.com/main/jobs/job-42',
  )
})

test('getMappedFieldValue supports suffix selectors for populated values', () => {
  const payload = {
    yearsOfExperience: '5',
    singleYear: '1',
    emptyYears: '',
  }

  assert.equal(
    getMappedFieldValue(payload, {
      strategy: 'suffix',
      value: 'yearsOfExperience',
      suffix: ' years',
    }),
    '5 years',
  )

  assert.equal(
    getMappedFieldValue(payload, {
      strategy: 'suffix',
      value: 'singleYear',
      singularSuffix: ' year',
      suffix: ' years',
    }),
    '1 year',
  )

  assert.equal(
    getMappedFieldValue(payload, {
      strategy: 'suffix',
      value: 'emptyYears',
      suffix: ' years',
    }),
    null,
  )
})

test('getMappedFieldValue supports fallback selector arrays', () => {
  const payload = {
    standardizedLocations: ['IN', 'Bengaluru, KA, IN'],
    locations: ['India, Multiple Locations, Multiple Locations'],
  }

  assert.equal(
    getMappedFieldValue(payload, ['standardizedLocations.1', 'locations.0']),
    'Bengaluru, KA, IN',
  )

  assert.equal(
    getMappedFieldValue({ locations: ['India, Multiple Locations, Multiple Locations'] }, ['standardizedLocations.1', 'locations.0']),
    'India, Multiple Locations, Multiple Locations',
  )
})

test('expandTemplate replaces token placeholders with runtime values', () => {
  assert.equal(
    expandTemplate('https://api.example.com/jobs/{{jobId}}?cursor={{cursor}}', {
      jobId: 'job-42',
      cursor: 'abc123',
    }),
    'https://api.example.com/jobs/job-42?cursor=abc123',
  )
})

test('offset-limit pagination advances until hasMore becomes false', () => {
  const config = normalizeApiPortalConfig({
    discovery: {
      careerPageUrl: 'https://careers.example.com/jobs',
      listingApiUrl: 'https://careers.example.com/api/jobs',
      mode: 'direct',
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: 25,
      offsetParam: 'offset',
      limitParam: 'limit',
      resultsPath: 'jobs',
      hasMorePath: 'hasMore',
    },
    mapping: {
      title: 'title',
      location: 'location',
      jobId: 'id',
      applyUrl: 'applyUrl',
    },
  })

  let state = createPaginationState(config.pagination)

  assert.deepEqual(getNextPageRequest(config, state).query, { offset: 0, limit: 25 })

  state = updatePaginationState(config.pagination, state, { hasMore: true })
  assert.deepEqual(getNextPageRequest(config, state).query, { offset: 25, limit: 25 })

  state = updatePaginationState(config.pagination, state, { hasMore: false })
  assert.equal(getNextPageRequest(config, state), null)
})

test('offset-limit pagination can stop from totalCount when hasMore is absent', () => {
  const config = normalizeApiPortalConfig({
    discovery: {
      careerPageUrl: 'https://careers.example.com/jobs',
      listingApiUrl: 'https://careers.example.com/api/jobs',
      mode: 'direct',
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: 10,
      offsetParam: 'start',
      limitParam: 'limit',
      resultsPath: 'data.positions',
      totalCountPath: 'data.count',
    },
    mapping: {
      title: 'title',
      location: 'location',
      jobId: 'id',
      applyUrl: 'applyUrl',
    },
  })

  let state = createPaginationState(config.pagination)

  assert.deepEqual(getNextPageRequest(config, state).query, { start: 0, limit: 10 })

  state = updatePaginationState(config.pagination, state, {
    pageSize: 10,
    resultCount: 10,
    totalCount: 15,
  })
  assert.deepEqual(getNextPageRequest(config, state).query, { start: 10, limit: 10 })

  state = updatePaginationState(config.pagination, state, {
    pageSize: 10,
    resultCount: 5,
    totalCount: 15,
  })
  assert.equal(getNextPageRequest(config, state), null)
})

test('page-number pagination advances while totalCount indicates more pages', () => {
  const config = normalizeApiPortalConfig({
    discovery: {
      careerPageUrl: 'https://careers.example.com/jobs',
      listingApiUrl: 'https://careers.example.com/api/jobs',
      mode: 'direct',
    },
    pagination: {
      strategy: 'page-number',
      pageParam: 'page',
      pageSize: 2,
      resultsPath: 'jobs',
      totalCountPath: 'totalCount',
    },
    mapping: {
      title: 'title',
      location: 'location',
      jobId: 'id',
      applyUrl: 'applyUrl',
    },
  })

  let state = createPaginationState(config.pagination)

  assert.deepEqual(getNextPageRequest(config, state).query, { page: 1 })

  state = updatePaginationState(config.pagination, state, {
    pageSize: 2,
    resultCount: 2,
    totalCount: 3,
  })
  assert.deepEqual(getNextPageRequest(config, state).query, { page: 2 })

  state = updatePaginationState(config.pagination, state, {
    pageSize: 2,
    resultCount: 1,
    totalCount: 3,
  })
  assert.equal(getNextPageRequest(config, state), null)
})

test('page-number pagination can target the request body for POST-backed listings APIs', () => {
  const config = normalizeApiPortalConfig({
    discovery: {
      careerPageUrl: 'https://careers.example.com/jobs',
      listingApiUrl: 'https://careers.example.com/api/jobs',
      mode: 'direct',
    },
    request: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        companyId: 'main',
        sort: 'new',
        limit: 10,
      },
    },
    pagination: {
      strategy: 'page-number',
      pageParam: 'page',
      pageParamLocation: 'body',
      pageSize: 10,
      resultsPath: 'jobs',
      totalCountPath: 'totalCount',
    },
    mapping: {
      title: 'title',
      location: 'location',
      jobId: 'id',
      applyUrl: 'applyUrl',
    },
  })

  let state = createPaginationState(config.pagination)

  assert.deepEqual(getNextPageRequest(config, state), {
    query: {},
    body: { page: 1 },
  })

  state = updatePaginationState(config.pagination, state, {
    pageSize: 10,
    resultCount: 10,
    totalCount: 15,
  })
  assert.deepEqual(getNextPageRequest(config, state), {
    query: {},
    body: { page: 2 },
  })

  state = updatePaginationState(config.pagination, state, {
    pageSize: 10,
    resultCount: 5,
    totalCount: 15,
  })
  assert.equal(getNextPageRequest(config, state), null)
})

test('runApiPortalScraper maps listing and detail payloads into the shared scraper job shape', async () => {
  const jobs = await runApiPortalScraper({
    provider: {
      source: 'example-api',
      companyName: 'Example API Corp',
      companyCareerPage: 'https://careers.example.com/jobs',
      countryFilter: 'India',
      atsPlatform: 'official-company-careers',
      config: readFixture('example-provider-config.json'),
    },
    fetchJson: async (url) => {
      if (url.includes('/api/jobs?offset=0')) return readFixture('example-listing-page-1.json')
      if (url.includes('/api/jobs?offset=2')) return readFixture('example-listing-page-2.json')
      if (url.endsWith('/api/jobs/job-1')) return readFixture('example-detail-1.json')
      if (url.endsWith('/api/jobs/job-2')) return readFixture('example-detail-2.json')
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Graduate Software Engineer',
    company: 'Example API Corp',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://careers.example.com/jobs/job-1',
    applyUrl: 'https://careers.example.com/jobs/job-1',
    sourceUrl: 'https://careers.example.com/jobs/job-1',
    source: 'example-api',
    jobId: 'job-1',
    requisitionId: 'REQ-1',
    department: 'Engineering',
    employmentType: 'Full-time',
    experienceRequired: '0-1 years of experience',
    jobDescription: 'Build backend services for India hiring.',
    minimumQualification: 'B.E./B.Tech in Computer Science',
    preferredQualification: 'Internship experience in distributed systems',
    requiredSkills: ['Node.js', 'Distributed Systems'],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})

test('runApiPortalScraper skips malformed records without aborting the provider', async () => {
  const jobs = await runApiPortalScraper({
    provider: {
      source: 'example-api',
      companyName: 'Example API Corp',
      companyCareerPage: 'https://careers.example.com/jobs',
      countryFilter: 'India',
      atsPlatform: 'official-company-careers',
      config: readFixture('example-provider-config.json'),
    },
    fetchJson: async () => ({
      jobs: [
        {
          id: 'job-good',
          title: 'Contract QA Engineer',
          applyUrl: 'https://careers.example.com/jobs/job-good',
          location: { displayName: 'Pune, India' },
        },
        {
          id: 'job-bad',
          title: null,
          applyUrl: null,
          location: {},
        },
      ],
      hasMore: false,
    }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Contract QA Engineer')
})

test('runApiPortalScraper merges configured request query params and supports listing-only field mapping', async () => {
  const seenUrls = []
  const jobs = await runApiPortalScraper({
    provider: {
      source: 'listing-only-api',
      companyName: 'Listing Only Corp',
      companyCareerPage: 'https://careers.example.com/jobs',
      countryFilter: 'India',
      atsPlatform: 'official-company-careers',
      config: {
        discovery: {
          careerPageUrl: 'https://careers.example.com/jobs',
          listingApiUrl: 'https://careers.example.com/api/jobs',
          mode: 'direct',
        },
        request: {
          method: 'GET',
          query: {
            content: 'true',
          },
        },
        pagination: {
          strategy: 'offset-limit',
          pageSize: 1,
          offsetParam: 'offset',
          limitParam: 'limit',
          resultsPath: 'jobs',
          hasMorePath: 'nextPageId',
        },
        mapping: {
          title: 'title',
          location: 'location.name',
          jobId: 'id',
          applyUrl: 'absolute_url',
          department: 'departments.0.name',
          jobDescription: 'content',
        },
      },
    },
    fetchJson: async (url) => {
      seenUrls.push(url)
      return {
        jobs: [
          {
            id: 'job-3',
            title: 'Platform Engineer',
            location: { name: 'Hyderabad, India' },
            absolute_url: 'https://careers.example.com/jobs/job-3',
            departments: [{ name: 'Platform' }],
            content: 'Build internal platforms.',
          },
        ],
        nextPageId: null,
      }
    },
  })

  assert.match(seenUrls[0], /content=true/i)
  assert.match(seenUrls[0], /offset=0/i)
  assert.match(seenUrls[0], /limit=1/i)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, 'Build internal platforms.')
  assert.equal(jobs[0].department, 'Platform')
})

test('runApiPortalScraper supports metadata-backed selectors and provider value maps', async () => {
  const jobs = await runApiPortalScraper({
    provider: {
      source: 'metadata-api',
      companyName: 'Metadata Corp',
      companyCareerPage: 'https://careers.example.com/jobs',
      countryFilter: 'India',
      atsPlatform: 'greenhouse',
      config: {
        discovery: {
          careerPageUrl: 'https://careers.example.com/jobs',
          listingApiUrl: 'https://careers.example.com/api/jobs',
          mode: 'direct',
        },
        request: {
          method: 'GET',
        },
        pagination: {
          strategy: 'single-page',
          resultsPath: 'jobs',
          hasMorePath: 'hasMore',
        },
        mapping: {
          title: 'title',
          location: {
            path: 'metadata',
            find: { key: 'name', value: 'Requisition Location' },
            valuePath: 'value',
          },
          jobId: 'id',
          applyUrl: 'absolute_url',
          employmentType: {
            path: 'metadata',
            find: { key: 'name', value: 'Requisition Type' },
            valuePath: 'value',
            valueMap: {
              'FTE - Regular': 'Full-time',
              'Service Contract': 'Contract',
              Intern: 'Internship',
            },
          },
        },
      },
    },
    fetchJson: async () => ({
      jobs: [
        {
          id: 'job-4',
          title: 'Quality Engineer',
          absolute_url: 'https://careers.example.com/jobs/job-4',
          metadata: [
            { name: 'Requisition Type', value: 'Service Contract' },
            { name: 'Requisition Location', value: 'Bengaluru - Campus' },
          ],
        },
      ],
      hasMore: false,
    }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru - Campus')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].employmentType, 'Contract')
})

test('runApiPortalScraper supports POST listing requests and MynextHire-style JD/apply links', async () => {
  const seenRequests = []
  const jobs = await runApiPortalScraper({
    provider: {
      source: 'example',
      companyName: 'Example Commerce',
      companyCareerPage: 'https://careers.example.com/',
      countryFilter: 'India',
      atsPlatform: 'mynexthire',
      config: {
        discovery: {
          careerPageUrl: 'https://careers.example.com/',
          listingApiUrl: 'https://example.mynexthire.com/employer/careers/reqlist/get',
        },
        request: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            source: 'careers',
            code: '',
            filterByBuId: -1,
          },
        },
        pagination: {
          strategy: 'single-page',
          resultsPath: 'reqDetailsBOList',
          hasMorePath: 'hasMore',
        },
        mapping: {
          title: 'reqTitle',
          location: {
            path: 'location',
            valueMap: {
              'Sumadhura Capitol Towers': 'Bangalore',
            },
          },
          jobId: 'reqId',
          requisitionId: 'reqId',
          sourceUrl: {
            strategy: 'mynexthire-link',
            baseUrl: 'https://careers.example.com/#/careers',
            pageType: 'jd',
            cvSource: 'careers',
            reqIdPath: 'reqId',
          },
          applyUrl: {
            strategy: 'mynexthire-link',
            baseUrl: 'https://careers.example.com/#/careers/apply',
            pageType: 'application',
            cvSource: 'careers',
            reqIdPath: 'reqId',
          },
          department: 'buName',
          employmentType: {
            path: 'employmentType',
            valueMap: {
              full_time: 'Full-time',
              conversion: 'Full-time',
              ijp: 'Full-time',
            },
          },
          experienceLevel: {
            path: 'fresher',
            valueMap: {
              true: 'Entry Level',
              false: 'Mid Level',
            },
          },
          postingDate: 'approvedOn',
          jobDescription: 'jdDisplay',
        },
      },
    },
    fetchJson: async (url, options = {}) => {
      seenRequests.push({ url, options })
      return {
        reqDetailsBOList: [
          {
            reqId: 27525,
            reqTitle: 'Senior Software Development Engineer in Test',
            location: 'Sumadhura Capitol Towers',
            buName: 'Technology',
            employmentType: 'full_time',
            fresher: true,
            approvedOn: '2026-06-19T11:53:02.171+0000',
            jdDisplay: 'Test platform quality at scale.',
          },
        ],
      }
    },
  })

  assert.equal(seenRequests.length, 1)
  assert.equal(seenRequests[0].options.method, 'POST')
  assert.equal(seenRequests[0].options.headers['Content-Type'], 'application/json')
  assert.equal(
    seenRequests[0].options.body,
    JSON.stringify({ source: 'careers', code: '', filterByBuId: -1 }),
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bangalore')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].experienceLevel, 'Entry Level')
  assert.equal(jobs[0].department, 'Technology')
  assert.equal(jobs[0].jobDescription, 'Test platform quality at scale.')
  assert.equal(jobs[0].postingDate, '2026-06-19T11:53:02.171+0000')
  assert.match(jobs[0].sourceUrl, /^https:\/\/careers\.example\.com\/#\/careers\?src%3Dcareers%26p%3D/)
  assert.match(jobs[0].applyUrl, /^https:\/\/careers\.example\.com\/#\/careers\/apply\?src%3Dcareers%26p%3D/)
  assert.equal(jobs[0].link, jobs[0].sourceUrl)

  const decodedSourceQuery = decodeURIComponent(jobs[0].sourceUrl.split('?')[1])
  const decodedApplyQuery = decodeURIComponent(jobs[0].applyUrl.split('?')[1])
  const sourceContext = JSON.parse(
    Buffer.from(decodedSourceQuery.split('p=')[1], 'base64').toString('utf8'),
  )
  const applyContext = JSON.parse(
    Buffer.from(decodedApplyQuery.split('p=')[1], 'base64').toString('utf8'),
  )

  assert.equal(sourceContext.pageType, 'jd')
  assert.equal(applyContext.pageType, 'application')
  assert.equal(sourceContext.reqId, 27525)
  assert.equal(applyContext.reqId, 27525)
  assert.deepEqual(sourceContext.customFields, {})
})

test('runApiPortalScraper supports page-number pagination with totalCount-backed public APIs', async () => {
  const seenUrls = []
  const jobs = await runApiPortalScraper({
    provider: {
      source: 'paged-api',
      companyName: 'Paged API Corp',
      companyCareerPage: 'https://careers.example.com/jobs',
      countryFilter: 'India',
      atsPlatform: 'official-company-careers',
      config: {
        discovery: {
          careerPageUrl: 'https://careers.example.com/jobs',
          listingApiUrl: 'https://careers.example.com/api/jobs',
        },
        request: {
          method: 'GET',
          query: {
            location: 'India',
          },
        },
        pagination: {
          strategy: 'page-number',
          pageParam: 'page',
          pageSize: 2,
          resultsPath: 'jobs',
          totalCountPath: 'totalCount',
        },
        mapping: {
          title: 'data.title',
          location: 'data.location_name',
          jobId: 'data.slug',
          requisitionId: 'data.req_id',
          applyUrl: 'data.apply_url',
          department: 'data.categories.0.name',
          employmentType: 'data.employment_type',
          minimumQualification: 'data.qualifications',
          jobDescription: 'data.description',
          postingDate: 'data.posted_date',
        },
      },
    },
    fetchJson: async (url) => {
      seenUrls.push(url)

      if (url.includes('page=1')) {
        return {
          totalCount: 3,
          jobs: [
            {
              data: {
                slug: '5375',
                req_id: '5375',
                title: 'Senior Solutions Engineer',
                location_name: 'India Remote',
                categories: [{ name: 'Sales' }],
                employment_type: 'Full Time',
                qualifications: 'Bachelor degree',
                description: '<p>Lead customer engineering engagements.</p>',
                posted_date: '2026-05-12T13:23:00+0000',
                apply_url: 'https://www.github.careers/jobs/5375/apply',
              },
            },
            {
              data: {
                slug: '5429',
                req_id: '5429',
                title: 'Senior Marketing Manager',
                location_name: 'India Remote',
                categories: [{ name: 'Marketing' }],
                employment_type: 'Full Time',
                qualifications: 'MBA preferred',
                description: '<p>Drive regional marketing.</p>',
                posted_date: '2026-05-28T04:26:00+0000',
                apply_url: 'https://www.github.careers/jobs/5429/apply',
              },
            },
          ],
        }
      }

      if (url.includes('page=2')) {
        return {
          totalCount: 3,
          jobs: [
            {
              data: {
                slug: '5488',
                req_id: '5488',
                title: 'Partner Development Manager',
                location_name: 'India Remote',
                categories: [{ name: 'Sales' }],
                employment_type: 'Full Time',
                qualifications: 'Bachelor degree',
                description: '<p>Build partner motion.</p>',
                posted_date: '2026-06-11T04:26:00+0000',
                apply_url: 'https://www.github.careers/jobs/5488/apply',
              },
            },
          ],
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(
    seenUrls.map((url) => new URL(url).searchParams.get('page')),
    ['1', '2'],
  )
  assert.equal(jobs.length, 3)
  assert.equal(jobs[2].jobId, '5488')
  assert.equal(jobs[2].location, 'India Remote')
})

test('runApiPortalScraper supports provider-side filtering on mapped fields for global boards', async () => {
  const jobs = await runApiPortalScraper({
    provider: {
      source: 'global-board',
      companyName: 'Global Board Inc',
      companyCareerPage: 'https://careers.example.com/jobs',
      countryFilter: 'India',
      atsPlatform: 'greenhouse',
      config: {
        discovery: {
          careerPageUrl: 'https://careers.example.com/jobs',
          listingApiUrl: 'https://careers.example.com/api/jobs',
          mode: 'direct',
        },
        request: {
          method: 'GET',
        },
        pagination: {
          strategy: 'single-page',
          resultsPath: 'jobs',
          hasMorePath: 'hasMore',
        },
        mapping: {
          title: 'title',
          location: 'location.name',
          jobId: 'id',
          applyUrl: 'absolute_url',
          department: 'departments.0.name',
        },
        resultFilter: {
          include: [
            {
              field: 'location',
              pattern: 'india',
            },
          ],
        },
      },
    },
    fetchJson: async () => ({
      jobs: [
        {
          id: 'job-india',
          title: 'Platform Engineer',
          location: { name: 'Remote - India' },
          absolute_url: 'https://careers.example.com/jobs/job-india',
          departments: [{ name: 'Engineering' }],
        },
        {
          id: 'job-us',
          title: 'Platform Engineer, US',
          location: { name: 'Remote - United States' },
          absolute_url: 'https://careers.example.com/jobs/job-us',
          departments: [{ name: 'Engineering' }],
        },
      ],
      hasMore: false,
    }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'job-india')
  assert.equal(jobs[0].location, 'Remote - India')
})

test('runApiPortalScraper supports Twilio-style search/detail APIs with detail-owned public URLs', async () => {
  const jobs = await runApiPortalScraper({
    provider: {
      source: 'twilio',
      companyName: 'Twilio',
      companyCareerPage: 'https://jobs.twilio.com/careers',
      countryFilter: 'India',
      atsPlatform: 'official-company-careers',
      config: {
        discovery: {
          careerPageUrl: 'https://jobs.twilio.com/careers',
          listingApiUrl: 'https://jobs.twilio.com/api/pcsx/search',
        },
        request: {
          method: 'GET',
          query: {
            domain: 'twilio.com',
            query: '',
            location: 'India',
            start: '0',
          },
        },
        pagination: {
          strategy: 'single-page',
          resultsPath: 'data.positions',
          hasMorePath: 'data.hasMore',
        },
        mapping: {
          title: 'name',
          location: 'locations.0',
          jobId: 'id',
          requisitionId: 'displayJobId',
          department: 'department',
          sourceUrl: {
            path: 'data',
            valuePath: 'publicUrl',
          },
          applyUrl: {
            path: 'data',
            valuePath: 'publicUrl',
          },
          postingDate: {
            path: 'data',
            valuePath: 'efcustomTextPostDate',
          },
        },
        detail: {
          enabled: true,
          urlTemplate: 'https://jobs.twilio.com/api/pcsx/position_details?position_id={{jobId}}&domain=twilio.com&hl=en',
          method: 'GET',
          mapping: {
            jobDescription: 'data.jobDescription',
          },
        },
      },
    },
    fetchJson: async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 1099553975674,
                displayJobId: '50658',
                name: 'Senior Engineering Manager (L5)',
                locations: ['Remote - India'],
                department: 'Engineering',
              },
            ],
          },
        }
      }

      if (url.includes('/api/pcsx/position_details?position_id=1099553975674')) {
        return {
          data: {
            publicUrl: 'https://jobs.twilio.com/careers/job/1099553975674',
            efcustomTextPostDate: 'Jun 11, 2026',
            jobDescription: '<p>Lead remote engineering teams in India.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Engineering Manager (L5)',
    company: 'Twilio',
    location: 'Remote - India',
    city: 'Remote',
    country: 'India',
    link: 'https://jobs.twilio.com/careers/job/1099553975674',
    applyUrl: 'https://jobs.twilio.com/careers/job/1099553975674',
    sourceUrl: 'https://jobs.twilio.com/careers/job/1099553975674',
    source: 'twilio',
    jobId: 1099553975674,
    requisitionId: '50658',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 'Jun 11, 2026',
    jobDescription: '<p>Lead remote engineering teams in India.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'Remote',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})

test('runApiPortalScraper honors provider-scoped detail concurrency without changing job mapping', async () => {
  let activeDetailRequests = 0
  let maxActiveDetailRequests = 0

  const jobs = await runApiPortalScraper({
    provider: {
      source: 'micron-concurrency-fixture',
      companyName: 'Micron Concurrency Fixture',
      companyCareerPage: 'https://careers.example.com/careers',
      countryFilter: 'India',
      atsPlatform: 'eightfold',
      config: {
        discovery: {
          listingApiUrl: 'https://careers.example.com/api/pcsx/search',
        },
        request: {
          method: 'GET',
          query: {
            domain: 'example.com',
            query: '',
            location: 'India',
          },
        },
        pagination: {
          strategy: 'single-page',
          resultsPath: 'data.positions',
        },
        mapping: {
          title: 'name',
          location: 'locations.0',
          jobId: 'id',
          requisitionId: 'displayJobId',
          department: 'department',
          sourceUrl: {
            path: 'data',
            valuePath: 'publicUrl',
          },
          applyUrl: {
            path: 'data',
            valuePath: 'publicUrl',
          },
        },
        detail: {
          enabled: true,
          concurrency: 2,
          urlTemplate: 'https://careers.example.com/api/pcsx/position_details?position_id={{jobId}}',
          method: 'GET',
          mapping: {
            jobDescription: 'data.jobDescription',
          },
        },
      },
    },
    fetchJson: async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 101,
                displayJobId: 'JR101',
                name: 'Job 101',
                locations: ['Hyderabad, Telangana, India'],
                department: 'Engineering',
              },
              {
                id: 102,
                displayJobId: 'JR102',
                name: 'Job 102',
                locations: ['Hyderabad, Telangana, India'],
                department: 'Engineering',
              },
              {
                id: 103,
                displayJobId: 'JR103',
                name: 'Job 103',
                locations: ['Hyderabad, Telangana, India'],
                department: 'Engineering',
              },
            ],
          },
        }
      }

      if (url.includes('/api/pcsx/position_details?position_id=')) {
        const positionId = Number(url.match(/position_id=(\d+)/)?.[1])
        activeDetailRequests += 1
        maxActiveDetailRequests = Math.max(maxActiveDetailRequests, activeDetailRequests)
        await new Promise((resolve) => setTimeout(resolve, 25))
        activeDetailRequests -= 1

        return {
          data: {
            publicUrl: `https://careers.example.com/careers/job/${positionId}`,
            jobDescription: `<p>Detail for ${positionId}</p>`,
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(maxActiveDetailRequests, 2)
  assert.match(jobs[0].jobDescription, /Detail for 101/)
})
