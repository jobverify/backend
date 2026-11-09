import assert from 'node:assert/strict'
import test from 'node:test'

const BLOCKED_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>403 Forbidden</title>
  </head>
  <body>
    <h1>403 Forbidden</h1>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/qentelli/script.js')
  } catch {
    assert.fail('Expected Qentelli scraper module at ../../scraper/qentelli/script.js')
  }
}

test('Qentelli returns [] only while the verified first-party homepage, careers, and jobs routes remain 403-blocked', async () => {
  const qentelli = await loadModule()

  assert.equal(qentelli.SOURCE, 'qentelli')
  assert.equal(qentelli.COMPANY, 'Qentelli')
  assert.equal(qentelli.HOMEPAGE_URL, 'https://www.qentelli.com/')
  assert.equal(qentelli.CAREERS_URL, 'https://www.qentelli.com/careers')
  assert.equal(qentelli.JOBS_URL, 'https://www.qentelli.com/jobs')
  assert.equal(qentelli.VERIFIED_ON, '2026-07-17')

  const jobs = await qentelli.createQentelliScraper().run({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: BLOCKED_HTML,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Qentelli fails closed when any verified route stops being 403-blocked or starts exposing public jobs', async () => {
  const qentelli = await loadModule()

  await assert.rejects(
    qentelli.createQentelliScraper().run({
      fetchPage: async (url) => ({
        status: url === qentelli.CAREERS_URL ? 200 : 403,
        url,
        html: url === qentelli.CAREERS_URL
          ? '<html><body><h1>Current Openings</h1><a href="/jobs/aws-developer">Apply now</a></body></html>'
          : BLOCKED_HTML,
      }),
    }),
    /public jobs surface|403-blocked/i,
  )
})
