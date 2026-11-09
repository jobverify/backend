import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'rakuten',
)

const readJsonFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const loadRakutenModule = async () => {
  try {
    return await import('../../scraper/rakuten/script.js')
  } catch {
    assert.fail('Expected Rakuten scraper module at ../../scraper/rakuten/script.js')
  }
}

test('buildListingRequest reproduces the public Rakuten Openings search request', async () => {
  const { LISTING_API_URL, buildListingRequest } = await loadRakutenModule()

  assert.equal(LISTING_API_URL, 'https://apic2.zwayam.com/jobs/search')
  assert.deepEqual(buildListingRequest(20), {
    filterCri: {
      paginationStartNo: 20,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    },
    domain: 'rakuten.openings.co',
    companyId: 'MTUxMjQ=',
  })
})

test('extractSearchResults keeps only Rakuten India jobs from the public listing payload', async () => {
  const { extractSearchResults } = await loadRakutenModule()
  const jobs = extractSearchResults(readJsonFixture('listing-page-1.json'))

  assert.deepEqual(jobs, [{
    title: 'Software Engineer',
    company: 'Rakuten',
    department: 'Engineering',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '48152',
    requisitionId: '48152',
    sourceUrl: 'https://rakuten.openings.co/#!/job-view/software-engineer?id=48152',
    applyUrl: 'https://rakuten.openings.co/#!/job-view/software-engineer?id=48152',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01T10:00:00.000Z',
    closingDate: null,
    jobDescription: 'Build customer-facing Rakuten products.',
  }])
})

test('run is bounded and enriches India listings from the public Rakuten detail surface', async () => {
  const { createRakutenScraper } = await loadRakutenModule()
  const scraper = createRakutenScraper({ maxPages: 1, maxJobs: 1, pageSize: 1 })
  const listingRequests = []
  const detailRequests = []

  const jobs = await scraper.run({
    fetchListingPage: async (request) => {
      listingRequests.push(request)
      return readJsonFixture('listing-page-1.json')
    },
    fetchJobDetail: async (request) => {
      detailRequests.push(request)
      return {
        id: 48152,
        jobTitle: 'Software Engineer',
        jobUrl: 'software-engineer',
        location: 'Bangalore, Karnataka, India',
        department: { departmentName: 'Engineering' },
        jobConfigurationData: {
          Description: 'Design and operate scalable Rakuten systems.',
        },
      }
    },
  })

  assert.deepEqual(listingRequests, [
    {
      filterCri: {
        paginationStartNo: 0,
        selectedCall: 'sort',
        sortCriteria: { name: 'modifiedDate', isAscending: false },
        anyOfTheseWords: '',
      },
      domain: 'rakuten.openings.co',
      companyId: 'MTUxMjQ=',
    },
  ])
  assert.deepEqual(detailRequests, [{
    jobUrl: 'software-engineer',
    externalSource: 'CAREERSITE',
    campusUrl: 'empty',
    companyId: 15124,
    jobId: 48152,
  }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '48152')
  assert.equal(jobs[0].jobDescription, 'Design and operate scalable Rakuten systems.')
  assert.equal(jobs[0].source, 'rakuten')
  assert.equal(jobs[0].link, 'https://rakuten.openings.co/#!/job-view/software-engineer?id=48152')
})
