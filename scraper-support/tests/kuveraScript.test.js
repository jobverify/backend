import assert from 'node:assert/strict'
import test from 'node:test'

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kuvera by CRED</title>
    <link rel="canonical" href="https://kuvera.in/about" />
  </head>
  <body>
    <main>
      <h1>We're on a mission to make investing simple.</h1>
      <p>JOIN OUR TEAM</p>
      <h2>We're Hiring!</h2>
      <p>
        We're looking for talented and driven FinTech enthusiasts. If this sounds like you,
        send your resume to <a href="mailto:jobs@kuvera.in">jobs@kuvera.in</a>
      </p>
      <footer>2026 Copyright Arevuk Advisory Services Pvt Ltd.</footer>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kuvera by CRED</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Product Manager"}
      </script>
      <a href="https://jobs.lever.co/kuvera/product-manager">Apply now</a>
    </main>
  </body>
</html>
`

const spaShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kuvera by CRED</title>
    <script src="https://assets2.kuvera.in/production/atlantis/web/assets/js/main.12345678.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const currentAboutShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kuvera by CRED</title>
    <meta name="author" content="Kuvera Dev Team" />
    <script src="https://assets2.kuvera.in/production/atlantis/web/assets/js/main.bdbffbba1285f001682c.js"></script>
  </head>
  <body>
    <main></main>
  </body>
</html>
`

const appBundleText = `
window.__APP__={};
const pageTitle="Kuvera by CRED";
const legalEntity="Arevuk Advisory Services Pvt Ltd";
const assetPath="https://assets2.kuvera.in/production/atlantis/web/";
const hiringBanner="JOIN OUR TEAM";
const hiringHeading="We\\u2019re Hiring!";
const hiringEmail="jobs@kuvera.in";
`

const currentAppBundleText = `
window.__APP__={};
const pageTitle="Kuvera by CRED";
const legalEntity="Arevuk Advisory Services Pvt Ltd";
const assetPath="https://assets2.kuvera.in/production/atlantis/web/";
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kuvera/script.js')
  } catch {
    assert.fail('Expected Kuvera scraper module at ../../scraper/kuvera/script.js')
  }
}

test('Kuvera helper contract stays pinned to the verified first-party resume-only hiring surface', async () => {
  const kuvera = await loadScriptModule()

  assert.equal(kuvera.SOURCE, 'kuvera')
  assert.equal(kuvera.COMPANY, 'Kuvera')
  assert.equal(kuvera.OFFICIAL_BRAND_NAME, 'Kuvera by CRED')
  assert.equal(kuvera.VERIFIED_ON, '2026-07-16')
  assert.equal(kuvera.HOMEPAGE_URL, 'https://kuvera.in/')
  assert.equal(kuvera.ABOUT_URL, 'https://kuvera.in/about')
  assert.equal(kuvera.RESUME_EMAIL, 'jobs@kuvera.in')
  assert.equal(kuvera.extractResumeEmail(aboutHtml), 'jobs@kuvera.in')
  assert.equal(
    kuvera.extractAppBundleUrl(spaShellHtml),
    'https://assets2.kuvera.in/production/atlantis/web/assets/js/main.12345678.js',
  )
  assert.equal(
    kuvera.extractAppBundleUrl(currentAboutShellHtml),
    'https://assets2.kuvera.in/production/atlantis/web/assets/js/main.bdbffbba1285f001682c.js',
  )
  assert.equal(kuvera.hasOfficialAboutPageSignal(aboutHtml), true)
  assert.equal(kuvera.hasOfficialAboutPageShellSignal(currentAboutShellHtml), true)
  assert.equal(kuvera.hasPublicJobListingSignal(aboutHtml), false)
  assert.equal(kuvera.hasPublicJobListingSignal(publicJobsHtml), true)
  assert.equal(kuvera.hasVerifiedBundleHiringSignal(appBundleText), true)
  assert.equal(kuvera.hasVerifiedBundleShellSignal(currentAppBundleText), true)
})

test('Kuvera returns no jobs only while the verified first-party about page stays resume-only', async () => {
  const kuvera = await loadScriptModule()
  const requestedUrls = []

  const jobs = await kuvera.createKuveraScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === kuvera.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      throw new Error(`Unexpected Kuvera URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [kuvera.ABOUT_URL])
  assert.deepEqual(jobs, [])
})

test('Kuvera accepts the verified SPA shell plus first-party app bundle hiring signal and still returns no jobs', async () => {
  const kuvera = await loadScriptModule()
  const requestedPages = []
  const requestedTexts = []

  const jobs = await kuvera.createKuveraScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === kuvera.ABOUT_URL) {
        return { status: 200, url, html: spaShellHtml }
      }

      throw new Error(`Unexpected Kuvera URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === 'https://assets2.kuvera.in/production/atlantis/web/assets/js/main.12345678.js') {
        return appBundleText
      }

      throw new Error(`Unexpected Kuvera asset URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [kuvera.ABOUT_URL])
  assert.deepEqual(requestedTexts, [
    'https://assets2.kuvera.in/production/atlantis/web/assets/js/main.12345678.js',
  ])
  assert.deepEqual(jobs, [])
})

test('Kuvera accepts the current official about-page shell and first-party app bundle and still returns no jobs', async () => {
  const kuvera = await loadScriptModule()
  const requestedPages = []
  const requestedTexts = []

  const jobs = await kuvera.createKuveraScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === kuvera.ABOUT_URL) {
        return { status: 200, url, html: currentAboutShellHtml }
      }

      throw new Error(`Unexpected Kuvera URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === 'https://assets2.kuvera.in/production/atlantis/web/assets/js/main.bdbffbba1285f001682c.js') {
        return currentAppBundleText
      }

      throw new Error(`Unexpected Kuvera asset URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [kuvera.ABOUT_URL])
  assert.deepEqual(requestedTexts, [
    'https://assets2.kuvera.in/production/atlantis/web/assets/js/main.bdbffbba1285f001682c.js',
  ])
  assert.deepEqual(jobs, [])
})

test('Kuvera fails closed when the about page drifts or begins exposing a public jobs board', async () => {
  const kuvera = await loadScriptModule()

  await assert.rejects(
    kuvera.createKuveraScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: kuvera.ABOUT_URL,
        html: '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>',
      }),
    }),
    /verified about page no longer matches/i,
  )

  await assert.rejects(
    kuvera.createKuveraScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: kuvera.ABOUT_URL,
        html: publicJobsHtml,
      }),
    }),
    /about page now appears to expose a public jobs board/i,
  )

  await assert.rejects(
    kuvera.createKuveraScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: kuvera.ABOUT_URL,
        html: spaShellHtml,
      }),
      fetchText: async () => 'window.__APP__={}; const title="Generic marketing site";',
    }),
    /verified about page no longer matches/i,
  )
})
