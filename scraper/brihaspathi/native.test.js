import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {inspectNativePage, inspectNativePayload, runNativeBrihaspathi, CAREERS_URL, CLIENT_URL, JOBS_API_URL} from './native.js'
const fixture=name=>readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8')
const payload=()=>JSON.parse(fixture('jobs.json'))
const page=()=>fixture('careers.html')
const client=()=>fixture('careers-client.js')
const captured=()=>new Map([[CAREERS_URL,page()],[CLIENT_URL,client()],[JOBS_API_URL,JSON.stringify(payload())]])
const fake=(inputs=captured(),calls=[])=>async(url,options)=>{calls.push({url,method:options.method});assert.equal(options.method,'GET');assert.ok(inputs.has(url));return{status:200,url:url===CAREERS_URL?'https://brihaspathi.com/careers':url,headers:new Headers(),text:async()=>inputs.get(url)}}
test('current native record preserves the brief and unknown country without invented dates or IDs',()=>{
 const parsed=inspectNativePayload(payload())
 assert.equal(parsed.records.length,1)
 const job=parsed.records[0]
 assert.equal(job.title,'Brand Manager');assert.equal(job.jobId,'33')
 assert.equal(job.jobDescription,'dfgrgfgrfg');assert.equal(job.location,'Hyderabad')
 for(const key of ['country','countryCode','city','requisitionId','postingDate','closingDate','remoteStatus','employmentType','minimumQualification','preferredQualification'])assert.equal(job[key],null,key)
 assert.equal(job.sourceDetailComplete,false);assert.equal(parsed.unknownCountryRecords,1)
 assert.equal(job.nativeCmsPublication,'2026-10-26T13:03:09.238Z')
 assert.equal(job.applicationContext.jobOpeningId,33)
})
test('current corporate shell and reviewed executable client must both bind the native API',()=>{
 assert.equal(inspectNativePage(page(),client()).clientVerified,true)
 assert.equal(inspectNativePage(page(),client()+';').clientVerified,true)
 assert.throws(()=>inspectNativePage(page(),client().replace('filters[isActive][$eq]=true','filters[isActive][$eq]=false')),/client contract/)
 assert.throws(()=>inspectNativePage(page().replaceAll('42s4mc2c2afza.js','other.js'),client()),/client delegation/)
})
test('zero-looking server text cannot skip the native API or closing snapshot',async()=>{
 const calls=[],inputs=captured();inputs.set(CAREERS_URL,page().replace('Open roles','Vacancies 0 Open roles'))
 const jobs=await runNativeBrihaspathi({fetchPage:fake(inputs,calls),requestIntervalMs:0})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeInventoryEvidence.observedNativeRecords,1)
 assert.equal(jobs.nativeInventoryEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeInventoryEvidence.lifecycleCleanupAllowed,false)
 assert.equal(calls.filter(c=>c.url===JOBS_API_URL).length,2)
 assert.equal(calls.length,6)
})
test('current API ceiling remains explicit rather than fabricating an unadvertised page flow',()=>{
 const p=payload();p.meta.pagination.total=101;p.meta.pagination.pageCount=2
 p.data=Array.from({length:100},(_,i)=>({...p.data[0],id:i+1}))
 const parsed=inspectNativePayload(p);assert.equal(parsed.apiPageComplete,false)
 assert.ok(parsed.reasons.includes('native-client-first-100-record-ceiling'))
})
test('native required skills remain separate and no default workplace is invented',()=>{
 const p=payload();p.data[0].required_skills='React, Node';p.data[0].location='Hyderabad, India'
 const job=inspectNativePayload(p).records[0]
 assert.deepEqual(job.requiredSkills,['React, Node']);assert.equal(job.countryCode,'IN')
 assert.equal(job.remoteStatus,null);assert.equal(job.city,null)
})
test('HR-only visibility applies across the board when any record has a postedBy value',()=>{
 const p=payload();p.data[0].postedBy='Marketing'
 assert.equal(inspectNativePayload(p).records.length,0)
 p.data[0].postedBy='Human Resources';assert.equal(inspectNativePayload(p).records.length,1)
 p.data[0].postedBy='   ';assert.equal(inspectNativePayload(p).records.length,0)
})
test('plain React text is preserved literally; HTML-looking API text is never executed',()=>{
 const p=payload();p.data[0].description='<script>not executed</script> native text'
 assert.equal(inspectNativePayload(p).records[0].jobDescription,p.data[0].description)
})
for(const value of [null,{}, {data:null}, {data:[],meta:{pagination:{page:1,pageSize:100,pageCount:0,total:1}}}])test('malformed or inconsistent native payload fails closed '+JSON.stringify(value),()=>assert.throws(()=>inspectNativePayload(value),/Brihaspathi current native/))
for(const key of ['id','title','location','description'])test('missing native '+key+' cannot be replaced by frontend defaults',()=>{
 const p=payload();delete p.data[0][key];assert.throws(()=>inspectNativePayload(p),/Brihaspathi current native/)
})
test('duplicate native posting identity is rejected',()=>{const p=payload();p.data.push({...p.data[0]});p.meta.pagination.total=2;assert.throws(()=>inspectNativePayload(p),/duplicate/);})
test('malformed native date is rejected rather than used as publication',()=>{const p=payload();p.data[0].publishedAt='2026-02-31T00:00:00Z';assert.throws(()=>inspectNativePayload(p),/timestamp/);})
test('explicit conflicting country prevents India acceptance',()=>{const p=payload();p.data[0].location='India';p.data[0].country='United States';const j=inspectNativePayload(p).records[0];assert.equal(j.countryCode,null);assert.ok(j.sourceScopeReasons.includes('conflicting-native-country'));})
test('explicit foreign country is normalized and unknown country codes fail closed',()=>{
 const p=payload();p.data[0].country='United States'
 const j=inspectNativePayload(p).records[0];assert.equal(j.countryCode,'US')
 assert.equal(inspectNativePayload(p).unknownCountryRecords,0)
 p.data[0].countryCode='ZZ';assert.throws(()=>inspectNativePayload(p),/country/)
})
test('changed closing content fails before result publication',async()=>{
 let count=0;const fetchPage=fake();await assert.rejects(runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async(u,o)=>{
  const r=await fetchPage(u,o);if(u===JOBS_API_URL&&++count===2){const p=payload();p.data[0].description='Changed';r.text=async()=>JSON.stringify(p)}return r
 }}),/closing snapshot/)
})
test('first access denial stops without retry',async()=>{let count=0;await assert.rejects(runNativeBrihaspathi({requestIntervalMs:0,fetchPage:async()=>{count++;return{status:403}}}),/HTTP 403/);assert.equal(count,1)})
test('already aborted operation makes no request',async()=>{let count=0;const a=new AbortController();a.abort();await assert.rejects(runNativeBrihaspathi({signal:a.signal,fetchPage:async()=>{count++}}));assert.equal(count,0)})
test('cancellation during body read cannot publish results',async()=>{const a=new AbortController();await assert.rejects(runNativeBrihaspathi({signal:a.signal,requestIntervalMs:0,fetchPage:async()=>({status:200,url:'https://brihaspathi.com/careers',headers:new Headers(),text:async()=>{a.abort();return page()}})}));})
test('caller cap is validated before requests',async()=>{await assert.rejects(runNativeBrihaspathi({maxJobs:-1}),/cap/);})
