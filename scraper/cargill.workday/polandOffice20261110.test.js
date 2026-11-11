import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {SEARCH,parseCargillOfficialRole,parseCargillRmkDetail} from './nativeContract.js'
import {runNativeCargill} from './nativeRun.js'
const bytes=fs.readFileSync(new URL('./test-data/poland-office-20261110.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(bytes)),manifest=JSON.parse(fs.readFileSync(new URL('./test-data/poland-office-20261110.manifest.json',import.meta.url)))
const sha=b=>createHash('sha256').update(b).digest('hex'),HOLD='CARGILL_SAME_COUNTRY_WORKSITE_DISAGREEMENT',role=fixture.role,decode=p=>new TextDecoder().decode(Buffer.from(p.bodyBase64,'base64'))
const publicPacket=fixture.packets.find(p=>p.requestURL===role.row.sourceUrl),nativePacket=fixture.packets.find(p=>p.requestURL===role.applicationURL)
const official=(html=decode(publicPacket))=>parseCargillOfficialRole(html,role.row,{now:fixture.capturedAt,deferIncompletePublicOffice:true})
const native=(html=decode(nativePacket),model=official())=>parseCargillRmkDetail(html,nativePacket.finalURL,model,{now:fixture.capturedAt})
const publicChange=change=>decode(publicPacket).replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,raw,close)=>{const job=JSON.parse(raw);if(job['@type']!=='JobPosting')return all;change(job);return open+JSON.stringify(job)+close})
test('all current original packets retain exact raw bytes, dates, MIME, methods and identities',()=>{
 assert.equal(sha(bytes),manifest.sha256);assert.equal(fixture.originalCurrentRows.length,84)
 for(const p of fixture.packets){const raw=Buffer.from(p.bodyBase64,'base64');assert.equal(raw.length,p.bodyBytes);assert.equal(sha(raw),p.bodySHA256);assert.equal(p.method,'GET');assert.equal(p.status,200);assert.ok(p.contentType);assert.ok(Date.parse(p.completedAt)>=Date.parse(p.requestedAt))}
})
test('genuine explicit public India and Poland offices parse without translating native office labels',()=>{
 const model=official();assert.equal(model.requisitionId,'336325');assert.deepEqual(model.addresses.map(a=>a.addressCountry),['Poland','Poland','India']);assert.equal(model.addresses[1].addressLocality,'Warsaw');assert.equal(model.addresses[1].addressRegion,'Mazovia')
})
test('genuine Polish SAP office is a full identity-bound discrepancy hold, never an alias or published India role',()=>{
 assert.throws(()=>native(),error=>{
  assert.equal(error.code,HOLD);const model=error.validatedModel
  assert.deepEqual(model.nativeLocations,['Warszawa, Mazowieckie, PL Poland, 02-675'])
  assert.equal(model.jobDescription,role.expectedNativeWholeCriteria);assert.equal(sha(model.jobDescription),role.expectedNativeWholeCriteriaSHA256)
  assert.equal(model.sourceLocationCorroborationComplete,false);assert.equal(model.sourceScopeComplete,false)
  assert.equal(model.nativeWholeCriteriaSHA256,role.expectedNativeWholeCriteriaSHA256);return true
 })
})
for(const [label,change]of [['unknown public country',()=>publicChange(p=>{p.jobLocation[0].address.addressCountry='Unknown'})],['public country code is not a name',()=>publicChange(p=>{p.jobLocation[0].address.addressCountry='PL'})],['missing own India office',()=>publicChange(p=>{p.jobLocation=p.jobLocation.slice(0,2)})],['wrong public employer',()=>publicChange(p=>{p.hiringOrganization.name='Other Corporation'})]])test('Poland support does not qualify '+label,()=>{
 assert.throws(()=>official(change(decode(publicPacket))))
})
for(const [label,change]of [['unknown native country',s=>s.replaceAll('PL Poland','XX Unknown')],['conflicting country label',s=>s.replaceAll('PL Poland','PL India')],['unpublished country name',s=>s.replaceAll('PL Poland','PL Polska')],['missing country metadata',s=>s.replace(/<meta\b[^>]*itemprop="addressCountry"[^>]*>/g,'')],['conflicting country metadata',s=>s.replace('content="PL"','content="IN"')],['unreviewed postal shape',s=>s.replaceAll('02-675','02675')],['wrong requisition',s=>s.replaceAll('336325','999999')],['wrong employer',s=>s.replace('content="cargill"','content="unrelated"')],['missing full criteria',s=>s.replaceAll('itemprop="description"','itemprop="missing-description"')]])test('typed discrepancy cannot swallow '+label,()=>{
 const original=decode(nativePacket),changed=change(original);assert.notEqual(changed,original)
 assert.throws(()=>native(changed),error=>error.code!==HOLD)
})
const controlledPage=()=>({hasJobs:true,hasContent:false,filters:'<input checked data-facet-type="2" data-id="1269750" data-display="India" data-count="1">',results:'<section id="search-results" data-total-results="1" data-total-job-results="1" data-total-pages="1" data-current-page="1" data-records-per-page="15"><a data-job-id="'+role.row.publicJobId+'" href="'+role.row.sourceUrl+'"><h3>'+role.row.title+'</h3><span class="job-location">'+role.row.nativeListingLocation+'</span></a></section>'})
const execute=async(mutate=()=>{})=>{
 let audit,listings=0,publicReads=0,nativeReads=0
 try{await runNativeCargill({now:fixture.capturedAt,onAudit:value=>{audit=value},fetchImpl:async url=>{
  let response
  if(url.startsWith(SEARCH+'/results?')){listings++;response={status:200,url,body:JSON.stringify(controlledPage())}}
  else{let matches=fixture.packets.filter(p=>p.requestURL===url),p=matches[0];if(url===role.row.sourceUrl)p=matches[Math.min(publicReads++,matches.length-1)];if(url===role.applicationURL)p=matches[Math.min(nativeReads++,matches.length-1)];assert.ok(p,'Only a genuine captured URL is read: '+url);response={status:p.status,url:p.finalURL,body:decode(p)};if(url===SEARCH)response.body=response.body.replaceAll('data-count="84"','data-count="1"')}
  mutate(response,url,{listings,publicReads,nativeReads});return{status:response.status,url:response.url,headers:new Headers({'Content-Type':'text/html'}),text:async()=>response.body}
 }})}catch(error){return{error,audit,listings,publicReads,nativeReads}}throw Error('All-held cohort must not return success-empty')
}
test('controlled one-role native hold requires both closing surfaces and retains observation instead of success-empty',async()=>{
 assert.equal(fixture.controlledCohortTestsOnly,true)
 const result=await execute();assert.equal(result.error.code,HOLD);assert.equal(result.publicReads,2);assert.equal(result.nativeReads,2);assert.equal(result.listings,2)
 const audit=result.error.nativeCollectionEvidence;assert.equal(audit.observedNativeRecords,1);assert.equal(audit.heldRoles.length,1);assert.equal(audit.returnedNativeRecords,0);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.ok(audit.heldRoles[0].publicClosingResponse.body);assert.ok(audit.heldRoles[0].nativeClosingResponse.body);assert.equal(audit.closingInventoryMatches,true)
})
test('held Poland detail transport and closing identity changes remain source failures',async()=>{
 for(const mutate of [(r,url,{nativeReads})=>{if(url===role.applicationURL&&nativeReads===2)r.status=403},(r,url,{publicReads})=>{if(url===role.row.sourceUrl&&publicReads===2)r.body=r.body.replaceAll('336325','999999')},(r,url,{nativeReads})=>{if(url===role.applicationURL&&nativeReads===2)r.body=r.body.replaceAll('Warszawa','Different Native City')}]){
  const {error}=await execute(mutate);assert.notEqual(error.code,HOLD)
 }
})
