import assert from 'node:assert/strict'
import test from 'node:test'
import { readCaptureBody } from '../../scraper/ascendion/native-captures/readFixture.js'
const official = async url => {
  const label = url.includes('/who-we-are/careers/') ? 'corporate' : url.includes('/gen/js/') ? 'protocol' : 'careers'
  return readCaptureBody('2026-11-05', `${label}.body.gz`).toString()
}

import {
  CAREER_PAGE_URL,
  SEARCH_API_BASE_URL,
  buildDetailUrl,
  buildSearchUrl,
  createAscendionScraper,
  extractSearchResults,
} from '../../scraper/ascendion/script.js'

const sampleSearchPayload = {
  status: 200,
  error: { message: '', body: '' },
  data: {
    count: 2,
    positions: [
      {
        id: 1970324837276925,
        displayJobId: '50328768',
        name: 'Senior Consultant / Engagement Lead - AI-Driven Technology Transformation',
        locations: ['Bangalore, Karnataka, India '],
        standardizedLocations: ['Bengaluru, KA, IN'],
        postedTs: 1782714558,
        creationTs: 1770747854,
        department: null,
        workLocationOption: 'onsite',
        positionUrl: '/careers/job/1970324837276925',
      },
      {
        id: 1970324837435960,
        displayJobId: '50337252',
        name: 'Network Admin/Engineer',
        locations: ['Bangalore, Karnataka, India', 'Hyderabad, Telangana, India'],
        standardizedLocations: ['Bengaluru, KA, IN', 'Hyderabad, TG, IN'],
        postedTs: 1782223086,
        creationTs: 1782206145,
        department: 'Network Operations',
        workLocationOption: 'onsite',
        positionUrl: '/careers/job/1970324837435960',
      },
    ],
  },
}

const detailPayloadById = {
  1970324837276925: {
    id: 1970324837276925,
    displayJobId: '50328768',
    name: 'Senior Consultant / Engagement Lead - AI-Driven Technology Transformation',
    locations: ['Bangalore, Karnataka, India '],
    department: null,
    jobDescription: '<div><strong>Lead enterprise AI transformation engagements.</strong></div>',
  },
  1970324837435960: {
    id: 1970324837435960,
    displayJobId: '50337252',
    name: 'Network Admin/Engineer',
    locations: ['Bangalore, Karnataka, India', 'Hyderabad, Telangana, India'],
    department: 'Network Operations',
    jobDescription: '<div>Support production network administration and incident response.</div>',
  },
}

test('extractSearchResults maps Ascendion pcsx positions and details into shared scraper fields', () => {
  const jobs = extractSearchResults(sampleSearchPayload, {
    detailPayloadById,
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Consultant / Engagement Lead - AI-Driven Technology Transformation',
    company: 'Ascendion',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '1970324837276925',
    requisitionId: '50328768',
    sourceUrl: 'https://jobs.ascendion.com/careers/job/1970324837276925',
    applyUrl: 'https://jobs.ascendion.com/careers/job/1970324837276925',
    employmentType: 'Onsite',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-29T06:29:18.000Z',
    closingDate: null,
    jobDescription: 'Lead enterprise AI transformation engagements.',
  })
  assert.deepEqual(jobs[1], {
    title: 'Network Admin/Engineer',
    company: 'Ascendion',
    department: 'Network Operations',
    location: 'Bangalore, Hyderabad, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '1970324837435960',
    requisitionId: '50337252',
    sourceUrl: 'https://jobs.ascendion.com/careers/job/1970324837435960',
    applyUrl: 'https://jobs.ascendion.com/careers/job/1970324837435960',
    employmentType: 'Onsite',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-23T13:58:06.000Z',
    closingDate: null,
    jobDescription: 'Support production network administration and incident response.',
  })
})

test('run fetches Ascendion openings from the public pcsx search API and decorates runner fields', async () => {
  const requests = []
  const scraper = createAscendionScraper({
    maxJobs: null,
    pageSize: 10,
  })

  const jobs = await scraper.run({
    fetchText: official,
    fetchJson: async (url) => {
      requests.push(url)
      if (url === buildSearchUrl({ start: 0 })) {
        return sampleSearchPayload
      }
      if (url === buildSearchUrl({ start: 2 })) {
        return {
          status: 200,
          error: { message: '', body: '' },
          data: {
            count: 2,
            positions: [],
          },
        }
      }

      const detailMatch = url.match(/position_id=(\d+)/)
      if (detailMatch) {
        const detail = detailPayloadById[Number(detailMatch[1])]
        return { status: 200, data: { ...detail, standardizedLocations: sampleSearchPayload.data.positions.find(p => p.id === detail.id).standardizedLocations,
          positionUrl: `/careers/job/${detail.id}`, publicUrl: `https://jobs.ascendion.com/careers/job/${detail.id}` } }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(CAREER_PAGE_URL, 'https://jobs.ascendion.com/careers')
  assert.equal(SEARCH_API_BASE_URL, 'https://jobs.ascendion.com/api/pcsx/search')
  assert.equal(buildDetailUrl(1970324837276925), 'https://jobs.ascendion.com/api/pcsx/position_details?position_id=1970324837276925&domain=ascendion.com&hl=en')
  assert.deepEqual(requests, [
    buildSearchUrl({ start: 0 }),
    buildSearchUrl({ start: 2 }),
    buildDetailUrl(1970324837276925),
    buildDetailUrl(1970324837435960),
    buildSearchUrl({ start: 0 }),
    buildSearchUrl({ start: 2 }),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'ascendion')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
