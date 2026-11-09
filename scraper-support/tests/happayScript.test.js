import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Expense Management Software | Spend Management System & Solution</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Amazing things happen at Happay all the time.</p>
      <p>Begin your journey of excellence with Indias leading Travel, Expense and Payment Management Solution.</p>
      <img alt="Happay-MMT Logo" src="/logo.png">
      <footer>&#169; 2026 Makemytrip (India) Private Limited. All rights reserved</footer>
    </main>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - Expense Management Software | Spend Management System & Solution</title>
  </head>
  <body>
    <main>
      <h1>Jobs</h1>
      <p>Expense Management</p>
      <p>Travel Management</p>
      <img alt="Happay-MMT Logo" src="/logo.png">
    </main>
  </body>
</html>
`

const contactPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Looking to get in touch with us?</h1>
      <p>To join the Happay team</p>
      <p>careers@happay.in</p>
      <p>MakeMyTrip (India) Limited</p>
      <p>Bengaluru office address</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/happay/script.js')
  } catch {
    assert.fail('Expected Happay scraper module at ../../scraper/happay/script.js')
  }
}

test('Happay helpers stay pinned to the verified first-party careers and jobs pages from Sunday, August 2, 2026', async () => {
  const happay = await loadModule()

  assert.equal(happay.SOURCE, 'happay')
  assert.equal(happay.COMPANY, 'Happay')
  assert.equal(happay.CAREERS_URL, 'https://happay.com/careers/')
  assert.equal(happay.JOBS_PAGE_URL, 'https://happay.com/jobs/')
  assert.equal(happay.CONTACT_PAGE_URL, 'https://happay.com/contact-us/')
  assert.equal(happay.VERIFIED_ON, '2026-07-17')
  assert.equal(happay.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(happay.hasBrokenJobsShortcodeSignal(jobsPageHtml), true)
  assert.equal(happay.hasOfficialCareersContactSignal(contactPageHtml), true)
  assert.equal(happay.pageExposesStructuredJobListings(jobsPageHtml), false)
})

test('Happay returns no jobs only while the verified first-party jobs page remains a non-listing shell', async () => {
  const happay = await loadModule()
  const requestedUrls = []

  const jobs = await happay.createHappayScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === happay.CAREERS_URL) return careersPageHtml
      if (url === happay.JOBS_PAGE_URL) return jobsPageHtml
      if (url === happay.CONTACT_PAGE_URL) return contactPageHtml
      throw new Error(`Unexpected Happay URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    happay.CAREERS_URL,
    happay.JOBS_PAGE_URL,
    happay.CONTACT_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Happay fails closed when the verified careers identity changes or a structured public jobs surface appears', async () => {
  const happay = await loadModule()

  await assert.rejects(
    happay.createHappayScraper().run({
      fetchText: async (url) => {
        if (url === happay.CAREERS_URL) return '<html><body><h1>Jobs</h1></body></html>'
        if (url === happay.JOBS_PAGE_URL) return jobsPageHtml
        if (url === happay.CONTACT_PAGE_URL) return contactPageHtml
        throw new Error(`Unexpected Happay URL: ${url}`)
      },
    }),
    /verified Happay careers page/i,
  )

  await assert.rejects(
    happay.createHappayScraper().run({
      fetchText: async (url) => {
        if (url === happay.CAREERS_URL) return careersPageHtml
        if (url === happay.JOBS_PAGE_URL) {
          return `
            <!doctype html>
            <html>
              <body>
                <main>
                  <h1>Jobs</h1>
                  <article class="job-card">
                    <h2>Engineering Manager</h2>
                    <a href="https://happay.com/jobs/engineering-manager">Apply now</a>
                  </article>
                </main>
              </body>
            </html>
          `
        }
        if (url === happay.CONTACT_PAGE_URL) return contactPageHtml
        throw new Error(`Unexpected Happay URL: ${url}`)
      },
    }),
    /structured public job listings/i,
  )
})
