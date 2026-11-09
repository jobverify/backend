import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const BOARD_ROWS = [
  {
    id: 223,
    title: 'Technical Support Representative',
    department: 'Customer Support',
    location: 'Bengaluru',
    job_status: 'OPEN',
    description_external: '<p>Respond to customer queries and troubleshoot issues.</p>',
    job_type: 'FULLTIME',
    code: 'CUS00223',
    created_on: Date.parse('2026-07-01T00:00:00.000Z'),
    experience_start: 1,
    experience_end: 3,
    office: {
      city: 'Bengaluru',
      country: 'India',
      state: 'Karnataka',
      name: 'India HQ',
    },
  },
  {
    id: 217,
    title: 'DevOps Engineer',
    department: 'India',
    location: 'Bengaluru',
    job_status: 'OPEN',
    description_external: '<p>Manage cloud infrastructure for Sense applications.</p>',
    job_type: 'FULLTIME',
    code: 'IND00217',
    created_on: Date.parse('2026-07-05T00:00:00.000Z'),
    experience_start: 2,
    experience_end: 4,
    office: {
      city: 'Bengaluru',
      country: 'India',
      state: 'Karnataka',
      name: 'India HQ',
    },
  },
  {
    id: 213,
    title: 'Brand & Motion Designer',
    department: 'Marketing',
    location: 'Remote',
    job_status: 'OPEN',
    description_external: '<p>Create high-quality motion assets for employer brand campaigns.</p>',
    job_type: 'FULLTIME',
    code: 'IND00213',
    created_on: Date.parse('2026-07-06T00:00:00.000Z'),
    experience_start: 2,
    experience_end: 5,
    office: {
      city: 'Remote',
      country: 'India',
      state: 'Karnataka',
      name: 'India Remote',
    },
  },
  {
    id: 212,
    title: 'Implementation Consultant',
    department: 'Sales',
    location: 'United States',
    job_status: 'OPEN',
    description_external: '<p>Lead enterprise customer implementations.</p>',
    job_type: 'FULLTIME',
    code: 'SAL00212',
    created_on: Date.parse('2026-07-04T00:00:00.000Z'),
    experience_start: 2,
    experience_end: 5,
    office: {
      city: 'Remote',
      country: 'United States',
      state: 'CA',
      name: 'US - Remote',
    },
  },
  {
    id: 111,
    title: 'Closed Example',
    department: 'Engineering',
    location: 'Bengaluru',
    job_status: 'CLOSED',
    description_external: '<p>This role is no longer open.</p>',
    job_type: 'FULLTIME',
    code: 'ENG00111',
    created_on: Date.parse('2026-06-30T00:00:00.000Z'),
    experience_start: 3,
    experience_end: 6,
    office: {
      city: 'Bengaluru',
      country: 'India',
      state: 'Karnataka',
      name: 'India HQ',
    },
  },
]

const buildJobsBoardHtml = ({ jobsDataKey = 'rows' } = {}) => `
<!doctype html>
<html lang="en">
  <head>
    <title> Job openings at <!-- -->Sense HQ<!-- --> </title>
    <meta property="og:title" content="Job openings at Sense HQ" />
  </head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          jobsData: {
            [jobsDataKey]: BOARD_ROWS,
            count: 11,
          },
        },
      },
    })}</script>
  </body>
</html>
`

const JOBS_BOARD_HTML = buildJobsBoardHtml()
const LEGACY_JOBS_BOARD_HTML = buildJobsBoardHtml({ jobsDataKey: 'jobs' })

const BROKEN_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected Careers Page</title>
  </head>
  <body>
    <h1>Unexpected</h1>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sensehq/script.js')
  } catch {
    assert.fail('Expected SenseHQ scraper module at ../../scraper/sensehq/script.js')
  }
}

test('SenseHQ helper exports stay pinned to the verified first-party jobs board and embedded payload contract', async () => {
  const sensehq = await loadModule()

  assert.equal(sensehq.SOURCE, 'sensehq')
  assert.equal(sensehq.COMPANY, 'SenseHQ')
  assert.equal(sensehq.OFFICIAL_BRAND_NAME, 'Sense HQ')
  assert.equal(sensehq.VERIFIED_ON, '2026-08-04')
  assert.equal(sensehq.HOMEPAGE_URL, 'https://www.sensehq.com/')
  assert.equal(sensehq.CAREERS_PAGE_URL, 'https://www.sensehq.com/careers')
  assert.equal(sensehq.JOBS_BOARD_URL, 'https://sensehr.sensehq.com/careers')
  assert.equal(sensehq.hasVerifiedJobsBoardSignal(JOBS_BOARD_HTML), true)
  assert.deepEqual(
    sensehq.extractIndiaJobsFromBoardHtml(JOBS_BOARD_HTML, { scrapedAt: FIXED_SCRAPED_AT }),
    [
      {
        title: 'Technical Support Representative',
        company: 'SenseHQ',
        department: 'Customer Support',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        jobId: '223',
        requisitionId: 'CUS00223',
        sourceUrl: 'https://sensehr.sensehq.com/careers/jobs/223',
        applyUrl: 'https://sensehr.sensehq.com/careers/jobs/223',
        employmentType: 'Full-time',
        experienceRequired: '1-3 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-01',
        closingDate: null,
        jobDescription: 'Respond to customer queries and troubleshoot issues.',
        remoteStatus: 'On-site',
        source: 'sensehq',
        link: 'https://sensehr.sensehq.com/careers/jobs/223',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'DevOps Engineer',
        company: 'SenseHQ',
        department: 'India',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        jobId: '217',
        requisitionId: 'IND00217',
        sourceUrl: 'https://sensehr.sensehq.com/careers/jobs/217',
        applyUrl: 'https://sensehr.sensehq.com/careers/jobs/217',
        employmentType: 'Full-time',
        experienceRequired: '2-4 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-05',
        closingDate: null,
        jobDescription: 'Manage cloud infrastructure for Sense applications.',
        remoteStatus: 'On-site',
        source: 'sensehq',
        link: 'https://sensehr.sensehq.com/careers/jobs/217',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Brand & Motion Designer',
        company: 'SenseHQ',
        department: 'Marketing',
        location: 'Remote, India',
        city: null,
        country: 'India',
        jobId: '213',
        requisitionId: 'IND00213',
        sourceUrl: 'https://sensehr.sensehq.com/careers/jobs/213',
        applyUrl: 'https://sensehr.sensehq.com/careers/jobs/213',
        employmentType: 'Full-time',
        experienceRequired: '2-5 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-06',
        closingDate: null,
        jobDescription: 'Create high-quality motion assets for employer brand campaigns.',
        remoteStatus: 'Remote',
        source: 'sensehq',
        link: 'https://sensehr.sensehq.com/careers/jobs/213',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('SenseHQ extractor stays backward compatible with the legacy jobsData.jobs array', async () => {
  const sensehq = await loadModule()

  assert.deepEqual(
    sensehq.extractIndiaJobsFromBoardHtml(LEGACY_JOBS_BOARD_HTML, { scrapedAt: FIXED_SCRAPED_AT }),
    sensehq.extractIndiaJobsFromBoardHtml(JOBS_BOARD_HTML, { scrapedAt: FIXED_SCRAPED_AT }),
  )
})

test('SenseHQ run verifies the board and returns only current India jobs from the embedded payload', async () => {
  const sensehq = await loadModule()
  const requestedUrls = []

  const jobs = await sensehq.createSensehqScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sensehq.JOBS_BOARD_URL) {
        return JOBS_BOARD_HTML
      }

      throw new Error(`Unexpected SenseHQ URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [sensehq.JOBS_BOARD_URL])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.requisitionId, job.remoteStatus]),
    [
      ['Technical Support Representative', 'Bengaluru, India', 'CUS00223', 'On-site'],
      ['DevOps Engineer', 'Bengaluru, India', 'IND00217', 'On-site'],
      ['Brand & Motion Designer', 'Remote, India', 'IND00213', 'Remote'],
    ],
  )
})

test('SenseHQ fails closed when the verified jobs board or embedded jobs payload drifts materially', async () => {
  const sensehq = await loadModule()

  await assert.rejects(
    sensehq.createSensehqScraper().run({
      fetchText: async () => BROKEN_BOARD_HTML,
    }),
    /verified sensehq jobs board/i,
  )

  await assert.rejects(
    sensehq.createSensehqScraper().run({
      fetchText: async () => JOBS_BOARD_HTML.replace('"rows":[', '"roles":['),
    }),
    /verified sensehq jobs payload/i,
  )
})
