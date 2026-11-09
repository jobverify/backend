import assert from 'node:assert/strict'
import test from 'node:test'

const loadKnowlarityModule = async () => {
  try {
    return await import('../../scraper/knowlarity/script.js')
  } catch {
    assert.fail('Expected Knowlarity scraper module at ../../scraper/knowlarity/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Best B2B Company to Work for - Jobs @ Knowlarity India</title>
    <link rel="canonical" href="https://www.knowlarity.com/careers" />
  </head>
  <body>
    <nav>
      <a href="/aboutus">About Us</a>
      <a href="/careers">Careers</a>
    </nav>
    <main>
      <h1>Join us to create impact</h1>
      <h2>Build a career of your potential</h2>
      <div class="job_maincontainer__ww9PU">
        <div class="job_job__HFNNu">JOB OPENINGS</div>
        <div class="job_dropdown__H3z7l">
          <select class="job_location__FyZl7"><option value="location">Location</option></select>
          <select class="job_department__7AadB"><option value="department">Department</option></select>
        </div>
      </div>
      <div class="dropdown_container__cS1u3">
        <div data-accordion-component="Accordion" class="dropdown_container1___1Wo0"></div>
      </div>
      <div class="email_container__nfjtx">
        <p>Not Matched any profile</p>
        <button>EMAIL US YOUR RESUME</button>
      </div>
    </main>
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"careersHome":{"heading":"Join us to create impact"},"jobOpening":[]}}}
    </script>
  </body>
</html>
`

const placeholderJobsHtml = careersPageHtml.replace(
  '"jobOpening":[]',
  `"jobOpening":[
    {
      "id":15,
      "JobTitle":null,
      "Tenure":null,
      "Location":null,
      "LocationPath":null,
      "Department":null,
      "DepartmentPath":null,
      "Experience":null,
      "publishDate":null,
      "Description":null,
      "Responsibility":null,
      "DesiredProfile":null,
      "FunctionalCompetencies":null,
      "published_at":"2026-08-29T14:09:34.000Z",
      "created_at":"2026-08-29T14:09:34.000Z",
      "updated_at":"2026-08-29T14:09:34.000Z",
      "Fulltime":null,
      "Duration":null,
      "DatePublished":null
    },
    {
      "id":16,
      "JobTitle":null,
      "Tenure":null,
      "Location":null,
      "LocationPath":null,
      "Department":null,
      "DepartmentPath":null,
      "Experience":null,
      "publishDate":null,
      "Description":null,
      "Responsibility":null,
      "DesiredProfile":null,
      "FunctionalCompetencies":null,
      "published_at":"2026-08-29T14:09:35.000Z",
      "created_at":"2026-08-29T14:09:35.000Z",
      "updated_at":"2026-08-29T14:09:35.000Z",
      "Fulltime":null,
      "Duration":null,
      "DatePublished":null
    }
  ]`,
).replace(
  '<div data-accordion-component="Accordion" class="dropdown_container1___1Wo0"></div>',
  `<div data-accordion-component="Accordion" class="dropdown_container1___1Wo0">
    <div data-accordion-component="AccordionItem">
      <div class="dropdown_manager__OhGO3"></div>
      <div class="dropdown_location__yLgPF">Location : | Work Experience :</div>
      <button class="dropdown_button__4H7yd">Apply Now</button>
    </div>
  </div>`,
)

const nonEmptyJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Best B2B Company to Work for - Jobs @ Knowlarity India</title>
  </head>
  <body>
    <main>
      <div>JOB OPENINGS</div>
      <div class="accordion-item">
        <h3>Account Executive</h3>
        <p>Location: Gurugram</p>
      </div>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"jobOpening":[{"title":"Account Executive","location":"Gurugram"}]}}}
      </script>
    </main>
  </body>
</html>
`

const driftedCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <main><p>No careers structure</p></main>
  </body>
</html>
`

test('Knowlarity pins the verified official empty-state careers page and embedded empty job array', async () => {
  const knowlarity = await loadKnowlarityModule()

  assert.equal(knowlarity.SOURCE, 'knowlarity')
  assert.equal(knowlarity.COMPANY, 'Knowlarity')
  assert.equal(knowlarity.VERIFIED_ON, '2026-08-15')
  assert.equal(knowlarity.HOMEPAGE_URL, 'https://www.knowlarity.com/')
  assert.equal(knowlarity.CAREERS_URL, 'https://www.knowlarity.com/careers')

  assert.equal(knowlarity.hasVerifiedCareersPageSignal(careersPageHtml), true)
  assert.equal(knowlarity.hasEmbeddedEmptyJobOpeningState(careersPageHtml), true)
  assert.equal(knowlarity.hasRenderablePublicJobsSignal(careersPageHtml), false)
  assert.equal(knowlarity.hasRenderablePublicJobsSignal(placeholderJobsHtml), false)
  assert.equal(knowlarity.hasRenderablePublicJobsSignal(nonEmptyJobsHtml), true)
})

test('Knowlarity sentinel returns [] only while the official careers page stays in the verified empty-state contract', async () => {
  const knowlarity = await loadKnowlarityModule()
  const requestedUrls = []

  const jobs = await knowlarity.createKnowlarityScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === knowlarity.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [knowlarity.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Knowlarity accepts only fully null first-party placeholder records as a non-renderable empty state', async () => {
  const knowlarity = await loadKnowlarityModule()

  const jobs = await knowlarity.createKnowlarityScraper().run({
    fetchPage: async (url) => ({ status: 200, url, html: placeholderJobsHtml }),
  })

  assert.deepEqual(jobs, [])

  const partialRecordHtml = placeholderJobsHtml.replace(
    '"JobTitle":null',
    '"JobTitle":"Account Executive"',
  )
  await assert.rejects(
    knowlarity.createKnowlarityScraper().run({
      fetchPage: async (url) => ({ status: 200, url, html: partialRecordHtml }),
    }),
    /public jobs surface/i,
  )
})

test('Knowlarity falls back to the browser-backed page fetch when direct TLS validation fails', async () => {
  const knowlarity = await loadKnowlarityModule()
  const requestedUrls = []

  const jobs = await knowlarity.createKnowlarityScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(`direct:${url}`)
      throw new Error('fetch failed | unable to verify the first certificate')
    },
    fetchBrowserPage: async (url) => {
      requestedUrls.push(`browser:${url}`)
      return { status: 200, url, html: careersPageHtml }
    },
  })

  assert.deepEqual(requestedUrls, [
    `direct:${knowlarity.CAREERS_URL}`,
    `browser:${knowlarity.CAREERS_URL}`,
  ])
  assert.deepEqual(jobs, [])
})

test('Knowlarity fails closed when both direct and browser-backed careers fetches time out', async () => {
  const knowlarity = await loadKnowlarityModule()

  await assert.rejects(
    knowlarity.createKnowlarityScraper().run({
      fetchPage: async () => {
        throw new Error(
          'fetch failed | Connect Timeout Error (attempted address: www.knowlarity.com:443, timeout: 10000ms)',
        )
      },
      fetchBrowserPage: async () => {
        throw new Error(
          'fetch failed | Connect Timeout Error (attempted address: www.knowlarity.com:443, timeout: 10000ms)',
        )
      },
    }),
    /timeout/i,
  )
})

test('Knowlarity sentinel fails closed when the official careers page drifts or starts exposing public jobs', async () => {
  const knowlarity = await loadKnowlarityModule()

  await assert.rejects(
    knowlarity.createKnowlarityScraper().run({
      fetchPage: async (url) => {
        if (url === knowlarity.CAREERS_URL) {
          return { status: 200, url, html: driftedCareersPageHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    knowlarity.createKnowlarityScraper().run({
      fetchPage: async (url) => {
        if (url === knowlarity.CAREERS_URL) {
          return { status: 200, url, html: nonEmptyJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
