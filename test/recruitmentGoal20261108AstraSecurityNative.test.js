import test from 'node:test'
import assert from 'node:assert/strict'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {fixture,replay,mutateBody,changeDetailRecord,changeBoardRecords} from './test-data/astraSecurityNative20261108.js'
const provider=()=>getScraperCatalog().find(v=>v.source==='astrasecurity'),run=(r,options={})=>createCatalogScraper(provider()).run({...r.options,...options}),failureOf=async promise=>{try{await promise;assert.fail('Expected native source failure')}catch(e){if(e?.code==='ERR_ASSERTION')throw e;return e}},expected=fixture.expected

test('Astra registered collection retains all8 complete native details and opening/closing board models',async()=>{
 const r=replay(),jobs=await run(r),e=jobs.nativeCollectionEvidence;assert.deepEqual(e.board,expected.openingBoard);assert.deepEqual(e.closingBoard,expected.closingBoard);assert.deepEqual(e.details,expected.details);assert.equal(e.observations.length,8);assert.equal(e.rawResponses.length,13);assert.deepEqual(r.uncaptured,[])
})
test('Astra returns only six explicitly published unlocked India roles with full own native descriptions',async()=>{
 const r=replay(),jobs=await run(r,{countryFilter:'India'});assert.equal(jobs.length,6);assert.deepEqual(jobs.map(j=>j.jobId),expected.details.slice(1,7).map(v=>v.nativeData.jobs[0].id));for(const row of jobs){assert.equal(row.country,'India');assert.equal(row.sourceNativeRecord.Publish,true);assert.equal(row.sourceNativeRecord.Is_Locked,false);assert.equal(row.jobDescription,row.sourceNativeDetail.records[0].fullCriteriaText);assert.equal(row.sourceCurrentNativeRoleQualified,true);assert.equal(row.sourceScopeComplete,false);assert.equal(row.lifecycleCleanupAllowed,false)}
})
test('Astra runtime locale IN cannot supply the remote job country and locked retained jobs stay observed',async()=>{
 const r=replay(),jobs=await run(r),rows=jobs.nativeCollectionEvidence.observations;assert.equal(rows.length,8);assert.equal(rows[0].country,null);assert.equal(rows[0].sourceNativeDetail.nativeData.country,'IN');assert.equal(rows[0].sourceCountryScopeUnresolved,true);assert.equal(rows[0].sourceCurrentNativeRoleQualified,false);assert.equal(rows[7].sourceNativeRecord.Publish,false);assert.equal(rows[7].sourceNativeRecord.Is_Locked,true);assert.equal(rows[7].sourceCurrentNativeRoleQualified,false);assert.ok(!jobs.some(v=>[rows[0].jobId,rows[7].jobId].includes(v.jobId)))
})
test('Astra zero output and country selection preserve all full models before caps',async()=>{
 const r=replay();let rows;const jobs=await run(r,{maxJobs:0,countryFilter:'United States',onRecords:v=>{rows=v}});assert.equal(jobs.length,0);assert.equal(rows.length,8);assert.deepEqual(jobs.nativeCollectionEvidence.details,expected.details);assert.equal(r.requests.length,13)
})
test('Astra a one-job output limit still acquires every full original and retained role',async()=>{
 const r=replay(),jobs=await run(r,{maxJobs:1});assert.equal(jobs.length,1);assert.equal(jobs.nativeCollectionEvidence.observations.length,8);assert.deepEqual(jobs.nativeCollectionEvidence.details,expected.details);assert.equal(r.requests.length,13)
})
test('Astra stable native IDs and opened dates do not fabricate requisition IDs or publication dates',async()=>{
 const r=replay(),jobs=await run(r),rows=jobs.nativeCollectionEvidence.observations;for(const [i,row]of rows.entries()){assert.equal(row.jobId,expected.details[i].nativeData.jobs[0].id);assert.equal(row.requisitionId,null);assert.equal(row.postingDate,null);assert.equal(row.dateOpened,expected.details[i].nativeData.jobs[0].Date_Opened);assert.equal(row.closingDate,null);assert.equal(row.company,expected.details[i].nativeData.meta.org_info.company_name);assert.equal(row.activeApplyVerified,false);assert.equal(row.applicationVisited,false)}
})
test('Astra awaited detached sinks preserve immutable full native observations through registry decoration',async()=>{
 const r=replay(),events=[],jobs=await run(r,{onAudit:async e=>{await new Promise(resolve=>setTimeout(resolve,3));e.details[0].records[0].fullCriteriaText='sink edit';events.push('audit')},onRecords:async rows=>{await new Promise(resolve=>setTimeout(resolve,3));rows[0].title='sink edit';events.push('records')}});assert.deepEqual(events,['audit','records']);assert.deepEqual(jobs.nativeCollectionEvidence.details,expected.details);assert.deepEqual(readSourceObservationEvidence(jobs,'astrasecurity'),{source:'astrasecurity',recordKind:'vacancy-rows',observedRecordCount:8,observedVacancyCount:8,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
})
test('Astra unknown country and company coverage prevent authoritative zero despite empty selected output',async()=>{
 const r=replay(),jobs=await run(r,{countryFilter:'United States'}),inventory=readInventoryEvidence(jobs);assert.equal(jobs.length,0);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
test('Astra request limits retain the whole board and every acquired full detail before terminal failure',async()=>{
 const r=replay(),e=await failureOf(run(r,{maxRequests:5}));assert.equal(e.code,'ASTRASECURITY_REQUEST_BUDGET');assert.equal(e.nativeEvidence.board.records.length,8);assert.equal(e.nativeEvidence.details.length,2);assert.equal(e.nativeEvidence.observations.length,8);assert.deepEqual(e.nativeEvidence.details,expected.details.slice(0,2));assert.equal(r.requests.length,5)
})
test('Astra retains changed closing models before rejecting a conflicting native board',async()=>{
 const r=replay(p=>{if(p.label==='closing-careers-board')changeBoardRecords(p,rows=>{rows[0].Posting_Title='Changed native title';rows[0].Job_Opening_Name='Changed native title'})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_CLOSING_CONFLICT');assert.equal(e.nativeEvidence.closingBoard.records[0].Posting_Title,'Changed native title');assert.equal(e.nativeEvidence.details.length,8);assert.equal(r.requests.length,12)
})
test('Astra retains a complete mismatched native detail before holding its identity',async()=>{
 const r=replay(p=>{if(p.label==='detail-0')changeDetailRecord(p,j=>{j.Posting_Title='Wrong native role'})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.details[0].records[0].nativeRecord.Posting_Title,'Wrong native role');assert.equal(e.nativeEvidence.observations.length,8);assert.equal(r.requests.length,4)
})
test('Astra rejects executable native data expressions without running publisher code or losing originals',async()=>{
 delete globalThis.__astraPublisherProbe;const old=expected.details[0].literalCarriers.find(v=>v.name==='jobs').nativeSource,r=replay(p=>{if(p.label==='detail-0')mutateBody(p,html=>html.replace(old,old+'+(globalThis.__astraPublisherProbe=true,[])'))}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(globalThis.__astraPublisherProbe,undefined);assert.equal(e.nativeEvidence.details[0].nativeData.meta.org_info.company_name,'Astra Security');assert.equal(e.nativeEvidence.details[0].records.length,0);assert.ok(e.nativeEvidence.details[0].literalCarriers.find(v=>v.name==='jobs').nativeSource.includes('__astraPublisherProbe'));assert.equal(e.nativeEvidence.rawResponses.length,4)
})
test('Astra absent own criteria retain all native detail fields and board observations before hold',async()=>{
 const r=replay(p=>{if(p.label==='detail-0')changeDetailRecord(p,j=>{j.Job_Description=''})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.details[0].records[0].nativeRecord.id,expected.details[0].nativeData.jobs[0].id);assert.equal(e.nativeEvidence.details[0].records[0].fullCriteriaText,'');assert.equal(e.nativeEvidence.details[0].records[0].nativeAuthoredCriteriaAvailable,false);assert.equal(e.nativeEvidence.observations.length,8);assert.equal(r.requests.length,4)
})
test('Astra effective catalog clears stale sentinel metadata and qualifies no company-wide scope',()=>{
 const p=provider();assert.equal(p.catalogOverride,true);assert.equal(p.countryFilter,'Global');assert.equal(p.parser,'live-parser');assert.equal(p.atsPlatform,'first-party-zoho-native-board-and-literal-details');assert.equal(p.backfillMode,null);assert.equal(p.runtimeValidation,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false)
})


test('Astra contradictory closing title aliases retain all claims and hold native proof',async()=>{
 const r=replay(p=>{if(p.label==='closing-careers-board')changeBoardRecords(p,rows=>{rows[0].Posting_Title='Changed native title'})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.closingBoard.records[0].Posting_Title,'Changed native title');assert.equal(e.nativeEvidence.closingBoard.records[0].Job_Opening_Name,'Information Security Analyst - I');assert.equal(e.nativeEvidence.details.length,8);assert.equal(r.requests.length,12)
})
test('Astra named and invalid numeric HTML references decode once while exact native description markup survives',async()=>{
 const extra='<p data-note="&copy; &#38;amp;">Native text &copy; &eacute; &#38;amp; &#x110000;.</p>',r=replay(p=>{if(p.label==='detail-0')changeDetailRecord(p,j=>{j.Job_Description=j.Job_Description.replace('</body>',extra+'</body>')})}),jobs=await run(r),model=jobs.nativeCollectionEvidence.details[0].records[0];assert.ok(model.fullCriteriaText.endsWith('Native text \u00a9 \u00e9 &amp; \ufffd.'));assert.ok(model.nativeDescriptionHTML.includes(extra));assert.equal(jobs.nativeCollectionEvidence.details.length,8);assert.equal(jobs.length,6)
})
test('Astra preserves unfamiliar nested native fields without trimming the full record',async()=>{
 const addition={terms:['New native requirement',{id:'publisher-specific-id',text:'Keep exact Unicode \u00e9'}],enabled:false},r=replay(p=>{if(p.label==='detail-1')changeDetailRecord(p,j=>{j.Publisher_Additional_Terms=addition})}),jobs=await run(r),model=jobs.nativeCollectionEvidence.details[1].records[0];assert.deepEqual(model.nativeRecord.Publisher_Additional_Terms,addition);assert.deepEqual(jobs[0].sourceNativeRecord.Publisher_Additional_Terms,addition);assert.equal(model.fullCriteriaText,expected.details[1].records[0].fullCriteriaText)
})
test('Astra own country contradictions preserve listing and detail countries without accepted binding',async()=>{
 const r=replay(p=>{if(p.label==='detail-1')changeDetailRecord(p,j=>{j.Country='United States'})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.board.records[1].Country,'India');assert.equal(e.nativeEvidence.details[1].records[0].nativeRecord.Country,'United States');assert.equal(e.nativeEvidence.observations[1].sourceNativeIdentityBound,false);assert.equal(e.nativeEvidence.observations[1].sourceCurrentNativeRoleQualified,false);assert.equal(r.requests.length,5)
})
test('Astra duplicate listing identities retain every carrier before stopping further admission',async()=>{
 const r=replay(p=>{if(p.label==='declared-careers-board')changeBoardRecords(p,rows=>{rows.push(structuredClone(rows[0]))})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.board.records.length,9);assert.equal(e.nativeEvidence.observations.length,9);assert.equal(e.nativeEvidence.details.length,0);assert.equal(r.requests.length,2)
})
test('Astra duplicate native JSON properties remain raw evidence without selecting a country silently',async()=>{
 const old=expected.details[0].literalCarriers.find(v=>v.name==='jobs').nativeSource,badJSON=JSON.stringify(expected.details[0].nativeData.jobs).replace('"Country":null','"Country":null,"Country":"India"'),replacement='JSON.parse('+JSON.stringify(badJSON).replaceAll('<','\\u003c')+')',r=replay(p=>{if(p.label==='detail-0')mutateBody(p,html=>html.replace(old,replacement))}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.details[0].records.length,0);assert.ok(e.nativeEvidence.details[0].parseFailures.some(v=>v.name==='jobs'));assert.equal(e.nativeEvidence.observations.length,8);assert.equal(r.requests.length,4)
})
test('Astra inert native detail program retains all literal data before a publication-proof hold',async()=>{
 const r=replay(p=>{if(p.label==='detail-0')mutateBody(p,html=>{const at=html.indexOf('var jobs = JSON.parse'),start=html.lastIndexOf('<script',at),end=html.indexOf('</script>',at)+9;assert.ok(at>0&&start>0&&end>at);return html.slice(0,start)+'<template>'+html.slice(start,end)+'</template>'+html.slice(end)})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.deepEqual(e.nativeEvidence.details[0].nativeData.jobs,expected.details[0].nativeData.jobs);assert.equal(e.nativeEvidence.details[0].records.length,1);assert.ok(e.nativeEvidence.details[0].parseFailures.length);assert.equal(r.requests.length,4)
})
test('Astra an inert board data carrier cannot qualify current publication while all eight records survive',async()=>{
 const original=expected.openingBoard.nativeInputs.find(v=>v.name==='jobs').nativeHTML,r=replay(p=>{if(p.label==='declared-careers-board')mutateBody(p,html=>html.replace(original,'<template>'+original+'</template>'))}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.deepEqual(e.nativeEvidence.board.records,expected.openingBoard.records);assert.equal(e.nativeEvidence.observations.length,8);assert.ok(e.nativeEvidence.board.parseFailures.length);assert.equal(r.requests.length,2)
})
test('Astra a declared client HTTP429 retains the full board and denial retry classification',async()=>{
 const r=replay(p=>{if(p.label==='declared-careers-client'){p.status=429;p.headers['Retry-After']='5'}}),e=await failureOf(run(r));assert.equal(e.status,429);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.retryDelayMs,5000);assert.equal(e.nativeEvidence.board.records.length,8);assert.equal(e.nativeEvidence.client,null);assert.equal(e.nativeEvidence.details.length,0);assert.equal(e.nativeEvidence.rawResponses.length,3)
})
test('Astra declared script MIME must be JavaScript before detail routes are admitted',async()=>{
 const r=replay(p=>{if(p.label==='declared-careers-client')p.headers['content-type']='text/html'}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.board.records.length,8);assert.equal(e.nativeEvidence.client,null);assert.equal(e.nativeEvidence.details.length,0);assert.equal(r.requests.length,3)
})
test('Astra automatic response redirects are held without parsing or further physical requests',async()=>{
 const r=replay(),base=r.options.fetchImpl,e=await failureOf(run(r,{fetchImpl:async(...args)=>{const response=await base(...args);Object.defineProperty(response,'redirected',{value:true});return response}}));assert.equal(e.code,'ASTRASECURITY_RESPONSE_IDENTITY');assert.equal(e.nativeEvidence.primary,null);assert.equal(e.nativeEvidence.rawResponses[0].response.redirected,true);assert.equal(r.requests.length,1)
})
test('Astra a public denial outranks its failing original stream while partial receipts survive',async()=>{
 const r=replay(p=>{if(p.label==='current-primary')p.status=403}),base=r.options.fetchImpl;{const e=await failureOf(run(r,{fetchImpl:async(url,init)=>{const original=await base(url,init);await original.body.cancel();let pulls=0;const response=new Response(new ReadableStream({pull(c){if(pulls++===0)c.enqueue(new TextEncoder().encode('partial denied original'));else c.error(Error('original stream failed'))}}),{status:403,headers:original.headers});Object.defineProperty(response,'url',{value:original.url});return response}}));assert.equal(e.status,403);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.nativeEvidence.rawResponses.length,1);const receipt=e.nativeEvidence.rawResponses[0].response;assert.equal(receipt.bodyComplete,false);assert.equal(receipt.bodyBytes,23);assert.equal(receipt.acquisitionFailure.message,'original stream failed')}
})
test('Astra exact false caller cancellation owns ignored late acquisition and immutable terminal evidence',async()=>{
 const r=replay(),base=r.options.fetchImpl,controller=new AbortController();let timer;const e=await failureOf(run(r,{signal:controller.signal,fetchImpl:async(...args)=>{const response=await base(...args);timer=setTimeout(()=>controller.abort(false),5);await new Promise(resolve=>setTimeout(resolve,60));return response}}));clearTimeout(timer);assert.equal(e,false);const {readAstraSecurityFailureEvidence}=await import('../scraper/astrasecurity/native20261108.js'),proof=readAstraSecurityFailureEvidence(controller.signal);assert.equal(proof.rawResponses.length,0);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(readAstraSecurityFailureEvidence(controller.signal),proof)
})
test('Astra earliest source lifetime bounds a longer ignored read without late receipt mutation',async()=>{
 const r=replay(),base=r.options.fetchImpl,e=await failureOf(run(r,{sourceTimeoutMs:15,readTimeoutMs:100,fetchImpl:async(...args)=>{const response=await base(...args);await new Promise(resolve=>setTimeout(resolve,60));return response}}));assert.equal(e.code,'ASTRASECURITY_NATIVE_TIMEOUT');assert.equal(e.nativeEvidence.rawResponses.length,0);const before=structuredClone(e.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,85));assert.deepEqual(e.nativeEvidence,before)
})
test('Astra secondary noncloneable callback diagnostics preserve the first budget error and eight native records',async()=>{
 const r=replay();let records;const e=await failureOf(run(r,{maxRequests:3,onAudit:()=>{throw {code:Symbol('opaque'),message:()=> 'x'}},onRecords:v=>{records=v}}));assert.equal(e.code,'ASTRASECURITY_REQUEST_BUDGET');assert.equal(e.nativeEvidence.board.records.length,8);assert.equal(records.length,8);assert.deepEqual(e.nativeEvidence.auditSinkFailures,[{sink:'audit',name:null,code:null,message:null}]);assert.equal(e.nativeEvidence.rawResponses.length,3)
})
test('Astra late record-observer work cannot change a retained complete collection after its bounded failure',async()=>{
 const r=replay();let started=false;const e=await failureOf(run(r,{auditTimeoutMs:200,onRecords:async rows=>{started=true;await new Promise(resolve=>setTimeout(resolve,500));rows[0].sourceNativeDetail.records[0].fullCriteriaText='late sink edit'}}));assert.equal(e.code,'ASTRASECURITY_AUDIT_TIMEOUT');assert.equal(started,true);assert.deepEqual(e.nativeEvidence.details,expected.details);const before=structuredClone(e.nativeEvidence);await new Promise(resolve=>setTimeout(resolve,550));assert.deepEqual(e.nativeEvidence,before)
})
test('Astra finite page truncation is rejected before any acquisition',async()=>{
 const r=replay(),e=await failureOf(run(r,{maxPages:1}));assert.equal(e.code,'ASTRASECURITY_INVALID_OPTIONS');assert.equal(r.requests.length,0)
})


const appendNativeWrites=(p,source)=>mutateBody(p,html=>{const at=html.indexOf('var jobs = JSON.parse'),end=html.indexOf('</script>',at);assert.ok(at>0&&end>at);return html.slice(0,end)+'\n'+source+'\n'+html.slice(end)})
const alterNativeScriptTag=(p,edit)=>mutateBody(p,html=>{const at=html.indexOf('var jobs = JSON.parse'),start=html.lastIndexOf('<script',at),end=html.indexOf('>',start)+1;assert.ok(at>0&&start>0&&end>start);return html.slice(0,start)+edit(html.slice(start,end))+html.slice(end)})

test('Astra later nested native publication and country writes hold qualification without losing either original claim',async()=>{
 const writes="jobs[0].Publish = false; jobs[0].Country = 'United States';",r=replay(p=>{if(p.label==='detail-1')appendNativeWrites(p,writes)}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(r.requests.length,5);assert.equal(e.nativeEvidence.details[1].records.length,1);assert.equal(e.nativeEvidence.details[1].nativeData.jobs[0].Country,'India');assert.ok(e.nativeEvidence.details[1].parseFailures.length);assert.ok(Buffer.from(e.nativeEvidence.rawResponses[4].response.rawBodyBase64,'base64').toString().includes(writes));assert.equal(e.nativeEvidence.observations[1].sourceCurrentNativeRoleQualified,false)
})
test('Astra later root native array reassignment is retained and held before further acquisition',async()=>{
 const r=replay(p=>{if(p.label==='detail-1')appendNativeWrites(p,'jobs = [];')}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.details[1].records.length,1);assert.ok(e.nativeEvidence.details[1].parseFailures.length);assert.ok(Buffer.from(e.nativeEvidence.rawResponses[4].response.rawBodyBase64,'base64').toString().includes('jobs = [];'));assert.equal(r.requests.length,5)
})
test('Astra competing root literal carriers outside the selected native program cannot be ignored',async()=>{
 const extra='<script>var jobs = [];</script>',r=replay(p=>{if(p.label==='detail-1')mutateBody(p,html=>html.replace('</body>',extra+'</body>'))}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.details[1].records.length,1);assert.ok(e.nativeEvidence.details[1].parseFailures.length);assert.ok(Buffer.from(e.nativeEvidence.rawResponses[4].response.rawBodyBase64,'base64').toString().includes(extra));assert.equal(r.requests.length,5)
})
test('Astra conflicting repeated employer assignments retain every claim without silently choosing the last',async()=>{
 const original=expected.details[1].nativeData.meta.org_info,bad={...original,id:'91259000009999999',company_name:'Unqualified sibling'},writes='meta.org_info = '+JSON.stringify(bad)+'; meta.org_info = '+JSON.stringify(original)+';',r=replay(p=>{if(p.label==='detail-1')appendNativeWrites(p,writes)}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.ok(e.nativeEvidence.details[1].parseFailures.length);assert.ok(Buffer.from(e.nativeEvidence.rawResponses[4].response.rawBodyBase64,'base64').toString().includes('Unqualified sibling'));assert.equal(e.nativeEvidence.observations[1].sourceNativeIdentityBound,false);assert.equal(r.requests.length,5)
})
test('Astra inactive primary handoffs remain evidence without admitting a board request',async()=>{
 const r=replay(p=>{if(['current-primary','closing-primary'].includes(p.label))mutateBody(p,html=>{for(const link of html.matchAll(/<a\b[^>]*href="https:\/\/jobs\.getastra\.com\/jobs\/Careers"[^>]*>[\s\S]*?<\/a>/g))html=html.replace(link[0],'<template>'+link[0]+'</template>');return html})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.primary.careersLinks.length,2);assert.equal(e.nativeEvidence.rawResponses.length,1);assert.equal(r.requests.length,1)
})
test('Astra an inactive declared client is retained without granting detail-route authority or fetching it',async()=>{
 const source='https://static.zohocdn.com/recruit/javascript/career-website-common.8ecb14ca5188780595fe2a3e99a509a2.js',r=replay(p=>{if(p.label==='declared-careers-board')mutateBody(p,html=>{const at=html.indexOf('src="'+source+'"'),start=html.lastIndexOf('<script',at),end=html.indexOf('</script>',at)+9;assert.ok(at>0&&start>0&&end>at);return html.slice(0,start)+'<template>'+html.slice(start,end)+'</template>'+html.slice(end)})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.board.records.length,8);assert.equal(e.nativeEvidence.clientDeclaration.url,source);assert.equal(e.nativeEvidence.rawResponses.length,2);assert.equal(r.requests.length,2)
})
test('Astra text/plain native programs retain full literal records but cannot establish publication',async()=>{
 const r=replay(p=>{if(p.label==='detail-1')alterNativeScriptTag(p,tag=>tag.replace(/\s+type\s*=\s*(?:"[^"]*"|'[^']*')/i,'').replace(/>$/,' type="text/plain">'))}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.deepEqual(e.nativeEvidence.details[1].nativeData.jobs,expected.details[1].nativeData.jobs);assert.equal(e.nativeEvidence.details[1].records.length,1);assert.ok(e.nativeEvidence.details[1].parseFailures.length);assert.equal(e.nativeEvidence.observations[1].sourceCurrentNativeRoleQualified,false);assert.equal(r.requests.length,5)
})
test('Astra helper text contained only in a comment cannot authorize detail routes',async()=>{
 const r=replay(p=>{if(p.label==='declared-careers-client')mutateBody(p,()=> '/*'+expected.routeHelperSource+'Lyte.Component.registerHelper("lyte_js_link"*/')}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.client.helperAuthorityValidated,false);assert.equal(e.nativeEvidence.client.registrationCount,0);assert.equal(e.nativeEvidence.board.records.length,8);assert.equal(e.nativeEvidence.details.length,0);assert.equal(r.requests.length,3)
})
test('Astra contradictory native page IDs retain both values without affirmative identity binding',async()=>{
 const old=expected.details[1].literalCarriers.find(v=>v.name==='meta').nativeSource,needle='"page_id":"91259000000273534"',r=replay(p=>{if(p.label==='detail-1')mutateBody(p,html=>{assert.ok(old.includes(needle));return html.replace(old,old.replace(needle,'"page_id":"91259000009999999"'))})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');const d=e.nativeEvidence.details[1];assert.equal(d.nativeData.page_id,'91259000000273534');assert.equal(d.nativeData.meta.page_id,'91259000009999999');assert.equal(e.nativeEvidence.observations[1].sourceNativeIdentityBound,false);assert.equal(e.nativeEvidence.observations[1].sourceCurrentNativeRoleQualified,false);assert.equal(r.requests.length,5)
})
test('Astra null native board rows cannot erase the board originals observations or original proof failure',async()=>{
 const r=replay(p=>{if(p.label==='declared-careers-board')changeBoardRecords(p,rows=>{rows[0]=null})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.equal(e.nativeEvidence.board.records[0],null);assert.equal(e.nativeEvidence.board.records.length,8);assert.equal(e.nativeEvidence.observations.length,8);assert.equal(e.nativeEvidence.observations[0].sourceNativeListingRecord,null);assert.equal(e.nativeEvidence.rawResponses.length,2);assert.equal(r.requests.length,2)
})
test('Astra primitive and array malformed-row controls remain retained proof holds rather than additional defects',async()=>{
 for(const value of [42,'invalid native row',false,[]]){const r=replay(p=>{if(p.label==='declared-careers-board')changeBoardRecords(p,rows=>{rows[0]=value})}),e=await failureOf(run(r));assert.equal(e.code,'ASTRASECURITY_NATIVE_PROOF');assert.deepEqual(e.nativeEvidence.board.records[0],value);assert.equal(e.nativeEvidence.observations.length,8);assert.equal(e.nativeEvidence.rawResponses.length,2);assert.equal(r.requests.length,2)}
})
test('Astra null-row failure evidence remains safe when the record observer cancels with exact false',async()=>{
 const controller=new AbortController(),r=replay(p=>{if(p.label==='declared-careers-board')changeBoardRecords(p,rows=>{rows[0]=null})}),e=await failureOf(run(r,{signal:controller.signal,onRecords:rows=>{assert.equal(rows.length,8);controller.abort(false)}}));assert.equal(e,false);const {readAstraSecurityFailureEvidence}=await import('../scraper/astrasecurity/native20261108.js'),proof=readAstraSecurityFailureEvidence(controller.signal);assert.equal(proof.board.records[0],null);assert.equal(proof.rawResponses.length,2);assert.equal(proof.observations.length,8)
})
