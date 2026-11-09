import assert from 'node:assert/strict'
import test from 'node:test'

const loadSilvermineModule = async () => {
  try {
    return await import('../../scraper/silvermine/script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Silvermine Group LLC</title>
  </head>
  <body>
    <main>
      <h2>CAREERS</h2>
      <h2>What We Offer</h2>
      <h3>Competitive Salary</h3>
      <h3>Hybrid Work Model</h3>
      <h3>Competitive Health Benefits</h3>
      <h3>Rewards and Recognitions</h3>
      <h3>Diverse Workforce</h3>
      <h3>Top IT Infrastructure</h3>
      <h2>Open Positions</h2>
      <p>
        Check out our open positions below - and click the link to apply.
        Don’t see a position that fits? Send us your resume, and why you think you belong here,
        we are always looking for talented people.
      </p>
      <footer>© 2026 Silvermine Group LLC</footer>
    </main>
  </body>
</html>
`

test('Silvermine validates the verified official careers shell and detects public job signals', async () => {
  const silvermine = await loadSilvermineModule()
  assert.ok(silvermine, 'Expected Silvermine scraper module at ../../scraper/silvermine/script.js')

  assert.equal(silvermine.SOURCE, 'silvermine')
  assert.equal(silvermine.COMPANY, 'Silvermine Group LLC')
  assert.equal(silvermine.CAREERS_URL, 'https://www.silverminegroup.com/careers/')
  assert.equal(silvermine.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(silvermine.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(silvermine.hasPublicJobBoardSignal(officialCareersHtml), false)
  assert.equal(
    silvermine.hasPublicJobBoardSignal('<html><body><a href="/careers/software-engineer">Apply</a></body></html>'),
    true,
  )
})

test('Silvermine returns no jobs for the verified official careers shell without public listings', async () => {
  const silvermine = await loadSilvermineModule()
  assert.ok(silvermine, 'Expected Silvermine scraper module at ../../scraper/silvermine/script.js')

  const requestedUrls = []
  const jobs = await silvermine.createSilvermineScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.silverminegroup.com/careers/'])
  assert.deepEqual(jobs, [])
})

test('Silvermine fails closed when the verified careers shell changes or exposes jobs', async () => {
  const silvermine = await loadSilvermineModule()
  assert.ok(silvermine, 'Expected Silvermine scraper module at ../../scraper/silvermine/script.js')

  await assert.rejects(
    silvermine.createSilvermineScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>Placeholder</p></body></html>',
    }),
    /Silvermine official careers page changed/i,
  )

  await assert.rejects(
    silvermine.createSilvermineScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title>Careers - Silvermine Group LLC</title>
          </head>
          <body>
            <main>
              <h2>CAREERS</h2>
              <h2>What We Offer</h2>
              <h3>Competitive Salary</h3>
              <h3>Hybrid Work Model</h3>
              <h3>Competitive Health Benefits</h3>
              <h3>Rewards and Recognitions</h3>
              <h3>Diverse Workforce</h3>
              <h3>Top IT Infrastructure</h3>
              <h2>Open Positions</h2>
              <p>
                Check out our open positions below - and click the link to apply.
                Don’t see a position that fits? Send us your resume.
              </p>
              <a href="/careers/software-engineer">Apply now</a>
            </main>
          </body>
        </html>
      `,
    }),
    /Silvermine careers page now appears to expose public job listings/i,
  )
})
