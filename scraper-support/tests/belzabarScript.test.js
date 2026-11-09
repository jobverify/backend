import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Belzabar Software</title>
  </head>
  <body>
    <nav>
      <a href="/about/life-at-belzabar#careers-section">Careers</a>
      <a href="https://www.linkedin.com/company/belzabar-software-design-india-private-limited/">LinkedIn</a>
    </nav>
    <main>
      <h1>Belzabar Software</h1>
      <p>Belzabar Software assists prominent and innovative companies with challenging enterprise technology projects.</p>
    </main>
  </body>
</html>
`

const currentHomepageShellHtml = `
<!doctype html>
<html data-wf-domain="web.belzabar.com" lang="en">
  <head>
    <title>Belzabar Software</title>
    <meta property="og:url" content="https://www.belzabar.com/" />
  </head>
  <body>
    <nav>
      <a href="/about/life-at-belzabar" class="navlink link w-inline-block">
        <div class="nav-text">Life at Belzabar</div>
      </a>
      <a href="/about/life-at-belzabar#careers-section" class="navlink link w-inline-block">
        <div class="nav-text">Careers</div>
      </a>
    </nav>
  </body>
</html>
`

const proxyErrorHtml = `
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html>
  <head>
    <title>502 Proxy Error</title>
  </head>
  <body>
    <h1>Proxy Error</h1>
    <p>The proxy server received an invalid response from an upstream server.</p>
    <p>Reason: <strong>Error reading from remote server</strong></p>
  </body>
</html>
`

const careersOutputHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Life at | Belzabar Software Design India Pvt Ltd</title>
  </head>
  <body>
    <nav>
      <a href="/about/life-at-belzabar#careers-section" class="navlink link w-inline-block">
        <div class="nav-text">Careers</div>
      </a>
      <a href="/pages/contact" class="navlink link w-inline-block">
        <div class="nav-text">Connect</div>
      </a>
    </nav>
    <section id="careers-section">
      <h1>Open Positions</h1>
      <div class="w-dyn-list">
        <div role="list" class="collection-list-2 w-dyn-items">
          <div role="listitem" class="collection-item w-dyn-item">
            <a href="/jobs/senior-infrastructure-engineer-linux" class="white-link">Senior DevOps Engineer</a>
          </div>
          <div role="listitem" class="collection-item w-dyn-item">
            <a href="/jobs/qa-engineer" class="white-link">QA Engineer</a>
          </div>
          <div role="listitem" class="collection-item w-dyn-item">
            <a href="/jobs/front-end-developer" class="white-link">Front End Developer</a>
          </div>
          <div role="listitem" class="collection-item w-dyn-item">
            <a href="/jobs/senior-computer-scientist-java" class="white-link">Lead Engineer/ Architect -Java</a>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

const devOpsDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at | Belzabar Software Design India Pvt Ltd</title>
  </head>
  <body>
    <main>
      <div class="top-margin w-richtext">
        <h3>Senior DevOps Engineer</h3>
        <p><strong>Requirement:</strong></p>
        <ul>
          <li>At least 6 years of experience in software infrastructure and engineering</li>
          <li>Strong experience with Linux, automation, and cloud infrastructure</li>
        </ul>
        <p><strong>Responsibility:</strong></p>
        <ul>
          <li>Design, maintain, and improve scalable infrastructure for enterprise systems.</li>
          <li>Collaborate with engineering teams on deployment automation and reliability.</li>
        </ul>
        <p>
          <strong>Experience: </strong>At least 6 years of experience in software infrastructure and engineering<br>
          <strong>Qualification: </strong>Bachelor’s degree or higher – in Computer Science or similar<br>
          <strong>Job Location: </strong>New Delhi
        </p>
        <p><em>To </em><strong><em>apply</em></strong> for<em> this position, send us your profile.</em></p>
      </div>
      <a href="#" class="button w-button">Apply</a>
      <div class="form-block">
        <label>Applying For *</label>
        <input type="radio" id="Senior DevOps Engineer" name="Applying For" value="Senior DevOps Engineer">
        <label>Name *</label>
        <input type="text" name="Name">
        <label>Experience (in years)*</label>
        <input type="text" name="Relevance">
      </div>
    </main>
  </body>
</html>
`

const qaEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at | Belzabar Software Design India Pvt Ltd</title>
  </head>
  <body>
    <main>
      <div class="top-margin w-richtext">
        <h3>QA Engineer</h3>
        <p><strong>Requirement:</strong></p>
        <ul>
          <li>Relevant work experience in manual testing of Web and Mobile (iOS and Android) applications.</li>
          <li>Knowledge of automated testing using Selenium or an alternate automation tool</li>
          <li>Good understanding of Web and Mobile based projects</li>
        </ul>
        <p><strong>Responsibility:</strong></p>
        <ul>
          <li>Interact with Business Analysis and Development teams to develop a strong understanding of the project and testing objectives.</li>
          <li>Responsible for creation and execution of test scripts and test data for module/integration/system testing.</li>
        </ul>
        <p>
          <strong>Experience: </strong>4+ years<br>
          <strong>Qualification: </strong>Bachelor’s degree or higher – in Computer Science or similar<br>
          <strong>Job Location: </strong>New Delhi
        </p>
        <p><em>To </em><strong><em>apply</em></strong> for<em> this position, send us your profile.</em></p>
      </div>
      <a href="#" class="button w-button">Apply</a>
      <div class="form-block">
        <label>Applying For *</label>
        <input type="radio" id="QA Engineer" name="Applying For" value="QA Engineer">
        <label>Name *</label>
        <input type="text" name="Name">
        <label>Experience (in years)*</label>
        <input type="text" name="Relevance">
      </div>
    </main>
  </body>
</html>
`

const currentQaEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at | Belzabar Software Design India Pvt Ltd</title>
  </head>
  <body>
    <main>
      <div>
        <h3>QA Engineer</h3>
      </div>
      <div class="top-margin w-richtext">
        <p><strong>Requirement:</strong></p>
        <ul>
          <li>Relevant work experience in manual testing of Web and Mobile (iOS and Android) applications.</li>
        </ul>
        <p><strong>Responsibility:</strong></p>
        <ul>
          <li>Coordinate issue triage across teams and validate releases.</li>
        </ul>
        <p>
          <strong>Experience: 4</strong>+ years<br>
          <strong>Qualification: </strong>Bachelor’s degree or higher – in Computer Science or similar<br>
          <strong>Job Location: </strong>New Delhi
        </p>
      </div>
      <a href="#" class="button w-button">Apply</a>
      <label class="field-label">Position Applying For *</label>
    </main>
  </body>
</html>
`

const loadBelzabarModule = async () => {
  try {
    return await import('../../scraper/belzabar/script.js')
  } catch {
    assert.fail('Expected Belzabar scraper module at ../../scraper/belzabar/script.js')
  }
}

test('Belzabar scraper keeps the verified homepage, canonical listing route, and first-party openings explicit', async () => {
  const belzabar = await loadBelzabarModule()

  assert.equal(belzabar.COMPANY, 'Belzabar')
  assert.equal(belzabar.OFFICIAL_BRAND_NAME, 'Belzabar Software Design India Pvt Ltd')
  assert.equal(belzabar.SOURCE, 'belzabar')
  assert.equal(belzabar.VERIFIED_AT, '2026-07-19')
  assert.equal(belzabar.HOMEPAGE_URL, 'https://www.belzabar.com/')
  assert.equal(
    belzabar.HOMEPAGE_LINKED_CAREERS_URL,
    'https://www.belzabar.com/about/life-at-belzabar#careers-section',
  )
  assert.equal(
    belzabar.CANONICAL_CAREERS_URL,
    'https://www.belzabar.com/about/life-at-belzabar',
  )
  assert.equal(
    belzabar.CAREERS_URL,
    'https://www.belzabar.com/about/life-at-belzabar',
  )
  assert.equal(belzabar.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    belzabar.extractHomepageCareersUrl(homepageHtml),
    'https://www.belzabar.com/about/life-at-belzabar#careers-section',
  )
  assert.equal(belzabar.hasOfficialCareersPageSignal(careersOutputHtml), true)

  const listings = belzabar.extractListings(careersOutputHtml)
  assert.deepEqual(
    listings.map((listing) => [listing.jobId, listing.title, listing.sourceUrl]),
    [
      [
        'senior-infrastructure-engineer-linux',
        'Senior DevOps Engineer',
        'https://www.belzabar.com/jobs/senior-infrastructure-engineer-linux',
      ],
      [
        'qa-engineer',
        'QA Engineer',
        'https://www.belzabar.com/jobs/qa-engineer',
      ],
      [
        'front-end-developer',
        'Front End Developer',
        'https://www.belzabar.com/jobs/front-end-developer',
      ],
      [
        'senior-computer-scientist-java',
        'Lead Engineer/ Architect -Java',
        'https://www.belzabar.com/jobs/senior-computer-scientist-java',
      ],
    ],
  )

  assert.equal(belzabar.hasOfficialJobDetailSignal(qaEngineerDetailHtml, listings[1]), true)
  const qaJob = belzabar.extractJobDetail(qaEngineerDetailHtml, listings[1])
  assert.equal(qaJob.title, 'QA Engineer')
  assert.equal(qaJob.company, 'Belzabar')
  assert.equal(qaJob.location, 'New Delhi, India')
  assert.equal(qaJob.city, 'New Delhi')
  assert.equal(qaJob.country, 'India')
  assert.equal(qaJob.jobId, 'qa-engineer')
  assert.equal(qaJob.requisitionId, 'qa-engineer')
  assert.equal(qaJob.sourceUrl, 'https://www.belzabar.com/jobs/qa-engineer')
  assert.equal(qaJob.applyUrl, 'https://www.belzabar.com/jobs/qa-engineer')
  assert.equal(qaJob.experienceRequired, '4+ years')
  assert.equal(
    qaJob.minimumQualification,
    'Bachelor’s degree or higher – in Computer Science or similar',
  )
  assert.deepEqual(qaJob.requiredSkills, [
    'Relevant work experience in manual testing of Web and Mobile (iOS and Android) applications.',
    'Knowledge of automated testing using Selenium or an alternate automation tool',
    'Good understanding of Web and Mobile based projects',
  ])
  assert.match(qaJob.jobDescription, /manual testing of Web and Mobile/i)
  assert.match(qaJob.jobDescription, /test scripts and test data/i)
})

test('Belzabar homepage signal accepts the current branded shell when the body copy is no longer rendered inline', async () => {
  const belzabar = await loadBelzabarModule()

  assert.equal(
    belzabar.extractHomepageCareersUrl(currentHomepageShellHtml),
    'https://www.belzabar.com/about/life-at-belzabar#careers-section',
  )
  assert.equal(belzabar.hasOfficialHomepageSignal(currentHomepageShellHtml), true)
})

test('Belzabar detail signal accepts the current inline experience markup and preserves the full value', async () => {
  const belzabar = await loadBelzabarModule()
  const listing = {
    jobId: 'qa-engineer',
    requisitionId: 'qa-engineer',
    title: 'QA Engineer',
    sourceUrl: 'https://www.belzabar.com/jobs/qa-engineer',
  }

  assert.equal(belzabar.hasOfficialJobDetailSignal(currentQaEngineerDetailHtml, listing), true)

  const job = belzabar.extractJobDetail(currentQaEngineerDetailHtml, listing)
  assert.equal(job.experienceRequired, '4+ years')
  assert.equal(job.minimumQualification, 'Bachelor’s degree or higher – in Computer Science or similar')
  assert.equal(job.location, 'New Delhi, India')
})

test('Belzabar run validates the homepage, the canonical listing page, and detail pages', async () => {
  const belzabar = await loadBelzabarModule()
  const requestedUrls = []

  const jobs = await belzabar.createBelzabarScraper({
    maxJobs: 2,
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === belzabar.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === belzabar.CAREERS_URL) {
        return { status: 200, url, html: careersOutputHtml }
      }

      if (url === 'https://www.belzabar.com/jobs/senior-infrastructure-engineer-linux') {
        return { status: 200, url, html: devOpsDetailHtml }
      }

      if (url === 'https://www.belzabar.com/jobs/qa-engineer') {
        return { status: 200, url, html: qaEngineerDetailHtml }
      }

      throw new Error(`Unexpected Belzabar URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    belzabar.HOMEPAGE_URL,
    belzabar.CAREERS_URL,
    'https://www.belzabar.com/jobs/senior-infrastructure-engineer-linux',
    'https://www.belzabar.com/jobs/qa-engineer',
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.source, job.link, job.scrapedAt]),
    [
      [
        'Senior DevOps Engineer',
        'belzabar',
        'https://www.belzabar.com/jobs/senior-infrastructure-engineer-linux',
        FIXED_SCRAPED_AT,
      ],
      [
        'QA Engineer',
        'belzabar',
        'https://www.belzabar.com/jobs/qa-engineer',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
})

test('Belzabar retries transient homepage proxy errors before validating the official surface', async () => {
  const belzabar = await loadBelzabarModule()
  const requestedUrls = []
  let homepageAttempts = 0

  const jobs = await belzabar.createBelzabarScraper({
    maxJobs: 1,
    now: () => FIXED_SCRAPED_AT,
    homepageRetryDelayMs: 0,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === belzabar.HOMEPAGE_URL) {
        homepageAttempts += 1
        if (homepageAttempts < 3) return { status: 502, url, html: proxyErrorHtml }
        return { status: 200, url, html: homepageHtml }
      }
      if (url === belzabar.CAREERS_URL) return { status: 200, url, html: careersOutputHtml }
      if (url === 'https://www.belzabar.com/jobs/senior-infrastructure-engineer-linux') {
        return { status: 200, url, html: devOpsDetailHtml }
      }

      throw new Error(`Unexpected Belzabar URL: ${url}`)
    },
  })

  assert.equal(homepageAttempts, 3)
  assert.deepEqual(jobs.map((job) => job.title), ['Senior DevOps Engineer'])
  assert.deepEqual(requestedUrls, [
    belzabar.HOMEPAGE_URL,
    belzabar.HOMEPAGE_URL,
    belzabar.HOMEPAGE_URL,
    belzabar.CAREERS_URL,
    'https://www.belzabar.com/jobs/senior-infrastructure-engineer-linux',
  ])
})

test('Belzabar fails closed when the verified homepage link, careers listing, or detail apply surface drifts', async () => {
  const belzabar = await loadBelzabarModule()

  await assert.rejects(
    belzabar.createBelzabarScraper().run({
      fetchPage: async (url) => {
        if (url === belzabar.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Belzabar Software</title></head><body>No careers link</body></html>',
          }
        }

        throw new Error(`Unexpected Belzabar URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    belzabar.createBelzabarScraper().run({
      fetchPage: async (url) => {
        if (url === belzabar.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === belzabar.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersOutputHtml.replace('/jobs/qa-engineer', '/pages/contact'),
          }
        }

        throw new Error(`Unexpected Belzabar URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    belzabar.createBelzabarScraper({ maxJobs: 1 }).run({
      fetchPage: async (url) => {
        if (url === belzabar.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === belzabar.CAREERS_URL) {
          return { status: 200, url, html: careersOutputHtml }
        }

        if (url === 'https://www.belzabar.com/jobs/senior-infrastructure-engineer-linux') {
          return {
            status: 200,
            url,
            html: devOpsDetailHtml.replace('Applying For *', 'Application removed'),
          }
        }

        throw new Error(`Unexpected Belzabar URL: ${url}`)
      },
    }),
    /verified job detail/i,
  )
})
