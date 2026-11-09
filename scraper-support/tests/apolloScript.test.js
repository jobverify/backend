import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  SEARCH_API_URL,
  buildDetailUrl,
  buildSearchRequest,
  createApolloTyresScraper,
  extractContextFromHomePage,
  extractSearchResults,
} from '../../scraper/apollo/script.js'

const sampleHomePage = `<!DOCTYPE html>
<html>
<body>
<script type="text/javascript">if(!csod.context  || !csod.context.token)  csod.context={"corp":"apollotyres","user":-100,"cultureID":1,"cultureName":"en-US","endpoints":{"cloud":"https://uk.api.csod.com/","api":"/"},"token":"sample-token"};</script>
</body>
</html>`

const sampleSearchPayload = {
  status: 'Success',
  timestamp: '2026-06-29T20:24:47.9834157Z',
  data: {
    totalCount: 2,
    requisitions: [
      {
        requisitionId: 1744,
        displayJobTitle: 'Senior Engineer - Plant Automation',
        postingEffectiveDate: '2026-06-10T00:00:00Z',
        postingExpirationDate: '2026-07-31T00:00:00Z',
        locations: [
          {
            city: 'Chennai',
            state: 'Tamil Nadu',
            country: 'India',
          },
        ],
      },
      {
        requisitionId: 1752,
        displayJobTitle: 'SAP Analyst',
        postingEffectiveDate: '2026-06-15T00:00:00Z',
        postingExpirationDate: '2026-07-15T00:00:00Z',
        locations: [
          {
            city: 'Gurugram',
            state: 'Haryana',
            country: 'India',
          },
          {
            city: 'Chennai',
            state: 'Tamil Nadu',
            country: 'India',
          },
        ],
      },
    ],
  },
}

const detailPayloadById = {
  1744: {
    displayTitle: 'Senior Engineer - Plant Automation',
    ref: 'REQ-1744',
    externalDescription: '<p>Own PLC and SCADA delivery for tyre manufacturing lines.</p>',
    jobAd: '<p>Automation engineering with Siemens PLC.</p>',
    primaryLocation: {
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
    },
    additionalLocations: [],
  },
  1752: {
    displayTitle: 'SAP Analyst',
    ref: 'REQ-1752',
    externalDescription: '<p>Support SAP SD and MM workflows.</p>',
    jobAd: '',
    primaryLocation: {
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
    },
    additionalLocations: [
      {
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
      },
    ],
  },
}

test('extractContextFromHomePage reads the embedded CSOD context from the Apollo Tyres home page', () => {
  assert.deepEqual(extractContextFromHomePage(sampleHomePage), {
    corp: 'apollotyres',
    user: -100,
    cultureID: 1,
    cultureName: 'en-US',
    endpoints: {
      cloud: 'https://uk.api.csod.com/',
      api: '/',
    },
    token: 'sample-token',
  })
})

test('extractSearchResults maps Apollo Tyres CSOD requisitions and detail payloads into shared scraper fields', () => {
  const jobs = extractSearchResults(sampleSearchPayload, {
    detailPayloadById,
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Engineer - Plant Automation',
    company: 'Apollo Tyres',
    department: null,
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: '1744',
    requisitionId: 'REQ-1744',
    sourceUrl: 'https://apollotyres.csod.com/ux/ats/careersite/1/home/requisition/1744?c=apollotyres',
    applyUrl: 'https://apollotyres.csod.com/ux/ats/careersite/1/home/requisition/1744?c=apollotyres',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-10T00:00:00Z',
    closingDate: '2026-07-31T00:00:00Z',
    jobDescription: 'Own PLC and SCADA delivery for tyre manufacturing lines.',
  })
  assert.deepEqual(jobs[1], {
    title: 'SAP Analyst',
    company: 'Apollo Tyres',
    department: null,
    location: 'Gurugram, Chennai, India',
    city: 'Gurugram',
    country: 'India',
    jobId: '1752',
    requisitionId: 'REQ-1752',
    sourceUrl: 'https://apollotyres.csod.com/ux/ats/careersite/1/home/requisition/1752?c=apollotyres',
    applyUrl: 'https://apollotyres.csod.com/ux/ats/careersite/1/home/requisition/1752?c=apollotyres',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-15T00:00:00Z',
    closingDate: '2026-07-15T00:00:00Z',
    jobDescription: 'Support SAP SD and MM workflows.',
  })
})

test('current Apollo runtime rejects unbound archived positive fixtures while retaining native URL/search builders', async () => {
  const requests = []
  const scraper = createApolloTyresScraper({
    maxJobs: null,
  })

  await assert.rejects(scraper.run({
    fetchText: async (url) => {
      requests.push({ type: 'text', url })
      return sampleHomePage
    },
    fetchJson: async (url) => {
      requests.push({ type: 'json', url })
      if (url === SEARCH_API_URL) {
        return sampleSearchPayload
      }

      const detailMatch = url.match(/requisitions\/(\d+)\/jobDetails/)
      if (detailMatch) {
        return detailPayloadById[Number(detailMatch[1])]
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), /Apollo native CSOD.*identity/i)

  assert.equal(CAREER_PAGE_URL, 'https://apollotyres.csod.com/ux/ats/careersite/1/home?c=apollotyres')
  assert.deepEqual(buildSearchRequest(), {
    careerSiteId: 1,
    careerSitePageId: 1,
    pageNumber: 1,
    pageSize: 20,
    cultureId: 1,
    cultureName: 'en-US',
    searchText: '',
    states: '',
    countryCodes: '',
    cities: '',
    placeID: '',
    radius: 0,
    postingsWithinDays: 0,
    customFieldCheckboxKeys: [],
    customFieldDropdowns: [],
    customFieldRadios: [],
  })
  assert.equal(buildDetailUrl(1744), 'https://apollotyres.csod.com/services/x/job-requisition/v2/requisitions/1744/jobDetails?cultureId=1')
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      'https://corporate.apollotyres.com/careers/',
    ],
  )
})
