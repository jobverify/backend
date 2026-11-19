import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {createE2logySoftwareSolutionsScraper} from './script.js'
import {extractCurrentDetail,extractCurrentListings} from './currentNative.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261119.json.gz',import.meta.url))))
const listings=extractCurrentListings(fixture.responses[0].body),native=fixture.responses[1].body
const sha=value=>createHash('sha256').update(value).digest('hex')

test('E2logy current published Nov16 vendor deployment retains both complete native Drupal roles',async()=>{
 const counts=new Map()
 const jobs=await createE2logySoftwareSolutionsScraper().run({fetchPage:async url=>{
  const rows=fixture.responses.filter(row=>row.url===url),index=counts.get(url)||0
  assert.ok(rows[index],'Unexpected native read '+url)
  counts.set(url,index+1)
  assert.equal(sha(rows[index].body),rows[index].sha256)
  return rows[index]
 }})
 assert.deepEqual(jobs.map(row=>row.jobId).sort(),['424443000011711102','424443000011711171'])
 assert.deepEqual(jobs.map(row=>row.city).sort(),['Ahmedabad','Noida'])
 assert.ok(jobs.every(row=>row.country==='India'&&row.sourceDetailComplete&&row.sourceDescriptionHTML.length>2000))
 assert.ok(jobs.every(row=>row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false&&row.requisitionId===null))
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('E2logy current deployment rejects an unknown CDN map or a mixed historical/current activation tuple',()=>{
 for(const changed of [
  native.replace('fingerPrintJSONForCDNPath = {','fingerPrintJSONForCDNPath = {"unreviewed.js":"unreviewed.js",'),
  native.replace('career-website-common.5d760a87446385b0a4896c0b55098b2c.js','career-website-common.e098b32b8e59c3522a0599bd2176f5cc.js'),
 ]){
  assert.notEqual(changed,native)
  assert.throws(()=>extractCurrentDetail(changed,listings[0]),/program|declaration/)
 }
})

for(const [statement,reason] of [
 ['This position is closed and we are no longer accepting applications.',/closed/],
 ['Work Country: Canada.',/country/],
 ['Employer: Other Company.',/employer/],
]){
 test('E2logy rejects contradictory full native criteria: '+statement,()=>{
  const carrier=readNativeDocument(native).nodes(node=>node.tag==='script'&&!node.attrs.src).at(-1)
  const ast=parse(carrier.raw,{ecmaVersion:'latest'}),literal=ast.body[3].declarations[0].init.arguments[0]
  const records=JSON.parse(literal.value)
  records[0].Job_Description+='<p>'+statement+'</p>'
  const body=carrier.raw.slice(0,literal.start)+JSON.stringify(JSON.stringify(records))+carrier.raw.slice(literal.end)
  const changed=native.replace(carrier.raw,body)
  assert.notEqual(changed,native)
  assert.throws(()=>extractCurrentDetail(changed,listings[0]),reason)
 })
}
