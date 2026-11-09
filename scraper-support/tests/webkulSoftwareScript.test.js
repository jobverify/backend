import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T12:00:00.000Z'

const jobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - Webkul Software</title>
  </head>
  <body>
    <h1>Open Positions</h1>
    <a href="https://webkul.com/jobs/it-cloud-engineer/" op-id="it-cloud-engineer" class="op-block op-next">
      <h5 class="op-name">IT Cloud Engineer</h5>
      <div class="op-info">
        <span>Experience: 02-05 years</span>
        <span>Open Position: 10</span>
      </div>
    </a>
    <a href="https://webkul.com/jobs/performance-marketing-specialist/" op-id="performance-marketing-specialist" class="op-block op-next">
      <h5 class="op-name">Performance Marketing Specialist</h5>
      <div class="op-info">
        <span>Experience: 3-5 Year</span>
        <span>Open Position: 5</span>
      </div>
    </a>
  </body>
</html>
`

const noListingsJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - Webkul Software</title>
  </head>
  <body>
    <h1>Open Positions</h1>
    <p>Here is the list of open positions that we are currently hiring.</p>
    <section class="wk-open-position text-left">
      <section class="wk-openjobs-tabs text-center">
        <span data-content="engineering" class="job-group">Engineering</span>
        <span data-content="business" class="job-group">Business</span>
        <span data-content="design" class="job-group">Design</span>
        <span data-content="quality-analyst" class="job-group">Quality Analyst</span>
        <span data-content="finance" class="job-group">Finance</span>
      </section>
      <div class="wk-follow-us">
        <p>You can follow us on Linkedin to recieve job updates.</p>
      </div>
    </section>
    <h2>Didn't find relevant opportunity?</h2>
    <p>We’re always looking forward to work with great ideas and top talent.</p>
  </body>
</html>
`

const itCloudEngineerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IT Cloud Engineer - Webkul Software</title>
  </head>
  <body>
    <h1>IT Cloud Engineer</h1>
    <span class="exp" data-val="02-05 years">Experience</span>
    <span class="count" data-val="10">Openings</span>
    <span class="job-location" data-val="Noida">Job Location</span>
    <span class="job-education" data-val="MCA/B.Tech-CS/IT/B.E">Education</span>
    <button data-profile="IT Cloud Engineer" data-category="Engineering" data-slug="cloud-engineer" class="wk-button btn-dark apply-by-github-btn">Apply By Github</button>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "IT Cloud Engineer",
        "url": "https://webkul.com/jobs/cloud-engineer",
        "description": "<p>Design and maintain cloud infrastructure for our e-commerce platform.</p>",
        "datePosted": "2026-01-01",
        "validThrough": "2026-12-31",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Webkul Software"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Noida",
            "addressCountry": "IND"
          }
        }
      }
    </script>
  </body>
</html>
`

const performanceMarketingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Performance Marketing Specialist - Webkul Software</title>
  </head>
  <body>
    <h1>Performance Marketing Specialist</h1>
    <span class="exp" data-val="3-5 Year">Experience</span>
    <span class="count" data-val="5">Openings</span>
    <span class="job-location" data-val="Noida (Work From Office)">Job Location</span>
    <span class="job-education" data-val="MBA">Education</span>
    <button data-profile="Performance Marketing Specialist" data-category="Marketing" data-slug="performance-marketing-specialist" class="wk-button btn-dark apply-by-github-btn">Apply By Github</button>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Performance Marketing Specialist",
        "description": "<p>Own performance marketing campaigns and reporting.</p>",
        "employmentType": "FULL_TIME",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Noida",
            "addressCountry": "IND"
          }
        }
      }
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/webkulsoftware/script.js')
  } catch {
    assert.fail('Expected Webkul Software scraper module at ../../scraper/webkulsoftware/script.js')
  }
}

test('Webkul Software validates the first-party jobs page and parses inline job cards', async () => {
  const webkul = await loadModule()

  assert.equal(webkul.SOURCE, 'webkulsoftware')
  assert.equal(webkul.COMPANY, 'Webkul Software')
  assert.equal(webkul.JOBS_URL, 'https://webkul.com/jobs/')
  assert.equal(webkul.VERIFIED_ON, '2026-08-15')
  assert.equal(webkul.hasOfficialJobsPageSignal(jobsHtml), true)
  assert.equal(webkul.hasOfficialNoListingsShellSignal(noListingsJobsHtml), true)

  const cards = webkul.extractJobCards(jobsHtml)
  assert.equal(cards.length, 2)
  assert.equal(cards[0].title, 'IT Cloud Engineer')
  assert.equal(cards[1].detailUrl, 'https://webkul.com/jobs/performance-marketing-specialist/')
})

test('Webkul Software run returns jobs from the verified first-party listing and detail pages', async () => {
  const webkul = await loadModule()

  const jobs = await webkul.createWebkulSoftwareScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === webkul.JOBS_URL) return jobsHtml
      if (url === 'https://webkul.com/jobs/it-cloud-engineer/') return itCloudEngineerHtml
      if (url === 'https://webkul.com/jobs/performance-marketing-specialist/') return performanceMarketingHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'IT Cloud Engineer')
  assert.equal(jobs[0].location, 'Noida')
  assert.equal(jobs[0].experienceRequired, '02-05 years')
  assert.equal(jobs[0].minimumQualification, 'MCA/B.Tech-CS/IT/B.E')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'Performance Marketing Specialist')
  assert.equal(jobs[1].location, 'Noida (Work From Office)')
  assert.equal(jobs[1].employmentType, 'FULL_TIME')
})

test('Webkul Software returns [] when the verified first-party jobs page degrades to the current no-listings shell', async () => {
  const webkul = await loadModule()

  const jobs = await webkul.createWebkulSoftwareScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === webkul.JOBS_URL) return noListingsJobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Webkul Software fails closed when the verified first-party jobs contract changes', async () => {
  const webkul = await loadModule()

  await assert.rejects(
    webkul.createWebkulSoftwareScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified first-party jobs surface/i,
  )
})
