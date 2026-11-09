import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'
const OPENING_URL =
  'https://www.sigmasolve.com/who-we-are/open-position/ai-driven-lead-generation-amp-email-marketing-specialist'

const openingsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Positions - Sigma Solve | Sigma Solve</title>
    <meta name="description" content="Career opportunities at Sigma Solve. Explore current openings and apply directly.">
    <link rel="canonical" href="https://www.sigmasolve.com/who-we-are/openings">
  </head>
  <body>
    <main>
      <p>Returning Candidate? <a href="/who-we-are/career-login">Log back in!</a></p>
      <label for="job-search">Search your job</label>
      <input id="job-search" type="search" placeholder="Search your job here">
      <ul>
        <li>
          <a href="/who-we-are/open-position/ai-driven-lead-generation-amp-email-marketing-specialist">
            AI-Driven Lead Generation &amp;amp; Email Marketing Specialist
          </a>
          <p><span>Full-time</span><span>Marketing</span></p>
        </li>
      </ul>
    </main>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI-Driven Lead Generation &amp;amp; Email Marketing Specialist | Sigma Solve</title>
    <meta name="description" content="Email Marketing | SEO | AI-Driven Prospecting | GA4/GTM/Clarity | Campaign Optimization">
    <link rel="canonical" href="${OPENING_URL}">
  </head>
  <body>
    <main>
      <h1>AI-Driven Lead Generation &amp;amp; Email Marketing Specialist</h1>
      <div>
        <span class="text-brand font-semibold">Type</span><span class="text-foreground">Full-time</span>
        <span class="text-brand font-semibold">Location</span><span class="text-foreground">United States</span>
        <span class="text-brand font-semibold">Department</span><span class="text-foreground">Marketing</span>
      </div>
      <h3>Key Responsibilities</h3>
      <ul>
        <li>Use AI tools to identify high-intent prospects.</li>
      </ul>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sigmasolve/script.js')
  } catch {
    assert.fail('Expected Sigma Solve scraper module at ../../scraper/sigmasolve/script.js')
  }
}

test('Sigma Solve generic helpers retain the original legacy opening format under current metadata', async () => {
  const sigmaSolve = await loadModule()

  assert.equal(sigmaSolve.SOURCE, 'sigmasolve')
  assert.equal(sigmaSolve.COMPANY, 'Sigma Solve')
  assert.equal(sigmaSolve.CAREERS_PAGE_URL, 'https://www.sigmasolve.com/who-we-are/openings')
  assert.equal(sigmaSolve.VERIFIED_ON, '2026-10-03')
  assert.equal(sigmaSolve.hasOfficialOpeningsPageSignal(openingsHtml), true)
  assert.deepEqual(sigmaSolve.extractOpeningSummaries(openingsHtml), [
    {
      title: 'AI-Driven Lead Generation & Email Marketing Specialist',
      department: 'Marketing',
      employmentType: 'Full-time',
      sourceUrl: OPENING_URL,
      applyUrl: OPENING_URL,
    },
  ])
})

test('Sigma Solve generic legacy detail helper preserves metadata with no inferred application', async () => {
  const sigmaSolve = await loadModule()
  const jobs = sigmaSolve.extractJobsFromDetailPages([
    {
      summary: {
        title: 'AI-Driven Lead Generation & Email Marketing Specialist',
        department: 'Marketing',
        employmentType: 'Full-time',
        sourceUrl: OPENING_URL,
        applyUrl: OPENING_URL,
      },
      detailHtml,
    },
  ])

  assert.deepEqual(jobs, [
    {
      title: 'AI-Driven Lead Generation & Email Marketing Specialist',
      company: 'Sigma Solve',
      department: 'Marketing',
      location: 'United States',
      city: null,
      state: null,
      country: 'United States',
      jobId: 'ai-driven-lead-generation-amp-email-marketing-specialist',
      requisitionId: 'ai-driven-lead-generation-amp-email-marketing-specialist',
      sourceUrl: OPENING_URL,
      applyUrl: null,
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Email Marketing | SEO | AI-Driven Prospecting | GA4/GTM/Clarity | Campaign Optimization',
      remoteStatus: 'On-site',
    },
  ])
})

test('Sigma Solve rejects the original thin legacy detail without an application anchor', async () => {
  const sigmaSolve = await loadModule()
  const requestedUrls = []

  await assert.rejects(sigmaSolve.createSigmaSolveScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sigmaSolve.CAREERS_PAGE_URL) return openingsHtml
      if (url === OPENING_URL) return detailHtml
      throw new Error(`Unexpected Sigma Solve URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  }), /verified sigma solve detail page/i)

  assert.deepEqual(requestedUrls, [
    sigmaSolve.CAREERS_PAGE_URL,
    OPENING_URL,
  ])
})

test('Sigma Solve fails closed when the openings page, opening cards, or detail page drift', async () => {
  const sigmaSolve = await loadModule()

  await assert.rejects(
    sigmaSolve.createSigmaSolveScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified sigma solve openings page/i,
  )

  await assert.rejects(
    sigmaSolve.createSigmaSolveScraper().run({
      fetchText: async (url) => {
        if (url === sigmaSolve.CAREERS_PAGE_URL) {
          return openingsHtml.replaceAll('/who-we-are/open-position/ai-driven-lead-generation-amp-email-marketing-specialist', '/who-we-are/career-login')
        }
        return detailHtml
      },
    }),
    /trusted sigma solve opening cards/i,
  )

  await assert.rejects(
    sigmaSolve.createSigmaSolveScraper().run({
      fetchText: async (url) => {
        if (url === sigmaSolve.CAREERS_PAGE_URL) return openingsHtml
        return '<html><head><title>Unexpected</title></head><body>No job details</body></html>'
      },
    }),
    /verified sigma solve detail page/i,
  )
})

// Historical fixtures above remain untouched. This separate controlled positive
// copies the existing current-role fixture declarations; it is not a native recapture.
const controlledCurrentRoleFixture = CAREERS_PAGE_URL => {
const DETAIL_URL = 'https://www.sigmasolve.com/who-we-are/open-position/content-growth-strategist'
const APPLY_URL = 'https://www.sigmasolve.com/who-we-are/apply-for-job?job=content-growth-strategist'
const OPENINGS_HTML = `
  <title>Open Positions | Sigma Solve</title>
  <meta name="description" content="Career opportunities at Sigma Solve. Explore current openings and apply directly." />
  <link rel="canonical" href="${CAREERS_PAGE_URL}" />
  <p>Returning Candidate?</p><input placeholder="Search your job here" />
  <a href="/who-we-are/open-position/content-growth-strategist">Content &amp; Growth Strategist</a>
  <p><span>Full-time</span><span>Marketing</span></p>
`
const detailHtml = (applyUrl = APPLY_URL) => `
  <title>Content &amp; Growth Strategist | Sigma Solve</title>
  <meta name="description" content="Own and scale Sigma Solve's marketing engine." />
  <link rel="canonical" href="${DETAIL_URL}" />
  <span>Type</span><span>Full-time</span>
  <span>Location</span><span>United States</span>
  <span>Department</span><span>Marketing</span>
  <a href="${applyUrl}">Apply for this job</a>
`
  return {DETAIL_URL, APPLY_URL, OPENINGS_HTML, detailHtml}
}

test('Sigma Solve controlled current-role fixture preserves source, application and observation fields', async () => {
  const sigmaSolve = await loadModule(), fixture = controlledCurrentRoleFixture(sigmaSolve.CAREERS_PAGE_URL), requestedUrls = []
  const jobs = await sigmaSolve.createSigmaSolveScraper({ maxJobs: 1 }).run({
    fetchText: async url => {
      requestedUrls.push(url)
      if (url === sigmaSolve.CAREERS_PAGE_URL) return fixture.OPENINGS_HTML
      if (url === fixture.DETAIL_URL) return fixture.detailHtml()
      assert.fail('Unexpected controlled Sigma Solve URL: ' + url)
    },
    now: () => FIXED_SCRAPED_AT,
  })
  assert.deepEqual(requestedUrls, [sigmaSolve.CAREERS_PAGE_URL, fixture.DETAIL_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sigmasolve')
  assert.equal(jobs[0].link, fixture.APPLY_URL)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].title, 'Content & Growth Strategist')
  assert.equal(jobs[0].sourceUrl, fixture.DETAIL_URL)
  assert.equal(jobs[0].applyUrl, fixture.APPLY_URL)
  assert.equal(jobs[0].country, 'United States')
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].closingDate, null)
})
