import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readLiteralFlightRecords} from '../../scraper-support/utils/kulaFlight.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/retained-http-20261029.json.gz',import.meta.url))))
const bytes=Buffer.from(fixture.bodyBase64,'base64'),html=bytes.toString('utf8')
assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.receipt.sha256)
const actual=()=>{
 const records=readLiteralFlightRecords(html),scopes=[]
 const walk=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x.departments))scopes.push(x);for(const v of Object.values(x))walk(v)}
 for(const record of records.values())if(record.kind==='model')walk(record.value)
 assert.equal(scopes.length,1)
 return {departments:scopes[0].departments,rows:scopes[0].departments.flatMap(x=>x.jobs),records}
}
const execute=async(document=html,options={})=>{
 const previous=globalThis.fetch,calls=[];let audit
 globalThis.fetch=async url=>{
  assert.equal(String(url),fixture.receipt.url);calls.push('default:'+url)
  const response=new Response(document,{status:fixture.receipt.httpStatus});Object.defineProperty(response,'url',{value:fixture.receipt.finalUrl});return response
 }
 try{
  const row=getScraperCatalog().find(p=>p.source==='codemonk')
  const jobs=await createCatalogScraper(row).run({fetchText:async url=>{assert.equal(url,fixture.receipt.url);calls.push('provided:'+url);return document},onAudit:value=>{audit=value},...options})
  return {jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
 }finally{globalThis.fetch=previous}
}
const change=(from,to)=>{
 let changed=0
 const result=html.replace(/(<script[^>]*>)(self\.__next_f\.push\([\s\S]*?)(<\/script>)/g,(all,open,body,close)=>{
  const match=body.match(/^self\.__next_f\.push\(([\s\S]*)\);?$/);assert.ok(match)
  const frame=JSON.parse(match[1]);if(frame[0]!==1||!frame[1].includes(from))return all
  changed++;frame[1]=frame[1].replaceAll(from,to);return open+'self.__next_f.push('+JSON.stringify(frame)+')'+close
 });assert.ok(changed);return result
}

test('original archived corporate criteria remain partial when current native applications are unavailable',async()=>{
 const native=actual(),{jobs,audit,evidence,calls}=await execute()
 assert.equal(jobs.length,8);assert.deepEqual(calls,['provided:'+fixture.receipt.url])
 assert.deepEqual(jobs.map(x=>x.jobId),native.rows.map(x=>x.uuid))
 for(const job of jobs){
  const row=native.rows.find(x=>x.uuid===job.jobId),description=native.records.get(row.description.slice(1)).value
  assert.equal(job.country,'India');assert.equal(job.applyUrl,row.apply_link);assert.equal(job.sourceUrl,row.link)
  assert.deepEqual(job.sourceNativeRecord,row);assert.equal(job.sourceNativeDescription,description)
  assert.deepEqual(job.sourceScreeningQuestions,row.job_screening_questions);assert.deepEqual(job.sourceApplicationFields,row.application_fields)
  assert.deepEqual(job.sourceNativeEducation,row.education);assert.deepEqual(job.requiredSkills,row.skill)
  assert.equal(job.sourceNativeCreatedAt,row.created_at);assert.equal(job.sourceNativeUpdatedAt,row.updated_at);assert.equal(job.postingDate,null)
  assert.equal(job.employmentType,row.job_type);assert.equal(job.legalHiringEmployer,null)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDeclaredCriteriaCopyComplete,false)
  assert.ok(job.sourceCriteriaIssues.includes('native-application-unavailable'))
  assert.ok(job.sourceCriteriaIssues.includes('native-application-activation-and-conditional-controls-unqualified'))
 }
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(audit.originalNativeHTML,html);assert.deepEqual(audit.nativeDepartments,native.departments)
 assert.equal(audit.renderedRoleIds.length,2);assert.equal(audit.unrenderedNativeRoleIds.length,6);assert.equal(audit.noClosingProof,true)
 assert.equal(audit.nativeApplications.filter(value=>value.error).length,8)
})

for(const [name,mutate] of [
 ['foreign native employer',()=>change('"company_name":"CODEMONK"','"company_name":"Other"')],
 ['unpublished native records',()=>change('"published":true','"published":false')],
 ['closed native records',()=>change('"status":"open"','"status":"closed"')],
 ['foreign application tenant',()=>change('jobs.pyjamahr.com/codemon/','jobs.pyjamahr.com/other/')],
 ['missing native description reference',()=>change('"description":"$17"','"description":"$deadbeef"')],
 ['object reference is not description text',()=>change('"description":"$17"','"description":"$0"')],
 ['native title prefix differs from rendered title',()=>change('"title":"Business Analyst Associate"','"title":"Business"')],
 ['typed country malformed',()=>change('"country":"India"','"country":[]')],
 ['mandatory screening type malformed',()=>change('"mandatory":true','"mandatory":"true"')],
 ['nonfinite numeric criteria',()=>change('"min_salary":400000','"min_salary":1e400')],
 ['unsafe numeric opening count',()=>change('"no_of_openings":1','"no_of_openings":9007199254740993')],
 ['inverted salary criteria',()=>change('"max_salary":600000','"max_salary":1')],
 ['inverted experience criteria',()=>change('"max_experience":2','"max_experience":0')],
 ['inactive native Flight frames',()=>html.replaceAll('<script>self.__next_f.push(','<script type="text/plain">self.__next_f.push(')],
 ['stylesheet-hidden corporate roles',()=>html.replace('</head>','<style>a[href^="/careers/"]{display:none!important}</style></head>')],
])test(name+' rejects rather than authorizing positive records',async()=>{await assert.rejects(execute(mutate()))})

test('unknown mandatory native criteria remain raw and revoke affected detail completeness',async()=>{
 const {jobs}=await execute(change('"company_name":"CODEMONK"','"company_name":"CODEMONK","mandatory_license":{"name":"Required"}'))
 assert.equal(jobs.length,8)
 for(const job of jobs){assert.deepEqual(job.sourceNativeRecord.mandatory_license,{name:'Required'});assert.equal(job.sourceDetailComplete,false);assert.ok(job.sourceCriteriaIssues.some(x=>x.includes('mandatory_license')))}
})

test('unknown nested application criteria are preserved and never silently marked complete',async()=>{
 const {jobs}=await execute(change('"input_type":"TEXT"','"input_type":"TEXT","mandatory_license":{"name":"Required"}'))
 assert.equal(jobs.length,8);assert.equal(jobs[0].sourceDetailComplete,false)
 assert.deepEqual(jobs[0].sourceApplicationFields[0].mandatory_license,{name:'Required'})
})

test('already aborted caller performs no injected transport',async()=>{
 const c=new AbortController(),reason=Error('Stop Codemonk');c.abort(reason);let count=0
 await assert.rejects(execute(html,{signal:c.signal,fetchText:async()=>{count++;return html}}),error=>error===reason)
 assert.equal(count,0)
})

test('audit cancellation cannot return successful native observations',async()=>{
 const c=new AbortController(),reason=Error('Stop audit')
 await assert.rejects(execute(html,{signal:c.signal,onAudit:()=>c.abort(reason)}),error=>error===reason)
})

test('default native transport receives caller abort without any HTTP',async()=>{
 const previous=globalThis.fetch,c=new AbortController(),reason=Error('Stop native transport');let transportCancelled=false
 globalThis.fetch=async(url,init)=>{
  assert.equal(String(url),fixture.receipt.url);c.abort(reason);transportCancelled=init.signal.aborted
  const response=new Response(bytes,{status:fixture.receipt.httpStatus});Object.defineProperty(response,'url',{value:fixture.receipt.finalUrl});return response
 }
 try{await assert.rejects(run({signal:c.signal}),error=>error===reason);assert.equal(transportCancelled,true)}finally{globalThis.fetch=previous}
})
