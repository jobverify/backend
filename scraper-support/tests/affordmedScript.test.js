import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const currentPublicPage=(source,url)=>{const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/'+source+'/test-data/current-public-20261103.json.gz',import.meta.url)))),row=fixture.responses.find(r=>r.url===url);assert.ok(row,'Only current captured declared public URL: '+url);return{url:row.finalURL,status:row.status,headers:row.headers,html:row.body}}
import assert from 'node:assert/strict'
import test from 'node:test'

const loadAffordmedModule = async () => {
  try {
    return await import('../../scraper/affordmed/script.js')
  } catch {
    return null
  }
}

const buildCareersHtml = () => `
<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Afford Medical Technologies Private Limited",
        "alternateName": "Affordmed"
      }
    </script>
    <script type="module" crossorigin src="/assets/index-DEUWnO6z.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

test('extractSearchResults returns no jobs when Affordmed only exposes a frontend shell without public openings', async () => {
  const affordmed = await loadAffordmedModule()
  assert.ok(affordmed)

  const jobs = affordmed.extractSearchResults(buildCareersHtml())
  assert.deepEqual(jobs, [])
})

test('Affordmed shell and active current root-router are inspected without certifying empty vacancies',async()=>{
 const module=await loadAffordmedModule(),reads=[]
 await assert.rejects(module.createAffordmedScraper().run({fetchPage:async url=>{reads.push(url);return currentPublicPage('affordmed',url)}}),error=>error.failureKind==='source_inventory_unavailable'&&error.inventoryEvidence.reportedTotal===null)
 assert.deepEqual(reads,[module.CAREER_PAGE_URL,'https://www.affordmed.com/assets/index-DEUWnO6z.js'])
})
