import assert from 'node:assert/strict'
import test from 'node:test'

const loadKirloskarModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Kirloskar Brothers Ltd scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Engineering the flow of progress</h1>
    <p>Kirloskar Brothers Limited (KBL), founded in 1888</p>
    <p>Yamuna, Survey no. 98/(3-7), Baner, Pune 411 045, India.</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Shape the future with a company that's shaped the world.</h1>
    <h2>Why work at KBL?</h2>
    <h3>Submit your resume. Build what matters.</h3>
    <form action="/careers/#wpcf7">
      <input id="resume-file" type="file" />
    </form>
    <div class="wpcf7">contact-form-7</div>
    <p>Upload Resume</p>
  </body>
</html>
`

const unavailablePage = {
  status: 503,
  url: 'https://www.kirloskarpumps.com/',
  html: '',
}

test('Kirloskar Brothers Ltd validators cover the verified resume-only and unavailable surfaces', async () => {
  const kirloskar = await loadKirloskarModule()

  assert.equal(kirloskar.VERIFIED_ON, '2026-08-07')
  assert.equal(kirloskar.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kirloskar.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(kirloskar.hasResumeOnlySignal(careersHtml), true)
  assert.equal(kirloskar.hasUnavailableSurfaceSignal(unavailablePage), true)
})

test('Kirloskar Brothers Ltd returns no jobs for the verified 503 outage pattern or the older resume-only surface', async () => {
  const kirloskar = await loadKirloskarModule()

  const outageJobs = await kirloskar.createKirloskarBrothersLtdScraper().run({
    fetchPage: async (url) => {
      if (url === kirloskar.HOMEPAGE_URL) return unavailablePage
      if (url === kirloskar.CAREERS_URL) return { ...unavailablePage, url }
      if (url === kirloskar.JOBS_LISTINGS_URL) return { ...unavailablePage, url }
      if (url === kirloskar.APPLICATION_FORM_URL) return { ...unavailablePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(outageJobs, [])

  const resumeOnlyJobs = await kirloskar.createKirloskarBrothersLtdScraper().run({
    fetchPage: async (url) => {
      if (url === kirloskar.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === kirloskar.CAREERS_URL) return { status: 200, url, html: careersHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(resumeOnlyJobs, [])
})
