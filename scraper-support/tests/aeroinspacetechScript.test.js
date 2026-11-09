import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
  <!doctype html>
  <html>
    <head><title>Aeroin SpaceTech Private Limited</title></head>
    <body>
      <nav><a href="/about">About</a><a href="/projects">Projects</a><a href="/team">Team</a><a href="/contact">Contact</a></nav>
      <main>
        <h1>Building India's First Stratospheric Balloon Rocket Launcher</h1>
        <p>Aeroin SpaceTech aims to build cutting edge space technology.</p>
        <p>info@aeroin.space</p>
      </main>
    </body>
  </html>
`

test('Aeroin SpaceTech validates its official homepage before returning no unverified listings', async () => {
  const aeroin = await import('../../scraper/aeroinspacetech/script.js')
  const requestedUrls = []

  assert.equal(aeroin.hasOfficialSiteSignal(officialHomepageHtml), true)
  assert.equal(aeroin.pageExposesPublicJobListings(officialHomepageHtml), false)

  const jobs = await aeroin.createAeroinSpaceTechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialHomepageHtml
    },
  })

  assert.deepEqual(requestedUrls, [aeroin.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Aeroin SpaceTech scraper requires review when the official site adds public job listings', async () => {
  const aeroin = await import('../../scraper/aeroinspacetech/script.js')
  const publicListingHtml = `${officialHomepageHtml}<article class="job-card"><h2>Propulsion Engineer</h2><a href="/jobs/propulsion-engineer">Apply now</a></article>`

  assert.equal(aeroin.pageExposesPublicJobListings(publicListingHtml), true)

  await assert.rejects(
    aeroin.createAeroinSpaceTechScraper().run({
      fetchText: async () => publicListingHtml,
    }),
    /public job listings/i,
  )
})
