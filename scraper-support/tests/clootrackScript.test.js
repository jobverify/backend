import assert from 'node:assert/strict'
import test from 'node:test'

const loadClootrackModule = async () => {
  try {
    return await import('../../scraper/clootrack/script.js')
  } catch {
    assert.fail('Expected Clootrack scraper module at ../../scraper/clootrack/script.js')
  }
}

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers</title>
    </head>
    <body>
      <main>
        <h1>Join our team at Clootrack to be at the forefront of AI-driven customer experience analytics.</h1>
        <p>At Clootrack, we truly believe that organizational culture can thrive regardless of physical office locations.</p>
        <p>That’s why we proudly set the standard for remote work practices.</p>
        <p>Think you're a fit? Reach out and let's explore.</p>
        <a href="/contact-us">Contact Us</a>
      </main>
      <footer>© 2026 Clootrack. All Rights Reserved</footer>
    </body>
  </html>
`

const currentOfficialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers</title>
    </head>
    <body>
      <main>
        <h1>Join our team at Clootrack to be at the forefront of AI-driven customer experience analytics.</h1>
        <p>At Clootrack, we truly believe that organizational culture can thrive regardless of physical office locations. That’s why we proudly set the standard for remote work practices!</p>
        <p>Think you’re a fit? Reach out and let’s explore.</p>
        <a href="/contact-us">Contact Us</a>
      </main>
      <footer>© 2026 Clootrack. All Rights Reserved</footer>
    </body>
  </html>
`

test('Clootrack validates the official careers surface before returning no unverified listings', async () => {
  const clootrack = await loadClootrackModule()
  const requestedUrls = []

  assert.equal(clootrack.CAREERS_URL, 'https://www.clootrack.com/careers')
  assert.equal(clootrack.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(clootrack.pageExposesPublicJobListings(officialCareersHtml), false)

  const jobs = await clootrack.createClootrackScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [clootrack.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Clootrack scraper requires review when the official careers page adds public job listings', async () => {
  const clootrack = await loadClootrackModule()
  const listingHtml = `${officialCareersHtml}
    <section class="jobs-grid">
      <article class="job-card">
        <h2>Senior Software Engineer</h2>
        <a href="/careers/senior-software-engineer">Apply Now</a>
      </article>
    </section>
  `

  assert.equal(clootrack.pageExposesPublicJobListings(listingHtml), true)

  await assert.rejects(
    clootrack.createClootrackScraper().run({
      fetchText: async () => listingHtml,
    }),
    /public job listings/i,
  )
})

test('Clootrack scraper fails closed when the official careers surface changes', async () => {
  const clootrack = await loadClootrackModule()

  await assert.rejects(
    clootrack.createClootrackScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /Clootrack official careers surface changed/i,
  )
})

test('Clootrack accepts the current official careers copy with curly apostrophes', async () => {
  const clootrack = await loadClootrackModule()

  assert.equal(clootrack.hasOfficialCareersSignal(currentOfficialCareersHtml), true)

  const jobs = await clootrack.createClootrackScraper().run({
    fetchText: async () => currentOfficialCareersHtml,
  })

  assert.deepEqual(jobs, [])
})
