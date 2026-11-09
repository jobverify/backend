import assert from 'node:assert/strict'
import test from 'node:test'

const loadNovacModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | NovacTech</title>
  </head>
  <body>
    <main>
      <h1>Let's Grow Together</h1>
      <p>We are building a culture at Novac, where talented minds can do their best!</p>
      <h2>Indulge and Grow</h2>
      <p>With Novac Family</p>
      <p>©2026 Novac Technology Solutions. All rights reserved.</p>
    </main>
  </body>
</html>
`

test('Novac Technology Solutions validates the verified official careers shell', async () => {
  const novac = await loadNovacModule()
  assert.ok(novac, 'Expected Novac Technology Solutions scraper module at ./script.js')

  assert.equal(novac.CAREERS_URL, 'https://www.novactech.com/careers')
  assert.equal(novac.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(novac.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(novac.hasPublicJobBoardSignal(officialCareersHtml), false)
  assert.equal(
    novac.hasPublicJobBoardSignal('<link rel="preload" href="/images/careers/career_bg.png" as="image">'),
    false,
  )
  assert.equal(
    novac.hasPublicJobBoardSignal('<html><body><a href="/careers/senior-engineer">Senior Engineer</a></body></html>'),
    true,
  )
  assert.equal(
    novac.hasPublicJobBoardSignal('<html><body><a href="/careers/senior-engineer">Apply Now</a></body></html>'),
    true,
  )
})

test('Novac Technology Solutions returns no jobs for the verified official careers shell without public listings', async () => {
  const novac = await loadNovacModule()
  assert.ok(novac, 'Expected Novac Technology Solutions scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await novac.createNovacTechnologySolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.novactech.com/careers'])
  assert.deepEqual(jobs, [])
})

test('Novac Technology Solutions fails closed when the verified careers shell changes or exposes jobs', async () => {
  const novac = await loadNovacModule()
  assert.ok(novac, 'Expected Novac Technology Solutions scraper module at ./script.js')

  await assert.rejects(
    novac.createNovacTechnologySolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>Placeholder</p></body></html>',
    }),
    /Novac Technology Solutions official careers page changed/i,
  )

  await assert.rejects(
    novac.createNovacTechnologySolutionsScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <h1>Let's Grow Together</h1>
            <p>Novac Technology Solutions</p>
            <a href="/careers/senior-engineer">Apply Now</a>
          </body>
        </html>
      `,
    }),
    /Novac Technology Solutions careers page now appears to expose public job listings/i,
  )
})
