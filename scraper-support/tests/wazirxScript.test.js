import assert from 'node:assert/strict'
import test from 'node:test'

const loadWazirXModule = async () => {
  try {
    return await import('../../scraper/wazirx/script.js')
  } catch {
    assert.fail('Expected WazirX scraper module at ../../scraper/wazirx/script.js')
  }
}

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>WazirX Careers — Trade Your Future</title>
    <link rel="canonical" href="https://careers.wazirx.com/" />
  </head>
  <body>
    <main>
      <h1>WazirX is Hiring</h1>
      <section>
        <h2>Order Book</h2>
        <h3>Open Roles</h3>
        <p>Click any role to see the full job profile and apply.</p>
      </section>
      <footer>
        <p>Apply via Email</p>
        <p>careers@wazirx.com</p>
      </footer>
    </main>
    <script src="js/jobs.js"></script>
  </body>
</html>
`

const JOBS_SCRIPT = `
const JOB_DATA = {
  'REQ-001': {
    title: 'Chief Business Officer',
    dept: 'Business Leadership',
    icon: '🏢',
    iconClass: 'mkt',
    location: 'Mumbai',
    type: 'Full-time',
    code: 'BIZLEADERSHIP/WazirX · REQ-001',
    overview: 'Lead the business roadmap and revenue strategy.',
    responsibilities: ['Own the business P&L', 'Build strategic partnerships'],
    requirements: ['15+ years in business leadership'],
    niceToHave: ['MBA or equivalent'],
  },
  'REQ-002': {
    title: 'Senior Software Development Engineer (SDE III)',
    dept: 'Engineering & Product',
    icon: '⚙️',
    iconClass: 'eng',
    location: 'Remote',
    type: 'Full-time',
    code: 'ENG-PROD/WazirX · REQ-002',
    overview: 'Build backend systems for a high-volume trading platform.',
    responsibilities: ['Build scalable backend systems'],
    requirements: ['10+ years of backend software engineering experience'],
    niceToHave: ['Experience in crypto or fintech'],
  },
  'REQ-006': {
    title: 'Senior Manager – Finance',
    dept: 'Finance',
    icon: '📊',
    iconClass: 'fin',
    location: 'Mumbai',
    type: 'Full-time',
    code: 'FINANCE/WazirX · REQ-006',
    overview: 'Lead treasury and financial discipline.',
    responsibilities: ['Manage treasury and forecasting'],
    requirements: ['8+ years in finance leadership'],
    niceToHave: [],
  },
  'REQ-009': {
    title: 'Customer Happiness Champion – Escalations',
    dept: 'Customer Happiness',
    icon: '🤝',
    iconClass: 'cust',
    location: 'Mumbai',
    type: 'Full-time',
    code: 'CUSTOMER/WazirX · REQ-009',
    overview: 'Resolve complex customer escalations with empathy and speed.',
    responsibilities: ['Handle escalations'],
    requirements: ['5+ years in customer support operations'],
    niceToHave: ['Experience in consumer fintech'],
  },
};
`

test('WazirX helpers stay pinned to the verified first-party careers surface', async () => {
  const wazirx = await loadWazirXModule()

  assert.equal(wazirx.SOURCE, 'wazirx')
  assert.equal(wazirx.COMPANY, 'WazirX')
  assert.equal(wazirx.CAREERS_URL, 'https://careers.wazirx.com/')
  assert.equal(wazirx.extractJobsScriptUrl(CAREERS_HTML), 'https://careers.wazirx.com/js/jobs.js')
  assert.equal(wazirx.hasVerifiedCareersPageSignal(CAREERS_HTML), true)
  assert.equal(wazirx.hasVerifiedCareersPageSignal('<html><body><h1>Careers</h1></body></html>'), false)

  assert.deepEqual(wazirx.extractJobsFromJobsScript(JOBS_SCRIPT), [
    {
      title: 'Chief Business Officer',
      jobId: 'REQ-001',
      requisitionId: 'REQ-001',
      teamCode: 'BIZLEADERSHIP/WazirX',
      department: 'Business Leadership',
      location: 'Mumbai',
      employmentType: 'Full-time',
      overview: 'Lead the business roadmap and revenue strategy.',
      responsibilities: ['Own the business P&L', 'Build strategic partnerships'],
      requirements: ['15+ years in business leadership'],
      niceToHave: ['MBA or equivalent'],
    },
    {
      title: 'Senior Software Development Engineer (SDE III)',
      jobId: 'REQ-002',
      requisitionId: 'REQ-002',
      teamCode: 'ENG-PROD/WazirX',
      department: 'Engineering & Product',
      location: 'Remote',
      employmentType: 'Full-time',
      overview: 'Build backend systems for a high-volume trading platform.',
      responsibilities: ['Build scalable backend systems'],
      requirements: ['10+ years of backend software engineering experience'],
      niceToHave: ['Experience in crypto or fintech'],
    },
    {
      title: 'Senior Manager – Finance',
      jobId: 'REQ-006',
      requisitionId: 'REQ-006',
      teamCode: 'FINANCE/WazirX',
      department: 'Finance',
      location: 'Mumbai',
      employmentType: 'Full-time',
      overview: 'Lead treasury and financial discipline.',
      responsibilities: ['Manage treasury and forecasting'],
      requirements: ['8+ years in finance leadership'],
      niceToHave: [],
    },
    {
      title: 'Customer Happiness Champion – Escalations',
      jobId: 'REQ-009',
      requisitionId: 'REQ-009',
      teamCode: 'CUSTOMER/WazirX',
      department: 'Customer Happiness',
      location: 'Mumbai',
      employmentType: 'Full-time',
      overview: 'Resolve complex customer escalations with empathy and speed.',
      responsibilities: ['Handle escalations'],
      requirements: ['5+ years in customer support operations'],
      niceToHave: ['Experience in consumer fintech'],
    },
  ])
})

test('WazirX run maps the official careers page into conservative shared scraper jobs', async () => {
  const wazirx = await loadWazirXModule()
  const requestedUrls = []

  const jobs = await wazirx.createWazirXScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === wazirx.CAREERS_URL) return CAREERS_HTML
      if (url === wazirx.extractJobsScriptUrl(CAREERS_HTML)) return JOBS_SCRIPT
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    wazirx.CAREERS_URL,
    wazirx.extractJobsScriptUrl(CAREERS_HTML),
  ])
  assert.equal(jobs.length, 4)

  assert.deepEqual(jobs[0], {
    title: 'Chief Business Officer',
    company: 'WazirX',
    location: 'Mumbai',
    city: 'Mumbai',
    country: 'India',
    link: 'https://careers.wazirx.com/',
    applyUrl: 'https://careers.wazirx.com/',
    sourceUrl: 'https://careers.wazirx.com/',
    source: 'wazirx',
    jobId: 'REQ-001',
    requisitionId: 'REQ-001',
    department: 'Business Leadership',
    employmentType: 'Full-time',
    experienceRequired: '15+ years in business leadership',
    jobDescription: 'Lead the business roadmap and revenue strategy.',
    minimumQualification: '15+ years in business leadership',
    preferredQualification: 'MBA or equivalent',
    requiredSkills: ['Own the business P&L', 'Build strategic partnerships'],
    postingDate: null,
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-25T00:00:00.000Z',
  })

  assert.equal(jobs[1].title, 'Senior Software Development Engineer (SDE III)')
  assert.equal(jobs[1].city, 'Remote')
  assert.equal(jobs[1].remoteStatus, 'Remote')
  assert.equal(jobs[1].department, 'Engineering & Product')
})

test('WazirX fails closed when the verified careers surface drifts', async () => {
  const wazirx = await loadWazirXModule()

  await assert.rejects(
    wazirx.createWazirXScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified wazirx careers surface/i,
  )

  await assert.rejects(
    wazirx.createWazirXScraper().run({
      fetchText: async (url) => {
        if (url === wazirx.CAREERS_URL) return CAREERS_HTML
        return JOBS_SCRIPT.replace(/REQ-\d{3}/g, 'ROLE-000')
      },
    }),
    /verified wazirx careers requisition blocks/i,
  )
})
