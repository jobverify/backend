import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Atlassian first-party listings and keeps India roles', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'atlassian')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ([
      {
        id: 25796,
        title: 'Principal Engineer, Search Platform',
        type: 'Full-Time',
        locations: [
          'Bengaluru - India -   Bengaluru,  560071 India',
          'Remote - India - Remote',
        ],
        category: 'Engineering',
        overview: '<p><strong>Working at Atlassian</strong></p><p>Atlassians can choose where they work.</p>',
        responsibilities: '<p><strong>Responsibilities</strong></p><ul><li>Lead platform initiatives.</li></ul>',
        qualifications: '<p><strong>Qualifications</strong></p><ul><li>Deep search systems experience.</li></ul>',
        compensation: '<p data-compensation="true">Competitive compensation package.</p>',
        applyUrl: 'https://careers-apac-atlassian.icims.com/jobs/25796/principal-engineer%2c-search-platform/job?mode=apply',
        portalJobPost: {
          id: 25796,
          portalUrl: 'https://careers-apac-atlassian.icims.com/jobs/25796/principal-engineer%2c-search-platform/job',
          updatedDate: '2026-07-31 03:14 AM',
        },
      },
      {
        id: 25583,
        title: 'Account Executive - Japanese Speaking',
        type: 'Full-Time',
        locations: [
          'Remote - Japan - Remote',
          'Remote - Remote',
        ],
        category: 'Sales',
        overview: '<p>Japan role.</p>',
        responsibilities: '<p>Sell software.</p>',
        qualifications: '<p>Japanese fluency.</p>',
        compensation: '<p>Local compensation.</p>',
        applyUrl: 'https://globalcareers-atlassian.icims.com/jobs/25583/account-executive---japanese-speaking/job?mode=apply',
        portalJobPost: {
          id: 25583,
          portalUrl: 'https://globalcareers-atlassian.icims.com/jobs/25583/account-executive---japanese-speaking/job',
          updatedDate: '2026-07-30 01:00 PM',
        },
      },
    ]),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      company: jobs[0].company,
      location: jobs[0].location,
      city: jobs[0].city,
      country: jobs[0].country,
      link: jobs[0].link,
      applyUrl: jobs[0].applyUrl,
      sourceUrl: jobs[0].sourceUrl,
      source: jobs[0].source,
      jobId: jobs[0].jobId,
      requisitionId: jobs[0].requisitionId,
      department: jobs[0].department,
      employmentType: jobs[0].employmentType,
      postingDate: jobs[0].postingDate,
      remoteStatus: jobs[0].remoteStatus,
    },
    {
      title: 'Principal Engineer, Search Platform',
      company: 'Atlassian',
      location: 'Bengaluru - India -   Bengaluru,  560071 India',
      city: 'Bengaluru',
      country: 'India',
      link: 'https://www.atlassian.com/company/careers/details/25796',
      applyUrl: 'https://careers-apac-atlassian.icims.com/jobs/25796/principal-engineer%2c-search-platform/job?mode=apply',
      sourceUrl: 'https://www.atlassian.com/company/careers/details/25796',
      source: 'atlassian',
      jobId: 25796,
      requisitionId: 25796,
      department: 'Engineering',
      employmentType: 'Full-Time',
      postingDate: '2026-07-31 03:14 AM',
      remoteStatus: 'On-site',
    },
  )
  assert.match(jobs[0].jobDescription, /Working at Atlassian/i)
  assert.match(jobs[0].jobDescription, /Responsibilities/i)
  assert.match(jobs[0].jobDescription, /Qualifications/i)
  assert.match(jobs[0].jobDescription, /Competitive compensation package/i)
  assert.match(jobs[0].minimumQualification, /Deep search systems experience/i)
  assert.match(jobs[0].preferredQualification, /Lead platform initiatives/i)
})
