import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jana Small Finance Bank</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>A career with us is more than just a job.</p>
    <a href="/index.php/career/current-openings">Current Openings</a>
    <p>Jana Small Finance Bank</p>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>A career with us is more than just a job. We seek to create an environment of trust, transparency and respect.</p>
    <a href="/index.php/career/current-openings">Click here to view our current openings.</a>
    <p>Jana Small Finance Bank will never ask or accept payment from anyone seeking employment with us.</p>
  </body>
</html>
`

const CURRENT_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Opening</title>
  </head>
  <body>
    <h1>Current Opening</h1>
    <p>Share your resume with us at careers@jana.bank.in and mention the Job Role in the subject line for the role you wish to explore.</p>
  </body>
</html>
`

const CURRENT_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jana Small Finance Bank Careers</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h2>A culture of learn and grow</h2>
    <a href="/index.php/career/current-openings">Click here to view our current openings</a>
    <h2>Why choose Jana</h2>
    <p>Thinking about joining us? Here are the top ten reasons why that’s a great idea.</p>
    <h3>1. Dig in on your first day</h3>
    <h3>3. Count on us for career growth</h3>
    <p>JANA Small Finance Bank</p>
  </body>
</html>
`

const CURRENT_OPENINGS_404_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 - Category not found</title>
  </head>
  <body>
    <h1>404 - Category not found</h1>
    <p>You may not be able to visit this page because of:</p>
    <p>The requested resource was not found.</p>
    <p>Please try one of the following pages: Home Page</p>
    <p>Category not found</p>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Opening</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Relationship Officer"}
    </script>
  </head>
  <body>
    <h1>Current Opening</h1>
    <a href="/jobs/relationship-officer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/janasmallfinancebank/script.js')
  } catch {
    assert.fail(
      'Expected Jana Small Finance Bank scraper module at ../../scraper/janasmallfinancebank/script.js',
    )
  }
}

test('Jana Small Finance Bank helpers stay pinned to the verified first-party careers-email handoff surface', async () => {
  const janaSmallFinanceBank = await loadModule()

  assert.equal(janaSmallFinanceBank.SOURCE, 'janasmallfinancebank')
  assert.equal(janaSmallFinanceBank.COMPANY, 'Jana Small Finance Bank')
  assert.equal(janaSmallFinanceBank.HOMEPAGE_URL, 'https://www.jana.bank.in/')
  assert.equal(
    janaSmallFinanceBank.CAREERS_URL,
    'https://www.jana.bank.in/about-us/careers-hm/',
  )
  assert.equal(
    janaSmallFinanceBank.CURRENT_OPENINGS_URL,
    'https://www.jana.bank.in/index.php/career/current-openings',
  )
  assert.equal(janaSmallFinanceBank.COMPANY_DOMAIN, 'jana.bank.in')
  assert.equal(janaSmallFinanceBank.VERIFIED_ON, '2026-07-26')
  assert.equal(
    janaSmallFinanceBank.extractCurrentOpeningsUrl(HOMEPAGE_HTML),
    janaSmallFinanceBank.CURRENT_OPENINGS_URL,
  )
  assert.equal(janaSmallFinanceBank.hasVerifiedHomepageSignals(HOMEPAGE_HTML), true)
  assert.equal(janaSmallFinanceBank.hasVerifiedCareersSignals(CAREERS_HTML), true)
  assert.equal(janaSmallFinanceBank.hasVerifiedCurrentOpeningsSignals(CURRENT_OPENINGS_HTML), true)
  assert.equal(janaSmallFinanceBank.hasPublicJobSignals(CURRENT_OPENINGS_HTML), false)
  assert.equal(janaSmallFinanceBank.hasPublicJobSignals(PUBLIC_JOBS_HTML), true)
})

test('Jana Small Finance Bank returns [] while the verified first-party surface remains a generic email handoff', async () => {
  const janaSmallFinanceBank = await loadModule()
  const requestedUrls = []

  const jobs = await janaSmallFinanceBank.createJanaSmallFinanceBankScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === janaSmallFinanceBank.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === janaSmallFinanceBank.CAREERS_URL) return CAREERS_HTML
      if (url === janaSmallFinanceBank.CURRENT_OPENINGS_URL) return CURRENT_OPENINGS_HTML
      throw new Error(`Unexpected Jana Small Finance Bank URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    janaSmallFinanceBank.HOMEPAGE_URL,
    janaSmallFinanceBank.CAREERS_URL,
    janaSmallFinanceBank.CURRENT_OPENINGS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Jana Small Finance Bank returns [] for the current branded careers page and linked branded 404 openings surface', async () => {
  const janaSmallFinanceBank = await loadModule()
  const requestedUrls = []

  assert.equal(
    janaSmallFinanceBank.extractCurrentOpeningsUrl(CURRENT_CAREERS_HTML),
    janaSmallFinanceBank.CURRENT_OPENINGS_URL,
  )
  assert.equal(janaSmallFinanceBank.hasVerifiedHomepageSignals(HOMEPAGE_HTML), true)
  assert.equal(janaSmallFinanceBank.hasVerifiedCareersSignals(CURRENT_CAREERS_HTML), true)
  assert.equal(
    janaSmallFinanceBank.hasVerifiedCurrentOpeningsSignals(CURRENT_OPENINGS_404_HTML),
    true,
  )
  assert.equal(janaSmallFinanceBank.hasPublicJobSignals(CURRENT_CAREERS_HTML), false)
  assert.equal(janaSmallFinanceBank.hasPublicJobSignals(CURRENT_OPENINGS_404_HTML), false)

  const jobs = await janaSmallFinanceBank.createJanaSmallFinanceBankScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === janaSmallFinanceBank.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === janaSmallFinanceBank.CAREERS_URL) return CURRENT_CAREERS_HTML
      if (url === janaSmallFinanceBank.CURRENT_OPENINGS_URL) return CURRENT_OPENINGS_404_HTML
      throw new Error(`Unexpected Jana Small Finance Bank URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    janaSmallFinanceBank.HOMEPAGE_URL,
    janaSmallFinanceBank.CAREERS_URL,
    janaSmallFinanceBank.CURRENT_OPENINGS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Jana Small Finance Bank returns [] when the linked current-openings route responds with HTTP 404 but still serves the verified branded 404 surface', async () => {
  const janaSmallFinanceBank = await loadModule()
  const requestedTextUrls = []
  const requestedPageUrls = []

  const jobs = await janaSmallFinanceBank.createJanaSmallFinanceBankScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === janaSmallFinanceBank.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === janaSmallFinanceBank.CAREERS_URL) return CURRENT_CAREERS_HTML
      if (url === janaSmallFinanceBank.CURRENT_OPENINGS_URL) {
        throw new Error(`HTTP 404 for ${url}`)
      }
      throw new Error(`Unexpected Jana Small Finance Bank text URL: ${url}`)
    },
    fetchPage: async (url) => {
      requestedPageUrls.push(url)
      if (url === janaSmallFinanceBank.CURRENT_OPENINGS_URL) {
        return {
          status: 404,
          url,
          html: CURRENT_OPENINGS_404_HTML,
        }
      }
      throw new Error(`Unexpected Jana Small Finance Bank page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    janaSmallFinanceBank.HOMEPAGE_URL,
    janaSmallFinanceBank.CAREERS_URL,
    janaSmallFinanceBank.CURRENT_OPENINGS_URL,
  ])
  assert.deepEqual(requestedPageUrls, [janaSmallFinanceBank.CURRENT_OPENINGS_URL])
  assert.deepEqual(jobs, [])
})

test('Jana Small Finance Bank fails closed when the verified first-party surface drifts into a public jobs board', async () => {
  const janaSmallFinanceBank = await loadModule()

  await assert.rejects(
    janaSmallFinanceBank.run({
      fetchText: async (url) => {
        if (url === janaSmallFinanceBank.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === janaSmallFinanceBank.CAREERS_URL) return CAREERS_HTML
        if (url === janaSmallFinanceBank.CURRENT_OPENINGS_URL) return PUBLIC_JOBS_HTML
        throw new Error(`Unexpected Jana Small Finance Bank URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
