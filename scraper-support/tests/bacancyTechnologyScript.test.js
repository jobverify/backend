import assert from 'node:assert/strict'
import test from 'node:test'

const loadBacancyModule = async () => {
  try {
    return await import('../../scraper/bacancytechnology/script.js')
  } catch {
    assert.fail('Expected Bacancy Technology scraper module at ../../scraper/bacancytechnology/script.js')
  }
}

const blockedHtml = `
<!doctype html>
<html>
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <h1>Sorry, you have been blocked</h1>
    <p>You are unable to access bacancytechnology.com</p>
  </body>
</html>
`

const accessibleJobsHtml = `
<!doctype html>
<html>
  <body>
    <h2>Opportunities with us</h2>
    <h3>Full Stack Developer</h3>
    <h3>Angular Developer</h3>
  </body>
</html>
`

test('Bacancy Technology recognises the verified Cloudflare block response', async () => {
  const bacancy = await loadBacancyModule()

  assert.equal(bacancy.JOBS_PAGE_URL, 'https://www.bacancytechnology.com/jobs/careers-apply.php')
  assert.equal(bacancy.isVerifiedCloudflareBlock({ status: 403, body: blockedHtml }), true)
  assert.equal(bacancy.isVerifiedCloudflareBlock({ status: 403, html: blockedHtml }), true)
  assert.equal(bacancy.isVerifiedCloudflareBlock({ status: 200, body: blockedHtml }), false)
  assert.equal(bacancy.isVerifiedCloudflareBlock({ status: 403, body: '<html></html>' }), false)
})

test('run returns no jobs only while Bacancy stays on the verified blocked surface', async () => {
  const bacancy = await loadBacancyModule()

  const responses = []
  const jobs = await bacancy.createBacancyTechnologyScraper().run({
    fetchPage: async (url) => {
      responses.push(url)
      return { status: 403, body: blockedHtml, url }
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(responses, ['https://www.bacancytechnology.com/jobs/careers-apply.php'])
  assert.deepEqual(jobs, [])
})

test('run fails closed when Bacancy no longer returns the verified blocked response', async () => {
  const bacancy = await loadBacancyModule()

  await assert.rejects(
    bacancy.createBacancyTechnologyScraper().run({
      fetchPage: async () => ({ status: 200, body: accessibleJobsHtml, url: bacancy.JOBS_PAGE_URL }),
    }),
    /verified Cloudflare-blocked Bacancy jobs surface/i,
  )
})
