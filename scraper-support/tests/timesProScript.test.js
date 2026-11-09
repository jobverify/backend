import assert from 'node:assert/strict'
import test from 'node:test'

const loadTimesProModule = async () => {
  try {
    return await import('../../scraper/timespro/script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Career Opportunities | TimesPro</title>
  </head>
  <body>
    <main>
      <h1>The House of TimesPro</h1>
      <p>
        Step into an environment built on an open and free culture, where
        innovation is encouraged and voices are heard.
      </p>
      <h2>Reasons To Join TimesPro</h2>
      <p>
        With 180 years of heritage in the media, entertainment, and education
        sectors, the Times Group is one of the most trusted brands in the
        Indian landscape.
      </p>
      <p>We are ushering in the Education 4.0 revolution in India.</p>
      <h3>A Strong Brand Reputation</h3>
    </main>
  </body>
</html>
`

test('TimesPro validates the verified official careers shell and detects public job signals', async () => {
  const timesPro = await loadTimesProModule()
  assert.ok(timesPro, 'Expected TimesPro scraper module at ../../scraper/timespro/script.js')

  assert.equal(timesPro.SOURCE, 'timespro')
  assert.equal(timesPro.COMPANY, 'TimesPro')
  assert.equal(timesPro.CAREERS_URL, 'https://timespro.com/careers')
  assert.equal(timesPro.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    timesPro.hasOfficialCareersSignal('<html><body><h1>Career</h1><p>Placeholder</p></body></html>'),
    false,
  )
  assert.equal(timesPro.hasPublicJobBoardSignal(officialCareersHtml), false)
  assert.equal(
    timesPro.hasPublicJobBoardSignal(
      '<html><body><a href="/careers/jobs/senior-manager">Apply now</a></body></html>',
    ),
    true,
  )
})

test('TimesPro returns no jobs for the verified official careers shell without public listings', async () => {
  const timesPro = await loadTimesProModule()
  assert.ok(timesPro, 'Expected TimesPro scraper module at ../../scraper/timespro/script.js')

  const requestedUrls = []
  const jobs = await timesPro.createTimesProScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://timespro.com/careers'])
  assert.deepEqual(jobs, [])
})

test('TimesPro fails closed when the verified careers shell changes or exposes jobs', async () => {
  const timesPro = await loadTimesProModule()
  assert.ok(timesPro, 'Expected TimesPro scraper module at ../../scraper/timespro/script.js')

  await assert.rejects(
    timesPro.createTimesProScraper().run({
      fetchText: async () => '<html><body><h1>Career</h1><p>Placeholder</p></body></html>',
    }),
    /TimesPro official careers page changed/i,
  )

  await assert.rejects(
    timesPro.createTimesProScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title>Explore Career Opportunities | TimesPro</title>
          </head>
          <body>
            <main>
              <h1>The House of TimesPro</h1>
              <h2>Reasons To Join TimesPro</h2>
              <p>We are ushering in the Education 4.0 revolution in India.</p>
              <a href="/careers/jobs/senior-manager">Apply now</a>
            </main>
          </body>
        </html>
      `,
    }),
    /TimesPro careers page now appears to expose public job listings/i,
  )
})
