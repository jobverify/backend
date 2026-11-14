import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readDrLalDocument,readDrLalAsset,readDrLalInventory,normalizeDrLalRecord,CAREERS_URL,CV_URL,LIST_URL} from './currentNative.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261114.json.gz',import.meta.url))))
const api='https://admin-api.lalpathlabs.com/api/',tokenURL=api+'public/guest-token',listURL=api+'jobs/posts'
const sha=value=>createHash('sha256').update(value).digest('hex')
const provider=getScraperCatalog().find(row=>row.source==='drlalpathlabs')
const scraper=()=>createCatalogScraper(provider)
const body=url=>fixture.responses.find(row=>row.url===url).body
const records=()=>JSON.parse(body(listURL)).Data
function replay(change=(_url,row)=>row){
 const requests=[],counts=new Map()
 const read=async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted()
  const original=url===tokenURL?{url,finalUrl:url,status:200,method:'POST',headers:{'content-type':'application/json','set-cookie':'test-only-cookie'},
   body:JSON.stringify({Status:true,StatusCode:200,Data:{token:'synthetic-fixture-token-never-issued',expiresIn:900}})}:fixture.responses.find(row=>row.url===url)
  assert.ok(original,'Undeclared request '+url)
  assert.equal(init.method||'GET',original.method)
  if(url===tokenURL){assert.equal(init.body,'{}');assert.match(new Headers(init.headers).get('content-type'),/^application\/json/)}
  else if(url.startsWith(api))assert.equal(new Headers(init.headers).get('x-access-token'),'synthetic-fixture-token-never-issued')
  else assert.equal(new Headers(init.headers).has('x-access-token'),false)
  const count=(counts.get(url)||0)+1;counts.set(url,count);requests.push({url,method:init.method||'GET'})
  const row=await change(url,structuredClone(original),count,init)
  const response=new Response(row.body,{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.finalUrl??row.url});return response
 }
 return {read,requests}
}

test('Dr Lal registered collector recovers five unique explicit India roles with all original criteria and cleanup holds',async t=>{
 for(const row of fixture.responses)assert.equal(sha(row.body),row.sha256)
 const transport=replay();t.mock.method(globalThis,'fetch',transport.read)
 const jobs=await scraper().run()
 assert.deepEqual(jobs.map(job=>job.jobId),['58','57','37','32','31'])
 assert.deepEqual(jobs.map(job=>sha(job.sourceDescriptionHTML)),[
  'df683787fa70c63d45edf0d966552563787e3f588e41fa1d6d542f246da46b6b','5a223fbc819b97d2076a2c6c1055618ae4421f44020bb2f88054c90da1afc8e7',
  '1d1d0d378cdd1ce9c06f9274f6794385183f2553a90e63ddd855c0da3f277e30','af813aa2105c4194d8b9677cfbf152b531b827e887d7ac9f360335ed4db61868','8bfc23871737b6b50a770e749cbadb9c3b6fcc8e4bbb8f2b87a57629cddeaa27'])
 assert.ok(jobs.every(job=>job.country==='India'&&job.company==='Dr Lal PathLabs'&&job.sourceDetailComplete&&job.sourceClosingReconciled&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.sourceNativeJobRecord.Id===Number(job.jobId)&&job.postingDate===null&&job.applicationVisited===false))
 assert.match(jobs.find(job=>job.jobId==='32').sourceDescription,/Himachal Pradesh Para Medical Council Registration is mandatory/)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.observedRecordCount,41);assert.equal(audit.observedVacancyCount,41)
 assert.equal(audit.unknownCountryCount,35);assert.equal(audit.ambiguousIndiaIdentityCount,1)
 assert.equal(audit.openingClosingRecordsMatch,true);assert.equal(audit.sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(JSON.stringify(audit).includes('synthetic-fixture-token-never-issued'),false)
 assert.equal(JSON.stringify(audit).includes('test-only-cookie'),false)
 assert.ok(transport.requests.every(row=>row.method==='GET'||row.url===tokenURL))
 assert.equal(transport.requests.filter(row=>row.url===listURL).length,2)
 assert.equal(assessSoftFailureAcquisition(provider,jobs).runnerOutcome.success,true)
})

for(const [name,mutate] of [
 ['missing required candidate criteria',row=>{row.JobDisclosed=''}],
 ['a long application-intake paragraph without the remaining role sections',row=>{row.JobDetails='<p>Send us your CV and join our company. We welcome prospective applicants. </p>'.repeat(8);row.JobPurpose='';row.Responsibility='';row.JobDisclosed=''}],
 ['an unavailable native candidate section',row=>{row.JobDisclosed='<p>Loading job details. Please wait.</p>'}],
])test('Dr Lal withholds '+name,()=>{
 const record=records().find(row=>row.Id===58);mutate(record)
 assert.equal(normalizeDrLalRecord(record).sourceDetailComplete,false)
})

for(const [name,url,edit,match] of [
 ['another employer canonical',CAREERS_URL,html=>html.replace('href="https://www.lalpathlabs.com/career"','href="https://unrelated.example/careers"'),/canonical/],
 ['a missing canonical',CAREERS_URL,html=>html.replace(/<link[^>]*rel="canonical"[^>]*>/,''),/canonical/],
 ['an extra executable declaration',LIST_URL,html=>html.replace('</head>','<script>window.hiddenCriteria=true</script></head>'),/deployment.*review/],
 ['a delegated frame',LIST_URL,html=>html.replace('</body>','<iframe src="https://unrelated.example"></iframe></body>'),/Delegated/],
 ['an executable event attribute',LIST_URL,html=>html.replace('<body','<body onload="window.hiddenCriteria=true"'),/event program/],
 ['a hidden corporate careers handoff',CV_URL,html=>html.replace(/<a\b([^>]*\bhref="\/career"[^>]*)>/g,'<a hidden$1>'),/handoff.*hidden/],
 ['another role route identity',CAREERS_URL+'/job-opening/phlebotomist',html=>html.replace('"slug":"phlebotomist"','"slug":"different-role"'),/role route identity/],
 ['changed deferred activation data',LIST_URL,html=>html.replace('ab_overlay: false','ab_overlay: true'),/deployment.*review/],
])test('Dr Lal rejects '+name,()=>{
 const original=body(url),changed=edit(original);assert.notEqual(changed,original)
 assert.throws(()=>readDrLalDocument(changed,url),match)
})

for(const [name,path] of [
 ['the declared API client','/_next/static/chunks/63106-52d5602bd7ee0ec4.js'],
 ['the employer and anonymous-session binding','/_next/static/chunks/pages/_app-e5472efa73c4d602.js'],
 ['the detail/activation renderer','/_next/static/chunks/pages/career/job-opening/%5Bslug%5D-b5d564a8bf8ce11d.js'],
])test('Dr Lal rejects changed immutable bytes in '+name,()=>{
 const url='https://www.lalpathlabs.com'+path
 assert.throws(()=>readDrLalAsset(url,body(url)+'\nwindow.changedCriteria=true'),/program bytes.*review/)
})

for(const [name,edit] of [
 ['a partial total',value=>{value.TotalRecord++}],
 ['a duplicate native ID',value=>{value.Data[1].Id=value.Data[0].Id}],
 ['a failed API envelope',value=>{value.Status=false}],
 ['a missing data array',value=>{delete value.Data}],
 ['an added employer/tenant field',value=>{value.Data[0].Employer='Unrelated employer'}],
 ['a new unrendered candidate criterion',value=>{value.Data[0].Eligibility='New criterion'}],
 ['a role path traversal',value=>{value.Data[0].Slug='../different-employer'}],
])test('Dr Lal rejects '+name,()=>{
 const value=JSON.parse(body(listURL));edit(value)
 assert.throws(()=>readDrLalInventory(JSON.stringify(value)),/native/i)
})

for(const field of ['JobDetails','JobPurpose','Responsibility','JobDisclosed']){
 test('Dr Lal preserves hidden-criteria rejection in '+field,()=>{
  const row=records().find(row=>row.Id===58);row[field]+='<p hidden>Additional hidden eligibility condition</p>'
  assert.throws(()=>normalizeDrLalRecord(row),/hidden or incomplete/)
 })
 test('Dr Lal rejects executable criteria in '+field,()=>{
  const row=records().find(row=>row.Id===58);row[field]+='<img onerror="window.rewriteCriteria=true" src="x">'
  assert.throws(()=>normalizeDrLalRecord(row),/executable native criteria/)
 })
}

for(const location of ['', 'Delhi/NCR','Singapore','India, Singapore','PAN INDIA / United Kingdom'])test('Dr Lal never promotes native worksite '+JSON.stringify(location)+' to India',()=>{
 const row=records().find(row=>row.Id===58);row.Location=location
 assert.equal(normalizeDrLalRecord(row).country,null)
})

test('Dr Lal quarantines mixed country, duplicate URLs, mismatched details and closing changes without certifying zero',async()=>{
 const transport=replay((url,row,count)=>{
  if(url===listURL){const value=JSON.parse(row.body);value.Data.find(r=>r.Id===58).Location='India, Singapore';value.Data.find(r=>r.Id===57).Slug='trainee-lab-technician'
   if(count===2)value.Data.find(r=>r.Id===31).JobDisclosed+='<p>New mandatory condition</p>'
   row.body=JSON.stringify(value)
  }else if(url===api+'jobs/details/lab-technician-pan-india'){const value=JSON.parse(row.body);value.Data.Id=58;row.body=JSON.stringify(value)}
  return row
 })
 const jobs=await scraper().run({fetchImpl:transport.read})
 assert.equal(jobs.length,0)
 const audit=jobs.nativeCollectionEvidence,hold=id=>audit.holds.find(row=>row.nativeId===id)?.reason
 assert.equal(hold('58'),'native-country-unqualified')
 assert.equal(hold('57'),'ambiguous-native-role-slug');assert.equal(hold('37'),'ambiguous-native-role-slug')
 assert.equal(hold('32'),'native-list-detail-identity-or-criteria-mismatch')
 assert.equal(hold('31'),'native-record-missing-inactive-ambiguous-or-changed-at-closing')
 assert.equal(audit.openingClosingRecordsMatch,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(assessSoftFailureAcquisition(provider,jobs).runnerOutcome.success,false)
 assert.equal(transport.requests.some(row=>row.url===api+'jobs/details/consultant-pathologist'),false)
})

test('Dr Lal zero native response retains scope and cleanup holds',async()=>{
 const transport=replay((url,row)=>{if(url===listURL){const value=JSON.parse(row.body);value.Data=[];value.TotalRecord=0;row.body=JSON.stringify(value)}return row})
 const jobs=await scraper().run({fetchImpl:transport.read})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(assessSoftFailureAcquisition(provider,jobs).runnerOutcome.success,false)
 assert.equal(transport.requests.some(row=>row.url.startsWith(api+'jobs/details/')),false)
})

test('Dr Lal caller cancellation keeps the opaque reason and starts no acquisition',async()=>{
 const controller=new AbortController(),reason={caller:'stop'};controller.abort(reason)
 let requests=0
 await assert.rejects(scraper().run({signal:controller.signal,fetchImpl:async()=>{requests++;throw Error('unexpected')}}),error=>error===reason)
 assert.equal(requests,0)
})

test('Dr Lal cancels a late original response after opaque caller cancellation',async()=>{
 const controller=new AbortController(),reason={caller:'cancel-pending'};let release,requests=0,cancels=0
 const pending=scraper().run({signal:controller.signal,fetchImpl:async()=>{requests++;return new Promise(resolve=>{release=resolve})}})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
 const response=new Response(new ReadableStream({cancel(){cancels++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(response,'url',{value:CV_URL});release(response)
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancels,1);assert.equal(requests,1)
})

test('Dr Lal enforces the existing bounded request deadline on an unresolved transport',async()=>{
 let requests=0
 await assert.rejects(scraper().run({requestTimeoutMs:10,fetchImpl:async()=>{requests++;return new Promise(()=>{})}}),error=>error.name==='TimeoutError')
 assert.equal(requests,1)
})

test('Dr Lal preserves the original anonymous-session transport timeout',async()=>{
 const reason=new DOMException('Native anonymous-session request expired','TimeoutError'),transport=replay()
 await assert.rejects(scraper().run({fetchImpl:(url,init)=>url===tokenURL?Promise.reject(reason):transport.read(url,init)}),error=>error===reason)
})
