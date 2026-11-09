import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from '../bizongo/nativeFixture.js'
import {runNativeBrihaspathi,inspectNativePage,CAREERS_URL,CLIENT_URL,JOBS_API_URL} from './native.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readFileSync} from 'node:fs'
const fixture=nativeFixture(import.meta.url),timeout=value=>new Promise(resolve=>setTimeout(()=>resolve(value),80))
test('current declared active native zero qualifies only after exact closing enumeration',async()=>{
 const calls=[],reports=[],jobs=await runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async u=>{calls.push(u);return fixture.fetchPage(u)},onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,0);assert.equal(calls.filter(u=>u===JOBS_API_URL).length,2);assert.equal(reports.length,1);assert.equal(reports[0].closingReconciled,true)
})
test('only relevant public client semantics gate inventory, not private application copy',()=>{
 const client=fixture.get(CLIENT_URL).replace('Please upload your resume.','Attach your resume to apply.')
 assert.equal(inspectNativePage(fixture.get(CAREERS_URL),client).clientVerified,true)
 assert.throws(()=>inspectNativePage(fixture.get(CAREERS_URL),client.replace('filters[isActive][$eq]=true','filters[isActive][$eq]=false')),/public|client|API/i)
})
test('executable native jobs client remains executable under CSS-hidden ancestors but nomodule cannot authorize it',()=>{
 const html=fixture.get(CAREERS_URL),src=new URL(CLIENT_URL).pathname
 const hidden=html.replace('<script src="'+src+'"','<div hidden><script src="'+src+'"').replace('src="'+src+'" async=""></script>','src="'+src+'" async=""></script></div>')
 assert.equal(inspectNativePage(hidden,fixture.get(CLIENT_URL)).clientVerified,true)
 assert.throws(()=>inspectNativePage(html.replace('src="'+src+'"','nomodule src="'+src+'"'),fixture.get(CLIENT_URL)),/client|executable/i)
})
test('public reader error identity is not relabelled as invalid JSON',async()=>{
 const reason={failure:'opaque public reader'}
 await assert.rejects(runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async u=>{if(u===JOBS_API_URL)throw reason;return fixture.fetchPage(u)}}),e=>e===reason)
})
test('audit observer is raced against caller cancellation with exact reason',async()=>{
 const controller=new AbortController(),reason={abort:'brihas-observer'},p=runNativeBrihaspathi({requestIntervalMs:0,signal:controller.signal,fetchPage:fixture.fetchPage,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([p.then(()=>null,e=>e),timeout('hung')]),reason)
})
const oldPositive=()=>JSON.parse(readFileSync(new URL('./fixtures/jobs.json',import.meta.url),'utf8'))
test('all declared API pages reconcile while the UI first-100 ceiling and full-criteria gaps stay explicit',async()=>{
 let reports=[],apiReads=0
 const positive=oldPositive().data[0]
 const fetchPage=async url=>{
  if(new URL(url).pathname!=='/strapi/api/job-openings')return fixture.fetchPage(url)
  apiReads++;const page=Number(new URL(url).searchParams.get('pagination[page]')||1),data=Array.from({length:page===1?100:1},(_,i)=>({...positive,id:(page-1)*100+i+1,countryCode:'IN',location:'Hyderabad, India'}))
  return{status:200,url,body:JSON.stringify({data,meta:{pagination:{page,pageSize:100,pageCount:2,total:101}}})}
 }
 const jobs=await runNativeBrihaspathi({fetchPage,requestIntervalMs:0,maxJobs:1,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.equal(apiReads,4);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(reports[0].observations.length,101);assert.equal(reports[0].observations.filter(r=>r.publiclyRendered).length,100)
 assert.equal(readSourceObservationEvidence(jobs,'brihaspathi').observedRecordCount,101)
 assert.ok(reports[0].observations.every(r=>r.originalDescription===positive.description&&r.requisitionId===null&&r.postingDate===null&&r.criteriaComplete===false))
})
test('native positive India cards retain the full original API string without promoting a clipped brief into persistence',async()=>{
 const positive=oldPositive();positive.data[0].countryCode='IN';positive.data[0].location='Hyderabad, India'
 const original='Literal <b>native</b> card & qualification text must survive exactly.';positive.data[0].description=original
 let report
 const jobs=await runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async url=>url===JOBS_API_URL?{status:200,url,body:JSON.stringify(positive)}:fixture.fetchPage(url),onAudit:r=>{report=r}})
 assert.equal(jobs.length,0);assert.equal(report.observations[0].originalDescription,original);assert.equal(report.observations[0].countryCode,'IN');assert.equal(report.observations[0].criteriaComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readSourceObservationEvidence(jobs,'brihaspathi').observedVacancyCount,1)
})
test('native department and every raw model field participate in closing reconciliation',async()=>{
 let count=0;const positive=oldPositive()
 await assert.rejects(runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async url=>{if(url!==JOBS_API_URL)return fixture.fetchPage(url);const row=structuredClone(positive);if(++count===2)row.data[0].department='Changed department';return{status:200,url,body:JSON.stringify(row)}}}),/closing snapshot/)
})
test('opaque onNativeEvidence rejection remains exact and is called only once',async()=>{
 const reason={observer:'native'},calls=[]
 await assert.rejects(runNativeBrihaspathi({requestIntervalMs:0,fetchPage:fixture.fetchPage,onNativeEvidence:()=>{calls.push(1);throw reason}}),e=>e===reason);assert.equal(calls.length,1)
})
test('hidden public vacancy containers cannot qualify a zero-looking API',()=>{
 assert.throws(()=>inspectNativePage(fixture.get(CAREERS_URL).replace('id="vacancies"','hidden id="vacancies"'),fixture.get(CLIENT_URL)),/open roles section/)
})
test('reviewed public vacancy renderer must still be registered as the native default component',()=>{
 const body=fixture.get(CLIENT_URL),changed=body.replace('e.s(["default",0,function','e.s(["private",0,function')
 assert.notEqual(changed,body);assert.throws(()=>inspectNativePage(fixture.get(CAREERS_URL),changed),/default|public|client/i)
})
test('native card motion visibility remains part of the public renderer contract',()=>{
 const body=fixture.get(CLIENT_URL),changed=body.replace('F={hidden:{opacity:0,y:16},show:{opacity:1','F={hidden:{opacity:0,y:16},show:{opacity:0')
 assert.notEqual(changed,body);assert.throws(()=>inspectNativePage(fixture.get(CAREERS_URL),changed),/public|client/i)
})
test('configured board zero does not assert broader company counts, source scope or cleanup authority',async()=>{
 let report;await runNativeBrihaspathi({fetchPage:fixture.fetchPage,requestIntervalMs:0,onAudit:r=>{report=r}})
 assert.equal(report.declaredBoardComplete,true);assert.equal(report.sourceScopeComplete,false);assert.equal(report.lifecycleCleanupAllowed,false)
 assert.equal(report.companyGlobalTotal,null);assert.equal(report.companyIndiaTotal,null);assert.equal(report.indiaAbsenceProven,false)
})
for(const nesting of ['root','meta','pagination','nested'])for(const kind of ['error','continuation'])test('zero-looking '+kind+' envelope at '+nesting+' cannot qualify native absence',async()=>{
 await assert.rejects(runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async url=>{
  const r=await fixture.fetchPage(url);if(url===JOBS_API_URL){const p=JSON.parse(r.body),target=nesting==='root'?p:nesting==='meta'?p.meta:nesting==='pagination'?p.meta.pagination:(p.meta.pageInfo={})
   if(kind==='error')target.error={status:503,name:'NativeUnavailable',message:'Inventory unavailable'}
   else{target.hasMore=true;target.nextCursor='public-next-page'}
   r.body=JSON.stringify(p)
  }return r
 }}),/error|continuation|unavailable/i)
})
test('unidentified bare reader text cannot establish a first-party complete native zero',async()=>{
 await assert.rejects(runNativeBrihaspathi({requestIntervalMs:500,fetchText:fixture.get}),/HTTP|response identity/i)
})
