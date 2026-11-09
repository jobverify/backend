import assert from 'node:assert/strict'
import test from 'node:test'
import * as source from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'

// Exact thin synthetic homepage from the archived d347 legacy regression.
// A brand, slogan and email alone do not establish the declared employer route.
const homepageHtml = `
  <html>
    <head>
      <title>Simplify3x - AI-Driven Technology Solutions for Enterprise Transformation</title>
    </head>
    <body>
      <p>Turning complex problems into simple solutions</p>
      <p>info@simplify3x.com</p>
    </body>
  </html>
`

const provider=getScraperCatalog().find(item=>item.source==='simplify3xsoftware')
assert.ok(provider)
for(const [name,execute] of [
  ['factory',options=>source.createSimplify3xSoftwareScraper().run(options)],
  ['registered',options=>createCatalogScraper(provider).run(options)],
])test('Simplify3x '+name+' rejects a thin branded marketing page on the first read',async t=>{
  t.mock.method(globalThis,'fetch',async()=>assert.fail('Native HTTP is forbidden'))
  const requests=[]
  await assert.rejects(execute({fetchPage:async url=>{
    requests.push(url)
    assert.equal(url,source.HOMEPAGE_URL,'A rejected homepage cannot authorize later routes')
    return{status:200,url,html:homepageHtml}
  }}),/homepage identity/i)
  assert.deepEqual(requests,[source.HOMEPAGE_URL])
})
