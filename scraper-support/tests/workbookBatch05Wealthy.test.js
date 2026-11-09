import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ATS_PLATFORM,
  BOARD_URL,
  CAREERS_URL,
  COMPANY,
  COMPANY_DOMAIN,
  CONTACT_EMAIL,
  EMPTY_BOARD_CODE,
  JOBS_RSS_URL,
  SOURCE,
  createWealthyScraper,
  extractJobsFromOfficialBoard,
  hasOfficialCareersSignal,
  hasOfficialZohoBoardSignal,
  hasRemovedRssSignal,
  run,
} from '../../scraper/wealthy/script.js'

const FIXED_SCRAPED_AT = '2026-07-25T12:00:00.000Z'

const htmlAttributeJson = (value) => JSON.stringify(value).replace(/"/g, '&quot;')

const verifiedCareersHtml = `
  <main>
    <h1>Solving an India-sized problem</h1>
    <section>
      <h2>Job Openings</h2>
      <link
        href="https://css.zohostatic.in/recruit/embed_careers_site/css/v1.0/embed_jobs.css"
        rel="stylesheet"
      />
      <div id="rec_job_listing_div"></div>
      <script src="https://js.zohostatic.in/recruit/embed_careers_site/javascript/v1.0/embed_jobs.js"></script>
      <button>View all jobs</button>
    </section>
    <section>
      <p>For business and hiring queries write to:</p>
      <p>${CONTACT_EMAIL}</p>
    </section>
    <section>
      <h2>Office Address</h2>
      <p>3rd Floor, Block B, No. 55/10, Harlukunte Village Sector 2 HSR Layout, Bengaluru, Karnataka 560102</p>
    </section>
  </main>
`

const pageJson = {
  detail: {
    section: {
      data: [
        {
          blocktype: 'jobs',
          title: 'Join us',
          subtitle: 'Current Openings',
        },
      ],
    },
  },
}

const moduleMeta = [
  {
    api_name: 'Job_Openings',
    fields: [
      { id: '54947000000003081', api_name: 'Job_Opening_Name' },
      { id: '54947000000003067', api_name: 'Job_Type' },
      { id: '54947000000003107', api_name: 'Industry' },
      { id: '54947000000003125', api_name: 'Work_Experience' },
      { id: '54947000000003127', api_name: 'Salary' },
      { id: '54947000000003101', api_name: 'City' },
      { id: '54947000000003103', api_name: 'State' },
      { id: '54947000000003105', api_name: 'Country' },
      { id: '54947000000003091', api_name: 'Date_Opened' },
      { id: '54947000000003143', api_name: 'Job_Description' },
    ],
  },
]

const buildBoardHtml = ({ jobsPayload, metaOverrides = {} }) => {
  const meta = {
    list_url: BOARD_URL,
    page_name: 'Careers',
    _no_longer: EMPTY_BOARD_CODE,
    ...metaOverrides,
  }

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Jobs at Wealthy</title>
      </head>
      <body>
        <input type="hidden" id="pageJson" value="${htmlAttributeJson(pageJson)}">
        <input type="hidden" id="moduleMeta" value="${htmlAttributeJson(moduleMeta)}">
        <input type="hidden" id="jobs" value="${htmlAttributeJson(jobsPayload)}">
        <input type="hidden" id="meta" value="${htmlAttributeJson(meta)}">
        <div id="career-website-main"></div>
      </body>
    </html>
  `
}

test('Wealthy returns [] when the official handoff reaches the known Zoho empty-board signals', async () => {
  assert.equal(SOURCE, 'wealthy')
  assert.equal(COMPANY, 'Wealthy')
  assert.equal(COMPANY_DOMAIN, 'wealthy.in')
  assert.equal(ATS_PLATFORM, 'zoho-recruit-public-board')
  assert.equal(CAREERS_URL, 'https://www.wealthy.in/careers')
  assert.equal(BOARD_URL, 'https://wealthy.zohorecruit.in/jobs/Careers')
  assert.equal(JOBS_RSS_URL, 'https://wealthy.zohorecruit.in/jobs/Careers/rss')
  assert.equal(hasOfficialCareersSignal(verifiedCareersHtml), true)

  const emptyBoardHtml = buildBoardHtml({ jobsPayload: [] })
  assert.equal(hasOfficialZohoBoardSignal(emptyBoardHtml), true)
  assert.equal(hasRemovedRssSignal('Oops! It seems that the joblist has been removed.'), true)

  const requestedUrls = []
  const jobs = await createWealthyScraper().run({
    fetchHtml: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return verifiedCareersHtml
      if (url === BOARD_URL) return emptyBoardHtml
      if (url === JOBS_RSS_URL) return 'Oops! It seems that the joblist has been removed.'
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, BOARD_URL, JOBS_RSS_URL])
  assert.deepEqual(jobs, [])
  assert.deepEqual(
    await run({
      fetchHtml: async (url) => {
        if (url === CAREERS_URL) return verifiedCareersHtml
        if (url === BOARD_URL) return emptyBoardHtml
        if (url === JOBS_RSS_URL) return 'Oops! It seems that the joblist has been removed.'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    [],
  )
})

test('Wealthy emits normalized jobs when the verified Zoho board publishes them', async () => {
  const publishedBoardHtml = buildBoardHtml({
    jobsPayload: [
      {
        id: '54947000000999999',
        '54947000000003081': 'Senior Product Manager',
        '54947000000003067': 'Full Time',
        '54947000000003107': 'Product',
        '54947000000003125': '6-8 years',
        '54947000000003127': '40-55 LPA',
        '54947000000003101': 'Bengaluru',
        '54947000000003103': 'Karnataka',
        '54947000000003105': 'India',
        '54947000000003091': '2026-07-20',
        '54947000000003143': '<div>Own growth and retention for advisor workflows.</div>',
        Remote_Job: true,
      },
    ],
    metaOverrides: {
      _no_longer: null,
    },
  })

  assert.equal(extractJobsFromOfficialBoard(publishedBoardHtml).length, 1)

  const jobs = await createWealthyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchHtml: async (url) => {
      if (url === CAREERS_URL) return verifiedCareersHtml
      if (url === BOARD_URL) return publishedBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior Product Manager',
      jobId: 'wealthy-54947000000999999',
      requisitionId: '54947000000999999',
      department: 'Product',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      sourceUrl: 'https://wealthy.zohorecruit.in/jobs/Careers/54947000000999999/senior-product-manager?source=CareerSite',
      applyUrl: 'https://wealthy.zohorecruit.in/jobs/Careers/54947000000999999/senior-product-manager?source=CareerSite',
      employmentType: 'Full Time',
      workplaceType: 'Remote',
      experienceRequired: '6-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: '40-55 LPA',
      postingDate: '2026-07-20',
      closingDate: null,
      jobDescription: 'Own growth and retention for advisor workflows.',
      companyCareerPage: CAREERS_URL,
      company: COMPANY,
      source: SOURCE,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
      link: 'https://wealthy.zohorecruit.in/jobs/Careers/54947000000999999/senior-product-manager?source=CareerSite',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Wealthy throws when the verified first-party careers contract drifts', async () => {
  await assert.rejects(
    createWealthyScraper().run({
      fetchHtml: async (url) => {
        if (url === CAREERS_URL) {
          return verifiedCareersHtml.replace(CONTACT_EMAIL, 'careers@wealthy.in')
        }
        if (url === BOARD_URL) return buildBoardHtml({ jobsPayload: [] })
        if (url === JOBS_RSS_URL) return 'Oops! It seems that the joblist has been removed.'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Wealthy careers handoff/i,
  )
})

test('Wealthy throws when the verified empty-board signals disappear while no jobs are published', async () => {
  await assert.rejects(
    createWealthyScraper().run({
      fetchHtml: async (url) => {
        if (url === CAREERS_URL) return verifiedCareersHtml
        if (url === BOARD_URL) {
          return buildBoardHtml({
            jobsPayload: [],
            metaOverrides: {
              _no_longer: null,
            },
          })
        }
        if (url === JOBS_RSS_URL) return '<rss><channel><title>Wealthy Careers</title></channel></rss>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /empty-board contract changed/i,
  )
})
