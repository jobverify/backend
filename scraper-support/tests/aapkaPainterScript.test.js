import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/aapkapainter/script.js')
  } catch {
    assert.fail('Expected Aapka Painter scraper module at ../../scraper/aapkapainter/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AapkaPainter – Expert Painting & Waterproofing Services in India</title>
  </head>
  <body>
    <h2>BOOK SITE VISIT</h2>
    <h3>Select your property type</h3>
    <li><a href="https://aapkapainter.com/career" target="_blank">Career</a></li>
    <footer>Copyright © 2026 AapkaPainter Solutions Pvt Ltd.</footer>
  </body>
</html>
`

const careerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Jobs at Aapkapainter</title>
    <link rel="canonical" href="https://aapkapainter.com/career">
    <meta
      name="description"
      content="Apply to jobs at Aapkapainter today. Learn about careers at Aapkapainter in software, marketing, sales and operations "
    >
  </head>
  <body>
    <style>
      #job-listing {
        margin: 100px 50px;
      }
    </style>
    <div id="job-listing"></div>
    <script type="text/javascript">
      var USERID = '1476';
    </script>
    <script src="https://ats.zimyo.com/assets/js/jobwidget.js"></script>
    <form action="https://aapkapainter.com/career" class="submit_house_detail" method="post"></form>
    <input type="hidden" name="channel" class="request_channel" value="career" id="request_channel3">
    <h2>BOOK SITE VISIT</h2>
    <h3>Select your property type</h3>
  </body>
</html>
`

const widgetScriptHtml = `
<!doctype html>
<html>
  <head>
    <title>Redirecting...</title>
  </head>
  <body>
    <script>
      setTimeout(function() {
        window.location.replace("https://ats.zimyo.work");
      }, 500);
    </script>
  </body>
</html>
`

const publicJobsCareerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Jobs at Aapkapainter</title>
  </head>
  <body>
    <div id="job-listing">
      <article data-job-id="eng-001">
        <h2>Software Engineer</h2>
        <a href="https://ats.zimyo.work/jobs/software-engineer/apply">Apply now</a>
      </article>
    </div>
    <script>
      var USERID = '1476';
    </script>
    <script src="https://ats.zimyo.com/assets/js/jobwidget.js"></script>
  </body>
</html>
`

test('Aapka Painter pins the verified first-party homepage, branded career shell, and dead Zimyo widget hook', async () => {
  const aapkaPainter = await loadModule()

  assert.equal(aapkaPainter.SOURCE, 'aapkapainter')
  assert.equal(aapkaPainter.COMPANY, 'Aapka Painter')
  assert.equal(aapkaPainter.VERIFIED_AT, '2026-07-14')
  assert.equal(aapkaPainter.HOMEPAGE_URL, 'https://aapkapainter.com/')
  assert.equal(aapkaPainter.CAREER_URL, 'https://aapkapainter.com/career')
  assert.equal(aapkaPainter.WIDGET_SCRIPT_URL, 'https://ats.zimyo.com/assets/js/jobwidget.js')
  assert.equal(aapkaPainter.WIDGET_USER_ID, '1476')
  assert.equal(aapkaPainter.WIDGET_REDIRECT_URL, 'https://ats.zimyo.work')
  assert.deepEqual(aapkaPainter.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://aapkapainter.com/careers',
    'https://aapkapainter.com/jobs',
    'https://aapkapainter.com/join-us',
    'https://aapkapainter.com/work-with-us',
  ])

  assert.equal(aapkaPainter.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aapkaPainter.extractCareerUrl(homepageHtml), aapkaPainter.CAREER_URL)
  assert.equal(aapkaPainter.hasOfficialCareerPageSignal(careerHtml), true)
  assert.equal(aapkaPainter.extractWidgetUserId(careerHtml), aapkaPainter.WIDGET_USER_ID)
  assert.equal(aapkaPainter.extractWidgetScriptUrl(careerHtml), aapkaPainter.WIDGET_SCRIPT_URL)
  assert.equal(aapkaPainter.hasPublicJobBoardSignal(careerHtml), false)
  assert.equal(aapkaPainter.hasPublicJobBoardSignal(publicJobsCareerHtml), true)
  assert.equal(aapkaPainter.hasDeadWidgetScriptSignal(widgetScriptHtml), true)
  assert.equal(
    aapkaPainter.isVerifiedMissingPublicJobRoute({
      status: 404,
      url: 'https://aapkapainter.com/jobs',
      html: '<html><body>Not Found</body></html>',
    }),
    true,
  )
})

test('Aapka Painter reports the dead widget as unavailable after checking the existing adjacent routes', async () => {
  const aapkaPainter = await loadModule()
  const requestedUrls = []

  const outcome = aapkaPainter.createAapkaPainterScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aapkaPainter.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aapkaPainter.CAREER_URL) {
        return { status: 200, url, html: careerHtml }
      }

      if (url === aapkaPainter.WIDGET_SCRIPT_URL) {
        return { status: 200, url, html: widgetScriptHtml }
      }

      if (aapkaPainter.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>Not Found</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  await assert.rejects(outcome, {
    failureType: 'upstream_unavailable',
    upstreamOutage: true,
    sourceUrl: aapkaPainter.WIDGET_SCRIPT_URL,
    scopeComplete: false,
    sourceScopeComplete: false,
    cleanupAuthority: false,
  })
  assert.deepEqual(requestedUrls, [
    aapkaPainter.HOMEPAGE_URL,
    aapkaPainter.CAREER_URL,
    aapkaPainter.WIDGET_SCRIPT_URL,
    ...aapkaPainter.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
})

test('Aapka Painter reports the known widget TLS host mismatch as unavailable rather than an empty inventory', async () => {
  const aapkaPainter = await loadModule()

  const outcome = aapkaPainter.createAapkaPainterScraper().run({
    fetchPage: async (url) => {
      if (url === aapkaPainter.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aapkaPainter.CAREER_URL) {
        return { status: 200, url, html: careerHtml }
      }

      if (url === aapkaPainter.WIDGET_SCRIPT_URL) {
        const error = new TypeError('fetch failed')
        error.cause = {
          code: 'ERR_TLS_CERT_ALTNAME_INVALID',
          message:
            "Hostname/IP does not match certificate's altnames: Host: ats.zimyo.com. is not in the cert's altnames: DNS:apiserver.zimyo.com, DNS:hrms.zimyo.com, DNS:sandbox.zimyo.com",
        }
        throw error
      }

      if (aapkaPainter.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>Not Found</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  await assert.rejects(outcome, {
    failureType: 'upstream_unavailable',
    upstreamOutage: true,
    sourceUrl: aapkaPainter.WIDGET_SCRIPT_URL,
    scopeComplete: false,
    sourceScopeComplete: false,
    cleanupAuthority: false,
  })
})

test('Aapka Painter sentinel fails closed when the homepage handoff, career shell, widget state, or adjacent routes drift into a public jobs surface', async () => {
  const aapkaPainter = await loadModule()

  await assert.rejects(
    aapkaPainter.createAapkaPainterScraper().run({
      fetchPage: async (url) => {
        if (url === aapkaPainter.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('https://aapkapainter.com/career', 'https://aapkapainter.com/jobs'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage no longer matches the trusted first-party career handoff/i,
  )

  await assert.rejects(
    aapkaPainter.createAapkaPainterScraper().run({
      fetchPage: async (url) => {
        if (url === aapkaPainter.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aapkaPainter.CAREER_URL) {
          return { status: 200, url, html: publicJobsCareerHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career page now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    aapkaPainter.createAapkaPainterScraper().run({
      fetchPage: async (url) => {
        if (url === aapkaPainter.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aapkaPainter.CAREER_URL) {
          return { status: 200, url, html: careerHtml }
        }

        if (url === aapkaPainter.WIDGET_SCRIPT_URL) {
          return {
            status: 200,
            url,
            html: widgetScriptHtml.replace('https://ats.zimyo.work', 'https://ats.zimyo.com/jobs/1476'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /embedded zimyo widget state changed materially/i,
  )

  await assert.rejects(
    aapkaPainter.createAapkaPainterScraper().run({
      fetchPage: async (url) => {
        if (url === aapkaPainter.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aapkaPainter.CAREER_URL) {
          return { status: 200, url, html: careerHtml }
        }

        if (url === aapkaPainter.WIDGET_SCRIPT_URL) {
          return { status: 200, url, html: widgetScriptHtml }
        }

        if (url === aapkaPainter.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsCareerHtml }
        }

        if (aapkaPainter.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: '<html><body>Not Found</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /common job route changed materially or now exposes public jobs/i,
  )
})
