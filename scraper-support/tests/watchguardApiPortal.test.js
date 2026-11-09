import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('the inner WatchGuard Lever mapper retains its legacy explicit-India unit contract', async () => {
  // These existing unit records exercise the inner API mapper, including raw
  // creation metadata. The registered source's publication proof is covered by
  // the separate authentic role-page tests; this is not live source evidence.
  const provider = getScraperCatalog().find((item) => item.source === 'watchguard')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ([
      {
        id: 'wg-india-1',
        text: 'Software Engineer',
        categories: {
          location: 'Bangalore, India',
          department: 'Engineering',
          commitment: 'Full time',
        },
        hostedUrl: 'https://jobs.lever.co/watchguard/wg-india-1',
        applyUrl: 'https://jobs.lever.co/watchguard/wg-india-1/apply',
        descriptionBodyPlain: 'Build secure networking features for India teams.',
        createdAt: 1783551600000,
      },
      {
        id: 'wg-us-1',
        text: 'Account Executive',
        categories: {
          location: 'Seattle, Washington, United States',
          department: 'Sales',
          commitment: 'Full time',
        },
        hostedUrl: 'https://jobs.lever.co/watchguard/wg-us-1',
        applyUrl: 'https://jobs.lever.co/watchguard/wg-us-1/apply',
        descriptionBodyPlain: 'Drive regional sales growth.',
        createdAt: 1783465200000,
      },
    ]),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineer',
    company: 'WatchGuard Technologies',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://jobs.lever.co/watchguard/wg-india-1',
    applyUrl: 'https://jobs.lever.co/watchguard/wg-india-1/apply',
    sourceUrl: 'https://jobs.lever.co/watchguard/wg-india-1',
    source: 'watchguard',
    jobId: 'wg-india-1',
    requisitionId: 'wg-india-1',
    department: 'Engineering',
    employmentType: 'Full time',
    experienceRequired: null,
    jobDescription: 'Build secure networking features for India teams.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: 1783551600000,
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
