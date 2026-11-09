import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; The product lifecycle management platform</title>
  </head>
  <body>
    <main>
      <h1>Make Great Things Happen. <span>Join Servify.</span></h1>
      <p>Present across 3 continents, Servify has a diverse workforce and are committed to building a workspace that promotes growth, both personally & professionally.</p>
      <h2>Apply now and <span>shape your future</span></h2>
      <p>Share your eye-catching application to careers@servify.com</p>
    </main>
  </body>
</html>
`

const OFFICIAL_CAREERS_WITH_PUBLIC_JOBS_HTML = OFFICIAL_CAREERS_HTML.replace(
  '</main>',
  '<a href="https://jobs.lever.co/servify/senior-engineer">Apply now</a></main>',
)

const loadServifyModule = async () => {
  try {
    return await import('../../scraper/servify/script.js')
  } catch {
    assert.fail('Expected Servify scraper module at ../../scraper/servify/script.js')
  }
}

test('Servify helpers pin the verified official careers page and email-apply contract', async () => {
  const servify = await loadServifyModule()

  assert.equal(servify.SOURCE, 'servify')
  assert.equal(servify.COMPANY, 'Servify')
  assert.equal(servify.HOMEPAGE_URL, 'https://servify.com/')
  assert.equal(servify.CAREERS_URL, 'https://servify.com/us/careers/')
  assert.equal(servify.CAREERS_EMAIL, 'careers@servify.com')
  assert.equal(servify.VERIFIED_ON, '2026-07-17')
  assert.equal(servify.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(servify.hasVisiblePublicJobsContract(OFFICIAL_CAREERS_HTML), false)
  assert.equal(servify.hasVisiblePublicJobsContract(OFFICIAL_CAREERS_WITH_PUBLIC_JOBS_HTML), true)
})

test('Servify returns [] only while the official careers page remains email-apply only', async () => {
  const servify = await loadServifyModule()
  const requests = []

  const jobs = await servify.createServifyScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === servify.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      throw new Error(`Unexpected Servify URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [servify.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Servify fails closed when the official careers page changes materially or starts exposing a public jobs board', async () => {
  const servify = await loadServifyModule()

  await assert.rejects(
    servify.createServifyScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body></body></html>',
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    servify.createServifyScraper().run({
      fetchText: async () => OFFICIAL_CAREERS_WITH_PUBLIC_JOBS_HTML,
    }),
    /public jobs surface/i,
  )
})
