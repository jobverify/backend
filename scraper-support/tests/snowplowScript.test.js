import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Shape the Future of Data</h1>
      <p>Join our global team on an incredible journey towards empowering the builders at data-driven companies.</p>
      <h2>Ready to build with us?</h2>
      <a href="https://snowplow.careers.hibob.com/">See Open Roles</a>
    </main>
  </body>
</html>
`

const CAREER_SITE_PAYLOAD = {
  sections: [
    {
      type: 'navbar',
      data: {
        jobListingMenuTitle: 'Current openings',
        careersPageMenuTitle: 'Join the data foundation for AI',
      },
    },
    {
      type: 'cover',
      data: {
        title: 'Join the data foundation for AI',
      },
    },
  ],
}

const JOB_AD_PAYLOAD = {
  filterGroups: {
    departments: [
      { serverId: '257243011', value: 'Customer Success Management' },
      { serverId: '256613049', value: 'Marketing' },
      { serverId: '256613052', value: 'Product' },
    ],
  },
  jobAdDetails: [
    {
      id: 'd268c712-27d4-4826-9e88-14a7b9a42d06',
      title: 'Customer Success Engineer',
      department: 'Customer Success Management',
      employmentType: 'Permanent',
      site: 'Massachusetts',
      country: 'United States',
      workspaceTypeId: 'remote',
      workspaceType: 'Remote',
      publishedAt: '2026-05-15T09:28:34.139717579Z',
      description: '<p><strong>About Snowplow</strong></p><p>Build customer context pipelines.</p>',
      responsibilities: '<ul><li>Partner with customers</li></ul>',
      requirements: '<ul><li>Strong SQL skills</li></ul>',
      benefits: '<p>Competitive compensation</p>',
    },
    {
      id: '321b5353-f971-4387-bc25-92f02e6f0ef6',
      title: 'Market Development Representative',
      department: 'Marketing',
      employmentType: 'Permanent',
      site: 'United Kingdom',
      country: 'United Kingdom',
      workspaceTypeId: 'hybrid',
      workspaceType: 'Hybrid',
      publishedAt: '2026-06-25T13:09:00.492455822Z',
      description: '<p>Create pipeline across EMEA.</p>',
      responsibilities: '<ul><li>Prospect target accounts</li></ul>',
      requirements: '<ul><li>Outbound experience</li></ul>',
      benefits: '<p>Equity for everyone</p>',
    },
    {
      id: '',
      title: 'Ignore malformed listing',
      department: 'Marketing',
      employmentType: 'Permanent',
      site: 'United Kingdom',
      country: 'United Kingdom',
      workspaceTypeId: 'hybrid',
      workspaceType: 'Hybrid',
      publishedAt: '2026-06-26T13:09:00.492455822Z',
      description: '<p>Should not be returned.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/snowplow/script.js')
  } catch {
    assert.fail('Expected Snowplow scraper module at ../../scraper/snowplow/script.js')
  }
}

test('Snowplow pins the verified official careers and HiBob endpoints', async () => {
  const snowplow = await loadModule()

  assert.equal(snowplow.SOURCE, 'snowplow')
  assert.equal(snowplow.COMPANY, 'Snowplow')
  assert.equal(snowplow.CAREERS_PAGE_URL, 'https://snowplow.io/careers')
  assert.equal(snowplow.HIBOB_CAREER_SITE_URL, 'https://snowplow.careers.hibob.com/')
  assert.equal(snowplow.HIBOB_CAREER_SITE_API_URL, 'https://snowplow.careers.hibob.com/api/career-site')
  assert.equal(snowplow.HIBOB_JOB_BOARD_API_URL, 'https://snowplow.careers.hibob.com/api/job-ad')
  assert.equal(snowplow.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(
    snowplow.extractVerifiedHiBobCareerSiteUrl(CAREERS_HTML),
    'https://snowplow.careers.hibob.com/',
  )
  assert.equal(snowplow.hasVerifiedCareerSitePayload(CAREER_SITE_PAYLOAD), true)
})

test('Snowplow extracts public HiBob jobs into shared scraper fields', async () => {
  const snowplow = await loadModule()
  const jobs = snowplow.extractHiBobJobs(JOB_AD_PAYLOAD)

  assert.deepEqual(jobs, [
    {
      title: 'Customer Success Engineer',
      company: 'Snowplow',
      department: 'Customer Success Management',
      location: 'Massachusetts, United States',
      city: null,
      state: null,
      country: 'United States',
      jobId: 'd268c712-27d4-4826-9e88-14a7b9a42d06',
      requisitionId: 'd268c712-27d4-4826-9e88-14a7b9a42d06',
      sourceUrl: 'https://snowplow.careers.hibob.com/jobs/d268c712-27d4-4826-9e88-14a7b9a42d06',
      applyUrl: 'https://snowplow.careers.hibob.com/jobs/d268c712-27d4-4826-9e88-14a7b9a42d06/apply',
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-15T09:28:34.139717579Z',
      closingDate: null,
      jobDescription: 'About Snowplow Build customer context pipelines. Responsibilities Partner with customers Requirements Strong SQL skills Benefits Competitive compensation',
      remoteStatus: 'Remote',
    },
    {
      title: 'Market Development Representative',
      company: 'Snowplow',
      department: 'Marketing',
      location: 'United Kingdom',
      city: null,
      state: null,
      country: 'United Kingdom',
      jobId: '321b5353-f971-4387-bc25-92f02e6f0ef6',
      requisitionId: '321b5353-f971-4387-bc25-92f02e6f0ef6',
      sourceUrl: 'https://snowplow.careers.hibob.com/jobs/321b5353-f971-4387-bc25-92f02e6f0ef6',
      applyUrl: 'https://snowplow.careers.hibob.com/jobs/321b5353-f971-4387-bc25-92f02e6f0ef6/apply',
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-25T13:09:00.492455822Z',
      closingDate: null,
      jobDescription: 'Create pipeline across EMEA. Responsibilities Prospect target accounts Requirements Outbound experience Benefits Equity for everyone',
      remoteStatus: 'Hybrid',
    },
  ])
})

test('current snowplow extraction requires transport response identity', async () => {
  const module = await import('../../scraper/snowplow/script.js')
  await assert.rejects(module.createSnowplowScraper().run({ fetchText: async () => '' }), /transport requires fetchPage/)
  assert.equal(module.PROVIDER_METADATA.atsPlatform, 'hibob')
  assert.equal(module.PROVIDER_METADATA.countryFilter, 'India')
})
