import assert from 'node:assert/strict'
import test from 'node:test'

const loadKissflowModule = async () => {
  try {
    return await import('../../scraper/kissflow/script.js')
  } catch {
    assert.fail('Expected Kissflow scraper module at ../../scraper/kissflow/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Kissflow</title>
    <link rel="canonical" href="https://careers.kissflow.com" />
  </head>
  <body>
    <header>
      <a href="https://kissflow.com/">Kissflow</a>
      <a href="https://careers.kissflow.com/#viewjobs">Get Jobs</a>
    </header>
    <main>
      <h1>We’re Redefining Work</h1>
      <h2 class="semi">Open Positions</h2>
      <div class="career-link career-col">
        <a href="https://careers.kissflow.com/solution-advisor" class="career-in-row">
          <h6 class="mb-24 h6 medium text-decoration-none link-charcoal700">Solution Advisor</h6>
          <p class="m-0">Experience: 8 - 12 years</p>
          <span class="caree-aply btn btn-md btn-outline-blue">Explore More</span>
        </a>
      </div>
      <div class="career-link career-col">
        <a href="https://careers.kissflow.com/client-director" class="career-in-row">
          <h6 class="mb-24 h6 medium text-decoration-none link-charcoal700">Client Director</h6>
          <p class="m-0">Experience: 14 - 18 years</p>
          <span class="caree-aply btn btn-md btn-outline-blue">Explore More</span>
        </a>
      </div>
    </main>
  </body>
</html>
`

const currentCareersPageHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers - Kissflow</title>
  </head>
  <body>
    <h1>We’re Redefining Work</h1>
    <p>We’re changing how work gets done — both in our office and around the world</p>
      <a href="/life-at-kissflow">Find your calling</a>
    <h2>Open Positions</h2>
    <a href="/solution-advisor">Solution Advisor Experience: 8 - 12 years Explore More</a>
    <a href="/client-director">Client Director Experience: 14 - 18 years Explore More</a>
    <h3>Always looking for passionate people to make our team better</h3>
    <h4>Contact Sales</h4>
  </body>
</html>
`

const solutionAdvisorHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Solution Advisor</title>
  </head>
  <body>
    <main>
      <h1 class="semi job-title mb-24 h3">Solution Advisor</h1>
      <h6 class="mt-24 mb-8 job-experience"><span class="medium">Experience:</span> 8 - 12 years</h6>
      <h6 class="h6 job-location pb-16"><span class="medium">Work Location:</span> Delhi&amp;Mumbai</h6>
      <a href="#apply" class="btn btn-outline-blue btn-xl career-btn">Apply now</a>
      <h6 class="mb-8 h6 mt-32"><span class="medium">Job Description:</span></h6>
      <p>As a Kissflow Solution Advisor, you will be the innovation driver and thought leader.</p>
      <h6>Required Skills</h6>
      <ul>
        <li>Low-code architecture</li>
        <li>Enterprise consulting</li>
      </ul>
      <h6>Applicant Details</h6>
    </main>
  </body>
</html>
`

const currentSolutionAdvisorHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Solution Advisor</title>
  </head>
  <body>
    <main>
      <h1 class="semi job-title mb-24 h3">Solution Advisor</h1>
      <h6 class="mt-24 mb-8 job-experience"><span class="medium">Experience:</span> 8 - 12 years</h6>
      <h6 class="h6 job-location pb-16"><span class="medium">Work Location:</span> Delhi&amp;Mumbai</h6>
      <a href="#apply" class="btn btn-outline-blue btn-xl career-btn">Apply now</a>
      <h6 class="mb-8 h6 mt-32"><span class="medium">Job Description:</span></h6>
      <p style="background-color: #ffffff;">As a <strong>Kissflow Solution Advisor</strong>, you will be the innovation driver and thought leader.</p>
      <p style="background-color: #ffffff;">You will help enterprises shape solution roadmaps on the Kissflow platform.</p>
      <h3><strong><span>Required Skills</span></strong></h3>
      <ul>
        <li>Low-code architecture</li>
        <li>Enterprise consulting</li>
      </ul>
      <h3 class="pb-24 semi text-charcoal700">Applicant Details</h3>
    </main>
  </body>
</html>
`

const clientDirectorHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Client Director</title>
  </head>
  <body>
    <main>
      <h1 class="semi job-title mb-24 h3">Client Director</h1>
      <h6 class="mt-24 mb-8 job-experience"><span class="medium">Experience:</span> 14 - 18 years</h6>
      <h6 class="h6 job-location pb-16"><span class="medium">Work Location:</span> Chennai&amp;Delhi&amp;Mumbai</h6>
      <a href="#apply" class="btn btn-outline-blue btn-xl career-btn">Apply now</a>
      <h6 class="mb-8 h6 mt-32"><span class="medium">Job Description:</span></h6>
      <p>The Kissflow Client Director will serve as a strategic advisor and trusted partner.</p>
      <h6>Required Skills</h6>
      <ul>
        <li>Executive relationship management</li>
      </ul>
      <h6>Applicant Details</h6>
    </main>
  </body>
</html>
`

const managerDigitalMarketingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Manager - Digital Marketing</title>
  </head>
  <body>
    <main>
      <h1 class="semi job-title mb-24 h3">Manager - Digital Marketing</h1>
      <h6 class="mt-24 mb-8 job-experience"><span class="medium">Experience:</span> 8 - 12 years</h6>
      <h6 class="h6 job-location pb-16"><span class="medium">Work Location:</span> Chennai</h6>
      <a href="#apply" class="btn btn-outline-blue btn-xl career-btn">Apply now</a>
      <h6 class="mb-8 h6 mt-32"><span class="medium">Job Description:</span></h6>
      <p>Own digital campaign strategy, performance marketing, and demand generation.</p>
      <h6>Required Skills</h6>
      <ul>
        <li>Performance marketing</li>
        <li>SEO</li>
      </ul>
      <h6>Applicant Details</h6>
    </main>
  </body>
</html>
`

const driftedCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Kissflow</title>
  </head>
  <body>
    <main>
      <h1>We’re Redefining Work</h1>
      <p>No jobs listed</p>
    </main>
  </body>
</html>
`

const driftedDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <main>
      <h1>Join us</h1>
      <p>No detail structure</p>
    </main>
  </body>
</html>
`

test('Kissflow pins the verified careers index, listing cards, and live first-party detail page fields', async () => {
  const kissflow = await loadKissflowModule()

  assert.equal(kissflow.SOURCE, 'kissflow')
  assert.equal(kissflow.COMPANY, 'Kissflow')
  assert.equal(kissflow.VERIFIED_ON, '2026-08-15')
  assert.equal(kissflow.HOMEPAGE_URL, 'https://kissflow.com/')
  assert.equal(kissflow.CAREERS_URL, 'https://careers.kissflow.com/')
  assert.deepEqual(kissflow.VERIFIED_ROLE_URLS, [
    'https://careers.kissflow.com/solution-advisor',
    'https://careers.kissflow.com/client-director',
  ])

  assert.equal(kissflow.hasVerifiedCareersPageSignal(currentCareersPageHtml), true)
  assert.deepEqual(kissflow.extractListingCards(currentCareersPageHtml), [
    {
      title: 'Solution Advisor',
      sourceUrl: 'https://careers.kissflow.com/solution-advisor',
      experienceRequired: '8 - 12 years',
    },
    {
      title: 'Client Director',
      sourceUrl: 'https://careers.kissflow.com/client-director',
      experienceRequired: '14 - 18 years',
    },
  ])

  assert.deepEqual(
    kissflow.extractJobDetail(currentSolutionAdvisorHtml, {
      title: 'Solution Advisor',
      sourceUrl: 'https://careers.kissflow.com/solution-advisor',
      experienceRequired: '8 - 12 years',
    }),
    {
      title: 'Solution Advisor',
      location: 'Delhi, Mumbai, India',
      city: 'Delhi',
      country: 'India',
      experienceRequired: '8 - 12 years',
      jobDescription:
        'As a Kissflow Solution Advisor, you will be the innovation driver and thought leader. You will help enterprises shape solution roadmaps on the Kissflow platform.',
      requiredSkills: [
        'Low-code architecture',
        'Enterprise consulting',
      ],
    },
  )
})

test('Kissflow scraper returns the verified first-party India jobs from the careers index and detail pages', async () => {
  const kissflow = await loadKissflowModule()
  const requestedUrls = []

  const jobs = await kissflow.createKissflowScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kissflow.CAREERS_URL) return currentCareersPageHtml
      if (url === 'https://careers.kissflow.com/solution-advisor') return currentSolutionAdvisorHtml
      if (url === 'https://careers.kissflow.com/client-director') return clientDirectorHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-16T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    kissflow.CAREERS_URL,
    ...kissflow.VERIFIED_ROLE_URLS,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      experienceRequired: job.experienceRequired,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Solution Advisor',
        location: 'Delhi, Mumbai, India',
        city: 'Delhi',
        sourceUrl: 'https://careers.kissflow.com/solution-advisor',
        applyUrl: 'https://careers.kissflow.com/solution-advisor',
        experienceRequired: '8 - 12 years',
        source: 'kissflow',
        scrapedAt: '2026-07-16T12:00:00.000Z',
      },
      {
        title: 'Client Director',
        location: 'Chennai, Delhi, Mumbai, India',
        city: 'Chennai',
        sourceUrl: 'https://careers.kissflow.com/client-director',
        applyUrl: 'https://careers.kissflow.com/client-director',
        experienceRequired: '14 - 18 years',
        source: 'kissflow',
        scrapedAt: '2026-07-16T12:00:00.000Z',
      },
    ],
  )
})

test('Kissflow scraper fails closed when the careers index or detail pages drift from the verified first-party contract', async () => {
  const kissflow = await loadKissflowModule()

  await assert.rejects(
    kissflow.createKissflowScraper().run({
      fetchText: async (url) => {
        if (url === kissflow.CAREERS_URL) return driftedCareersPageHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    kissflow.createKissflowScraper().run({
      fetchText: async (url) => {
        if (url === kissflow.CAREERS_URL) return currentCareersPageHtml
        return driftedDetailHtml
      },
    }),
    /detail page/i,
  )
})
