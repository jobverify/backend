import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {run,CAREERS_PAGE_URL,ASHBY_JOB_BOARD_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-http-20261105.json.gz',import.meta.url))))
const secondCapture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-http-20261105-second.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const originalFeed=()=>JSON.parse(captured.responses.find(row=>row.url===ASHBY_JOB_BOARD_URL).body)
const replaceBootstrap=(page,mutate)=>{
 const script=readNativeDocument(page.html).nodes(node=>node.tag==='script'&&!node.attrs.src&&/window\.__appData\s*=/.test(node.raw||''))[0]
 const statement=parse(script.raw,{ecmaVersion:'latest',sourceType:'script'}).body[0]
 const body=script.raw.slice(0,statement.end)+mutate(script.raw.slice(statement.end))
 return{...page,html:page.html.replace(script.raw,body)}
}
const replay=async({mutatePage,mutateJson,dataset=captured}={})=>{
 const calls=[],audits=[]
 const fetchPage=async url=>{
  calls.push(url)
  const n=calls.filter(value=>value===url).length
  const packets=dataset.responses.filter(row=>row.url===url)
  assert.ok(packets.length,'Unexpected real-fixture request '+url)
  const packet=packets[Math.min(n-1,packets.length-1)]
  const page={status:packet.status,url:packet.finalUrl,html:packet.body}
  return mutatePage?mutatePage(page,url,n):page
 }
 const jobs=await run({now:()=>dataset.completedAt,fetchPage,fetchJson:async url=>{
  const page=await fetchPage(url)
  const value=JSON.parse(page.html)
  return mutateJson?mutateJson(value,calls.filter(item=>item===url).length):value
 },onAudit:value=>audits.push(value)})
 return{jobs,calls,audit:audits.at(-1),evidence:readInventoryEvidence(jobs)}
}

test('November GitBook fixture preserves all seven genuine response bodies and source clocks',()=>{
 assert.equal(captured.responses.length,7)
 for(const row of captured.responses){
  assert.equal(row.sha256,sha(row.body));assert.equal(row.bytes,Buffer.byteLength(row.body))
  assert.equal(row.status,200);assert.equal(row.url,row.finalUrl)
  assert.ok(row.completedAt>=row.requestedAt)
 }
})

test('current GitBook employer declarations bind the three full native roles with unresolved Remote countries',async()=>{
 const {jobs,calls,audit,evidence}=await replay()
 const native=originalFeed().jobs
 assert.equal(jobs.length,3);assert.deepEqual(jobs.map(row=>row.jobId),native.map(row=>row.id))
 assert.equal(calls.length,10);assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.employerScopeStable,true);assert.equal(audit.unresolvedAdvertisedRoleIds.length,0)
 assert.equal(audit.detailProofs.length,3)
 assert.deepEqual(audit.unknownCountryRoleIds,native.map(row=>row.id))
 for(const [index,job]of jobs.entries()){
  assert.equal(job.sourceDetailComplete,true)
  assert.deepEqual(job.sourceNativeRecord,native[index])
  assert.equal(job.sourceDescription,native[index].descriptionHtml)
  assert.equal(job.sourceNativeDescriptionPlain,native[index].descriptionPlain)
  assert.equal(job.country,null);assert.equal(job.city,null)
  assert.equal(job.nativeAddressCountry,'Remote')
  assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.verifiedAt,captured.completedAt)
})

test('current GitBook scope still rejects an unreviewed corporate recruiting channel',async()=>{
 await assert.rejects(replay({mutatePage:(page,url)=>url===CAREERS_PAGE_URL?{...page,html:page.html.replace('</body>','<a href="https://jobs.example/new-careers">Open roles</a></body>')}:page}),/employer.*scope|handoff|binding/i)
})

test('current GitBook native bootstrap changes cannot certify full descriptions',async()=>{
 const {jobs,audit}=await replay({mutatePage:(page,url)=>{
  if(!url.includes('jobs.ashbyhq.com'))return page
  const script=readNativeDocument(page.html).nodes(node=>node.tag==='script'&&!node.attrs.src&&/window\.__appData\s*=/.test(node.raw||''))[0]
  return{...page,html:page.html.replace(script.raw,script.raw+'\nwindow.unreviewedRenderer=true;')}
 }})
 assert.equal(jobs.length,3)
 assert.equal(audit.sourceScopeComplete,false)
 for(const job of jobs){assert.equal(job.sourceDetailComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)}
 assert.ok(audit.detailProofs.every(row=>row.reasons.some(reason=>/reviewed.bootstrap/i.test(reason))))
})

test('current GitBook still rejects a changed closing native inventory',async()=>{
 await assert.rejects(replay({mutateJson:(value,n)=>{if(n===2)value.jobs.pop();return value}}),/closing.inventory.changed/i)
})

test('unknown criteria in current GitBook feed remain intact and revoke detail completeness',async()=>{
 const {jobs}=await replay({mutateJson:value=>{value.jobs[0].mandatoryLicense='current original criteria';return value}})
 assert.equal(jobs.length,3);assert.equal(jobs[0].sourceNativeRecord.mandatoryLicense,'current original criteria')
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[1].sourceDetailComplete,true)
})

test('the second genuinely captured native release retains all three full roles and the original observation clock',async()=>{
 assert.equal(secondCapture.responses.length,10)
 for(const row of secondCapture.responses){assert.equal(sha(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes)}
 const {jobs,calls,audit,evidence}=await replay({dataset:secondCapture})
 assert.equal(calls.length,10);assert.equal(jobs.length,3)
 assert.equal(jobs.filter(row=>row.sourceDetailComplete).length,3)
 assert.equal(evidence.verifiedAt,secondCapture.completedAt)
 assert.equal(audit.employerScopeStable,true);assert.equal(audit.closingInventoryMatches,true)
 for(const job of jobs){assert.equal(job.country,null);assert.equal(job.lifecycleCleanupAllowed,false)}
})

test('a foreign native bootstrap CDN remains unreviewed',async()=>{
 const {jobs,audit}=await replay({dataset:secondCapture,mutatePage:(page,url)=>{
  if(!url.includes('jobs.ashbyhq.com'))return page
  return replaceBootstrap(page,tail=>tail.replace('https://cdn.ashbyprd.com/frontend_non_user/','https://foreign.example/frontend_non_user/'))
 }})
 assert.equal(jobs.length,3);assert.equal(jobs.filter(row=>row.sourceDetailComplete).length,0)
 assert.ok(audit.detailProofs.every(row=>row.reasons.some(reason=>/reviewed.bootstrap/i.test(reason))))
})

for(const [name,mutate]of[
 ['mixed retained build IDs',html=>html.replace('773e7a6a93cf5c090c7ab5ec7951f0b52da90a36','6e083157b97906f9546485e7ef7829fb8fd69416')],
 ['an unseen uniform build ID',html=>html.replaceAll('773e7a6a93cf5c090c7ab5ec7951f0b52da90a36','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')],
])test(name+' cannot certify current GitBook native criteria',async()=>{
 const {jobs,audit}=await replay({dataset:secondCapture,mutatePage:(page,url)=>url.includes('jobs.ashbyhq.com')?replaceBootstrap(page,mutate):page})
 assert.equal(jobs.length,3);assert.equal(jobs.filter(row=>row.sourceDetailComplete).length,0)
 assert.ok(audit.detailProofs.every(row=>row.reasons.some(reason=>/reviewed.bootstrap/i.test(reason))))
})
