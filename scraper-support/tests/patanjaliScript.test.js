import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>career &#8211; Patanjali Ayurved</title>
  </head>
  <body>
    <main>
      <p>
        <iframe
          style="border: none; width: 100%; height: 500px;"
          src="https://patanjaliayurved.org/career.php"
          title="Iframe Example"
        ></iframe>
      </p>
    </main>
  </body>
</html>
`

const APPLICATION_FORM_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Application Form</title>
  </head>
  <body>
    <main>
      <h2 class="my-4">Job Application Form</h2>
      <label for="category">Category for</label>
      <select id="category">
        <option value="" selected disabled>Select Category</option>
        <option value="ASM">ASM</option>
        <option value="TSI">TSI</option>
      </select>
      <h5>Upload Your Resume</h5>
    </main>
  </body>
</html>
`

const CONTACT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us &#8211; Patanjali Ayurved</title>
  </head>
  <body>
    <main>
      <h4>For Career</h4>
      <p><a href="http://career@patanjaliayurved.org">career@patanjaliayurved.org</a></p>
      <a href="https://patanjaliayurved.org/career.html">Career</a>
    </main>
  </body>
</html>
`

const CAUTION_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Caution Notice &#8211; Patanjali Ayurved</title>
  </head>
  <body>
    <main>
      <p>
        some third parties issuing the fake appointment letter for the confirm jobs in
        PATANJALI AYURVED LIMITED or in its group companies/trust against some money.
      </p>
      <p>
        PATANAJLI AYURVED LIMITED or its group companies/trust don’t charge money from the
        candidates by any mode and the public are advised not to be attracted by
        communication which promise jobs.
      </p>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Area Sales Manager"}
    </script>
    <a href="https://jobs.example.com/patanjali/asm">Apply now</a>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/patanjali/script.js')
  } catch {
    assert.fail('Expected Patanjali scraper module at ../../scraper/patanjali/script.js')
  }
}

test('Patanjali sentinel helpers stay pinned to the verified iframe career page, application form, and caution notice', async () => {
  const patanjali = await loadScriptModule()

  assert.equal(patanjali.SOURCE, 'patanjali')
  assert.equal(patanjali.COMPANY, 'Patanjali')
  assert.equal(patanjali.OFFICIAL_BRAND_NAME, 'Patanjali Ayurved')
  assert.equal(patanjali.VERIFIED_ON, '2026-07-17')
  assert.equal(patanjali.HOMEPAGE_URL, 'https://patanjaliayurved.org/')
  assert.equal(patanjali.CAREERS_PAGE_URL, 'https://patanjaliayurved.org/career.html')
  assert.equal(patanjali.APPLICATION_FORM_URL, 'https://patanjaliayurved.org/career.php')
  assert.equal(patanjali.CONTACT_PAGE_URL, 'https://patanjaliayurved.org/contact.html')
  assert.equal(patanjali.CAUTION_NOTICE_URL, 'https://patanjaliayurved.org/caution-notice.html')
  assert.equal(patanjali.CAREER_EMAIL, 'career@patanjaliayurved.org')
  assert.equal(patanjali.hasOfficialCareersPageSignal(CAREERS_PAGE_HTML), true)
  assert.equal(
    patanjali.extractEmbeddedApplicationFormUrl(CAREERS_PAGE_HTML),
    'https://patanjaliayurved.org/career.php',
  )
  assert.equal(patanjali.hasOfficialApplicationFormSignal(APPLICATION_FORM_HTML), true)
  assert.equal(patanjali.hasOfficialContactPageSignal(CONTACT_PAGE_HTML), true)
  assert.equal(patanjali.extractCareerEmail(CONTACT_PAGE_HTML), 'career@patanjaliayurved.org')
  assert.equal(patanjali.hasOfficialCautionNoticeSignal(CAUTION_PAGE_HTML), true)
  assert.equal(patanjali.pageExposesPublicJobListings(CAREERS_PAGE_HTML), false)
  assert.equal(patanjali.pageExposesPublicJobListings(APPLICATION_FORM_HTML), false)
  assert.equal(patanjali.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('Patanjali returns [] while the official surface remains an iframe handoff to a generic application form with no public job listings', async () => {
  const patanjali = await loadScriptModule()
  const requestedUrls = []

  const jobs = await patanjali.createPatanjaliScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === patanjali.CAREERS_PAGE_URL) {
        return { status: 200, url, html: CAREERS_PAGE_HTML }
      }

      if (url === patanjali.APPLICATION_FORM_URL) {
        return { status: 200, url, html: APPLICATION_FORM_HTML }
      }

      if (url === patanjali.CONTACT_PAGE_URL) {
        return { status: 200, url, html: CONTACT_PAGE_HTML }
      }

      if (url === patanjali.CAUTION_NOTICE_URL) {
        return { status: 200, url, html: CAUTION_PAGE_HTML }
      }

      throw new Error(`Unexpected Patanjali URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    patanjali.CAREERS_PAGE_URL,
    patanjali.APPLICATION_FORM_URL,
    patanjali.CONTACT_PAGE_URL,
    patanjali.CAUTION_NOTICE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Patanjali fails closed when the verified surface drifts or begins exposing public job listings', async () => {
  const patanjali = await loadScriptModule()

  await assert.rejects(
    patanjali.createPatanjaliScraper().run({
      fetchPage: async (url) => {
        if (url === patanjali.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected Patanjali URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    patanjali.createPatanjaliScraper().run({
      fetchPage: async (url) => {
        if (url === patanjali.CAREERS_PAGE_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected Patanjali URL: ${url}`)
      },
    }),
    /careers page now appears to expose public jobs/i,
  )

  await assert.rejects(
    patanjali.createPatanjaliScraper().run({
      fetchPage: async (url) => {
        if (url === patanjali.CAREERS_PAGE_URL) {
          return { status: 200, url, html: CAREERS_PAGE_HTML }
        }

        if (url === patanjali.APPLICATION_FORM_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        throw new Error(`Unexpected Patanjali URL: ${url}`)
      },
    }),
    /application form now appears to expose public jobs/i,
  )
})
