import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  JOBS_URL,
  JOB_BOARD_SLUG,
  SOURCE,
  createRsaSecurityApplicationsScraper,
  extractIndiaListingsFromBoardPage,
  extractJobDetail,
  extractVerifiedJobBoardUrl,
  hasVerifiedCareersPageSignal,
} from './script.js'

const INDIA_LISTINGS_PAGE_0 = [
  {
    id: '6137bd3e-638a-417f-b2e9-3511090f7ae9',
    name: 'Administrative Assistant 1 ',
    department: { name: 'Facilities' },
    locations: [
      {
        name: 'Bangalore, India',
        country: 'India',
        countryCode: 'IN',
        state: 'Karnataka',
        stateCode: 'KA',
        city: 'Bangalore',
        workplaceType: 'ON_SITE',
      },
    ],
    url: 'https://ats.rippling.com/rsa-security/jobs/6137bd3e-638a-417f-b2e9-3511090f7ae9',
  },
  {
    id: '1ee9a517-a81c-447b-8cfb-9fc47b927012',
    name: 'Intern- Human Resources ',
    department: { name: 'Human Resources' },
    locations: [
      {
        name: 'Bangalore, India',
        country: 'India',
        countryCode: 'IN',
        state: 'Karnataka',
        stateCode: 'KA',
        city: 'Bangalore',
        workplaceType: 'ON_SITE',
      },
    ],
    url: 'https://ats.rippling.com/rsa-security/jobs/1ee9a517-a81c-447b-8cfb-9fc47b927012',
  },
  {
    id: '34b0cffe-ff29-4f02-b23d-ad162344f9cf',
    name: 'Senior Analyst - HR Generalist ',
    department: { name: 'Human Resources' },
    locations: [
      {
        name: 'Bangalore, India',
        country: 'India',
        countryCode: 'IN',
        state: 'Karnataka',
        stateCode: 'KA',
        city: 'Bangalore',
        workplaceType: 'ON_SITE',
      },
    ],
    url: 'https://ats.rippling.com/rsa-security/jobs/34b0cffe-ff29-4f02-b23d-ad162344f9cf',
  },
  {
    id: '321c8b5a-3e3d-420d-bb59-3d4a1999495f',
    name: 'Solutions Principal',
    department: { name: 'PS' },
    locations: [
      {
        name: 'India',
        country: 'India',
        countryCode: 'IN',
        state: null,
        stateCode: null,
        city: null,
        workplaceType: 'REMOTE',
      },
    ],
    url: 'https://ats.rippling.com/rsa-security/jobs/321c8b5a-3e3d-420d-bb59-3d4a1999495f',
  },
]

const INDIA_LISTINGS_PAGE_1 = [
  {
    id: 'af677e37-1fe6-4785-aabb-f8c4d782ffb5',
    name: 'Software Engineer - Apprentice',
    department: { name: 'Product R&D' },
    locations: [
      {
        name: 'Bangalore, India',
        country: 'India',
        countryCode: 'IN',
        state: 'Karnataka',
        stateCode: 'KA',
        city: 'Bangalore',
        workplaceType: 'ON_SITE',
      },
    ],
    url: 'https://ats.rippling.com/rsa-security/jobs/af677e37-1fe6-4785-aabb-f8c4d782ffb5',
  },
  {
    id: '33bf39af-9f08-4374-8496-c8393f52881d',
    name: 'Software Principal Engineer ',
    department: { name: 'Product R&D' },
    locations: [
      {
        name: 'Bangalore, India',
        country: 'India',
        countryCode: 'IN',
        state: 'Karnataka',
        stateCode: 'KA',
        city: 'Bangalore',
        workplaceType: 'ON_SITE',
      },
    ],
    url: 'https://ats.rippling.com/rsa-security/jobs/33bf39af-9f08-4374-8496-c8393f52881d',
  },
]

const NON_INDIA_PAGE_0 = [
  {
    id: 'c16eefd9-b97d-4997-9c4c-425384a01354',
    name: 'Customer Success Manager',
    department: { name: 'Customer Support' },
    locations: [
      {
        name: 'Remote (United States)',
        country: 'United States',
        countryCode: 'US',
        state: null,
        stateCode: null,
        city: null,
        workplaceType: 'REMOTE',
      },
    ],
    url: 'https://ats.rippling.com/rsa-security/jobs/c16eefd9-b97d-4997-9c4c-425384a01354',
  },
]

const NON_INDIA_PAGE_1 = [
  {
    id: 'b290cc51-2821-4a29-9a29-24b4c2e15458',
    name: 'Training Administrator',
    department: { name: 'PS' },
    locations: [
      {
        name: 'Cairo, Egypt',
        country: 'Egypt',
        countryCode: 'EG',
        state: 'Al Qāhirah',
        stateCode: 'C',
        city: 'Cairo',
        workplaceType: 'ON_SITE',
      },
    ],
    url: 'https://ats.rippling.com/rsa-security/jobs/b290cc51-2821-4a29-9a29-24b4c2e15458',
  },
]

const DETAIL_FIXTURES = {
  '6137bd3e-638a-417f-b2e9-3511090f7ae9': {
    title: 'Administrative Assistant 1 ',
    location: 'Bangalore, India',
    departmentName: 'Fac Banglr',
    baseDepartment: 'Facilities',
    employmentTypeId: 'Regular, Full Time Salaried - Global',
    createdOn: '2026-03-16T01:16:21.948000-07:00',
    roleHtml: `
      <p><strong>Role Summary</strong></p>
      <p>The Administrative Assistant supports the Center of Excellence.</p>
      <p><strong>Required Qualifications &amp; Skills</strong></p>
      <ul>
        <li>Bachelor's degree or equivalent experience</li>
        <li>2-5 years of experience in an administrative or coordination role</li>
        <li>Strong organizational and time-management skills</li>
      </ul>
    `,
  },
  '1ee9a517-a81c-447b-8cfb-9fc47b927012': {
    title: 'Intern- Human Resources ',
    location: 'Bangalore, India',
    departmentName: 'HR Bangalore',
    baseDepartment: 'Human Resources',
    employmentTypeId: 'Intern',
    createdOn: '2026-06-25T08:10:00.000000-07:00',
    roleHtml: `
      <p>Human Resources internship supporting employee programs.</p>
      <ul>
        <li>Strong communication skills</li>
      </ul>
    `,
  },
  '34b0cffe-ff29-4f02-b23d-ad162344f9cf': {
    title: 'Senior Analyst - HR Generalist ',
    location: 'Bangalore, India',
    departmentName: 'HR Bangalore',
    baseDepartment: 'Human Resources',
    employmentTypeId: 'Regular, Full Time Salaried - Global',
    createdOn: '2026-06-30T08:10:00.000000-07:00',
    roleHtml: `
      <p>HR generalist role for Bangalore operations.</p>
      <ul>
        <li>5+ years HR experience</li>
      </ul>
    `,
  },
  '321c8b5a-3e3d-420d-bb59-3d4a1999495f': {
    title: 'Solutions Principal',
    location: 'India',
    departmentName: 'PS Delivery',
    baseDepartment: 'PS',
    employmentTypeId: 'Regular, Full Time Salaried - Global',
    createdOn: '2026-07-10T08:27:16.569000-07:00',
    roleHtml: `
      <p><strong>Principal Responsibilities:</strong></p>
      <ul>
        <li>Drive Professional Services bookings and attach rate.</li>
        <li>Lead discovery workshops and solution reviews.</li>
      </ul>
      <p><strong>Qualifications</strong></p>
      <ul>
        <li>10+ years of experience in IAM, IGA, cybersecurity consulting or professional services.</li>
        <li>Strong expertise in Identity Governance and MFA.</li>
      </ul>
    `,
  },
  'af677e37-1fe6-4785-aabb-f8c4d782ffb5': {
    title: 'Software Engineer - Apprentice',
    location: 'Bangalore, India',
    departmentName: 'Product R&D',
    baseDepartment: 'Product R&D',
    employmentTypeId: 'Apprentice',
    createdOn: '2026-07-11T09:00:00.000000-07:00',
    roleHtml: `
      <p>Apprentice role for Bangalore engineering.</p>
      <ul>
        <li>Computer science fundamentals</li>
      </ul>
    `,
  },
  '33bf39af-9f08-4374-8496-c8393f52881d': {
    title: 'Software Principal Engineer ',
    location: 'Bangalore, India',
    departmentName: 'Product R&D',
    baseDepartment: 'Product R&D',
    employmentTypeId: 'Regular, Full Time Salaried - Global',
    createdOn: '2026-07-12T09:00:00.000000-07:00',
    roleHtml: `
      <p>Lead principal engineering work in Bangalore.</p>
      <ul>
        <li>12+ years building secure distributed systems</li>
      </ul>
    `,
  },
}

const careersHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>RSA Careers: Join the Identity Security Leader Today</title>
    </head>
    <body>
      <main>
        <section>
          <h2>Our Culture</h2>
          <p>Rewards, Benefits, and Growth</p>
          <p>RSA Values</p>
        </section>
        <section>
          <h1>Join RSA to build your career</h1>
          <p>and secure the most secure.</p>
        </section>
        <a href="https://ats.rippling.com/rsa-security/jobs">Explore</a>
        <a href="https://ats.rippling.com/rsa-security/jobs">Explore open roles</a>
      </main>
    </body>
  </html>
`

const buildBoardHtml = ({ page, items, totalPages = 2, slug = JOB_BOARD_SLUG, companyName = 'RSA Security' }) => `
  <!doctype html>
  <html>
    <head>
      <title>RSA Career Opportunities | RSA Security</title>
    </head>
    <body>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            apiData: {
              jobBoard: {
                boardType: 'RIPPLING',
                slug,
                title: 'RSA Career Opportunities',
                boardURL: JOBS_URL,
                companyName,
              },
              jobBoardSlug: slug,
            },
            dehydratedState: {
              queries: [
                {
                  state: {
                    data: {
                      items,
                      page,
                      pageSize: 20,
                      totalItems: 36,
                      totalPages,
                    },
                  },
                  queryKey: ['board', slug, 'job-posts', false, {
                    searchQuery: '',
                    departments: [],
                    workplaceType: null,
                    country: '',
                    state: '',
                    city: '',
                    page,
                    pageSize: 20,
                  }],
                },
              ],
            },
          },
        },
        page: '/[jobBoardSlug]/jobs',
        query: { jobBoardSlug: slug, ...(page > 0 ? { page: String(page) } : {}) },
      })}</script>
    </body>
  </html>
`

const buildDetailHtml = (
  jobId,
  {
    title,
    location,
    departmentName,
    baseDepartment,
    employmentTypeId,
    createdOn,
    roleHtml,
  },
  overrides = {},
) => `
  <!doctype html>
  <html>
    <head>
      <title>${title}</title>
    </head>
    <body>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            apiData: {
              jobBoard: {
                slug: overrides.boardSlug ?? JOB_BOARD_SLUG,
                title: 'RSA Career Opportunities',
                boardURL: JOBS_URL,
                companyName: overrides.boardCompanyName ?? 'RSA Security',
              },
              jobPost: {
                id: jobId,
                uuid: jobId,
                name: overrides.jobName ?? title,
                companyName: overrides.jobCompanyName ?? 'RSA Security',
                description: {
                  company: '<p>RSA is a global leader in identity security.</p>',
                  role: roleHtml,
                },
                workLocations: [location],
                department: {
                  name: departmentName,
                  base_department: baseDepartment,
                },
                employmentType: {
                  id: employmentTypeId,
                  label: null,
                },
                createdOn,
                url: `${JOBS_URL}/${jobId}`,
                board: {
                  slug: overrides.boardSlug ?? JOB_BOARD_SLUG,
                },
              },
            },
          },
        },
        page: '/[jobBoardSlug]/jobs/[jobId]',
        query: {
          jobBoardSlug: JOB_BOARD_SLUG,
          jobId,
        },
      })}</script>
    </body>
  </html>
`

const boardPage0Html = buildBoardHtml({
  page: 0,
  items: [...NON_INDIA_PAGE_0, ...INDIA_LISTINGS_PAGE_0],
})

const boardPage1Html = buildBoardHtml({
  page: 1,
  items: [...NON_INDIA_PAGE_1, ...INDIA_LISTINGS_PAGE_1],
})

test('RSA Security Applications scraper validates the official careers page and Rippling board surfaces', () => {
  assert.equal(SOURCE, 'rsasecurityapplications')
  assert.equal(COMPANY, 'RSA Security Applications')
  assert.equal(CAREERS_URL, 'https://www.rsa.com/rsa-careers/')
  assert.equal(JOBS_URL, 'https://ats.rippling.com/rsa-security/jobs')
  assert.equal(JOB_BOARD_SLUG, 'rsa-security')
  assert.equal(hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(extractVerifiedJobBoardUrl(careersHtml), JOBS_URL)

  assert.deepEqual(extractIndiaListingsFromBoardPage(boardPage0Html), {
    page: 0,
    totalPages: 2,
    listings: [
      {
        title: 'Administrative Assistant 1',
        jobId: '6137bd3e-638a-417f-b2e9-3511090f7ae9',
        requisitionId: '6137bd3e-638a-417f-b2e9-3511090f7ae9',
        department: 'Facilities',
        location: 'Bangalore, India',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        workplaceType: 'ON_SITE',
        sourceUrl: 'https://ats.rippling.com/rsa-security/jobs/6137bd3e-638a-417f-b2e9-3511090f7ae9',
      },
      {
        title: 'Intern- Human Resources',
        jobId: '1ee9a517-a81c-447b-8cfb-9fc47b927012',
        requisitionId: '1ee9a517-a81c-447b-8cfb-9fc47b927012',
        department: 'Human Resources',
        location: 'Bangalore, India',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        workplaceType: 'ON_SITE',
        sourceUrl: 'https://ats.rippling.com/rsa-security/jobs/1ee9a517-a81c-447b-8cfb-9fc47b927012',
      },
      {
        title: 'Senior Analyst - HR Generalist',
        jobId: '34b0cffe-ff29-4f02-b23d-ad162344f9cf',
        requisitionId: '34b0cffe-ff29-4f02-b23d-ad162344f9cf',
        department: 'Human Resources',
        location: 'Bangalore, India',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        workplaceType: 'ON_SITE',
        sourceUrl: 'https://ats.rippling.com/rsa-security/jobs/34b0cffe-ff29-4f02-b23d-ad162344f9cf',
      },
      {
        title: 'Solutions Principal',
        jobId: '321c8b5a-3e3d-420d-bb59-3d4a1999495f',
        requisitionId: '321c8b5a-3e3d-420d-bb59-3d4a1999495f',
        department: 'PS',
        location: 'India',
        city: null,
        state: null,
        country: 'India',
        workplaceType: 'REMOTE',
        sourceUrl: 'https://ats.rippling.com/rsa-security/jobs/321c8b5a-3e3d-420d-bb59-3d4a1999495f',
      },
    ],
  })

  assert.deepEqual(extractIndiaListingsFromBoardPage(boardPage1Html), {
    page: 1,
    totalPages: 2,
    listings: [
      {
        title: 'Software Engineer - Apprentice',
        jobId: 'af677e37-1fe6-4785-aabb-f8c4d782ffb5',
        requisitionId: 'af677e37-1fe6-4785-aabb-f8c4d782ffb5',
        department: 'Product R&D',
        location: 'Bangalore, India',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        workplaceType: 'ON_SITE',
        sourceUrl: 'https://ats.rippling.com/rsa-security/jobs/af677e37-1fe6-4785-aabb-f8c4d782ffb5',
      },
      {
        title: 'Software Principal Engineer',
        jobId: '33bf39af-9f08-4374-8496-c8393f52881d',
        requisitionId: '33bf39af-9f08-4374-8496-c8393f52881d',
        department: 'Product R&D',
        location: 'Bangalore, India',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        workplaceType: 'ON_SITE',
        sourceUrl: 'https://ats.rippling.com/rsa-security/jobs/33bf39af-9f08-4374-8496-c8393f52881d',
      },
    ],
  })

  assert.deepEqual(
    extractJobDetail(buildDetailHtml('321c8b5a-3e3d-420d-bb59-3d4a1999495f', DETAIL_FIXTURES['321c8b5a-3e3d-420d-bb59-3d4a1999495f'])),
    {
      title: 'Solutions Principal',
      jobId: '321c8b5a-3e3d-420d-bb59-3d4a1999495f',
      requisitionId: '321c8b5a-3e3d-420d-bb59-3d4a1999495f',
      department: 'PS',
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      employmentType: 'Regular, Full Time Salaried - Global',
      experienceRequired: '10+ years',
      jobDescription: 'RSA is a global leader in identity security. Principal Responsibilities: - Drive Professional Services bookings and attach rate. - Lead discovery workshops and solution reviews. Qualifications - 10+ years of experience in IAM, IGA, cybersecurity consulting or professional services. - Strong expertise in Identity Governance and MFA.',
      requiredSkills: [
        'Drive Professional Services bookings and attach rate.',
        'Lead discovery workshops and solution reviews.',
        '10+ years of experience in IAM, IGA, cybersecurity consulting or professional services.',
        'Strong expertise in Identity Governance and MFA.',
      ],
      postingDate: '2026-07-10',
      sourceUrl: 'https://ats.rippling.com/rsa-security/jobs/321c8b5a-3e3d-420d-bb59-3d4a1999495f',
      applyUrl: 'https://ats.rippling.com/rsa-security/jobs/321c8b5a-3e3d-420d-bb59-3d4a1999495f',
    },
  )
})

test('RSA Security Applications scraper paginates the verified board and returns only explicit India jobs', async () => {
  const requestedUrls = []
  const scraper = createRsaSecurityApplicationsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREERS_URL) return careersHtml
      if (url === JOBS_URL) return boardPage0Html
      if (url === `${JOBS_URL}?page=1`) return boardPage1Html

      const detailMatch = /\/jobs\/([0-9a-f-]+)$/i.exec(url)
      if (detailMatch) {
        const fixture = DETAIL_FIXTURES[detailMatch[1]]
        if (fixture) return buildDetailHtml(detailMatch[1], fixture)
      }

      throw new Error(`Unexpected RSA URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    JOBS_URL,
    `${JOBS_URL}?page=1`,
    'https://ats.rippling.com/rsa-security/jobs/6137bd3e-638a-417f-b2e9-3511090f7ae9',
    'https://ats.rippling.com/rsa-security/jobs/1ee9a517-a81c-447b-8cfb-9fc47b927012',
    'https://ats.rippling.com/rsa-security/jobs/34b0cffe-ff29-4f02-b23d-ad162344f9cf',
    'https://ats.rippling.com/rsa-security/jobs/321c8b5a-3e3d-420d-bb59-3d4a1999495f',
    'https://ats.rippling.com/rsa-security/jobs/af677e37-1fe6-4785-aabb-f8c4d782ffb5',
    'https://ats.rippling.com/rsa-security/jobs/33bf39af-9f08-4374-8496-c8393f52881d',
  ])

  assert.equal(jobs.length, 6)
  assert.equal(jobs.every((job) => job.company === COMPANY), true)
  assert.equal(jobs.every((job) => job.country === 'India'), true)
  assert.equal(jobs.every((job) => job.source === SOURCE), true)
  assert.equal(jobs.every((job) => job.link === job.applyUrl), true)
  assert.equal(jobs.every((job) => /\d{4}-\d{2}-\d{2}T/.test(job.scrapedAt)), true)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location]),
    [
      ['Administrative Assistant 1', 'Bangalore, India'],
      ['Intern- Human Resources', 'Bangalore, India'],
      ['Senior Analyst - HR Generalist', 'Bangalore, India'],
      ['Solutions Principal', 'India'],
      ['Software Engineer - Apprentice', 'Bangalore, India'],
      ['Software Principal Engineer', 'Bangalore, India'],
    ],
  )
})

test('RSA Security Applications scraper fails closed when the careers page, listing shell, or detail surface drifts', async () => {
  const scraper = createRsaSecurityApplicationsScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected RSA URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) return careersHtml
        if (url === JOBS_URL) {
          return buildBoardHtml({
            page: 0,
            items: INDIA_LISTINGS_PAGE_0,
            slug: 'someone-else',
          })
        }
        throw new Error(`Unexpected RSA URL: ${url}`)
      },
    }),
    /verified rippling listing shell/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) return careersHtml
        if (url === JOBS_URL) return boardPage0Html
        if (url === `${JOBS_URL}?page=1`) return boardPage1Html
        if (url === 'https://ats.rippling.com/rsa-security/jobs/6137bd3e-638a-417f-b2e9-3511090f7ae9') {
          return buildDetailHtml(
            '6137bd3e-638a-417f-b2e9-3511090f7ae9',
            DETAIL_FIXTURES['6137bd3e-638a-417f-b2e9-3511090f7ae9'],
            { boardSlug: 'other-board' },
          )
        }

        const detailMatch = /\/jobs\/([0-9a-f-]+)$/i.exec(url)
        if (detailMatch && DETAIL_FIXTURES[detailMatch[1]]) {
          return buildDetailHtml(detailMatch[1], DETAIL_FIXTURES[detailMatch[1]])
        }

        throw new Error(`Unexpected RSA URL: ${url}`)
      },
    }),
    /verified rippling job detail/i,
  )
})
