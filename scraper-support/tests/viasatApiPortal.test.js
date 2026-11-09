import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper uses the India query and prefers full_location for Viasat jobs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'viasat')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      assert.equal(url, 'https://careers.viasat.com/api/jobs?country=India&page=1')

      return {
        jobs: [
          {
            data: {
              slug: 'req-12345',
              req_id: '12345',
              title: 'Software Engineer',
              full_location: 'Chennai, India',
              location_name: 'Carlsbad, California, United States',
              apply_url: 'https://careers-viasat.icims.com/jobs/12345/login',
              description: '<p>Build satellite networking software.</p>',
              employment_type: 'FULL_TIME',
              posted_date: '2026-07-09T00:00:00+0000',
            },
          },
        ],
        totalCount: 1,
      }
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineer',
    company: 'Viasat',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    link: 'https://careers-viasat.icims.com/jobs/12345/login',
    applyUrl: 'https://careers-viasat.icims.com/jobs/12345/login',
    sourceUrl: 'https://careers-viasat.icims.com/jobs/12345/login',
    source: 'viasat',
    jobId: 'req-12345',
    requisitionId: '12345',
    department: null,
    employmentType: 'FULL_TIME',
    experienceRequired: null,
    postingDate: '2026-07-09T00:00:00+0000',
    jobDescription: '<p>Build satellite networking software.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
