import assert from 'node:assert/strict'
import test from 'node:test'

const loadAnantaAspenCentreModule = async () => {
  try {
    return await import('../../scraper/anantaaspencentre/script.js')
  } catch {
    assert.fail('Expected Ananta Aspen Centre scraper module at ../../scraper/anantaaspencentre/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Ananta Centre</title>
    <link rel="canonical" href="https://anantacentre.in/" />
  </head>
  <body>
    <nav>
      <ul>
        <li><a href="https://anantacentre.in/careers/" class="elementor-sub-item">Careers</a></li>
      </ul>
    </nav>
    <h2>Mission</h2>
    <footer>Ananta Centre</footer>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers &#8211; Ananta Centre</title>
    <link rel="canonical" href="https://anantacentre.in/careers/" />
  </head>
  <body>
    <h2 class="elementor-heading-title elementor-size-default">CAREERS</h2>
    <a href="#elementor-action:action=popup:open&settings=eyJpZCI6NDEzNDd9">
      <span class="elementor-button-text">Apply Now</span>
    </a>
    <div data-elementor-type="popup" data-elementor-id="41347" class="elementor elementor-41347 elementor-location-popup">
      <h2 class="elementor-heading-title elementor-size-default">Apply Now</h2>
      <label for="form-field-field_ec80977">Name</label>
      <input size="1" type="text" name="form_fields[field_ec80977]" id="form-field-field_ec80977" placeholder="Name" required="required">
      <input type="number" name="form_fields[field_8741318]" id="form-field-field_8741318" placeholder="Mobile Number" required="required">
      <label for="form-field-email">Email</label>
      <input type="email" name="form_fields[email]" id="form-field-email" required="required">
      <div class="elementor-field-type-upload elementor-field-group elementor-field-group-field_c50b0ba">
        <input type="file" name="form_fields[field_c50b0ba]" id="form-field-field_c50b0ba" class="elementor-upload-field" required="required">
      </div>
      <label for="form-field-field_0f9a819">Are you applying for an internship?</label>
      <label for="form-field-field_60b79c2">I hereby authorize Ananta Centre to use my email address and mobile number for the purpose of further communication.</label>
      <span class="elementor-button-text">SUBMIT</span>
    </div>
  </body>
</html>
`

const missingJobRouteHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found &#8211; Ananta Centre</title>
  </head>
  <body>
    <span>Search</span>
    <input placeholder="Search.." type="search" name="s">
    <footer>Ananta Centre</footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers &#8211; Ananta Centre</title>
    <link rel="canonical" href="https://anantacentre.in/careers/" />
  </head>
  <body>
    <h2>CAREERS</h2>
    <section class="job-card-list">
      <article class="job-card" data-job-id="policy-001">
        <h3>Research Associate</h3>
        <p>Current openings in New Delhi</p>
        <a href="https://anantacentre.in/careers/research-associate/">View Details</a>
      </article>
    </section>
  </body>
</html>
`

test('Ananta Aspen Centre sentinel pins the verified first-party homepage, careers form shell, redirect, and missing job routes', async () => {
  const ananta = await loadAnantaAspenCentreModule()

  assert.equal(ananta.SOURCE, 'anantaaspencentre')
  assert.equal(ananta.COMPANY, 'Ananta Aspen Centre')
  assert.equal(ananta.OFFICIAL_BRAND_NAME, 'Ananta Centre')
  assert.equal(ananta.VERIFIED_ON, '2026-07-15')
  assert.equal(ananta.HOMEPAGE_URL, 'https://anantacentre.in/')
  assert.equal(ananta.CAREERS_URL, 'https://anantacentre.in/careers/')
  assert.equal(ananta.LEGACY_CAREER_URL, 'https://anantacentre.in/career')
  assert.deepEqual(ananta.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://anantacentre.in/jobs',
    'https://anantacentre.in/join-us',
    'https://anantacentre.in/work-with-us',
    'https://anantacentre.in/openings',
  ])

  assert.equal(ananta.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ananta.extractCareerUrl(homepageHtml), ananta.CAREERS_URL)
  assert.equal(ananta.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(ananta.hasPublicJobBoardSignal(careersHtml), false)
  assert.equal(ananta.hasPublicJobBoardSignal(publicJobsHtml), true)
  assert.equal(
    ananta.isVerifiedCareerRedirectPage({
      status: 200,
      url: ananta.CAREERS_URL,
      html: careersHtml,
    }),
    true,
  )
  assert.equal(
    ananta.isVerifiedMissingPublicJobRoute({
      status: 404,
      url: 'https://anantacentre.in/jobs',
      html: missingJobRouteHtml,
    }),
    true,
  )
})

test('Ananta Aspen Centre sentinel returns no jobs while the verified nonlisting careers surface remains unchanged', async () => {
  const ananta = await loadAnantaAspenCentreModule()
  const requestedUrls = []

  const jobs = await ananta.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ananta.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === ananta.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === ananta.LEGACY_CAREER_URL) {
        return { status: 200, url: ananta.CAREERS_URL, html: careersHtml }
      }

      if (ananta.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingJobRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ananta.HOMEPAGE_URL,
    ananta.CAREERS_URL,
    ananta.LEGACY_CAREER_URL,
    ...ananta.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Ananta Aspen Centre sentinel fails closed when the handoff, careers shell, redirect, or common routes drift into a public jobs surface', async () => {
  const ananta = await loadAnantaAspenCentreModule()

  await assert.rejects(
    ananta.run({
      fetchPage: async (url) => {
        if (url === ananta.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('https://anantacentre.in/careers/', 'https://anantacentre.in/jobs'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage no longer matches the trusted first-party career handoff/i,
  )

  await assert.rejects(
    ananta.run({
      fetchPage: async (url) => {
        if (url === ananta.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ananta.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    ananta.run({
      fetchPage: async (url) => {
        if (url === ananta.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ananta.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === ananta.LEGACY_CAREER_URL) {
          return { status: 404, url, html: missingJobRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /legacy career route no longer resolves to the trusted first-party careers page/i,
  )

  await assert.rejects(
    ananta.run({
      fetchPage: async (url) => {
        if (url === ananta.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ananta.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === ananta.LEGACY_CAREER_URL) {
          return { status: 200, url: ananta.CAREERS_URL, html: careersHtml }
        }

        if (url === ananta.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (ananta.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingJobRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /common job route changed materially or now exposes public jobs/i,
  )
})
