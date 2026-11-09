import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => {
  try {
    return await import('../../scraper/futurismtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Futurism Technologies catalog module at ../../scraper/futurismtechnologies/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/futurismtechnologies/script.js')
  } catch {
    assert.fail('Expected Futurism Technologies scraper module at ../../scraper/futurismtechnologies/script.js')
  }
}

const cloudflareBlockHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <h1>Sorry, you have been blocked</h1>
    <h2>You are unable to access futurismtechnologies.com</h2>
    <p>Cloudflare Ray ID: a1cf300d1f152b44</p>
  </body>
</html>
`

test('Futurism catalog records the blocked first-party careers surface', async () => {
  const { FUTURISM_TECHNOLOGIES_CATALOG } = await loadCatalog()

  assert.equal(FUTURISM_TECHNOLOGIES_CATALOG.source, 'futurismtechnologies')
  assert.equal(FUTURISM_TECHNOLOGIES_CATALOG.companyName, 'Futurism Technologies')
  assert.equal(FUTURISM_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://www.futurismtechnologies.com/careers/')
  assert.equal(FUTURISM_TECHNOLOGIES_CATALOG.atsPlatform, 'official-careers-surface-blocked')
  assert.equal(FUTURISM_TECHNOLOGIES_CATALOG.verifiedOn, '2026-07-18')
  assert.match(FUTURISM_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /cloudflare/i)
  assert.match(FUTURISM_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Futurism sentinel returns [] only while the official careers URL is Cloudflare-blocked', async () => {
  const futurism = await loadScript()

  assert.equal(futurism.hasCloudflareBlockSignal(cloudflareBlockHtml), true)

  const jobs = await futurism.run({
    fetchText: async (url) => {
      assert.equal(url, futurism.CAREERS_URL)
      return cloudflareBlockHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    futurism.run({
      fetchText: async () => '<html><body><h1>Software Engineer</h1><a href="/apply">Apply now</a></body></html>',
    }),
    /changed materially/i,
  )
})
