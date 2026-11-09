import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h4>Careers</h4>
      <h1>Innovate. Impact. Grow.</h1>
      <h2>Where Ideas Meet Impact</h2>
      <p>We are always excited to meet talented individuals ready to grow with us.</p>
      <section>
        <h3>Lorem ipsum dolor sit amet</h3>
        <p>Full Time</p>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <p>Experience: 1-2 years</p>
        <p>Qualification: B.Tech</p>
        <button>Apply Now</button>
      </section>
      <form>
        <label>Position Applying For</label>
        <label>Resume/CV</label>
        <button>Submit</button>
      </form>
    </main>
  </body>
</html>
`

const publicJobsHtml = careersHtml
  .replace(/Lorem ipsum dolor sit amet/g, 'Senior Java Developer')
  .replace('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', 'Build lending platforms across India.')

const loadModule = async () => {
  try {
    return await import('../../scraper/volksoft/script.js')
  } catch {
    assert.fail('Expected Volksoft Technologies scraper module at ../../scraper/volksoft/script.js')
  }
}

test('Volksoft Technologies helpers stay pinned to the verified placeholder-only careers page from Friday, July 17, 2026', async () => {
  const volksoft = await loadModule()

  assert.equal(volksoft.SOURCE, 'volksoft')
  assert.equal(volksoft.COMPANY, 'Volksoft Technologies')
  assert.equal(volksoft.OFFICIAL_BRAND_NAME, 'VolkSoft')
  assert.equal(volksoft.VERIFIED_ON, '2026-07-17')
  assert.equal(volksoft.HOMEPAGE_URL, 'https://volksoft.in/')
  assert.equal(volksoft.CAREERS_URL, 'https://volksoft.in/careers/')
  assert.equal(volksoft.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(volksoft.hasVerifiedPlaceholderListings(careersHtml), true)
  assert.equal(volksoft.pageExposesTrustworthyPublicJobListings(careersHtml), false)
  assert.equal(volksoft.pageExposesTrustworthyPublicJobListings(publicJobsHtml), true)
})

test('Volksoft Technologies returns [] only while the verified careers page still exposes placeholder listings', async () => {
  const volksoft = await loadModule()
  const requestedUrls = []

  const jobs = await volksoft.createVolksoftTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [volksoft.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Volksoft Technologies fails closed when the careers shell drifts or the placeholders become real openings', async () => {
  const volksoft = await loadModule()

  await assert.rejects(
    volksoft.createVolksoftTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /careers page/i,
  )

  await assert.rejects(
    volksoft.createVolksoftTechnologiesScraper().run({
      fetchText: async () => publicJobsHtml,
    }),
    /trustworthy public job listings|placeholder/i,
  )
})
