import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {extractKulaNativeJobs,resolveKulaJobDescriptions} from '../../scraper-support/utils/kulaFlight.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/retained-http-20261029.json.gz',import.meta.url))))
const bytes=Buffer.from(fixture.bodyBase64,'base64')
assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.receipt.sha256)
const html=bytes.toString('utf8'),accountName='saas-labs'
const raw=()=>extractKulaNativeJobs(html,{accountName})
const resolved=()=>resolveKulaJobDescriptions(html,raw())
const execute=async(document=html,options={})=>{
 const calls=[];let audit
 const jobs=await run({fetchText:async url=>{assert.equal(url,fixture.receipt.url);calls.push(url);return document},onAudit:value=>{audit=value},...options})
 return {jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
}
// Counterfactual changes to authentic Flight fields, not synthetic vacancy rows.
const change=(from,to)=>html.replace(/(<script[^>]*>)(self\.__next_f\.push\([\s\S]*?)(<\/script>)/g,(all,open,body,close)=>{
 const match=body.match(/^self\.__next_f\.push\(([\s\S]*)\);?$/)
 assert.ok(match);const frame=JSON.parse(match[1]);if(frame[0]!==1)return all
 assert.ok(frame[1].includes(from));frame[1]=frame[1].replaceAll(from,to)
 return open+'self.__next_f.push('+JSON.stringify(frame)+')'+close
})

test('registered original listing retains17 explicit India identities and JDs without claiming missing application criteria',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='saaslabs')
 assert.equal(provider.adapter,'script');assert.match(provider.modulePath.replaceAll('\\','/'),/\/saaslabs\/script\.js$/)
 let audit;const jobs=await createCatalogScraper(provider).run({fetchText:async url=>{assert.equal(url,fixture.receipt.url);return html},onAudit:value=>{audit=value}})
 const originals=raw(),full=resolved(),doc=readVisibleNativeDocument(html,{strict:true})
 assert.equal(jobs.length,17);assert.deepEqual(jobs.map(job=>job.jobId).sort(),originals.map(job=>String(job.id)).sort())
 for(const job of jobs){
  const native=originals.find(row=>String(row.id)===job.jobId),description=full.find(row=>row.id===native.id).ats_job.job_description
  assert.equal(job.country,'India');assert.equal(job.employmentType,native.ats_job.work_type_name)
  assert.deepEqual(job.sourceNativeRecord,native);assert.equal(job.sourceNativeDescription,description)
  assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceListingDescriptionComplete,true)
  assert.equal(job.sourceApplicationCustomFields,null);assert.ok(job.sourceCriteriaIssues.includes('native-application-detail-unavailable'))
  assert.equal(job.postingDate,null);assert.equal(job.sourceNativeLaunchAt,native.launch_at)
  assert.equal(job.legalHiringEmployer,null);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.ok(doc.nodes(node=>node.tag==='a'&&new URL(node.attrs.href||'/',fixture.receipt.url).href===job.sourceUrl).length)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(audit.originalNativeHTML,html);assert.deepEqual(audit.nativeRecords,originals);assert.equal(audit.noClosingProof,true)
})

for(const [name,document] of [
 ['foreign native account',()=>change('"account_id":1364','"account_id":9999')],
 ['confidential vacancies',()=>change('"is_confidential":false','"is_confidential":true')],
 ['unlisted vacancies',()=>change('"listed":true','"listed":false')],
 ['internal-only vacancies',()=>change('"kind":"internal_and_external"','"kind":"internal"')],
 ['country/code contradiction',()=>change('"country_code":"IN"','"country_code":"US"')],
 ['typed country shape',()=>change('"country_code":"IN"','"country_code":[]')],
 ['inactive literal frame',()=>html.replace('<script>self.__next_f.push(', '<script type="text/plain">self.__next_f.push(')],
 ['stylesheet-hidden role links',()=>html.replace('</head>','<style>a[href*="/saas-labs/"]{display:none!important}</style></head>')],
 ['foreign role application path',()=>html.replace('href="/saas-labs/34790-product-marketing-manager"','href="https://careers.kula.ai/other/34790-product-marketing-manager"')],
 ['foreign publisher title',()=>html.replace('<title>Work at SaaS Labs | Careers for Innovators</title>','<title>Other publisher</title>')],
 ['absent active publisher heading',()=>html.replaceAll('SaaS Labs Careers','Other publisher careers')],
 ['truncated native title with original rendered heading',()=>change('"title":"Product Marketing Manager"','"title":"Product"')],
])test(name+' cannot establish known India jobs',async()=>{await assert.rejects(execute(document()))})

test('unknown mandatory criteria remain raw and revoke affected detail completeness',async()=>{
 const document=change('"jobs_cbv_settings_enabled":false','"jobs_cbv_settings_enabled":false,"mandatory_license":{"name":"Required"}')
 const {jobs,audit}=await execute(document)
 assert.equal(jobs.length,17)
 for(const job of jobs){assert.deepEqual(job.sourceNativeRecord.mandatory_license,{name:'Required'});assert.equal(job.sourceDetailComplete,false);assert.ok(job.sourceCriteriaIssues.some(reason=>reason.includes('mandatory_license')))}
 assert.equal(audit.nativeRecords.length,17)
})

test('unknown nested office criteria stay intact and incomplete',async()=>{
 const document=change('"country_code":"IN"','"country_code":"IN","mandatory_qualification":{"license":"Required"}')
 const {jobs}=await execute(document)
 assert.equal(jobs.length,17)
 assert.equal(jobs[0].sourceDetailComplete,false)
 assert.deepEqual(jobs[0].sourceNativeRecord.ats_job.offices[0].mandatory_qualification,{license:'Required'})
})

test('hidden native JD subtree cannot be certified as a full visible description',async()=>{
 const document=change('"job_description":"$20"','"job_description":'+JSON.stringify('<p>Build and maintain actual source systems.</p><style>.secret{display:none}</style><p class="secret">Mandatory license required.</p>'))
 const {jobs}=await execute(document),job=jobs.find(row=>row.jobId==='34790')
 assert.equal(job.sourceDetailComplete,false)
 assert.match(job.jobDescription,/Build and maintain/)
 assert.doesNotMatch(job.jobDescription,/Mandatory license/)
 assert.match(job.sourceNativeDescription,/Mandatory license/)
})

test('aborted caller cannot perform native transport or return partial successful jobs',async()=>{
 let calls=0;const controller=new AbortController(),reason=Error('Stop native source');controller.abort(reason)
 await assert.rejects(execute(html,{signal:controller.signal,fetchText:async()=>{calls++;return html}}),error=>error===reason)
 assert.equal(calls,0)
})

test('audit cancellation cannot return recovered jobs',async()=>{
 const controller=new AbortController(),reason=Error('Stop audit')
 await assert.rejects(execute(html,{signal:controller.signal,onAudit:()=>controller.abort(reason)}),error=>error===reason)
})

test('default native HTTP stack receives caller cancellation while returning original fixture bytes',async()=>{
 const previous=globalThis.fetch,controller=new AbortController(),reason=Error('Cancel native HTTP')
 let transportCancelled=false
 globalThis.fetch=async(url,init)=>{
  assert.equal(String(url),fixture.receipt.url)
  controller.abort(reason);transportCancelled=init.signal.aborted
  const response=new Response(bytes,{status:fixture.receipt.httpStatus})
  Object.defineProperty(response,'url',{value:fixture.receipt.finalUrl})
  return response
 }
 try{await assert.rejects(run({signal:controller.signal}),error=>error===reason);assert.equal(transportCancelled,true)}
 finally{globalThis.fetch=previous}
})
