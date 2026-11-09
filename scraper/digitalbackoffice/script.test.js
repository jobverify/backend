import assert from 'node:assert/strict'
import test from 'node:test'

const loadDigitalBackOfficeModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Digital Back Office scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Digital Back Office - Keeping You Connected</title>
  </head>
  <body>
    <main>
      <h1>Why work with Digital Back Office?</h1>
      <p>Connecticut managed IT services and infrastructure support.</p>
      <a href="/it-services-connecticut/">IT Services</a>
    </main>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact An IT Professional - Digital Back Office</title>
    <link rel="canonical" href="https://www.digitalbackoffice.com/contact-it-professional/" />
  </head>
  <body>
    <main>
      <h1>Contact An IT Professional</h1>
      <p>Reach out to the Digital Back Office team to discuss your IT needs.</p>
    </main>
  </body>
</html>
`

test('Digital Back Office validates the official homepage and the verified contact-form jobs route', async () => {
  const digitalBackOffice = await loadDigitalBackOfficeModule()

  assert.equal(digitalBackOffice.HOMEPAGE_URL, 'https://www.digitalbackoffice.com/')
  assert.equal(digitalBackOffice.JOBS_PAGE_URL, 'https://www.digitalbackoffice.com/it-jobs/')
  assert.equal(digitalBackOffice.hasOfficialDigitalBackOfficeSignal(homepageHtml), true)
  assert.equal(digitalBackOffice.hasVerifiedContactRouteSignal(jobsPageHtml), true)
  assert.equal(digitalBackOffice.hasPublicJobBoardSignal(homepageHtml), false)
  assert.equal(digitalBackOffice.hasPublicJobBoardSignal(jobsPageHtml), false)
})

test('Digital Back Office returns an empty set when the official jobs route remains a contact form with no public listings', async () => {
  const digitalBackOffice = await loadDigitalBackOfficeModule()
  const requestedUrls = []

  const jobs = await digitalBackOffice.createDigitalBackOfficeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === digitalBackOffice.HOMEPAGE_URL) return homepageHtml
      if (url === digitalBackOffice.JOBS_PAGE_URL) return jobsPageHtml

      throw new Error(`Unexpected Digital Back Office fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    digitalBackOffice.HOMEPAGE_URL,
    digitalBackOffice.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Digital Back Office throws when the official jobs route starts exposing public job listings', async () => {
  const digitalBackOffice = await loadDigitalBackOfficeModule()

  await assert.rejects(
    digitalBackOffice.createDigitalBackOfficeScraper().run({
      fetchText: async (url) => {
        if (url === digitalBackOffice.HOMEPAGE_URL) return homepageHtml
        if (url === digitalBackOffice.JOBS_PAGE_URL) {
          return `
            <main>
              <h1>Digital Back Office Careers</h1>
              <a href="/jobs/apply/648/">Apply Now</a>
              <p>Current openings</p>
            </main>
          `
        }

        throw new Error(`Unexpected Digital Back Office fixture URL: ${url}`)
      },
    }),
    /public site now appears to expose job listings/i,
  )
})
