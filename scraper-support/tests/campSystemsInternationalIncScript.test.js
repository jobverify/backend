import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/campsystemsinternationalinc/script.js')
  } catch {
    assert.fail('Expected CAMP Systems International, Inc. scraper module at ../../scraper/campsystemsinternationalinc/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | CAMP Systems</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Innovative, forward-thinkers wanted</h2>
      <p>CAMP is the leading provider of aviation software and services.</p>
      <p>Our SaaS products power the business of aviation worldwide.</p>
      <a href="/find-opportunities">Find Opportunities</a>
      <a href="mailto:HRRecruiting@campsystems.com">HRRecruiting@campsystems.com</a>
    </main>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Innovative, forward-thinkers wanted.</h2>
      <p>CAMP Systems is a SaaS company delivering groundbreaking aircraft health management solutions and market data to the business aviation industry worldwide.</p>
      <p>We are comprised of talented and passionate people with skillsets in: Software Development, Product Management, IT Infrastructure, and Business Operations.</p>
      <p>At CAMP Systems, we embrace a healthy, collaborative and diverse work environment.</p>
    </main>
  </body>
</html>
`

test('CAMP Systems International, Inc. sentinel pins the verified first-party careers landing page', async () => {
  const campSystems = await loadModule()

  assert.equal(campSystems.SOURCE, 'campsystemsinternationalinc')
  assert.equal(campSystems.COMPANY, 'CAMP Systems International, Inc.')
  assert.equal(campSystems.OFFICIAL_BRAND_NAME, 'CAMP Systems')
  assert.equal(campSystems.CAREERS_URL, 'https://www.campsystems.com/careers')
  assert.equal(campSystems.VERIFIED_ON, '2026-11-03')
  assert.equal(campSystems.hasVerifiedCareersSignal(careersHtml), true)
  assert.equal(campSystems.hasVerifiedCareersSignal(currentCareersHtml), true)
})

test('CAMP legacy HTML-only transport retains unverified landing evidence without claiming a native vacancy total', async () => {
  const campSystems = await loadModule()

  const jobs = await campSystems.createCampSystemsInternationalIncScraper().run({
    fetchText: async (url) => {
      assert.equal(url, campSystems.CAREERS_URL)
      return currentCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('CAMP Systems International, Inc. fails closed when the verified landing page drifts', async () => {
  const campSystems = await loadModule()

  await assert.rejects(
    campSystems.createCampSystemsInternationalIncScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified CAMP Systems careers landing/i,
  )
})
