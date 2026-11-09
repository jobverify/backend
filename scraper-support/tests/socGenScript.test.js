import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
  <html>
    <head>
      <title>All Job offers at Societe Generale | Careers Société Générale</title>
    </head>
    <body>
      <h1>All Job offers at Societe Generale</h1>
      <div>702 offre(s)</div>
      <a href="https://careers.societegenerale.com/en/job-offers/senior-analyst-260009MF-en">
        Senior Analyst
      </a>
      <div>Bangalore, India Permanent contract Banking operations processing</div>
      <a href="https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en">
        Delivery Manager
      </a>
      <div>Chennai, India Permanent contract Corporate &amp; Investment banking</div>
    </body>
  </html>
`

const listingHtml = `
  <html>
    <body>
      <div class="job-offer-card">
        <a href="https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en">Delivery Manager</a>
        <div class="job-meta">Chennai, India Permanent contract Corporate &amp; Investment banking</div>
      </div>
      <div class="job-offer-card">
        <a href="https://careers.societegenerale.com/en/job-offers/senior-software-engineer-25000XYZ-en">Senior Software Engineer</a>
        <div class="job-meta">Bangalore, India Permanent contract IT (Information Technology)</div>
      </div>
      <div class="job-offer-card">
        <a href="https://careers.societegenerale.com/en/job-offers/credit-analyst-25000AAA-en">Credit Analyst</a>
        <div class="job-meta">Warsaw, Poland Permanent contract Risks</div>
      </div>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <body>
      <h1>Delivery Manager</h1>
      <div class="department">Corporate &amp; Investment banking</div>
      <a class="apply" href="https://socgen.taleo.net/careersection/sgcareers/jobapply.ftl?job=25000FP8&amp;lang=en&amp;src=CWS-1">Apply</a>
      <div>Permanent contract</div>
      <div>Chennai, India</div>
      <div>Hybrid</div>
      <div>Reference 25000FP8</div>
      <div>Publication date 2026/07/03</div>
      <h2>Responsibilities</h2>
      <p>Client/stakeholder management</p>
      <ul>
        <li>Report and escalate Client Incidents</li>
        <li>Build effective synergy with cross-functional units</li>
      </ul>
      <h2>Profile required</h2>
      <p>A good academic background</p>
      <p>Strong understanding of syndicated financing and loan life cycle</p>
      <h2>Why join us</h2>
      <p>We are committed to creating a diverse environment.</p>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/socgen/script.js')
  } catch {
    assert.fail('Expected SocGen scraper module at ../../scraper/socgen/script.js')
  }
}

test('SocGen exports a stable exact-name wrapper over the verified Societe Generale public jobs contract', async () => {
  const socgen = await loadModule()

  assert.equal(socgen.SOURCE, 'socgen')
  assert.equal(socgen.COMPANY, 'SocGen')
  assert.equal(socgen.OFFICIAL_BRAND_NAME, 'Societe Generale')
  assert.equal(socgen.CAREERS_URL, 'https://careers.societegenerale.com/en/Technical/all-job-offers')
  assert.equal(socgen.VERIFIED_ON, '2026-07-27')
  assert.match(socgen.VERIFIED_SURFACE_SUMMARY, /702 offre\(s\)/i)
  assert.equal(socgen.hasVerifiedSocGenCareersPageSignal(careersPageHtml), true)
  assert.deepEqual(
    socgen.decorateSocGenJob(
      {
        title: 'Delivery Manager',
        company: 'Societe Generale',
        source: 'societegenerale',
        jobId: '25000FP8',
        link: 'https://socgen.taleo.net/careersection/sgcareers/jobapply.ftl?job=25000FP8&lang=en&src=CWS-1',
        applyUrl: 'https://socgen.taleo.net/careersection/sgcareers/jobapply.ftl?job=25000FP8&lang=en&src=CWS-1',
        sourceUrl: 'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en',
      },
      '2026-07-27T19:30:00.000Z',
    ),
    {
      title: 'Delivery Manager',
      company: 'SocGen',
      source: 'socgen',
      jobId: '25000FP8',
      link: 'https://socgen.taleo.net/careersection/sgcareers/jobapply.ftl?job=25000FP8&lang=en&src=CWS-1',
      applyUrl: 'https://socgen.taleo.net/careersection/sgcareers/jobapply.ftl?job=25000FP8&lang=en&src=CWS-1',
      sourceUrl: 'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en',
      companyCareerPage: 'https://careers.societegenerale.com/en/Technical/all-job-offers',
      companyDomain: 'careers.societegenerale.com',
      atsPlatform: 'oracle-taleo',
      scrapedAt: '2026-07-27T19:30:00.000Z',
    },
  )
})

test('SocGen run validates the careers page and decorates jobs from the existing Societe Generale scraper', async () => {
  const socgen = await loadModule()
  const requests = []

  const jobs = await socgen.createSocGenScraper({
    maxJobs: 1,
    now: () => '2026-07-27T19:30:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requests.push(url)
      assert.equal(url, 'https://careers.societegenerale.com/en/Technical/all-job-offers')
      return {
        status: 200,
        url,
        html: careersPageHtml,
      }
    },
    fetchText: async (url) => {
      requests.push(url)
      if (url === 'https://careers.societegenerale.com/en/Technical/all-job-offers') return listingHtml
      if (url === 'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    'https://careers.societegenerale.com/en/Technical/all-job-offers',
    'https://careers.societegenerale.com/en/Technical/all-job-offers',
    'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'socgen')
  assert.equal(jobs[0].company, 'SocGen')
  assert.equal(jobs[0].companyCareerPage, socgen.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'careers.societegenerale.com')
  assert.equal(jobs[0].atsPlatform, 'oracle-taleo')
  assert.equal(jobs[0].scrapedAt, '2026-07-27T19:30:00.000Z')
})

test('SocGen fails closed when the verified careers page drifts materially', async () => {
  const socgen = await loadModule()

  await assert.rejects(
    socgen.createSocGenScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Different jobs page</h1></body></html>',
      }),
    }),
    /verified SocGen careers page/i,
  )
})

test('SocGen run passes caller signal through validation and delegated fetches', async () => {
  const socgen = await loadModule()
  const controller = new AbortController()
  const signals = []

  const jobs = await socgen.createSocGenScraper({
    maxJobs: 1,
    now: () => '2026-07-27T19:30:00.000Z',
  }).run({
    signal: controller.signal,
    fetchPage: async (url, options = {}) => {
      signals.push(options.signal)
      return {
        status: 200,
        url,
        html: careersPageHtml,
      }
    },
    fetchText: async (url, options = {}) => {
      signals.push(options.signal)
      if (url === 'https://careers.societegenerale.com/en/Technical/all-job-offers') return listingHtml
      if (url === 'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(signals, [controller.signal, controller.signal, controller.signal])
})
