import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Aptean Jibe jobs from the public India endpoint', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aptean')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      assert.match(url, /careers\.aptean\.com\/api\/jobs/i)

      return {
        jobs: [
          {
            data: {
              slug: '6809',
              req_id: '6809',
              title: 'Cloud Engineer',
              full_location: 'Madurai, India',
              location_name: 'Madurai India',
              country: 'India',
              country_code: 'IN',
              city: 'Madurai',
              apply_url: 'https://asiapac-aptean.icims.com/jobs/6809/login',
              description: '<p>Build and support cloud infrastructure for Aptean products.</p>',
              employment_type: 'FULL_TIME',
              tags3: ['Experienced Professional'],
              posted_date: '2026-06-24T06:20:00+0000',
            },
          },
        ],
        totalCount: 1,
      }
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Cloud Engineer',
    company: 'Aptean',
    location: 'Madurai, India',
    city: 'Madurai',
    country: 'India',
    link: 'https://asiapac-aptean.icims.com/jobs/6809/login',
    applyUrl: 'https://asiapac-aptean.icims.com/jobs/6809/login',
    sourceUrl: 'https://asiapac-aptean.icims.com/jobs/6809/login',
    source: 'aptean',
    jobId: '6809',
    requisitionId: '6809',
    department: null,
    employmentType: 'Full-time',
    experienceRequired: 'Experienced Professional',
    postingDate: '2026-06-24T06:20:00+0000',
    jobDescription: '<p>Build and support cloud infrastructure for Aptean products.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})

test('runApiPortalScraper paginates through all Aptean India jobs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aptean')
  assert.ok(provider)

  const requestedPages = []

  const buildRecord = (index) => ({
    data: {
      slug: `${6800 + index}`,
      req_id: `${6800 + index}`,
      title: `Aptean Role ${index}`,
      full_location: 'Bengaluru, India',
      apply_url: `https://asiapac-aptean.icims.com/jobs/${6800 + index}/login`,
      description: `<p>Role ${index}</p>`,
      employment_type: 'FULL_TIME',
      tags3: ['Experienced Professional'],
      posted_date: '2026-06-24T06:20:00+0000',
    },
  })

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      const parsedUrl = new URL(url)
      const page = Number(parsedUrl.searchParams.get('page') || '1')
      requestedPages.push(page)

      if (page === 1) {
        return {
          jobs: Array.from({ length: 10 }, (_, index) => buildRecord(index + 1)),
          totalCount: 12,
        }
      }

      if (page === 2) {
        return {
          jobs: Array.from({ length: 2 }, (_, index) => buildRecord(index + 11)),
          totalCount: 12,
        }
      }

      return {
        jobs: [],
        totalCount: 12,
      }
    },
  })

  assert.equal(jobs.length, 12)
  assert.deepEqual(requestedPages, [1, 2])
  assert.equal(jobs.at(-1)?.title, 'Aptean Role 12')
})
