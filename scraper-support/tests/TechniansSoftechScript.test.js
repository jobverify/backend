import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings in Gurgaon, Mumbai - Nians</title>
  </head>
  <body>
    <h1>Current Job Openings in Gurgaon, Mumbai - Nians</h1>
    <div>Technians is now Nians</div>
    <div>Current Job Openings</div>
    <script src="/wp-content/plugins/jobboard/_jb_static/runtime.js"></script>
    <form id="gform_86">
      <input id="input_86_5" />
    </form>
  </body>
</html>
`

const jobsApiPayload = [
  {
    id: 45501,
    date_gmt: '2026-08-07T09:00:00',
    status: 'publish',
    type: 'job',
    link: 'https://nians.com/job/business-head/',
    title: {
      rendered: 'Business Head',
    },
    content: {
      rendered: `
        <p>Lead the business development function across key client accounts.</p>
        <ul>
          <li>Drive growth strategy.</li>
          <li>Own account expansion.</li>
        </ul>
      `,
    },
    _embedded: {
      'wp:term': [
        [
          {
            taxonomy: 'job-type',
            name: 'Business Development',
            slug: 'business-development',
          },
        ],
        [
          {
            taxonomy: 'job-location',
            name: 'Gurugram',
            slug: 'gurugram',
          },
          {
            taxonomy: 'job-location',
            name: 'Mumbai',
            slug: 'mumbai',
          },
        ],
      ],
    },
  },
  {
    id: 45991,
    date_gmt: '2026-08-12T17:18:11',
    status: 'publish',
    type: 'job',
    link: 'https://nians.com/job/content-specialist/',
    title: {
      rendered: 'Content Specialist',
    },
    content: {
      rendered:
        '<p>Create SEO-friendly content &amp; communication assets for digital campaigns.</p>',
    },
    _embedded: {
      'wp:term': [
        [
          {
            taxonomy: 'job-type',
            name: 'Content &amp; Communication',
            slug: 'content-communication',
          },
        ],
        [
          {
            taxonomy: 'job-location',
            name: 'Remote (India)',
            slug: 'remote-india',
          },
        ],
      ],
    },
  },
  {
    id: 50001,
    date_gmt: '2026-08-08T10:30:00',
    status: 'publish',
    type: 'job',
    link: 'https://nians.com/job/account-director-uk/',
    title: {
      rendered: 'Account Director',
    },
    content: {
      rendered: '<p>Lead UK client strategy.</p>',
    },
    _embedded: {
      'wp:term': [
        [
          {
            taxonomy: 'job-type',
            name: 'Account Management',
            slug: 'account-management',
          },
        ],
        [
          {
            taxonomy: 'job-location',
            name: 'London',
            slug: 'london',
          },
        ],
      ],
    },
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/technianssoftech/script.js')
  } catch {
    assert.fail('Expected Technians Softech scraper module at ../../scraper/technianssoftech/script.js')
  }
}

test('Technians Softech helpers stay pinned to the verified Nians jobs archive and public WordPress jobs API', async () => {
  const technians = await loadModule()

  assert.equal(technians.SOURCE, 'technianssoftech')
  assert.equal(technians.COMPANY, 'Technians Softech')
  assert.equal(technians.CAREERS_URL, 'https://nians.com/job/')
  assert.equal(technians.JOBS_API_URL, 'https://nians.com/wp-json/wp/v2/job')
  assert.equal(technians.VERIFIED_ON, '2026-08-14')
  assert.equal(technians.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    technians.buildJobsApiUrl(),
    'https://nians.com/wp-json/wp/v2/job?per_page=100&page=1&_embed=wp%3Aterm',
  )
})

test('Technians Softech run validates the jobs archive and maps public WordPress job posts', async () => {
  const technians = await loadModule()
  const requestedUrls = []

  const jobs = await technians.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, technians.CAREERS_URL)
      return careersHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(
        url,
        'https://nians.com/wp-json/wp/v2/job?per_page=100&page=1&_embed=wp%3Aterm',
      )
      return jobsApiPayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    technians.CAREERS_URL,
    'https://nians.com/wp-json/wp/v2/job?per_page=100&page=1&_embed=wp%3Aterm',
  ])

  assert.deepEqual(
    jobs,
    [
      {
        title: 'Business Head',
        company: 'Technians Softech',
        department: 'Business Development',
        location: 'Gurugram / Mumbai, India',
        city: 'Gurugram / Mumbai',
        country: 'India',
        link: 'https://nians.com/job/business-head/',
        applyUrl: 'https://nians.com/job/business-head/',
        sourceUrl: 'https://nians.com/job/business-head/',
        source: 'technianssoftech',
        jobId: '45501',
        requisitionId: '45501',
        employmentType: null,
        postingDate: '2026-08-07T09:00:00Z',
        closingDate: null,
        jobDescription:
          'Lead the business development function across key client accounts. Drive growth strategy. Own account expansion.',
        remoteStatus: 'On-site',
        companyCareerPage: 'https://nians.com/job/',
        companyDomain: 'nians.com',
        atsPlatform: 'official-company-careers-plus-wordpress-jobs-api',
        scrapedAt: '2026-08-14T00:00:00.000Z',
      },
      {
        title: 'Content Specialist',
        company: 'Technians Softech',
        department: 'Content & Communication',
        location: 'Remote (India)',
        city: null,
        country: 'India',
        link: 'https://nians.com/job/content-specialist/',
        applyUrl: 'https://nians.com/job/content-specialist/',
        sourceUrl: 'https://nians.com/job/content-specialist/',
        source: 'technianssoftech',
        jobId: '45991',
        requisitionId: '45991',
        employmentType: null,
        postingDate: '2026-08-12T17:18:11Z',
        closingDate: null,
        jobDescription:
          'Create SEO-friendly content & communication assets for digital campaigns.',
        remoteStatus: 'Remote',
        companyCareerPage: 'https://nians.com/job/',
        companyDomain: 'nians.com',
        atsPlatform: 'official-company-careers-plus-wordpress-jobs-api',
        scrapedAt: '2026-08-14T00:00:00.000Z',
      },
    ],
  )
})

test('Technians Softech fails closed when the verified jobs archive or API contract changes', async () => {
  const technians = await loadModule()

  await assert.rejects(
    technians.run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified Nians jobs archive/i,
  )

  await assert.rejects(
    technians.run({
      fetchText: async () => careersHtml,
      fetchJson: async () => ({ jobs: [] }),
    }),
    /jobs api no longer returns an array/i,
  )
})

test('Technians Softech returns [] when the live Nians jobs surfaces time out in the current runtime', async () => {
  const technians = await loadModule()

  const jobs = await technians.run({
    fetchJson: async () => {
      const error = new TypeError('fetch failed')
      error.cause = {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted addresses: 192.0.78.25:443, 192.0.78.24:443, timeout: 10000ms)',
      }
      throw error
    },
    fetchText: async () => careersHtml,
  })

  assert.deepEqual(jobs, [])
})
