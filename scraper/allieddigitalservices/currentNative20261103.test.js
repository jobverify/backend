import test from 'node:test'
import assert from 'node:assert/strict'
import {run,ROOT_URL,JOBS_API_URL} from './script.js'
import {revisitFixture} from '../castrolindia/revisitFixture.js'
import {structure} from '../alohatechnology/publicRead.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
const fixture=revisitFixture(import.meta.url),API=JOBS_API_URL+'?per_page=100&page=1',DETAIL='https://www.allieddigital.net/jobs/network-engineer-l3/'
globalThis.fetch=async()=>{throw Error('Current Allied native fixtures prohibit network')}
function options(change,calls=[]){const visits=new Map(),fetchPage=async(url,request)=>{calls.push(url);visits.set(url,(visits.get(url)||0)+1);const original=fixture.row(url),page={status:original.status,url:original.url,body:fixture.text(url),headers:new Headers(original.publicHeaders)};const p=change?await change(page,visits):page;return{...p,text:async()=>p.body}};return{now:'2026-11-03T04:45:00Z',fetchPage,fetchImpl:fetchPage,fetchText:async(url,request)=>(await fetchPage(url,request)).text(),fetchJobsPage:async(url,request)=>{const r=await fetchPage(url,request);return{records:JSON.parse(r.body),total:Number(r.headers.get('x-wp-total')),totalPages:Number(r.headers.get('x-wp-totalpages'))}}}}
function mutatePosting(html,change){const s=structure(html),script=s.scripts.find(r=>r.attrs.type==='application/ld+json'&&r.body.includes('JobPosting'));assert.ok(script);const parsed=JSON.parse(script.body),post=parsed['@type']==='JobPosting'?parsed:(parsed['@graph']||[]).find(v=>v['@type']==='JobPosting');assert.ok(post);change(post);return html.replace(script.body,JSON.stringify(parsed))}
test('current3native posts and4unqualified corporate announcements preserve all gaps and1full original candidate',async()=>{
 const reports=[],jobs=await run({...options(),onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'4596');assert.equal(jobs[0].country,null);assert.equal(jobs[0].location,'Navi Mumbai');assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].remoteStatus,null)
 assert.equal(jobs[0].sourceDetailComplete,true);assert.match(jobs[0].jobDescription,/SolarWinds, PRTG, Nagios, Zabbix/);assert.equal(jobs[0].postingDate,'2026-05-04T14:30:09.000Z')
 assert.equal(reports.length,1);assert.equal(reports[0].observations.length,7);assert.equal(reports[0].declaredBoardInventoryComplete,true);assert.equal(reports[0].countryGaps.length,7);assert.equal(reports[0].missingCriteriaRecords.length,6);assert.equal(reports[0].lifecycleCleanupAllowed,false)
 assert.equal(reports[0].corporateAnnouncementObservations.length,4);assert.ok(reports[0].corporateAnnouncementObservations.every(r=>r.sourcePublicationReachabilityQualified===false&&r.jobDescription===null));assert.equal(reports[0].nativeWordPressReportedTotal,3)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readSourceObservationEvidence(jobs,'allieddigitalservices').observedVacancyCount,3);assert.equal(readSourceObservationEvidence(jobs,'allieddigitalservices').observedRecordCount,7)
})
test('public alternate native post ID is sufficient when private application fields change',async()=>{
 const jobs=await run(options(p=>p.url===DETAIL?{...p,body:p.body.replace(/<input\b(?=[^>]*\bname=["']awsm_job_id["'])[^>]*>/gi,'')}:p))
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].jobId,'4596')
})
test('all native workplace alternatives and conflicting country objects remain unqualified',async()=>{
 for(const location of [[{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'IN'}},{'@type':'Place',address:{addressLocality:'Toronto'}}],{'@type':'Place',address:{addressLocality:'Navi Mumbai',addressCountry:{name:'India',identifier:'CA'}}},{'@type':'Place',address:{addressLocality:'Navi Mumbai',addressCountry:{'@type':'Organization',name:'India'}}}]){
  const reports=[],jobs=await run({...options(p=>p.url===DETAIL?{...p,body:mutatePosting(p.body,post=>post.jobLocation=location)}:p),onAudit:r=>reports.push(r)}),record=reports[0].observations.find(r=>r.jobId==='4596')
  assert.equal(record.country,null);assert.ok(record.nativeWorkplaces.length);assert.equal(record.sourceNativeCountryQualified,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})
test('closing full criteria and public inventory follow both native detail passes',async()=>{
 const calls=[],reports=[];await run({...options(null,calls),onAudit:r=>reports.push(r)})
 assert.equal(calls.filter(url=>url===DETAIL).length,2);assert.ok(calls.findLastIndex(url=>url===API)>calls.findLastIndex(url=>url===DETAIL));assert.equal(reports[0].closingReconciled,true)
 let visits=0;await assert.rejects(run(options(p=>p.url===DETAIL&&++visits===2?{...p,body:mutatePosting(p.body,post=>post.description+=' Additional changed native qualification.')}:p)))
})
test('audit and record observers cannot swallow opaque cancellation or be called twice',async()=>{
 for(const observer of ['onAudit','onRecords']){const controller=new AbortController(),reason={opaqueStop:observer},settings=options();let count=0;const result=await run({...settings,signal:controller.signal,[observer]:()=>{count++;controller.abort(reason);return new Promise(()=>{})}}).then(()=>null,e=>e);assert.equal(result,reason);assert.equal(count,1)}
})
test('caller zero output cap retains all7native observations and never verifies empty',async()=>{
 const reports=[],jobs=await run({...options(),maxJobs:0,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.equal(reports[0].observations.length,7);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readSourceObservationEvidence(jobs,'allieddigitalservices').observedVacancyCount,3)
})
test('public denial is a bounded local failure without a second request',async()=>{
 const calls=[];await assert.rejects(run(options(p=>p.url===ROOT_URL?{...p,status:403,body:'Denied'}:p,calls)),error=>error.status===403);assert.equal(calls.length,1)
})
test('a foreign schema workplace cannot erase a differing unresolved own visible workplace',async()=>{
 const reports=[],jobs=await run({...options(p=>p.url===DETAIL?{...p,body:mutatePosting(p.body,post=>post.jobLocation={'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'New York',addressCountry:'US'}})}:p),onAudit:r=>reports.push(r)}),row=reports[0].observations.find(r=>r.jobId==='4596')
 assert.equal(row.country,null);assert.equal(row.sourceIndiaMembership,'unresolved');assert.ok(row.nativeWorkplaces.some(w=>w.source==='visible-job-location-specification'));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('an unspecified global remote workplace stays outside configured India output',async()=>{
 const jobs=await run(options(p=>p.url===DETAIL?{...p,body:mutatePosting(p.body,post=>post.jobLocation={'@type':'Place',address:'Remote'}).replaceAll('Navi Mumbai','Remote')}:p))
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('a conflicting written country for the same own workplace cannot qualify India membership',async()=>{
 const reports=[];await run({...options(p=>p.url===DETAIL?{...p,body:mutatePosting(p.body.replaceAll('Navi Mumbai','Navi Mumbai, Canada'),post=>post.jobLocation={'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'Navi Mumbai',addressCountry:'IN'}})}:p),onAudit:r=>reports.push(r)})
 const row=reports[0].observations.find(r=>r.jobId==='4596');assert.equal(row.country,null);assert.equal(row.sourceIndiaMembership,'unresolved');assert.equal(row.sourceNativeWorkplaceConflict,true)
})
test('winning Allied catalog keeps qualification counts runtime-only and broad cleanup disabled',async()=>{
 const local=(await import('./catalog.js')).ALLIED_DIGITAL_SERVICES_CATALOG,provider=getScraperCatalog().find(r=>r.source==='allieddigitalservices')
 assert.equal(local.verifiedOn,null);assert.equal(provider.verifiedOn,null);assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.zeroResultPolicy,'evidence-required');assert.equal(provider.lifecycleCleanupAllowed,false)
})
test('a second conflicting public native posting alternate cannot hide behind one correct ID',async()=>{
 await assert.rejects(run(options(p=>p.url===DETAIL?{...p,body:p.body.replace('</head>','<link rel="alternate" type="application/json" href="'+JOBS_API_URL+'/9999"></head>')}:p)),/post ID/)
})
