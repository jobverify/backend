import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const loadZeeModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const OFFICIAL_ABOUT_HTML = `
  <html>
    <body>
      <h1>A global content and technology powerhouse.</h1>
      <p>With a visionary team and cutting-edge technology, we are constantly pushing boundaries to create and deliver meaningful content that connects with audiences everywhere.</p>
      <h2>At the forefront of innovation</h2>
      <p>Our advanced technological expertise combined with deep consumer insights powers innovative solutions that enable us to stay ahead of the curve.</p>
      <h3>Corporate and Registered Office</h3>
      <p>18th Floor, A - Wing, Marathon Futurex, NM Joshi Marg, Lower Parel, Mumbai - 400013</p>
      <p>© Zee Entertainment Enterprises Limited</p>
    </body>
  </html>
`

const OFFICIAL_CAREERS_HTML = `
  <html>
    <body>
      <h1>Careers</h1>
      <h2>Being the sky to a thousand stars</h2>
      <p>Many a shooting star has taken off in the firmament of 'Z'.</p>
      <a href="https://zee.sensehq.com/careers">Explore Jobs</a>
      <h3>Search by Function</h3>
      <p>Content &amp; International Markets Corporate Reputation Management Digital Businesses &amp; Platforms</p>
      <h3>Search by Location</h3>
      <p>Mumbai Noida Kochi Bangalore Kolkata Hyderabad Bhubaneshwar Chennai Jaipur</p>
      <p>© Zee Entertainment Enterprises Limited</p>
    </body>
  </html>
`

const LISTING_PAGE_1_DATA = {
  props: {
    pageProps: {
      jobsData: {
        rows: [
          {
            id: 2001,
            created_on: Date.parse('2026-06-12T00:00:00.000Z'),
            job_status: 'OPEN',
            department: 'Zee Entertainment Enterprises Limited - Technology - Engineering - Data - Data Science',
            title: 'Associate Data Scientist',
            location: 'Bangalore',
            experience_start: 1,
            experience_end: 3,
            description_external: '<p><strong>Skills :</strong> Python, SQL, Machine Learning</p><p>Build recommendation models for digital products.</p>',
            job_type: 'FULLTIME',
            code: 'ZEE-ADS-01',
            office: {
              city: 'Bangalore',
              country: 'India',
              location: 'Bangalore',
              name: 'Bangalore',
              state: 'Karnataka',
              pin_code: '560001',
            },
          },
          {
            id: 2002,
            created_on: Date.parse('2026-06-12T00:00:00.000Z'),
            job_status: 'OPEN',
            department: 'Zee Entertainment Enterprises Limited - International',
            title: 'International Producer',
            location: 'London',
            experience_start: 4,
            experience_end: 6,
            description_external: '<p><strong>Skills :</strong> Editorial, Production</p><p>Lead UK content operations.</p>',
            job_type: 'FULLTIME',
            code: 'ZEE-UK-01',
            office: {
              city: 'London',
              country: 'United Kingdom',
              location: 'London',
              name: 'London',
              state: 'England',
              pin_code: 'SW1A',
            },
          },
          {
            id: 2003,
            created_on: Date.parse('2026-06-12T00:00:00.000Z'),
            job_status: 'CLOSED',
            department: 'Zee Entertainment Enterprises Limited - Revenue',
            title: 'Closed Role',
            location: 'Mumbai',
            experience_start: 2,
            experience_end: 4,
            description_external: '<p>Closed role.</p>',
            job_type: 'FULLTIME',
            code: 'ZEE-CLS-01',
            office: {
              city: 'Mumbai',
              country: 'India',
              location: 'Mumbai',
              name: 'Mumbai',
              state: 'Maharashtra',
              pin_code: '400013',
            },
          },
        ],
        count: 4,
      },
    },
  },
  page: '/jobs',
  query: {},
  buildId: 'zee-build',
  assetPrefix: '/careers',
  isFallback: false,
  gssp: true,
  customServer: true,
}

const LISTING_PAGE_2_DATA = {
  props: {
    pageProps: {
      jobsData: {
        rows: [
          {
            id: 2004,
            created_on: Date.parse('2026-06-13T00:00:00.000Z'),
            job_status: 'OPEN',
            department: 'Zee Entertainment Enterprises Limited - Revenue - Sales Planning & Strategy',
            title: 'Senior Manager - Revenue Analytics',
            location: 'Noida',
            experience_start: 5,
            experience_end: 8,
            description_external: '<div><b>Skills :</b> SQL, Forecasting, Tableau</div><div>Drive revenue reporting and pricing analytics.</div>',
            job_type: 'FULLTIME',
            code: 'ZEE-REV-02',
            office: {
              city: 'Noida',
              country: 'India',
              location: 'Noida',
              name: 'Noida',
              state: 'Uttar Pradesh',
              pin_code: '201301',
            },
          },
        ],
        count: 4,
      },
    },
  },
  page: '/jobs',
  query: { page: '2' },
  buildId: 'zee-build',
  assetPrefix: '/careers',
  isFallback: false,
  gssp: true,
  customServer: true,
}

const toListingHtml = (payload) =>
  `<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></body></html>`

const LISTING_PAGE_1_HTML = toListingHtml(LISTING_PAGE_1_DATA)
const LISTING_PAGE_2_HTML = toListingHtml(LISTING_PAGE_2_DATA)

test('Zee helpers stay pinned to the verified official careers handoff and the public SenseHQ routes', async () => {
  const zee = await loadZeeModule()
  assert.ok(zee, 'Expected Zee Entertainment Enterprises scraper module at ./script.js')

  assert.equal(zee.SOURCE, 'zeeentertainmententerprises')
  assert.equal(zee.COMPANY, 'Zee Entertainment Enterprises Limited')
  assert.equal(zee.ABOUT_URL, 'https://www.zee.com/about-us/')
  assert.equal(zee.CAREERS_URL, 'https://www.zee.com/careers/')
  assert.equal(zee.API_BASE_URL, 'https://zee.sensehq.com/careers')
  assert.equal(zee.hasOfficialAboutPageSignal(OFFICIAL_ABOUT_HTML), true)
  assert.equal(zee.hasOfficialCareersPageSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(zee.extractSenseHqCareersUrl(OFFICIAL_CAREERS_HTML), zee.API_BASE_URL)
  assert.equal(zee.buildListingUrl(), 'https://zee.sensehq.com/careers/jobs')
  assert.equal(zee.buildListingUrl({ page: 2 }), 'https://zee.sensehq.com/careers/jobs?page=2')
  assert.equal(zee.buildJobUrl(2001), 'https://zee.sensehq.com/careers/jobs/2001')
})

test('extractSearchResults keeps only open India jobs from the Zee SenseHQ listings pages', async () => {
  const zee = await loadZeeModule()
  assert.ok(zee, 'Expected Zee Entertainment Enterprises scraper module at ./script.js')

  const jobs = zee.extractSearchResults(LISTING_PAGE_1_HTML)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Associate Data Scientist',
    company: 'Zee Entertainment Enterprises Limited',
    department: 'Zee Entertainment Enterprises Limited - Technology - Engineering - Data - Data Science',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '2001',
    requisitionId: 'ZEE-ADS-01',
    sourceUrl: 'https://zee.sensehq.com/careers/jobs/2001',
    applyUrl: 'https://zee.sensehq.com/careers/jobs/2001',
    employmentType: 'Full-time',
    experienceRequired: '1-3 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Python',
      'SQL',
      'Machine Learning',
    ],
    postingDate: '2026-06-12',
    closingDate: null,
    jobDescription: 'Skills : Python, SQL, Machine Learning Build recommendation models for digital products.',
    publicExperienceChecked: true,
  })

  assert.deepEqual(zee.extractPaginationSummary(LISTING_PAGE_1_HTML), {
    currentPage: 1,
    pageSize: 3,
    totalCount: 4,
    totalPages: 2,
    hasNext: true,
  })
})

test('run verifies current corporate and native role identities and decorates shared runner fields', async () => {
  const zee = await loadZeeModule()
  assert.ok(zee, 'Expected Zee Entertainment Enterprises scraper module at ./script.js')

  const requests = []
  const native = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)))
  const encode = data => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
  const jobs = await zee.createZeeEntertainmentEnterprisesScraper().run({
    now: () => '2026-10-21T00:00:00.000Z',
    fetchText: async (url) => {
      requests.push(url)

      if (url === zee.ABOUT_URL) return OFFICIAL_ABOUT_HTML
      if (url === zee.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === zee.buildListingUrl()) return encode(native('native-listing'))
      if (url === zee.buildJobUrl('5831')) return encode(native('native-detail'))

      throw new Error(`Unexpected Zee URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    zee.ABOUT_URL,
    zee.CAREERS_URL,
    zee.buildListingUrl(),
    zee.buildListingUrl(),
    zee.buildJobUrl('5831'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'zeeentertainmententerprises')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].title, 'SDE-III')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.match(jobs[0].jobDescription, /Swift/)
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})
