import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  LEVER_ENDPOINT,
  createSafeSecurityScraper,
} from './script.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { getCompanyAliasMap } from '../../scraper-support/providers/companyCoverage.js'

test('scrapes current Safe Security Lever postings for India', async () => {
  const requests = []
  const jobs = await createSafeSecurityScraper().run({
    fetchJson: async (url) => {
      requests.push(url)
      return [
        {
          id: 'india-threat-researcher',
          text: 'Threat Researcher II',
          hostedUrl: 'https://jobs.lever.co/safe/india-threat-researcher',
          applyUrl: 'https://jobs.lever.co/safe/india-threat-researcher/apply',
          createdAt: 1_753_000_000_000,
          categories: {
            location: 'New Delhi, Delhi, India',
            team: 'Threat Intel',
            commitment: 'Full-time',
          },
          workplaceType: 'onsite',
          descriptionPlain: 'Research threats for SAFE.',
        },
        {
          id: 'us-role',
          text: 'Enterprise Account Executive - West',
          hostedUrl: 'https://jobs.lever.co/safe/us-role',
          categories: { location: 'Los Angeles, California, United States' },
        },
      ]
    },
  })

  assert.deepEqual(requests, [LEVER_ENDPOINT])
  assert.equal(CAREER_PAGE_URL, 'https://jobs.safe.security/')
  const { scrapedAt, ...job } = jobs[0]
  assert.match(scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.deepEqual([job], [
    {
      title: 'Threat Researcher II',
      company: 'Safe Security',
      department: 'Threat Intel',
      location: 'New Delhi, Delhi, India',
      city: 'New Delhi',
      country: 'India',
      jobId: 'india-threat-researcher',
      requisitionId: 'india-threat-researcher',
      sourceUrl: 'https://jobs.lever.co/safe/india-threat-researcher',
      applyUrl: 'https://jobs.lever.co/safe/india-threat-researcher/apply',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-20T08:26:40.000Z',
      closingDate: null,
      jobDescription: 'Research threats for SAFE.',
      remoteStatus: 'On-site',
      source: 'safesecurity',
      link: 'https://jobs.lever.co/safe/india-threat-researcher/apply',
    },
  ])
})

test('registers Safe Security and resolves the Lucideus alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'safesecurity')

  assert.equal(provider.companyName, 'Safe Security')
  assert.match(provider.modulePath, /safesecurity[\\/]script\.js$/i)
  assert.equal(getCompanyAliasMap().Lucideus, 'safesecurity')
})
