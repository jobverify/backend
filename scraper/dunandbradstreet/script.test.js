import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  LEVER_ENDPOINT,
  createDunAndBradstreetScraper,
} from './script.js'

test('fetches the official Lever board and returns only India roles with scraper metadata', async () => {
  const requests = []
  const scraper = createDunAndBradstreetScraper()

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requests.push(url)
      return [
        {
          id: 'india-role',
          text: 'Senior Data Engineer',
          hostedUrl: 'https://jobs.lever.co/dnb/india-role',
          applyUrl: 'https://jobs.lever.co/dnb/india-role/apply',
          createdAt: 1_720_000_000_000,
          categories: {
            location: 'Hyderabad - India',
            team: 'Technology',
            commitment: 'Employee: Full Time',
          },
          workplaceType: 'hybrid',
          descriptionPlain: 'Build reliable data products.',
        },
        {
          id: 'us-role',
          text: 'Data Engineer',
          hostedUrl: 'https://jobs.lever.co/dnb/us-role',
          categories: { location: 'Austin - Texas - United States' },
        },
      ]
    },
  })

  assert.deepEqual(requests, [LEVER_ENDPOINT])
  assert.equal(CAREER_PAGE_URL, 'https://jobs.lever.co/dnb/')
  assert.equal(jobs.length, 1)
  const { scrapedAt, ...job } = jobs[0]
  assert.deepEqual(job, {
    title: 'Senior Data Engineer',
    company: 'Dun & Bradstreet',
    department: 'Technology',
    location: 'Hyderabad - India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'india-role',
    requisitionId: 'india-role',
    sourceUrl: 'https://jobs.lever.co/dnb/india-role',
    applyUrl: 'https://jobs.lever.co/dnb/india-role/apply',
    employmentType: 'Employee: Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2024-07-03T09:46:40.000Z',
    closingDate: null,
    jobDescription: 'Build reliable data products.',
    remoteStatus: 'Hybrid',
    source: 'dunandbradstreet',
    link: 'https://jobs.lever.co/dnb/india-role/apply',
  })
  assert.match(scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
