import assert from 'node:assert/strict'
import test from 'node:test'

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

test('Societe Generale scraper parses India listings, enriches detail pages, and preserves Taleo apply links', async () => {
  const socgen = await import('../../scraper/societegenerale/script.js')
  const requests = []

  assert.equal(
    socgen.CAREER_PAGE_URL,
    'https://careers.societegenerale.com/en/Technical/all-job-offers',
  )
  assert.equal(typeof socgen.extractSearchResults, 'function')
  assert.equal(typeof socgen.extractJobDetail, 'function')
  assert.equal(typeof socgen.createSocieteGeneraleScraper, 'function')

  const listings = socgen.extractSearchResults(listingHtml)
  assert.deepEqual(listings, [
    {
      title: 'Delivery Manager',
      company: 'Societe Generale',
      department: 'Corporate & Investment banking',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: '25000FP8',
      requisitionId: '25000FP8',
      sourceUrl: 'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en',
      applyUrl: 'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Senior Software Engineer',
      company: 'Societe Generale',
      department: 'IT (Information Technology)',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '25000XYZ',
      requisitionId: '25000XYZ',
      sourceUrl: 'https://careers.societegenerale.com/en/job-offers/senior-software-engineer-25000XYZ-en',
      applyUrl: 'https://careers.societegenerale.com/en/job-offers/senior-software-engineer-25000XYZ-en',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])

  const detail = socgen.extractJobDetail(detailHtml, listings[0])
  assert.equal(detail.title, 'Delivery Manager')
  assert.equal(detail.department, 'Corporate & Investment banking')
  assert.equal(detail.location, 'Chennai, India')
  assert.equal(detail.city, 'Chennai')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '25000FP8')
  assert.equal(detail.requisitionId, '25000FP8')
  assert.equal(
    detail.applyUrl,
    'https://socgen.taleo.net/careersection/sgcareers/jobapply.ftl?job=25000FP8&lang=en&src=CWS-1',
  )
  assert.equal(detail.postingDate, '2026-07-03')
  assert.equal(detail.minimumQualification, 'A good academic background')
  assert.equal(detail.remoteStatus, 'Hybrid')
  assert.match(detail.jobDescription, /Report and escalate Client Incidents/i)
  assert.match(detail.jobDescription, /diverse environment/i)

  const jobs = await socgen.createSocieteGeneraleScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === socgen.CAREER_PAGE_URL) return listingHtml
      if (url === 'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    socgen.CAREER_PAGE_URL,
    'https://careers.societegenerale.com/en/job-offers/delivery-manager-25000FP8-en',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'societegenerale')
  assert.equal(jobs[0].company, 'Societe Generale')
  assert.equal(
    jobs[0].link,
    'https://socgen.taleo.net/careersection/sgcareers/jobapply.ftl?job=25000FP8&lang=en&src=CWS-1',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Societe Generale run passes caller signal and fetches detail pages concurrently', async () => {
  const socgen = await import('../../scraper/societegenerale/script.js')
  const controller = new AbortController()
  const signals = []
  let activeDetailFetches = 0
  let maxActiveDetailFetches = 0

  const jobs = await socgen.createSocieteGeneraleScraper().run({
    signal: controller.signal,
    fetchText: async (url, options = {}) => {
      signals.push(options.signal)

      if (url === socgen.CAREER_PAGE_URL) return listingHtml
      if (url.includes('/en/job-offers/')) {
        activeDetailFetches += 1
        maxActiveDetailFetches = Math.max(maxActiveDetailFetches, activeDetailFetches)
        await new Promise((resolve) => setTimeout(resolve, 20))
        activeDetailFetches -= 1
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.ok(maxActiveDetailFetches > 1)
  assert.deepEqual(signals, [controller.signal, controller.signal, controller.signal])
})
