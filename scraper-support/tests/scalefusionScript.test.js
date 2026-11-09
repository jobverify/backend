import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Scalefusion | Build What the World Runs On</title>
  </head>
  <body>
    <main>
      <h1>Build what the world runs on.</h1>
      <p>
        Scalefusion is a product of ProMobi Technologies Pvt. Ltd, a company driven by innovation,
        collaboration, and curiosity.
      </p>
      <a class="btn btn-primary" href="https://promobitech.com/careers" target="_blank">View job openings</a>
      <p>You will be redirected to the careers page on our corporate website.</p>
    </main>
  </body>
</html>
`

const promobiCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section>
      <h3>Health Benefits</h3>
      <p>We want you to be healthy.</p>
    </section>
    <section class="job-card">
      <h3>Ruby On Rails Developer</h3>
      <a href="/jobs/ruby-on-rails-developer">See Details</a>
      <p>
        We are looking for a Ruby on Rails Product Engineer with experience in developing
        multi-tenant SaaS applications.
      </p>
      <h6>Experience</h6>
      <p>1 - 3 years</p>
      <h6>Job Type</h6>
      <p>Full time</p>
      <h6>Location</h6>
      <ul>
        <li>Pune</li>
      </ul>
      <h6>Date Posted</h6>
      <p>Jul 15, 2026</p>
    </section>
    <section class="job-card">
      <h3>Principal Solutions Consultant (Enterprise)</h3>
      <a href="/jobs/principal-solutions-consultant">See Details</a>
      <p>
        We are looking for a seasoned Principal Solutions Consultant (Technical Architect)
        to lead Enterprise solution engineering in Mumbai.
      </p>
      <h6>Experience</h6>
      <p>10-15 years</p>
      <h6>Job Type</h6>
      <p>Full time</p>
      <h6>Location</h6>
      <ul>
        <li>Mumbai</li>
      </ul>
      <h6>Date Posted</h6>
      <p>Feb 10, 2026</p>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/scalefusion/script.js')
  } catch {
    assert.fail('Expected Scalefusion scraper module at ../../scraper/scalefusion/script.js')
  }
}

test('Scalefusion helpers stay pinned to the verified exact-name careers handoff and parent job listing page', async () => {
  const scalefusion = await loadModule()

  assert.equal(scalefusion.SOURCE, 'scalefusion')
  assert.equal(scalefusion.COMPANY, 'Scalefusion')
  assert.equal(scalefusion.CAREERS_PAGE_URL, 'https://scalefusion.com/careers/')
  assert.equal(scalefusion.CORPORATE_CAREERS_URL, 'https://promobitech.com/careers')
  assert.equal(scalefusion.VERIFIED_ON, '2026-07-17')
  assert.equal(scalefusion.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    scalefusion.extractOfficialCareersHandoffUrl(careersHtml),
    'https://promobitech.com/careers',
  )
})

test('Scalefusion extracts parent-company open positions into shared scraper job fields', async () => {
  const scalefusion = await loadModule()
  const jobs = scalefusion.extractPromobiJobs(promobiCareersHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Ruby On Rails Developer',
      company: 'Scalefusion',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      state: null,
      country: 'India',
      jobId: 'ruby-on-rails-developer',
      requisitionId: 'ruby-on-rails-developer',
      sourceUrl: 'https://promobitech.com/jobs/ruby-on-rails-developer',
      applyUrl: 'https://promobitech.com/jobs/ruby-on-rails-developer',
      employmentType: 'Full-time',
      experienceRequired: '1 - 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15',
      closingDate: null,
      jobDescription:
        'We are looking for a Ruby on Rails Product Engineer with experience in developing multi-tenant SaaS applications.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Principal Solutions Consultant (Enterprise)',
      company: 'Scalefusion',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      state: null,
      country: 'India',
      jobId: 'principal-solutions-consultant',
      requisitionId: 'principal-solutions-consultant',
      sourceUrl: 'https://promobitech.com/jobs/principal-solutions-consultant',
      applyUrl: 'https://promobitech.com/jobs/principal-solutions-consultant',
      employmentType: 'Full-time',
      experienceRequired: '10-15 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-02-10',
      closingDate: null,
      jobDescription:
        'We are looking for a seasoned Principal Solutions Consultant (Technical Architect) to lead Enterprise solution engineering in Mumbai.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Scalefusion run validates the official careers handoff and returns normalized parent-company openings', async () => {
  const scalefusion = await loadModule()
  const requestedUrls = []

  const jobs = await scalefusion.createScalefusionScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === scalefusion.CAREERS_PAGE_URL) return careersHtml
      if (url === scalefusion.CORPORATE_CAREERS_URL) return promobiCareersHtml
      throw new Error(`Unexpected Scalefusion URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    scalefusion.CAREERS_PAGE_URL,
    scalefusion.CORPORATE_CAREERS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'scalefusion')
  assert.equal(jobs[0].link, 'https://promobitech.com/jobs/ruby-on-rails-developer')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Scalefusion fails closed when the official careers page, handoff, or parent jobs page drift', async () => {
  const scalefusion = await loadModule()

  await assert.rejects(
    scalefusion.createScalefusionScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified official scalefusion careers page/i,
  )

  await assert.rejects(
    scalefusion.createScalefusionScraper().run({
      fetchText: async (url) => {
        if (url === scalefusion.CAREERS_PAGE_URL) {
          return careersHtml.replaceAll('https://promobitech.com/careers', 'https://promobitech.com/jobs')
        }
        return promobiCareersHtml
      },
    }),
    /verified scalefusion careers handoff/i,
  )

  await assert.rejects(
    scalefusion.createScalefusionScraper().run({
      fetchText: async (url) => {
        if (url === scalefusion.CAREERS_PAGE_URL) return careersHtml
        return '<html><body><h3>Benefits</h3></body></html>'
      },
    }),
    /verified promobi public jobs surface/i,
  )
})
