import assert from 'node:assert/strict'
import test from 'node:test'

const loadHeadoutModule = async () => {
  try {
    return await import('../../scraper/headout/script.js')
  } catch {
    assert.fail('Expected Headout scraper module at ../../scraper/headout/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Headout — Help the world head out</title>
    <link rel="canonical" href="https://www.headout.com/careers/" />
    <script src="https://assets.headout.com/hobrandpages/_next/static/chunks/11111-no-match.js" async=""></script>
    <script src="https://assets.headout.com/hobrandpages/_next/static/chunks/47646-open-roles.js" async=""></script>
  </head>
  <body>
    <main>
      <h2>Join us to help the world head out</h2>
      <h3>Search open positions</h3>
      <p>All locations</p>
      <p>All teams</p>
    </main>
  </body>
</html>
`

const unrelatedChunkScript = `
console.log('not the loader we are looking for')
`

const verifiedLoaderScript = `
let s={greenhouse:"https://boards-api.greenhouse.io"};
let n={greenhouseDepartments:e=>"/v1/boards/".concat(e,"/departments")};
let g={render_as:"list"};
let l=["headoutcareers","headoutreferrals"];
`

const careersPayload = {
  jobs: [
    {
      id: 4563784006,
      title: 'Software Engineer, Apps',
      location: { name: 'Bengaluru' },
      absolute_url: 'https://boards.greenhouse.io/headoutcareers/jobs/4563784006?gh_jid=4563784006',
      requisition_id: '263',
      company_name: 'Headout',
      updated_at: '2026-07-13T09:08:14-04:00',
      content: '&lt;p&gt;Build mobile product experiences.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ name: 'Bengaluru', location: null }],
      metadata: [
        { name: 'Employment Type', value: 'Full-time' },
        { name: 'Workplace Type', value: 'On-site' },
      ],
    },
    {
      id: 4048584006,
      title: 'Photo Editor (Remote)',
      location: { name: 'Remote (India)' },
      absolute_url: 'https://boards.greenhouse.io/headoutcareers/jobs/4048584006?gh_jid=4048584006',
      requisition_id: '74',
      company_name: 'Headout',
      updated_at: '2026-06-22T11:02:08-04:00',
      content: '&lt;p&gt;Edit and optimize travel imagery.&lt;/p&gt;',
      departments: [{ name: 'Media Operations' }],
      offices: [{ name: 'Remote (India)', location: null }],
      metadata: [
        { name: 'Employment Type', value: 'Full-time' },
        { name: 'Workplace Type', value: 'Remote' },
      ],
    },
    {
      id: 4249472006,
      title: 'Account Executive, USA',
      location: { name: 'New York' },
      absolute_url: 'https://boards.greenhouse.io/headoutcareers/jobs/4249472006?gh_jid=4249472006',
      requisition_id: '152',
      company_name: 'Headout',
      updated_at: '2026-06-24T14:07:21-04:00',
      content: '&lt;p&gt;US go-to-market role.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
      offices: [{ name: 'New York', location: null }],
      metadata: [
        { name: 'Employment Type', value: 'Full-time' },
        { name: 'Workplace Type', value: 'Hybrid' },
      ],
    },
  ],
  meta: { total: 3 },
}

const referralsPayload = {
  jobs: [],
  meta: { total: 0 },
}

test('Headout verifies the first-party careers shell and open-roles loader contract', async () => {
  const headout = await loadHeadoutModule()

  assert.equal(headout.SOURCE, 'headout')
  assert.equal(headout.COMPANY, 'Headout')
  assert.equal(headout.OFFICIAL_BRAND_NAME, 'Headout')
  assert.equal(headout.CAREERS_URL, 'https://www.headout.com/careers/')
  assert.equal(headout.VERIFIED_ON, '2026-08-15')
  assert.deepEqual(headout.GREENHOUSE_BOARD_SLUGS, ['headoutcareers', 'headoutreferrals'])
  assert.equal(
    headout.buildGreenhouseJobsApiUrl('headoutcareers'),
    'https://boards-api.greenhouse.io/v1/boards/headoutcareers/jobs?content=true',
  )
  assert.equal(headout.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(headout.extractCandidateLoaderScriptUrls(officialCareersHtml), [
    'https://assets.headout.com/hobrandpages/_next/static/chunks/11111-no-match.js',
    'https://assets.headout.com/hobrandpages/_next/static/chunks/47646-open-roles.js',
  ])
  assert.equal(headout.hasVerifiedOpenRolesLoaderSignal(unrelatedChunkScript), false)
  assert.equal(headout.hasVerifiedOpenRolesLoaderSignal(verifiedLoaderScript), true)
})

test('Headout extracts only India jobs from the verified multi-board Greenhouse payloads', async () => {
  const headout = await loadHeadoutModule()

  const jobs = headout.extractIndiaJobsFromGreenhousePayload(careersPayload, {
    boardSlug: 'headoutcareers',
    scrapedAt: '2026-07-16T12:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.remoteStatus]),
    [
      ['Software Engineer, Apps', 'Bengaluru', 'On-site'],
      ['Photo Editor (Remote)', 'Remote (India)', 'Remote'],
    ],
  )
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'headout')
  assert.equal(
    jobs[0].link,
    'https://boards.greenhouse.io/headoutcareers/jobs/4563784006',
  )
})

test('Headout run validates the official page and loader before fetching the Greenhouse job APIs', async () => {
  const headout = await loadHeadoutModule()
  const requested = []

  const jobs = await headout.createHeadoutScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === headout.CAREERS_URL) return officialCareersHtml
      if (url === 'https://assets.headout.com/hobrandpages/_next/static/chunks/11111-no-match.js') {
        return unrelatedChunkScript
      }
      if (url === 'https://assets.headout.com/hobrandpages/_next/static/chunks/47646-open-roles.js') {
        return verifiedLoaderScript
      }
      throw new Error(`Unexpected Headout text fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      if (url === headout.buildGreenhouseJobsApiUrl('headoutcareers')) return careersPayload
      if (url === headout.buildGreenhouseJobsApiUrl('headoutreferrals')) return referralsPayload
      throw new Error(`Unexpected Headout JSON fixture URL: ${url}`)
    },
    now: () => '2026-07-16T12:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: headout.CAREERS_URL },
    { type: 'text', url: 'https://assets.headout.com/hobrandpages/_next/static/chunks/11111-no-match.js' },
    { type: 'text', url: 'https://assets.headout.com/hobrandpages/_next/static/chunks/47646-open-roles.js' },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/headoutcareers/jobs?content=true',
      options: { method: 'GET' },
    },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/headoutreferrals/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Software Engineer, Apps', 'Photo Editor (Remote)'],
  )
})
