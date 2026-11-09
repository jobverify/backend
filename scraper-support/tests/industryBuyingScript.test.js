import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('../../scraper/industrybuying/script.js')

const homepageHtml = `
<!DOCTYPE html>
<html>
  <body>
    <footer>
      <a href="https://jobs.industrybuying.com/" title="Careers">Careers</a>
    </footer>
  </body>
</html>
`

const jobsSiteHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Careers at IndustryBuying</title>
    <meta name="description" content="Build India's largest B2B marketplace with us.">
  </head>
  <body>
    <a href="/jobs">View all roles</a>
  </body>
</html>
`

const orgsPayload = {
  data: [
    {
      id: 'org_1782819232623',
      name: 'industrybuying',
      slug: 'industrybuying',
    },
  ],
}

const jobsPayload = {
  data: [
    {
      id: 'job_1783396889733',
      orgId: 'org_1782819232623',
      requisitionId: 'req_1783395887484',
      title: 'Category Group Head',
      department: 'Category',
      location: 'New Delhi',
      jobType: 'Full Time',
      openings: 1,
      createdAt: '2026-07-07',
    },
    {
      id: 'job_other_org',
      orgId: 'org_other',
      title: 'Ignore Me',
      location: 'Austin',
    },
  ],
  departments: ['Category'],
  total: 1,
}

const jobDetailPayload = {
  data: {
    id: 'req_1783395887484',
    orgId: 'org_1782819232623',
    requisitionId: 'req_1783395887484',
    title: 'Category Group Head',
    department: 'Category',
    location: 'New Delhi',
    jobType: 'Full Time',
    status: 'Active',
    openings: 1,
    createdAt: '2026-07-07',
    reqId: 'REQ-009',
    jobDescription: '<p>Lead category growth and profitability.</p>',
    experience: '8-15',
    salaryMin: 17,
    salaryMax: 22,
    skillsRequired: ['P&L Management', 'Vendor Management'],
  },
}

test('IndustryBuying resolves the verified first-party handoff, jobs site, and careers API identity', async () => {
  const industryBuying = await loadModule()

  assert.equal(industryBuying.SOURCE, 'industrybuying')
  assert.equal(industryBuying.COMPANY, 'IndustryBuying')
  assert.equal(industryBuying.HOMEPAGE_URL, 'https://www.industrybuying.com/')
  assert.equal(industryBuying.HOMEPAGE_HANDOFF_URL, 'https://www.industrybuying.com/')
  assert.equal(industryBuying.JOBS_SITE_URL, 'https://jobs.industrybuying.com/')
  assert.equal(industryBuying.JOBS_PAGE_URL, 'https://jobs.industrybuying.com/jobs')
  assert.equal(industryBuying.CAREER_API_BASE_URL, 'https://careers.industrybuying.com/api/career')
  assert.equal(industryBuying.CAREER_ORGS_API_URL, 'https://careers.industrybuying.com/api/career/orgs')
  assert.equal(industryBuying.CAREER_JOBS_API_URL, 'https://careers.industrybuying.com/api/career/jobs')
  assert.equal(industryBuying.EXPECTED_ORG_ID, 'org_1782819232623')
  assert.equal(industryBuying.EXPECTED_ORG_SLUG, 'industrybuying')
  assert.equal(industryBuying.VERIFIED_ON, '2026-11-05')
  assert.equal(industryBuying.extractCareersLink(homepageHtml), 'https://jobs.industrybuying.com/')
  assert.equal(industryBuying.hasOfficialJobsSiteSignal(jobsSiteHtml), true)
  assert.deepEqual(industryBuying.extractExpectedOrg(orgsPayload), {
    id: 'org_1782819232623',
    name: 'industrybuying',
    slug: 'industrybuying',
  })
})

test('IndustryBuying maps the verified first-party jobs summary and detail payload into the shared contract', async () => {
  const industryBuying = await loadModule()

  const summaries = industryBuying.extractJobSummaries(jobsPayload, { orgId: 'org_1782819232623' })
  assert.equal(summaries.length, 1)

  const detail = industryBuying.extractJobDetail(jobDetailPayload)
  const job = industryBuying.mapJob({ summary: summaries[0], detail })

  assert.deepEqual(job, {
    title: 'Category Group Head',
    company: 'IndustryBuying',
    department: 'Category',
    location: null,
    city: null,
    country: null,
    rawWorkplace: {listing: 'New Delhi', detail: 'New Delhi'},
    sourceCountryScopeUnresolved: true,
    sourceListingComplete: false,
    sourceScopeComplete: false,
    lifecycleCleanupAllowed: false,
    nativeSourceRecord: {listing: jobsPayload.data[0], detail: jobDetailPayload.data},
    jobId: 'job_1783396889733',
    requisitionId: 'req_1783395887484',
    sourceUrl: 'https://jobs.industrybuying.com/jobs/detail?id=job_1783396889733',
    applyUrl: 'https://jobs.industrybuying.com/jobs/apply?id=job_1783396889733',
    employmentType: 'Full Time',
    experienceRequired: '8-15',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['P&L Management', 'Vendor Management'],
    postingDate: '2026-07-07',
    closingDate: null,
    jobDescription: 'Lead category growth and profitability.',
  })
})

test('IndustryBuying run validates the pinned first-party careers surface and decorates jobs', async () => {
  const industryBuying = await loadModule()

  const requestedTexts = []
  const requestedJson = []
  const scraper = industryBuying.createIndustryBuyingScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === industryBuying.HOMEPAGE_HANDOFF_URL) return homepageHtml
      if (url === industryBuying.JOBS_SITE_URL) return jobsSiteHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === industryBuying.CAREER_ORGS_API_URL) return orgsPayload
      if (url === `${industryBuying.CAREER_JOBS_API_URL}?orgId=${industryBuying.EXPECTED_ORG_ID}`) {
        return jobsPayload
      }
      if (url === `${industryBuying.CAREER_JOBS_API_URL}?id=job_1783396889733`) {
        return jobDetailPayload
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    industryBuying.HOMEPAGE_HANDOFF_URL,
    industryBuying.JOBS_SITE_URL,
  ])
  assert.deepEqual(requestedJson, [
    industryBuying.CAREER_ORGS_API_URL,
    `${industryBuying.CAREER_JOBS_API_URL}?orgId=${industryBuying.EXPECTED_ORG_ID}`,
    `${industryBuying.CAREER_JOBS_API_URL}?id=job_1783396889733`,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'industrybuying')
  assert.equal(jobs[0].company, 'IndustryBuying')
  assert.equal(jobs[0].link, 'https://jobs.industrybuying.com/jobs/apply?id=job_1783396889733')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('IndustryBuying fails closed when the verified handoff, jobs site, or careers API identity changes', async () => {
  const industryBuying = await loadModule()

  await assert.rejects(
    industryBuying.createIndustryBuyingScraper().run({
      fetchText: async (url) => {
        if (url === industryBuying.HOMEPAGE_HANDOFF_URL) return '<html><body>No careers link</body></html>'
        return jobsSiteHtml
      },
      fetchJson: async () => orgsPayload,
    }),
    /careers handoff/i,
  )

  await assert.rejects(
    industryBuying.createIndustryBuyingScraper().run({
      fetchText: async (url) => {
        if (url === industryBuying.HOMEPAGE_HANDOFF_URL) return homepageHtml
        return '<html><title>Unexpected</title></html>'
      },
      fetchJson: async () => orgsPayload,
    }),
    /careers site no longer matches/i,
  )

  await assert.rejects(
    industryBuying.createIndustryBuyingScraper().run({
      fetchText: async (url) => {
        if (url === industryBuying.HOMEPAGE_HANDOFF_URL) return homepageHtml
        return jobsSiteHtml
      },
      fetchJson: async (url) => {
        if (url === industryBuying.CAREER_ORGS_API_URL) {
          return { data: [{ id: 'org_other', name: 'different', slug: 'different' }] }
        }
        return jobsPayload
      },
    }),
    /org identity/i,
  )
})
