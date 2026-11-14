import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261114.json.gz',import.meta.url))))
const HOME='https://calendly.com/careers',FEED='https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true'
const ISLAND='https://calendly.com/_astro/islands.B4pXc9Su.js'
const scraper=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='calendly'))
const replay=(change=(_url,row)=>row)=>{
 const counts=new Map()
 return async url=>{const row=fixture.responses.find(row=>row.url===url);assert.ok(row,'Undeclared request '+url);const count=(counts.get(url)||0)+1;counts.set(url,count);const changed=change(url,{...row},count),response=new Response(changed.body,{status:changed.status,headers:changed.headers});Object.defineProperty(response,'url',{value:changed.finalUrl});return response}
}
const sha=value=>createHash('sha256').update(value).digest('hex')

test('Calendly Nov14 declared Astro assets reconcile five real foreign roles and prove only finite India zero',async()=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 const jobs=await scraper().run({fetchImpl:replay()}),evidence=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs,[])
 assert.equal(evidence.status,'complete-inventory');assert.equal(evidence.reportedTotal,5);assert.equal(evidence.indiaFacetCount,0)
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(isVerifiedEmptyEvidence(evidence),false)
 assert.deepEqual(audit.roles.map(role=>role.id),[8846049002,8922278002,8628979002,8728555002,8860525002])
 assert.equal(audit.companyGlobalScopeQualified,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.fullClosingPublisherRenderersBoardFeedAndEveryRoleReconciled,true)
 const native=JSON.parse(fixture.responses.find(row=>row.url===FEED).body).jobs
 for(const role of audit.roles){
  assert.equal(role.country,'United States');assert.equal(role.employer,'Calendly')
  assert.equal(role.fullCriteriaOutsideStructuredPayRangesExact,true)
  assert.equal(role.closingFullRoleCriteriaAndIdentityUnchanged,true)
  assert.deepEqual(role.sourceNativeRecord,native.find(row=>row.id===role.id))
 }
})

for(const[name,url,edit]of[
 ['changed current renderer bytes',ISLAND,body=>body+'\nwindow.extra=true'],
 ['another recruitment declaration',HOME,body=>body+'<a href="https://other.example/jobs">Other jobs</a>'],
 ['a different declared deployment',HOME,body=>body.replaceAll('index.6LzILDFT.js','index.Ca3DqKKy.js')],
])test('Calendly current deployment withholds zero for '+name,async()=>{
 await assert.rejects(()=>scraper().run({fetchImpl:replay((current,row)=>current===url?{...row,body:edit(row.body)}:row)}),/program|renderer/)
})

test('Calendly current deployment withholds zero when an India role appears',async()=>{
 await assert.rejects(()=>scraper().run({fetchImpl:replay((url,row)=>{
  if(url!==FEED)return row
  const body=JSON.parse(row.body);body.jobs[0].location.name='India';body.jobs[0].offices=[]
  return {...row,body:JSON.stringify(body)}
 })}),/India role requires/)
})

test('Calendly current deployment still checks closing asset bytes',async()=>{
 await assert.rejects(()=>scraper().run({fetchImpl:replay((url,row,count)=>url===ISLAND&&count===2?{...row,body:row.body+'\nwindow.extra=true'}:row)}),/closing.*renderer/)
})
