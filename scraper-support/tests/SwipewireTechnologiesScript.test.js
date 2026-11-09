import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Swipe Wire</title>
  </head>
  <body>
    <section>
      <h1>Seeking Excellent Opportunities?</h1>
      <p>
        Swipe Wire as we are commonly known was established in the year 2020 dealing in IT
        Solutions, Marketing Consultancy and Support related services
      </p>
      <p>
        If this describes you, please send us your portfolio at
        <code>info@swipe-wire.com</code> to collaborate and partner with us for future projects.
      </p>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/swipewiretechnologies/script.js')
  } catch {
    assert.fail('Expected Swipewire Technologies scraper module at ../../scraper/swipewiretechnologies/script.js')
  }
}

test('Swipewire Technologies stays pinned to the verified resume-only first-party careers page', async () => {
  const swipewire = await loadModule()

  assert.equal(swipewire.SOURCE, 'swipewiretechnologies')
  assert.equal(swipewire.COMPANY_NAME, 'Swipewire Technologies')
  assert.equal(swipewire.OFFICIAL_BRAND_NAME, 'Swipe Wire')
  assert.equal(swipewire.CAREERS_URL, 'https://swipe-wire.com/career.html')
  assert.equal(swipewire.VERIFIED_ON, '2026-07-17')
  assert.equal(swipewire.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(swipewire.hasNoStructuredJobListingsSignal(verifiedCareersHtml), true)
  assert.equal(
    swipewire.hasNoStructuredJobListingsSignal(
      `${verifiedCareersHtml}<article class="job-card"><h2>Frontend Engineer</h2><a href="/jobs/frontend-engineer">Apply Now</a></article>`,
    ),
    false,
  )
})

test('Swipewire Technologies returns an honest empty list while the official page remains future-projects only', async () => {
  const swipewire = await loadModule()
  const requestedUrls = []

  const jobs = await swipewire.createSwipewireTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [swipewire.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Swipewire Technologies fails closed when the verified careers page drifts or publishes public jobs', async () => {
  const swipewire = await loadModule()

  await assert.rejects(
    swipewire.createSwipewireTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified swipewire technologies careers page/i,
  )

  await assert.rejects(
    swipewire.createSwipewireTechnologiesScraper().run({
      fetchText: async () =>
        `${verifiedCareersHtml}<article class="job-card"><h2>Frontend Engineer</h2><a href="/jobs/frontend-engineer">Apply Now</a></article>`,
    }),
    /structured public job listings/i,
  )
})
