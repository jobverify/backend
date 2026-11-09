import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-10T00:00:00.000Z'

const loadSquareyardsModule = async () => {
  try {
    return await import('../../scraper/squareyards/script.js')
  } catch {
    assert.fail('Expected Squareyards scraper module at ../../scraper/squareyards/script.js')
  }
}

const salesPayload = [
  {
    id: 'sqy-tech-001',
    title: 'Senior Software Engineer',
    location: 'Bangalore East',
    department: 'Technology',
    experience: '4-7 years',
    job_type: 'Full Time',
    description: `
      <div>
        <p>Build customer-facing platform workflows.</p>
        <ul>
          <li>Node.js</li>
          <li>Distributed systems</li>
        </ul>
      </div>
    `,
    posted_on: '2026-07-08',
  },
  {
    id: 'sqy-sales-002',
    title: 'Assistant Manager - Sales',
    location: 'Gurugram',
    department: 'Sales',
    experience: '2-5 years',
    job_type: 'Full Time',
    description: '<p>Drive residential demand generation across priority projects.</p>',
    posted_on: '2026-07-09',
  },
]

const technologyPayload = [
  {
    id: 'sqy-tech-001',
    title: 'Senior Software Engineer',
    location: 'Bangalore East',
    department: 'Technology',
    experience: '4-7 years',
    job_type: 'Full Time',
    description: `
      <div>
        <p>Build customer-facing platform workflows.</p>
        <ul>
          <li>Node.js</li>
          <li>Distributed systems</li>
        </ul>
      </div>
    `,
    posted_on: '2026-07-08',
  },
  {
    id: 'sqy-hr-003',
    title: 'Talent Acquisition Specialist',
    location: 'Noida',
    department: 'Human Resources',
    experience: '3-6 years',
    job_type: 'Full Time',
    description: `
      <div>
        <p>Manage hiring operations for corporate functions.</p>
        <ul>
          <li>Stakeholder management</li>
        </ul>
      </div>
    `,
    posted_on: '2026-07-07',
  },
]

const humanResourcesPayload = [
  {
    id: 'sqy-hr-003',
    title: 'Talent Acquisition Specialist',
    location: 'Noida',
    department: 'Human Resources',
    experience: '3-6 years',
    job_type: 'Full Time',
    description: `
      <div>
        <p>Manage hiring operations for corporate functions.</p>
        <ul>
          <li>Stakeholder management</li>
        </ul>
      </div>
    `,
    posted_on: '2026-07-07',
  },
]

const customerRelationsPayload = []
const interiorCompanyPayload = []

test('Squareyards scraper uses the verified public department surfaces and derives first-party apply URLs from embedded job data', async () => {
  const squareyards = await loadSquareyardsModule()

  assert.equal(squareyards.CAREERS_URL, 'https://www.squareyards.com/career')
  assert.deepEqual(squareyards.DEPARTMENT_PATHS, [
    'Sales',
    'Technology',
    'Human_Resources',
    'Customer_Relations',
    'Interior_Company',
  ])
  assert.deepEqual(squareyards.buildDepartmentUrls(), [
    'https://www.squareyards.com/career/Sales',
    'https://www.squareyards.com/career/Technology',
    'https://www.squareyards.com/career/Human_Resources',
    'https://www.squareyards.com/career/Customer_Relations',
    'https://www.squareyards.com/career/Interior_Company',
  ])

  assert.deepEqual(squareyards.extractListings(technologyPayload), [
    {
      title: 'Senior Software Engineer',
      company: 'Squareyards',
      department: 'Technology',
      location: 'Bangalore East',
      city: 'Bangalore East',
      country: 'India',
      jobId: 'sqy-tech-001',
      requisitionId: 'sqy-tech-001',
      sourceUrl: 'https://www.squareyards.com/career/Technology',
      applyUrl: 'https://www.squareyards.com/career_form/sqy-tech-001?location=Bangalore_East&dept=Technology',
      employmentType: 'Full Time',
      experienceRequired: '4-7 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Node.js',
        'Distributed systems',
      ],
      postingDate: '2026-07-08',
      closingDate: null,
      jobDescription: 'Build customer-facing platform workflows. Node.js Distributed systems',
    },
    {
      title: 'Talent Acquisition Specialist',
      company: 'Squareyards',
      department: 'Human Resources',
      location: 'Noida',
      city: 'Noida',
      country: 'India',
      jobId: 'sqy-hr-003',
      requisitionId: 'sqy-hr-003',
      sourceUrl: 'https://www.squareyards.com/career/Human_Resources',
      applyUrl: 'https://www.squareyards.com/career_form/sqy-hr-003?location=Noida&dept=Human_Resources',
      employmentType: 'Full Time',
      experienceRequired: '3-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Stakeholder management',
      ],
      postingDate: '2026-07-07',
      closingDate: null,
      jobDescription: 'Manage hiring operations for corporate functions. Stakeholder management',
    },
  ])

  const requestedUrls = []
  const jobs = await squareyards.createSquareyardsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchDepartmentListings: async (url) => {
      requestedUrls.push(url)

      if (url === 'https://www.squareyards.com/career/Sales') return salesPayload
      if (url === 'https://www.squareyards.com/career/Technology') return technologyPayload
      if (url === 'https://www.squareyards.com/career/Human_Resources') return humanResourcesPayload
      if (url === 'https://www.squareyards.com/career/Customer_Relations') return customerRelationsPayload
      if (url === 'https://www.squareyards.com/career/Interior_Company') return interiorCompanyPayload

      throw new Error(`Unexpected Squareyards department URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.squareyards.com/career/Sales',
    'https://www.squareyards.com/career/Technology',
    'https://www.squareyards.com/career/Human_Resources',
    'https://www.squareyards.com/career/Customer_Relations',
    'https://www.squareyards.com/career/Interior_Company',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map(({ jobId, applyUrl, sourceUrl, source, link, scrapedAt }) => ({
      jobId,
      applyUrl,
      sourceUrl,
      source,
      link,
      scrapedAt,
    })),
    [
      {
        jobId: 'sqy-tech-001',
        applyUrl: 'https://www.squareyards.com/career_form/sqy-tech-001?location=Bangalore_East&dept=Technology',
        sourceUrl: 'https://www.squareyards.com/career/Sales',
        source: 'squareyards',
        link: 'https://www.squareyards.com/career_form/sqy-tech-001?location=Bangalore_East&dept=Technology',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: 'sqy-sales-002',
        applyUrl: 'https://www.squareyards.com/career_form/sqy-sales-002?location=Gurugram&dept=Sales',
        sourceUrl: 'https://www.squareyards.com/career/Sales',
        source: 'squareyards',
        link: 'https://www.squareyards.com/career_form/sqy-sales-002?location=Gurugram&dept=Sales',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: 'sqy-hr-003',
        applyUrl: 'https://www.squareyards.com/career_form/sqy-hr-003?location=Noida&dept=Human_Resources',
        sourceUrl: 'https://www.squareyards.com/career/Technology',
        source: 'squareyards',
        link: 'https://www.squareyards.com/career_form/sqy-hr-003?location=Noida&dept=Human_Resources',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Squareyards default department fetch is bounded by a timeout signal', async () => {
  const squareyards = await loadSquareyardsModule()
  let capturedInit = null

  const payload = await squareyards.defaultFetchDepartmentListings(
    'https://www.squareyards.com/career/Technology',
    {
      timeoutMs: 25,
      fetchImpl: async (url, init) => {
        capturedInit = init

        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(technologyPayload),
        }
      },
    },
  )

  assert.deepEqual(payload, technologyPayload)
  assert.equal(capturedInit.Referer, undefined)
  assert.equal(capturedInit.headers.Referer, squareyards.CAREERS_URL)
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})
