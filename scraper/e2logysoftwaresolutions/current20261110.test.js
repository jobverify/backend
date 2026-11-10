import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractCurrentDetail,extractCurrentListings} from './currentNative.js'

const bytes=readFileSync(new URL('./fixtures/current-http-20261110.json.gz',import.meta.url))
const captured=JSON.parse(gunzipSync(bytes)),corporate='https://e2logy.com/careers'
const opening=captured.responses.find(row=>row.url===corporate)
const listings=extractCurrentListings(opening.body)
const native=captured.responses.find(row=>row.url===listings[0].sourceUrl)
const sha=value=>createHash('sha256').update(value).digest('hex')

// Restoring a retired Zoho asset/declaration fingerprint must break this
// behavior: genuine currently bound native criteria must remain collectable.
test('current E2logy registered source collects both live bound roles with full criteria and closing checks',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected live network in current E2logy replay')})
 assert.equal(captured.responses.length,6)
 for(const row of captured.responses){assert.equal(sha(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes)}
 const scraper=createCatalogScraper(getScraperCatalog().find(row=>row.source==='e2logysoftwaresolutions'))
 const calls=[]
 const jobs=await scraper.run({now:()=>captured.completedAt,fetchPage:async url=>{
  calls.push(url);const n=calls.filter(value=>value===url).length,rows=captured.responses.filter(row=>row.url===url),row=rows[n-1]
  assert.ok(row,'Unexpected or excess native request: '+url)
  return{status:row.status,url:row.finalUrl,headers:row.headers,body:row.body}
 }})
 assert.deepEqual(calls,[corporate,...listings.map(row=>row.sourceUrl),...listings.map(row=>row.sourceUrl),corporate])
 assert.deepEqual(jobs.map(row=>row.jobId),['424443000011667046','424443000011620017'])
 assert.ok(jobs.every(row=>row.country==='India'&&row.company==='E2logy Software Solutions'&&row.jobDescription.length>1000&&row.sourceDetailComplete===true))
 assert.ok(jobs.every(row=>row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch,true)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const[name,mutate,error]of[
 ['unreviewed asset-map bytes',html=>html.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unexpected.js":"unexpected.js",'),/inline program authority/],
 ['a changed active external declaration',html=>html.replace('career-website-common.d5910bf420e6656b66157906f08fbee8.js','career-website-common.00000000000000000000000000000000.js'),/declaration authority/],
 ['an extra active script',html=>html+'<script>window.unreviewed=true;</script>',/declaration authority/],
 ['a renamed data binding',html=>html.replace('var jobs =','var jobsAlias ='),/declaration structure/],
 ['a different employer',html=>html.replaceAll('E2logy Software Solutions Private Limited','Another Employer Private Limited'),/employer identity/],
 ['another native job ID',html=>html.replaceAll('424443000011667046','424443000011667047'),/ID\/title/],
 ['a hidden owned carrier',html=>html.replace('<head>','<head hidden>'),/hidden or inert/],
])test('current E2logy rejects '+name,()=>{
 const changed=mutate(native.body);assert.notEqual(changed,native.body,'The fault must alter the captured response')
 assert.throws(()=>extractCurrentDetail(changed,listings[0]),error)
})

test('current E2logy keeps corporate workplace conflicts fatal after accepting its exact deployment',()=>{
 assert.throws(()=>extractCurrentDetail(native.body,{...listings[0],country:'United States'}),/corporate\/detail metadata conflict/)
})
