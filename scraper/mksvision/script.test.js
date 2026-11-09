import assert from 'node:assert/strict'
import test from 'node:test'

const loadMksVisionModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected MKS Vision scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head><title>MKS Vision</title></head>
  <body>
    <h1>A Preferred Technology Partner</h1>
    <p>Connecting Insights, Ideas & Innovation</p>
    <a href="https://mksvision.com/career">Career</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head><title>MKS Vision</title></head>
  <body>
    <article>
      <h1>Career</h1>
      <p>We are Hiring</p>
      <div class="modelApply"></div>
      <div class="row career-list">
        <div class="col-md-6 job-titile">ERP Coordinator</div>
        <div class="col-md-3 job-exp">2-4 Years</div>
        <a href="/job/erp-coordinator">Apply</a>
      </div>
    </article>
  </body>
</html>
`

const outagePage = {
  status: 500,
  url: 'https://mksvision.com/',
  html: '<html><head><title>Server Error</title></head><body><h1>Server Error</h1></body></html>',
}

test('MKS Vision validators and metadata reflect the Friday, August 7, 2026 outage-aware contract', async () => {
  const mksvision = await loadMksVisionModule()

  assert.equal(mksvision.VERIFIED_ON, '2026-08-07')
  assert.equal(mksvision.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(mksvision.hasOfficialCareerSignal(careersHtml), true)
  assert.equal(mksvision.isUnavailableSurface(outagePage), true)
})

test('MKS Vision extracts inline jobs when the first-party careers page is healthy and returns an authoritative empty result during the verified outage pattern', async () => {
  const mksvision = await loadMksVisionModule()

  const liveJobs = await mksvision.createMksVisionScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      if (url === mksvision.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === mksvision.CAREER_PAGE_URL) return { status: 200, url, html: careersHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(liveJobs.length, 1)
  assert.equal(liveJobs[0].title, 'ERP Coordinator')
  assert.equal(liveJobs[0].applyUrl, 'https://mksvision.com/job/erp-coordinator')

  const outageJobs = await mksvision.createMksVisionScraper().run({
    fetchPage: async () => outagePage,
  })

  assert.deepEqual(outageJobs, [])
})
