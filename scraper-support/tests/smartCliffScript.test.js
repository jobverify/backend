import assert from 'node:assert/strict'
import test from 'node:test'

const loadSmartCliffModule = async () => {
  try {
    return await import('../../scraper/smartcliff/script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | SmartCliff</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/career">Career</a>
      <a href="/contact">Contact</a>
    </nav>
    <main>
      <h1>Career Discover In-Demand Careers Today!</h1>
    </main>
    <footer>Copyright 2025 SmartCliff. All rights reserved.</footer>
  </body>
</html>
`

test('SmartCliff validates the verified official careers shell and detects public job signals', async () => {
  const smartCliff = await loadSmartCliffModule()
  assert.ok(smartCliff, 'Expected SmartCliff scraper module at ../../scraper/smartcliff/script.js')

  assert.equal(smartCliff.SOURCE, 'smartcliff')
  assert.equal(smartCliff.COMPANY, 'SmartCliff Learning Solutions LLP')
  assert.equal(smartCliff.CAREERS_URL, 'https://smartcliff.in/career')
  assert.equal(smartCliff.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    smartCliff.hasOfficialCareersSignal('<html><body><h1>Career</h1><p>Placeholder</p></body></html>'),
    false,
  )
  assert.equal(smartCliff.hasPublicJobBoardSignal(officialCareersHtml), false)
  assert.equal(
    smartCliff.hasPublicJobBoardSignal('<script src="/_next/static/chunks/app/(career)/career/page-b25cfa21cb81f798.js"></script>'),
    false,
  )
  assert.equal(
    smartCliff.hasPublicJobBoardSignal('<html><body><a href="/career/software-trainer">Software Trainer</a></body></html>'),
    true,
  )
  assert.equal(
    smartCliff.hasPublicJobBoardSignal('<html><body><a href="/career/software-trainer">Apply now</a></body></html>'),
    true,
  )
})

test('SmartCliff returns no jobs for the verified official careers shell without public listings', async () => {
  const smartCliff = await loadSmartCliffModule()
  assert.ok(smartCliff, 'Expected SmartCliff scraper module at ../../scraper/smartcliff/script.js')

  const requestedUrls = []
  const jobs = await smartCliff.createSmartCliffScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://smartcliff.in/career'])
  assert.deepEqual(jobs, [])
})

test('SmartCliff fails closed when the verified careers shell changes or exposes jobs', async () => {
  const smartCliff = await loadSmartCliffModule()
  assert.ok(smartCliff, 'Expected SmartCliff scraper module at ../../scraper/smartcliff/script.js')

  await assert.rejects(
    smartCliff.createSmartCliffScraper().run({
      fetchText: async () => '<html><body><h1>Career</h1><p>Placeholder</p></body></html>',
    }),
    /SmartCliff official careers page changed/i,
  )

  await assert.rejects(
    smartCliff.createSmartCliffScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title>Career | SmartCliff</title>
          </head>
          <body>
            <main>
              <h1>Career Discover In-Demand Careers Today!</h1>
              <a href="/career/software-trainer">Apply now</a>
            </main>
            <footer>Copyright 2025 SmartCliff. All rights reserved.</footer>
          </body>
        </html>
      `,
    }),
    /SmartCliff careers page now appears to expose public job listings/i,
  )
})
