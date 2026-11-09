import assert from 'node:assert/strict'
import test from 'node:test'

const loadIndegeneModule = async () => {
  try {
    return await import('../../scraper/indegene/script.js')
  } catch {
    assert.fail('Expected Indegene scraper module at ../../scraper/indegene/script.js')
  }
}

const buildSearchPayload = (...responses) => ({
  totalJobs: responses.length,
  jobSearchResult: responses.map((response) => ({ response })),
})

test('Indegene scraper stays pinned to the live public SuccessFactors jobs API contract', async () => {
  const indegene = await loadIndegeneModule()

  assert.equal(indegene.CAREERS_ROOT, 'https://careers.indegene.com/')
  assert.equal(
    indegene.SEARCH_PAGE_URL,
    'https://careers.indegene.com/search/?createNewAlert=false&q=&optionsFacetsDD_country=IN&optionsFacetsDD_customfield1=&locale=en_GB',
  )
  assert.deepEqual(
    indegene.buildSearchRequestPayload(),
    {
      keywords: '',
      locale: 'en_GB',
      pageNumber: 0,
      sortBy: 'recent',
    },
  )
  assert.deepEqual(
    indegene.buildSearchRequestPayload(2),
    {
      keywords: '',
      locale: 'en_GB',
      pageNumber: 2,
      sortBy: 'recent',
    },
  )
  assert.equal(indegene.SEARCH_API_URL, 'https://careers.indegene.com/services/recruiting/v1/jobs')
  assert.equal(
    indegene.buildDetailUrl('Manager-Strategy-&amp;-AI-Solutions', '13373'),
    'https://careers.indegene.com/job/Manager-Strategy-&-AI-Solutions/13373/?locale=en_GB',
  )
})

test('extractSearchResults parses the current SuccessFactors payload, keeps India roles, and maps state codes when the live API exposes them', async () => {
  const indegene = await loadIndegeneModule()

  const jobs = indegene.extractSearchResults(buildSearchPayload(
    {
      unifiedStandardTitle: 'Manager \u2013 Strategy & AI Solutions',
      id: '13373',
      filter1: ['India'],
      unifiedStandardStart: '10/07/2026',
      unifiedStandardEnd: '17/07/2026',
      urlTitle: 'Manager-Strategy-&amp;-AI-Solutions',
    },
    {
      unifiedStandardTitle: 'Lead - Data Science',
      id: '13875',
      filter1: ['United States'],
      Cust_Joblocation: ['New Jersey'],
      unifiedStandardStart: '19/05/2026',
      unifiedStandardEnd: '01/08/2026',
      urlTitle: 'Lead-Data-Science',
    },
    {
      unifiedStandardTitle: 'Senior Project Associate',
      id: '12984',
      filter1: ['India'],
      jobLocationShort: ['KA, IND, '],
      unifiedStandardStart: '13/07/2026',
      unifiedStandardEnd: '13/08/2026',
      urlTitle: 'Senior-Project-Associate',
    },
  ))

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Manager \u2013 Strategy & AI Solutions',
    company: 'Indegene',
    department: null,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: '13373',
    requisitionId: '13373',
    sourceUrl: 'https://careers.indegene.com/job/Manager-Strategy-&-AI-Solutions/13373/?locale=en_GB',
    applyUrl: 'https://careers.indegene.com/job/Manager-Strategy-&-AI-Solutions/13373/?locale=en_GB',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '10/07/2026',
    closingDate: '17/07/2026',
    jobDescription: null,
    publicExperienceChecked: true,
  })
  assert.deepEqual(jobs[1], {
    title: 'Senior Project Associate',
    company: 'Indegene',
    department: null,
    location: 'Karnataka, India',
    city: null,
    state: 'Karnataka',
    country: 'India',
    jobId: '12984',
    requisitionId: '12984',
    sourceUrl: 'https://careers.indegene.com/job/Senior-Project-Associate/12984/?locale=en_GB',
    applyUrl: 'https://careers.indegene.com/job/Senior-Project-Associate/12984/?locale=en_GB',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '13/07/2026',
    closingDate: '13/08/2026',
    jobDescription: null,
    publicExperienceChecked: true,
  })
})

test('run pages through the public jobs API, dedupes repeated India requisitions, and decorates runner metadata with a stable timestamp', async () => {
  const indegene = await loadIndegeneModule()
  const requestedPayloads = []
  const scrapedAt = new Date('2026-07-09T12:34:56.000Z')

  const jobs = await indegene.createIndegeneScraper({
    now: () => scrapedAt,
  }).run({
    fetchSearchPageSession: async () => ({
      csrfToken: 'csrf-token',
      cookieHeader: 'SESSION=abc123',
    }),
    fetchJson: async (url, options = {}) => {
      requestedPayloads.push({
        url,
        body: JSON.parse(options.body),
        headers: options.headers,
      })

      if (requestedPayloads.length === 1) {
        return {
          totalJobs: 4,
          jobSearchResult: [
            {
              response: {
                unifiedStandardTitle: 'Manager \u2013 Strategy & AI Solutions',
                id: '13373',
                filter1: ['India'],
                unifiedStandardStart: '10/07/2026',
                unifiedStandardEnd: '17/07/2026',
                urlTitle: 'Manager-Strategy-&amp;-AI-Solutions',
              },
            },
            {
              response: {
                unifiedStandardTitle: 'Lead - Data Science',
                id: '13875',
                filter1: ['United States'],
                Cust_Joblocation: ['New Jersey'],
                unifiedStandardStart: '19/05/2026',
                unifiedStandardEnd: '01/08/2026',
                urlTitle: 'Lead-Data-Science',
              },
            },
          ],
        }
      }

      if (requestedPayloads.length === 2) {
        return {
          totalJobs: 4,
          jobSearchResult: [
            {
              response: {
                unifiedStandardTitle: 'Senior Project Associate',
                id: '12984',
                filter1: ['India'],
                jobLocationShort: ['KA, IND, '],
                unifiedStandardStart: '13/07/2026',
                unifiedStandardEnd: '13/08/2026',
                urlTitle: 'Senior-Project-Associate',
              },
            },
            {
              response: {
                unifiedStandardTitle: 'Manager \u2013 Strategy & AI Solutions',
                id: '13373',
                filter1: ['India'],
                unifiedStandardStart: '10/07/2026',
                unifiedStandardEnd: '17/07/2026',
                urlTitle: 'Manager-Strategy-&amp;-AI-Solutions',
              },
            },
          ],
        }
      }

      throw new Error(`Unexpected Indegene page request: ${requestedPayloads.length}`)
    },
  })

  assert.deepEqual(
    requestedPayloads.map((request) => ({ url: request.url, body: request.body })),
    [
      {
        url: indegene.SEARCH_API_URL,
        body: {
          keywords: '',
          locale: 'en_GB',
          pageNumber: 0,
          sortBy: 'recent',
        },
      },
      {
        url: indegene.SEARCH_API_URL,
        body: {
          keywords: '',
          locale: 'en_GB',
          pageNumber: 1,
          sortBy: 'recent',
        },
      },
    ],
  )
  assert.equal(requestedPayloads[0].headers['X-CSRF-Token'], 'csrf-token')
  assert.equal(requestedPayloads[0].headers.Cookie, 'SESSION=abc123')
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Indegene')
  assert.equal(jobs[0].source, 'indegene')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-09T12:34:56.000Z')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].state, 'Karnataka')
  assert.equal(jobs[1].jobId, '12984')
  assert.equal(jobs[1].publicExperienceChecked, true)
})
