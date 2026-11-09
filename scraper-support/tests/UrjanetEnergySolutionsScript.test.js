import assert from 'node:assert/strict'
import test from 'node:test'

const acquisitionBlogHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Arcadia acquires Urjanet</h1>
    <p>Urjanet, the largest utility data provider in the world, is now part of Arcadia.</p>
    <p>The Urjanet data network will significantly expand Arcadia's energy intelligence reach.</p>
  </body>
</html>
`

const redirectPlatformHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>The most comprehensive energy data platform | Arcadia</h1>
    <p>Power every decision with energy intelligence.</p>
    <p>The Arcadia platform helps enterprises manage utility data at scale.</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers | Arcadia</h1>
    <p>Change the future of energy with us.</p>
    <a href="/jobs">View job openings</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/urjanetenergysolutions/script.js')
  } catch {
    assert.fail('Expected Urjanet Energy Solutions scraper module at ../../scraper/urjanetenergysolutions/script.js')
  }
}

test('Urjanet Energy Solutions helpers stay pinned to the verified Arcadia acquisition evidence', async () => {
  const urjanet = await loadModule()

  assert.equal(urjanet.SOURCE, 'urjanetenergysolutions')
  assert.equal(urjanet.COMPANY, 'Urjanet Energy Solutions')
  assert.equal(
    urjanet.ACQUISITION_BLOG_URL,
    'https://www.arcadia.com/blog/arcadia-acquires-urjanet',
  )
  assert.equal(urjanet.URJANET_REDIRECT_URL, 'https://www.urjanet.com/')
  assert.equal(urjanet.CAREERS_URL, 'https://www.arcadia.com/careers')
  assert.equal(urjanet.hasAcquisitionBlogSignal(acquisitionBlogHtml), true)
  assert.equal(urjanet.hasRedirectPlatformSignal(redirectPlatformHtml), true)
  assert.equal(urjanet.hasParentCareersSignal(careersHtml), true)
})

test('Urjanet Energy Solutions run validates the acquisition evidence and stays fail-closed', async () => {
  const urjanet = await loadModule()
  const requestedUrls = []

  const jobs = await urjanet.createUrjanetEnergySolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === urjanet.ACQUISITION_BLOG_URL) return acquisitionBlogHtml
      if (url === urjanet.URJANET_REDIRECT_URL) return redirectPlatformHtml
      if (url === urjanet.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Urjanet URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    urjanet.ACQUISITION_BLOG_URL,
    urjanet.URJANET_REDIRECT_URL,
    urjanet.CAREERS_URL,
  ])
})

test('Urjanet Energy Solutions fails closed when the acquisition evidence disappears', async () => {
  const urjanet = await loadModule()

  await assert.rejects(
    urjanet.createUrjanetEnergySolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Urjanet Careers</h1></body></html>',
    }),
    /verified acquisition evidence/i,
  )
})
