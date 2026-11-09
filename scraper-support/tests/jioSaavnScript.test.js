import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Work With Us</h1>
      <p>Come make music beautiful.</p>
      <a href="/careers">Find Authentic Jobs</a>
      <section>
        <h2>Life At JioSaavn</h2>
      </section>
      <section>
        <h2>Find Your Gig.</h2>
        <article>
          <h3>Mumbai</h3>
          <p>0 Openings</p>
        </article>
        <article>
          <h3>Bengaluru</h3>
          <p>0 Openings</p>
        </article>
        <article>
          <h3>Gurgaon</h3>
          <p>0 Openings</p>
        </article>
        <article>
          <h3>New York City</h3>
          <p>0 Openings</p>
        </article>
        <article>
          <h3>Mountain View, CA</h3>
          <p>0 Openings</p>
        </article>
      </section>
      <footer>© 2026 Saavn Media Limited</footer>
    </main>
  </body>
</html>
`

const jobsAppearHtml = careersHtml.replace('Mumbai</h3>\n          <p>0 Openings</p>', 'Mumbai</h3>\n          <p>2 Openings</p>')

const driftHtml = careersHtml.replace('Find Your Gig.', 'Find Your Team.')

const currentCareersHtml = careersHtml.replace('Find Authentic Jobs', 'Find Your Dream Job')

const loadModule = async () => {
  try {
    return await import('../../scraper/jiosaavn/script.js')
  } catch {
    assert.fail('Expected JioSaavn scraper module at ../../scraper/jiosaavn/script.js')
  }
}

test('JioSaavn recognizes the verified first-party empty careers surface', async () => {
  const jiosaavn = await loadModule()

  assert.equal(jiosaavn.SOURCE, 'jiosaavn')
  assert.equal(jiosaavn.COMPANY, 'JioSaavn')
  assert.equal(jiosaavn.CAREERS_URL, 'https://corporate.saavn.com/careers')
  assert.equal(jiosaavn.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(jiosaavn.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.deepEqual(
    jiosaavn.extractLocationOpeningCounts(careersHtml),
    [
      { location: 'Mumbai', openings: 0 },
      { location: 'Bengaluru', openings: 0 },
      { location: 'Gurgaon', openings: 0 },
      { location: 'New York City', openings: 0 },
      { location: 'Mountain View, CA', openings: 0 },
    ],
  )
  assert.equal(jiosaavn.hasVerifiedZeroOpeningsSignal(careersHtml), true)
  assert.equal(jiosaavn.pageExposesPublicJobListings(careersHtml), false)
})

test('JioSaavn accepts the current dream-job heading while location counts remain zero', async () => {
  const jiosaavn = await loadModule()

  const jobs = await jiosaavn.createJioSaavnScraper().run({
    fetchText: async () => currentCareersHtml,
  })

  assert.deepEqual(jobs, [])
})

test('JioSaavn returns no jobs while the verified first-party careers surface shows zero openings', async () => {
  const jiosaavn = await loadModule()
  const requestedUrls = []

  const jobs = await jiosaavn.createJioSaavnScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === jiosaavn.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [jiosaavn.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('JioSaavn fails closed when the first-party careers surface drifts or starts exposing openings', async () => {
  const jiosaavn = await loadModule()

  await assert.rejects(
    jiosaavn.createJioSaavnScraper().run({
      fetchText: async () => driftHtml,
    }),
    /verified first-party public surface/i,
  )

  await assert.rejects(
    jiosaavn.createJioSaavnScraper().run({
      fetchText: async () => jobsAppearHtml,
    }),
    /public jobs surface now exposes openings or changed shape/i,
  )
})
