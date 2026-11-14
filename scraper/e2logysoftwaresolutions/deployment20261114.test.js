import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractCurrentListings,extractCurrentDetail} from './currentNative.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261114.json.gz',import.meta.url))))
const listings=extractCurrentListings(fixture.responses[0].body),native=fixture.responses[1].body
const sha=value=>createHash('sha256').update(value).digest('hex')
const scraper=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='e2logysoftwaresolutions'))
const replay=()=>async url=>{const row=fixture.responses.find(row=>row.url===url);assert.ok(row,'Undeclared request '+url);return {...row}}

test('E2logy Nov14 deployment returns both current original India Drupal roles without broadening scope',async()=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 const jobs=await scraper().run({fetchPage:replay()})
 assert.deepEqual(jobs.map(job=>job.jobId),['424443000011711102','424443000011711171'])
 assert.deepEqual(jobs.map(job=>job.city),['Noida','Ahmedabad'])
 assert.deepEqual(jobs.map(job=>sha(job.sourceDescriptionHTML)),['a5edd3dbaf6c436029758fad7113e7e5ec32b8ef1a1b1041e444eb5d68955c53','863e8dd465ecd35e92afce870c4ae81d58111958ab8ce8d06624fe8b4cd5c43c'])
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.jobDescription.length>1000&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

for(const[name,edit]of[
 ['an unknown asset map',html=>html.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unexpected.js":"unexpected.js",')],
 ['another deployment declaration with the new map',html=>html.replace('career-website-common.e098b32b8e59c3522a0599bd2176f5cc.js','career-website-common.d5910bf420e6656b66157906f08fbee8.js')],
 ['an additional active script',html=>html+'<script>window.extra=true</script>'],
 ['an executable data initializer',html=>html.replace('var jobs = JSON.parse(', 'var jobs = executeInstead(')],
])test('E2logy current deployment rejects '+name,()=>{
 const changed=edit(native);assert.notEqual(changed,native)
 assert.throws(()=>extractCurrentDetail(changed,listings[0]),/program|declaration|literal/)
})

test('E2logy current deployment retains employer identity and explicit corporate/detail country agreement',()=>{
 assert.throws(()=>extractCurrentDetail(native,{...listings[0],country:'United States'}),/metadata conflict/)
 assert.throws(()=>extractCurrentDetail(native.replaceAll('E2logy Software Solutions Private Limited','Other Employer Private Limited'),listings[0]),/employer identity/)
})
