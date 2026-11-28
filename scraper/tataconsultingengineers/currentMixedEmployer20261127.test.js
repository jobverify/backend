import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {publicationPage,publicationRole,runCurrentPublications} from './currentPublished20261119.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-mixed-employer-20261127.json.gz',import.meta.url))))
const corporate='https://www.tataconsultingengineers.com/careers/',board='https://careers.tataconsultingengineers.com/search',alternateID='61905644',ordinaryID='61096544'
const own=fixture.responses.find(p=>p.url.includes('/job/')&&!p.url.includes('/ecofirst/')),alternate=fixture.responses.find(p=>p.url.includes('/ecofirst/job/'))
const content=p=>Buffer.from(p.bodyBase64,'base64').toString(),listed=()=>content(fixture.responses.find(p=>p.url===board))
const page=()=>publicationPage(listed(),board),ordinary=()=>page().rows.find(r=>r.id===ordinaryID)
const clock=()=>fixture.observedAt
function replace(body,before,after){assert.ok(body.includes(before),'Mutation must change an actual current value: '+before);const changed=body.replaceAll(before,after);assert.notEqual(changed,body);return changed}
function editCard(html,id,edit){const d=document(html),card=d.nodes(n=>n.tag==='li'&&d.hasClass(n,'job-id-'+id));assert.equal(card.length,1);const n=card[0],before=d.outer(n),after=edit(before);assert.notEqual(after,before);return html.slice(0,n.start)+after+html.slice(n.end)}
function editCriteria(html,edit){const d=document(html),nodes=d.nodes(n=>n.attrs.itemprop==='description');assert.equal(nodes.length,1);const n=nodes[0],before=d.inner(n),after=edit(before);assert.notEqual(after,before);return html.slice(0,n.openEnd)+after+html.slice(n.closeStart)}
function replay(edit=(url,body)=>body){
 const reads=[],counts=new Map()
 return {reads,options:{requestIntervalMs:0,now:clock,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');url=String(url);reads.push(url)
  assert.equal(new URL(url).pathname.startsWith('/ecofirst/'),false,'An employer-held observation must never enter TCE role enrichment')
  const count=counts.get(url)??0;counts.set(url,count+1)
  const packet=fixture.responses.filter(p=>p.requestedUrl===url)[count]
  // Explicit failure controls restrict this component test to the separately
  // captured first page and first own detail pair. They invent no positive row,
  // closing response, description, country or application.
  if(!packet)throw new TypeError('fetch failed')
  const response=new Response(edit(url,content(packet),count),{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url});Object.defineProperty(response,'redirected',{value:packet.redirected});return response
 }}}
}

test('TCE genuine current mixed listing retains all native rows and marks the alternate brand employer-unqualified',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.responses.length,7)
 for(const p of fixture.responses){const body=Buffer.from(p.bodyBase64,'base64');assert.equal(body.length,p.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),p.sha256)}
 const current=page();assert.equal(current.rows.length,25);assert.equal(current.total,436)
 const row=current.rows.find(row=>row.id===alternateID);assert.ok(row);assert.equal(row.sourceEmployerScopeUnresolved,true);assert.equal(row.nativePublisherNamespace,'ecofirst')
 assert.equal(row.url,alternate.url);assert.equal(row.title,'Working Engineer-E1-Architecture-Design Engineering');assert.equal(row.country,'India')
 const original=document(listed()),card=original.nodes(n=>n.tag==='li'&&original.hasClass(n,'job-id-'+alternateID))[0]
 assert.equal(row.originalHtml,original.outer(card));assert.ok(row.originalTree);assert.ok(row.nativeLocationFields.length>0)
 assert.match(row.originalHtml,/Department/);assert.match(row.originalHtml,/Architecture/);assert.match(row.originalHtml,/Navi Mumbai/)
 assert.ok(current.rows.filter(row=>row.id!==alternateID).every(row=>!row.sourceEmployerScopeUnresolved&&new URL(row.url).pathname.startsWith('/job/')))
})

test('TCE preserves the alternate full raw row and closing observation in an employer-scope hold without publishing or fetching it',async()=>{
 const {reads,options}=replay(),jobs=await runCurrentPublications(options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,24);assert.equal(jobs.some(job=>job.jobId===alternateID),false)
 assert.equal(readSourceObservationEvidence(jobs,'tataconsultingengineers').observedRecordCount,25)
 assert.equal(audit.nativeOpeningInventory.length,25);assert.equal(audit.nativeClosingInventory.length,25)
 const held=audit.held.find(h=>h.id===alternateID);assert.ok(held);assert.equal(held.stage,'employer-scope');assert.match(held.reason,/employer|brand|namespace/i)
 assert.deepEqual(held.originalRecord,page().rows.find(row=>row.id===alternateID));assert.deepEqual(held.originalRecord,held.closingRecord)
 assert.ok(held.originalRecord.originalHtml);assert.equal(held.originalRecord.sourceEmployerScopeUnresolved,true)
 assert.equal(reads.some(url=>url.includes('/ecofirst/')),false)
 assert.ok(jobs.every(job=>job.company==='Tata Consulting Engineers Limited'&&job.country==='India'&&job.sourceDetailComplete===false))
 assert.equal(audit.listingOpeningPaginationComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('TCE alternate role declares the same tenant with a different brand and cannot qualify as a TCE detail',()=>{
 assert.match(content(alternate),/"ssoCompanyId"\s*:\s*'tatacons02'/);assert.match(content(alternate),/"brand"\s*:\s*"ecofirst"/)
 assert.throws(()=>publicationRole(content(alternate),page().rows.find(row=>row.id===alternateID),{observedAt:clock()}),/native publisher account differs/)
})

test('TCE current pure job route keeps original own country, criteria, application and partial flags',()=>{
 const job=publicationRole(content(own),ordinary(),{observedAt:clock()})
 assert.equal(job.jobId,ordinaryID);assert.equal(job.country,'India');assert.equal(job.company,'Tata Consulting Engineers Limited')
 assert.ok(job.sourceDescription.length>100);assert.ok(job.sourceRawDescriptionHtml);assert.ok(job.postingDate)
 assert.equal(new URL(job.applyUrl).pathname,'/talentcommunity/apply/'+ordinaryID+'/')
 assert.equal(job.sourceNativeApplication.submitted,false);assert.equal(job.sourceNativeApplication.activationVerified,false)
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
})

test('TCE a valid own detail cannot map a branded route even without a caller-supplied employer hold flag',()=>{
 const row=ordinary(),branded=new URL(row.url);branded.pathname='/ecofirst'+branded.pathname
 assert.equal(row.sourceEmployerScopeUnresolved,undefined);row.url=branded.href
 const changed=replace(content(own),own.url,branded.href)
 assert.throws(()=>publicationRole(changed,row,{observedAt:clock()}),/native published employer namespace unqualified/)
})

for(const [name,edit]of [
 ['unknown brand path',body=>replace(body,'/ecofirst/job/','/unreviewed/job/')],
 ['foreign brand origin',body=>replace(body,'/ecofirst/job/','https://foreign.invalid/ecofirst/job/')],
 ['query on brand identity',body=>replace(body,'/'+alternateID+'/', '/'+alternateID+'/?unreviewed=true')],
 ['different native ID',body=>replace(body,'/61905644/','/61905645/')],
 ['mixed responsive role links',body=>{const next=body.replace('href="/ecofirst/job/','href="/job/');assert.notEqual(next,body);return next}],
 ['foreign primary role',body=>replace(body,'/job/Pune-Planning-Engineer-MH-411021/'+ordinaryID+'/','https://foreign.invalid/job/Pune-Planning-Engineer-MH-411021/'+ordinaryID+'/')],
])test('TCE mixed inventory still rejects '+name,()=>{
 const id=name==='foreign primary role'?ordinaryID:alternateID,changed=editCard(listed(),id,edit)
 assert.throws(()=>publicationPage(changed,board),/native.*(?:identity|link)|same-role|tile identity/i)
})

test('TCE duplicate native IDs across ordinary and alternate namespaces remain invalid',()=>{
 const changed=editCard(listed(),alternateID,body=>replace(body,alternateID,ordinaryID))
 assert.throws(()=>publicationPage(changed,board),/duplicate native row identity/)
})

test('TCE a branded-to-primary closing route change stays held with both original records',async()=>{
 let changed=false;const {options}=replay((url,body,count)=>{
  if(url!==board||count!==1)return body
  changed=true;return editCard(body,alternateID,body=>replace(body,'/ecofirst/job/','/job/'))
 })
 const jobs=await runCurrentPublications(options);assert.equal(changed,true);assert.equal(jobs.length,24);assert.equal(jobs.some(j=>j.jobId===alternateID),false)
 const held=jobs.nativeCollectionEvidence.held.find(h=>h.id===alternateID);assert.ok(held);assert.match(held.reason,/closing whole published row changed/)
 assert.equal(held.originalRecord.sourceEmployerScopeUnresolved,true);assert.ok(held.originalRecord.url.includes('/ecofirst/'));assert.ok(!held.closingRecord.url.includes('/ecofirst/'))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const [name,edit,reason]of [
 ['wrong native employer',html=>replace(html,'itemprop="hiringOrganization" content="tatacons02"','itemprop="hiringOrganization" content="Other Employer"'),/employer/],
 ['conflicting typed country',html=>replace(html,'itemprop="addressCountry" content="IN"','itemprop="addressCountry" content="US"'),/country|geograph|India/],
 ['wrong-role application',html=>replace(html,'/talentcommunity/apply/'+ordinaryID+'/','/talentcommunity/apply/999999999/'),/application role/],
 ['closed full criteria',html=>editCriteria(html,body=>body+'<p>This position has been filled.</p>'),/closed/],
])test('TCE current own detail preserves '+name+' guard',()=>{
 const changed=edit(content(own));assert.throws(()=>publicationRole(changed,ordinary(),{observedAt:clock()}),reason)
})

test('TCE an explicitly foreign ordinary row cannot borrow the separate India detail',async()=>{
 let changed=0;const {options}=replay((url,body)=>{
  if(url!==board)return body
  changed++;return editCard(body,ordinaryID,body=>replace(body,'Pune, MH, IN, 411021','Pune, MH, US, 411021'))
 })
 const jobs=await runCurrentPublications(options);assert.equal(changed,2);assert.equal(jobs.length,23);assert.equal(jobs.some(j=>j.jobId===ordinaryID),false)
 assert.ok(jobs.nativeCollectionEvidence.held.some(h=>h.id===ordinaryID&&/country/.test(h.reason)))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
