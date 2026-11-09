import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  FOUNTAIN_BOARD_URL,
  buildFountainOpeningsApiUrl,
  buildFountainPortalApplicationFormUrl,
  createCmsComputersScraper,
  extractFountainApiJobs,
  extractFountainJobs,
  extractFountainPortalJob,
  hasCmsCareersSignal,
} from './script.js'

const cmsCareersPage = `
  <html>
    <head><title>Business Services Company | Careers | CMS Info Systems</title></head>
    <body>
      <h1>Where talent meets <span>possibilities</span></h1>
      <p>People play an integral role at CMS, and their commitment &amp; passion help us power India uninterrupted.</p>
      <section>
        <h2>Where talent meets</h2>
        <p>Passion. Performance. Pride.</p>
      </section>
      <a href="https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900">
        <span>FIND YOUR OPPORTUNITY</span>
      </a>
    </body>
  </html>
`

const renderedFountainCards = [
  {
    title: 'Assistant Manager - Operations',
    location: 'Mumbai, Maharashtra, India',
    department: 'Operations',
    href: 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900/jobs/operations-manager-123',
  },
  {
    title: 'Software Engineer',
    location: 'Bengaluru, Karnataka, India',
    department: 'Technology',
    href: 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900/jobs/software-engineer-456',
  },
  {
    title: 'Regional Manager',
    location: 'Dubai, United Arab Emirates',
    department: 'Operations',
    href: 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900/jobs/regional-manager-789',
  },
]

const fountainApiPayload = {
  openings: [
    {
      id: '833d27a7-65b8-4839-a56e-2d42bcd8e2e0',
      title: 'Chennai - AM - Talent Acquisition Blue Collar',
      job_type: null,
      location: 'Karnataka',
      apply_url: 'https://ap-1.fountain.com/cms/apply/chennai-am-talent-acquisition-blue-collar',
    },
    {
      id: '9acdb1fc-569a-4941-940c-59aed33278b2',
      title: 'HR - Bangalore',
      job_type: null,
      location: 'Karnataka',
      apply_url: 'https://ap-1.fountain.com/cms/apply/assistant-manager-hr-c90f389d-1625-43d9-9dc3-9edfd13724f5',
    },
    {
      id: 'not-india',
      title: 'Regional Manager',
      job_type: null,
      location: 'Dubai',
      apply_url: 'https://ap-1.fountain.com/cms/apply/regional-manager',
    },
  ],
  pagination: {
    current_page: 1,
    next_page: null,
    total_count: 3,
    total_pages: 1,
  },
  current_city: 'Chennai',
}

const fountainPortalPayload = {
  status: 200,
  payload: {
    funnel: {
      title: 'Chennai - AM - Talent Acquisition Blue Collar',
      position_description_html: '<p>Lead blue-collar hiring in Chennai.</p><p>5+ years of experience in talent acquisition.</p>',
    },
  },
}

const fountainPortalNotApproved = {
  status: 401,
  payload: {
    message: 'Funnel not approved',
  },
  bodyText: '{"message":"Funnel not approved"}',
}

test('validates CMS Info Systems careers page with its official Fountain board link', () => {
  assert.equal(CAREERS_PAGE_URL, 'https://www.cms.com/careers')
  assert.equal(
    FOUNTAIN_BOARD_URL,
    'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900',
  )
  assert.equal(hasCmsCareersSignal(cmsCareersPage), true)
  assert.equal(hasCmsCareersSignal('<main>CMS careers</main>'), false)
})

test('extractFountainJobs keeps and normalizes rendered India roles only', () => {
  assert.deepEqual(extractFountainJobs(renderedFountainCards), [
    {
      title: 'Assistant Manager - Operations',
      company: 'CMS Info Systems',
      department: 'Operations',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'operations-manager-123',
      requisitionId: 'operations-manager-123',
      sourceUrl: 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900/jobs/operations-manager-123',
      applyUrl: 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900/jobs/operations-manager-123',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Software Engineer',
      company: 'CMS Info Systems',
      department: 'Technology',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'software-engineer-456',
      requisitionId: 'software-engineer-456',
      sourceUrl: 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900/jobs/software-engineer-456',
      applyUrl: 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900/jobs/software-engineer-456',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('extractFountainApiJobs keeps and normalizes public Fountain API India openings', () => {
  assert.equal(
    buildFountainOpeningsApiUrl(1),
    'https://ap-1.fountain.com/internal_api/career_site/openings?career_site%5Baccount_slug%5D=cms&career_site%5Bbrand_id%5D=a9218256-8fbf-40ab-936b-49ff5ff7c900&career_site%5Bis_jobs_from_current_location%5D=true&page=1&radius=any&sort_by=distance&category=any&compensation_type=any&location=current_location&locale=en-US',
  )
  assert.equal(
    buildFountainPortalApplicationFormUrl('833d27a7-65b8-4839-a56e-2d42bcd8e2e0'),
    'https://ap-1.fountain.com/internal_api/portal/cms/application_forms/new?funnel_id=833d27a7-65b8-4839-a56e-2d42bcd8e2e0&try_new_ui=true&brand_id=a9218256-8fbf-40ab-936b-49ff5ff7c900',
  )
  assert.deepEqual(extractFountainApiJobs(fountainApiPayload), [
    {
      title: 'Chennai - AM - Talent Acquisition Blue Collar',
      company: 'CMS Info Systems',
      department: null,
      location: 'Chennai, Karnataka, India',
      city: 'Chennai',
      country: 'India',
      jobId: '833d27a7-65b8-4839-a56e-2d42bcd8e2e0',
      requisitionId: '833d27a7-65b8-4839-a56e-2d42bcd8e2e0',
      sourceUrl: 'https://ap-1.fountain.com/cms/apply/chennai-am-talent-acquisition-blue-collar',
      applyUrl: 'https://ap-1.fountain.com/cms/apply/chennai-am-talent-acquisition-blue-collar',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'HR - Bangalore',
      company: 'CMS Info Systems',
      department: null,
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '9acdb1fc-569a-4941-940c-59aed33278b2',
      requisitionId: '9acdb1fc-569a-4941-940c-59aed33278b2',
      sourceUrl: 'https://ap-1.fountain.com/cms/apply/assistant-manager-hr-c90f389d-1625-43d9-9dc3-9edfd13724f5',
      applyUrl: 'https://ap-1.fountain.com/cms/apply/assistant-manager-hr-c90f389d-1625-43d9-9dc3-9edfd13724f5',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('extractFountainApiJobs does not mistake a role prefix for an India city', () => {
  const [job] = extractFountainApiJobs({
    openings: [{
      id: 'role-without-city',
      title: 'Assistant Manager - Operations',
      location: 'Karnataka',
      apply_url: 'https://ap-1.fountain.com/cms/apply/assistant-manager-operations',
    }],
    current_city: 'Chennai',
  })

  assert.equal(job.city, null)
  assert.equal(job.location, 'Karnataka, India')
})

test('extractFountainPortalJob enriches approved public Fountain application forms', () => {
  const job = extractFountainApiJobs(fountainApiPayload)[0]

  assert.deepEqual(extractFountainPortalJob(job, fountainPortalPayload), {
    ...job,
    title: 'Chennai - AM - Talent Acquisition Blue Collar',
    jobDescription: 'Lead blue-collar hiring in Chennai. 5+ years of experience in talent acquisition.',
    experienceRequired: '5+ years',
    publicExperienceChecked: true,
  })
})

test('extractFountainPortalJob marks unapproved public Fountain funnels as checked-missing', () => {
  const job = extractFountainApiJobs({
    openings: [{
      id: 'b3c81450-e11f-478b-a94d-c765abb85792',
      title: 'Assistant Manager - Field Services SLM - Navi Mumbai - Belapur',
      location: 'Belapur - Navi Mumbai (Corporate)',
      apply_url: 'https://ap-1.fountain.com/cms/apply/assistant-manager-field-services-slm',
    }],
    current_city: null,
  })[0]

  assert.deepEqual(extractFountainPortalJob(job, fountainPortalNotApproved), {
    ...job,
    publicExperienceChecked: true,
  })
})

test('run validates CMS before loading the public Fountain openings API and adds scraper metadata', async () => {
  const events = []
  const scraper = createCmsComputersScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      events.push(`cms:${url}`)
      return cmsCareersPage
    },
    fetchJson: async (url) => {
      events.push(`api:${url}`)
      return fountainApiPayload
    },
    fetchPortalForm: async (jobId) => {
      events.push(`portal:${jobId}`)
      return fountainPortalPayload
    },
    launchBrowser: async () => {
      throw new Error('Browser should not be launched for CMS Fountain API parsing')
    },
  })

  assert.deepEqual(events, [
    `cms:${CAREERS_PAGE_URL}`,
    `api:${buildFountainOpeningsApiUrl(1)}`,
    'portal:833d27a7-65b8-4839-a56e-2d42bcd8e2e0',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'cmscomputers')
  assert.equal(jobs[0].link, fountainApiPayload.openings[0].apply_url)
  assert.equal(jobs[0].experienceRequired, '5+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].jobDescription, 'Lead blue-collar hiring in Chennai. 5+ years of experience in talent acquisition.')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run rejects a CMS careers page that does not link to the verified public Fountain board', async () => {
  const scraper = createCmsComputersScraper()

  await assert.rejects(
    scraper.run({ fetchText: async () => '<h1>Careers</h1>' }),
    /does not match the expected official CMS careers page structure/,
  )
})
