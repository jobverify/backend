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

test('Futurism current collector requires metadata and never treats a blocked body as company zero', async t => {
  const futurism=await loadScript()
  t.mock.method(globalThis,'fetch',()=>{throw Error('Real network prohibited in source regression')})
  assert.equal(futurism.hasCloudflareBlockSignal(cloudflareBlockHtml),true)
  await assert.rejects(futurism.run({fetchText:async()=>cloudflareBlockHtml}),/response metadata/)
  const controller=new AbortController(),reason=Object.freeze({owner:'current source caller'})
  controller.abort(reason)
  await assert.rejects(futurism.run({signal:controller.signal}),error=>error===reason)
})
