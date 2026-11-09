import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Bighaat</title>
    <link rel="canonical" href="https://corporate.bighaat.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Join BigHaat</h1>
      <p>How about applying your experience and knowledge to a business model that is transforming agriculture?</p>
      <p>Build for the future of agriculture in India.</p>
    </main>
  </body>
</html>
`

const loadBigHaatModule = async () => {
  try {
    return await import('../../scraper/bighaat/script.js')
  } catch {
    assert.fail('Expected BigHaat scraper module at ../../scraper/bighaat/script.js')
  }
}

test('BigHaat validates the official careers page before returning no unverified listings', async () => {
  const bigHaat = await loadBigHaatModule()

  assert.equal(bigHaat.CAREERS_URL, 'https://corporate.bighaat.com/careers/')
  assert.equal(bigHaat.hasOfficialCareersSurface(careersHtml), true)
  assert.equal(bigHaat.pageExposesPublicJobListings(careersHtml), false)

  const requestedUrls = []
  const jobs = await bigHaat.createBigHaatScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [bigHaat.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('BigHaat requires review if the verified careers page starts exposing public job cards', async () => {
  const bigHaat = await loadBigHaatModule()

  const publicListingHtml = `${careersHtml}
    <article class="job-card">
      <h2>Territory Sales Manager</h2>
      <a href="/careers/territory-sales-manager">Apply now</a>
    </article>`

  assert.equal(bigHaat.pageExposesPublicJobListings(publicListingHtml), true)

  await assert.rejects(
    bigHaat.createBigHaatScraper().run({
      fetchText: async () => publicListingHtml,
    }),
    /public job listings/i,
  )
})
