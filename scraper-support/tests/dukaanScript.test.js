import assert from 'node:assert/strict'
import test from 'node:test'

const ABOUT_US_HTML = `
<!doctype html>
<html>
  <head>
    <title>About Us | Dukaan</title>
  </head>
  <body>
    <nav>
      <a href="https://angel.co/company/dukaan-app/jobs">Careers</a>
    </nav>
    <h5>See yourself here?</h5>
    <a href="https://angel.co/company/dukaan-app/jobs">Join the Team!</a>
    <h1>Do our values resonate with you?</h1>
    <p>Work with the latest technology and help the new Indian peeps to come and sell online.</p>
    <a href="https://angel.co/company/dukaan-app/jobs">See open positions</a>
  </body>
</html>
`

const EMPTY_WELLFOUND_HTML = `
<!doctype html>
<html>
  <body>
    <h1>Jobs at Dukaan</h1>
    <span>View 0 jobs</span>
    <p>Dukaan hasn't added any jobs yet</p>
  </body>
</html>
`

const PUBLIC_WELLFOUND_HTML = `
<!doctype html>
<html>
  <body>
    <h1>Jobs at Dukaan</h1>
    <span>View 1 job</span>
    <article class="job-card"><h2>Software Engineer</h2></article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/dukaan/script.js')
  } catch {
    assert.fail('Expected Dukaan scraper module at ../../scraper/dukaan/script.js')
  }
}

test('Dukaan sentinel pins the verified first-party handoff and empty Wellfound surface', async () => {
  const dukaan = await loadModule()

  assert.equal(dukaan.SOURCE, 'dukaan')
  assert.equal(dukaan.COMPANY, 'Dukaan')
  assert.equal(dukaan.VERIFIED_ON, '2026-08-02')
  assert.equal(dukaan.HOMEPAGE_URL, 'https://mydukaan.io/about-us')
  assert.equal(dukaan.CAREERS_URL, 'https://wellfound.com/company/dukaan-app/jobs')
  assert.equal(dukaan.LEGACY_CAREERS_URL, 'https://angel.co/company/dukaan-app/jobs')
  assert.equal(dukaan.hasOfficialCareersHandoffSignal(ABOUT_US_HTML), true)
  assert.equal(dukaan.hasEmptyJobsSurfaceSignal(EMPTY_WELLFOUND_HTML), true)
  assert.equal(dukaan.hasEmptyJobsSurfaceSignal(PUBLIC_WELLFOUND_HTML), false)
})

test('Dukaan sentinel returns [] only while the verified first-party handoff and public jobs surface stay empty', async () => {
  const dukaan = await loadModule()
  const requestedUrls = []

  const jobs = await dukaan.createDukaanScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === dukaan.HOMEPAGE_URL) return ABOUT_US_HTML
      return EMPTY_WELLFOUND_HTML
    },
  })

  assert.deepEqual(requestedUrls, [dukaan.HOMEPAGE_URL, dukaan.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Dukaan sentinel fails closed when the verified first-party handoff disappears', async () => {
  const dukaan = await loadModule()

  await assert.rejects(
    dukaan.createDukaanScraper().run({ fetchText: async () => '<html><body>No careers handoff</body></html>' }),
    /verified first-party careers handoff/i,
  )
})

test('Dukaan sentinel fails closed when the verified public jobs surface changes', async () => {
  const dukaan = await loadModule()

  await assert.rejects(
    dukaan.createDukaanScraper().run({
      fetchText: async (url) => {
        if (url === dukaan.HOMEPAGE_URL) return ABOUT_US_HTML
        return PUBLIC_WELLFOUND_HTML
      },
    }),
    /surface now exposes public jobs|verified empty jobs surface/i,
  )
})

test('Dukaan sentinel can verify the empty state with a browser fallback after direct access is blocked', async () => {
  const dukaan = await loadModule()
  const requestedUrls = []
  const browserUrls = []

  const jobs = await dukaan.createDukaanScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === dukaan.HOMEPAGE_URL) return ABOUT_US_HTML
      throw new Error('HTTP 403 for https://wellfound.com/company/dukaan-app/jobs')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return EMPTY_WELLFOUND_HTML
    },
  })

  assert.deepEqual(requestedUrls, [dukaan.HOMEPAGE_URL, dukaan.CAREERS_URL])
  assert.deepEqual(browserUrls, [dukaan.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Dukaan sentinel preserves the verified empty-state fallback when Wellfound blocks both direct and browser access', async () => {
  const dukaan = await loadModule()
  const browserUrls = []

  const jobs = await dukaan.createDukaanScraper().run({
    fetchText: async (url) => {
      if (url === dukaan.HOMEPAGE_URL) return ABOUT_US_HTML
      throw new Error('HTTP 403 for https://wellfound.com/company/dukaan-app/jobs')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      throw new Error('HTTP 403 for https://wellfound.com/company/dukaan-app/jobs')
    },
  })

  assert.deepEqual(browserUrls, [dukaan.CAREERS_URL])
  assert.deepEqual(jobs, [])
})
