import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - KeyCDN</title>
  </head>
  <body>
    <main>
      <h1>We are looking for smart and enthusiastic people to help us build a world-class CDN.</h1>
      <p>Remote first company</p>
      <p>Made in Switzerland</p>
      <p>Open source and cool colleagues around the world.</p>
    </main>
  </body>
</html>
`

const jobsSurfaceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>KeyCDN Careers</title>
  </head>
  <body>
    <h1>Current openings</h1>
    <a href="/jobs/senior-platform-engineer">Senior Platform Engineer</a>
    <a href="https://jobs.ashbyhq.com/keycdn">View jobs</a>
  </body>
</html>
`

const loadKeycdnModule = async () => {
  try {
    return await import('../../scraper/keycdn/script.js')
  } catch {
    assert.fail('Expected KeyCDN scraper module at ../../scraper/keycdn/script.js')
  }
}

test('KeyCDN scraper helpers stay pinned to the verified first-party careers sentinel', async () => {
  const keycdn = await loadKeycdnModule()

  assert.equal(keycdn.SOURCE, 'keycdn')
  assert.equal(keycdn.COMPANY, 'KeyCDN')
  assert.equal(keycdn.COMPANY_DOMAIN, 'keycdn.com')
  assert.equal(keycdn.CAREERS_URL, 'https://www.keycdn.com/careers')
  assert.equal(keycdn.VERIFIED_AT, '2026-07-25')
  assert.equal(keycdn.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(keycdn.hasLinkedTrustworthyPublicJobsSurface(careersHtml), false)
  assert.equal(keycdn.hasLinkedTrustworthyPublicJobsSurface(jobsSurfaceHtml), true)
})

test('KeyCDN run returns [] while the verified careers page has no trustworthy public jobs surface', async () => {
  const keycdn = await loadKeycdnModule()
  const requestedUrls = []

  const jobs = await keycdn.createKeycdnScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: careersHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [keycdn.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('KeyCDN fails closed when the careers page drifts or public jobs surface appears', async () => {
  const keycdn = await loadKeycdnModule()

  await assert.rejects(
    keycdn.createKeycdnScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><title>Unexpected</title></html>',
      }),
    }),
    /careers page/i,
  )

  await assert.rejects(
    keycdn.createKeycdnScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: jobsSurfaceHtml,
      }),
    }),
    /public jobs surface/i,
  )
})
