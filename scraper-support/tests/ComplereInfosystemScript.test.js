import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Build Your Career Path | Explore Opportunities at Complere</title>
  </head>
  <body>
    <section>
      <h1>Join Our Team</h1>
      <h2>Why Choose Complere Infosystem for Career Opportunities</h2>
      <p>How to Apply</p>
      <p>Ready to take the next step in your career? To apply for any of our current openings, please send your resume and a cover letter outlining your qualifications and interests to <a href="mailto:hr@complereinfosystem.com">hr@complereinfosystem.com</a>.</p>
      <p>Contact Us</p>
      <p>For Career +91 9518894544</p>
    </section>
  </body>
</html>
`

const loadComplereModule = async () => {
  try {
    return await import('../../scraper/complereinfosystem/script.js')
  } catch {
    assert.fail('Expected Complere Infosystem scraper module at ../../scraper/complereinfosystem/script.js')
  }
}

test('Complere Infosystem validates its official careers page before returning no unverified listings', async () => {
  const complere = await loadComplereModule()
  const requestedUrls = []

  assert.equal(complere.hasOfficialComplereCareersSignals(verifiedCareersHtml), true)
  assert.equal(complere.pageExposesStructuredJobListings(verifiedCareersHtml), false)

  const jobs = await complere.createComplereInfosystemScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [complere.OFFICIAL_CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Complere Infosystem scraper requires review when the careers page adds structured public job listings', async () => {
  const complere = await loadComplereModule()
  const publicListingHtml = `${verifiedCareersHtml}<article class="job-card"><h3>Data Engineer</h3><a href="/careers/data-engineer">Apply Now</a></article>`

  assert.equal(complere.pageExposesStructuredJobListings(publicListingHtml), true)

  await assert.rejects(
    complere.createComplereInfosystemScraper().run({
      fetchText: async () => publicListingHtml,
    }),
    /structured public job listings/i,
  )
})

test('Complere Infosystem scraper fails closed when the official careers identity drifts', async () => {
  const complere = await loadComplereModule()

  await assert.rejects(
    complere.createComplereInfosystemScraper().run({
      fetchText: async () => '<html><body>Unrelated company</body></html>',
    }),
    /official careers surface/i,
  )
})
