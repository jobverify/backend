import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {squareRole,squareApplication,squareListing,runSquareNative} from './currentNative20261119.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const body=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const first=url=>fixture.responses.find(x=>x.requestedUrl===url)
const sales=JSON.parse(body(first('https://www.squareyards.com/career/Sales'))).data
const row=sales[0],url='https://www.squareyards.com/career_form/'+row.id+'?location=Mumbai&dept=Sales'
const execute=(mutate,extra={})=>{const counts=new Map();return runSquareNative({...extra,requestIntervalMs:0,fetchImpl:async(u,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
 const n=counts.get(u)||0;counts.set(u,n+1);const receipt=fixture.responses.filter(r=>r.requestedUrl===u)[n];assert.ok(receipt,'Unexpected public read '+u)
 const r=new Response(mutate?mutate(body(receipt),u,n):body(receipt),{status:receipt.status,headers:receipt.headers});Object.defineProperty(r,'url',{value:receipt.url});return r
}})}
test('Square Yards reads every current native department including formerly omitted Marketing',()=>{
 assert.deepEqual(squareListing(body(first('https://www.squareyards.com/career'))).departments,['Sales','Technology','Marketing','Customer_Relations','Human_Resources','Interior_Company'])
})
test('Square Yards retains the whole published positionName, full criteria, native id and exact workplace',()=>{
 const job=squareRole(row,'Sales');assert.equal(job.title,row.positionName);assert.equal(job.jobId,String(row.id));assert.equal(job.requisitionId,row.jobId);assert.equal(job.country,'India');assert.equal(job.nativeSourceRecord,row);assert.ok(job.jobDescription.includes('Minimum 3 to 6 years'));assert.equal(job.postingDate,null)
 assert.equal(squareApplication(body(first(url)),row).jobId,String(row.id))
})
test('Square Yards holds the sibling brand, foreign, unknown and misspelled workplaces',()=>{
 assert.throws(()=>squareRole({...row,department:'Interior Company',verticalName:'Interior'},'Interior_Company'),/employer/)
 assert.throws(()=>squareRole({...row,country:'United States'},'Sales'),/country/)
 for(const location of ['Dubai','All Location','Gurgoan','Mumbai, United States','Greater Mumbai Unknown'])assert.throws(()=>squareRole({...row,location},'Sales'),/workplace/)
})
test('Square Yards rejects publication, full-criteria country/employer/closure contradictions and application drift',()=>{
 for(const patch of [{status:'Closed'},{isPublish:0},{openPosition:0},{description:row.description+'<p>Country: United States</p>'},{description:row.description+'<p>Location: New York, United States</p>'},{description:row.description+'<p>Employer: Other Company</p>'},{description:row.description+'<p>This position has been filled.</p>'}])assert.throws(()=>squareRole({...row,...patch},'Sales'))
 assert.throws(()=>squareApplication(body(first(url)).replace('name="job_id" value="11364"','name="job_id" value="99999"'),row),/identity/)
})
test('Square Yards closes all full native rows, own application models and declared programs while retaining company holds',async()=>{
 const jobs=await execute();assert.ok(jobs.length>=25);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceClosingQualified&&j.sourceDetailComplete));assert.equal(jobs.nativeCollectionEvidence.openingNativeRecords.length,46);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false);assert.equal(jobs.nativeCollectionEvidence.openingClosingMatch,true)
 assert.ok(jobs.some(j=>j.department==='Marketing'));assert.ok(!jobs.some(j=>j.department==='Interior Company'))
})
test('Square Yards never publishes changed closing full criteria or application identities',async()=>{
 await assert.rejects(execute((s,u,n)=>n===1&&u.endsWith('/career/Sales')?s.replace('Minimum 3 to 6 years','Minimum 6 to 9 years'):s),/closing/)
 await assert.rejects(execute((s,u,n)=>n===1&&u===url?s.replace('name="job_id" value="11364"','name="job_id" value="99999"'):s),/identity/)
})
test('Square Yards propagates caller cancellation and refuses legacy metadata-free callbacks',async()=>{
 const c=new AbortController();c.abort(Error('caller cancelled'));await assert.rejects(runSquareNative({signal:c.signal}),/caller cancelled/)
 await assert.rejects(runSquareNative({fetchText:async()=>''}),/metadata/)
})
