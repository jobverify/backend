import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import{createHash}from'node:crypto'
import{projectSigmaWorksiteCountries}from'./worksiteCountry.js'
import{sigmaNativeCountryIssues}from'./nativeDetails.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/worksite-country-20261103.json.gz',import.meta.url))))
for(const r of fixture.responses)assert.equal(createHash('sha256').update(r.body).digest('hex'),r.sha256)
const current=()=>structuredClone(fixture)
test('current same-role named worksite ID and native directory country recover only directly bound geography',()=>{
 const f=current(),before=JSON.stringify(f.boardPayload),result=projectSigmaWorksiteCountries(f.boardPayload.jobs,f.officePayload)
 assert.ok(result.proofs.length>=7);assert.equal(JSON.stringify(f.boardPayload),before);assert.ok(sigmaNativeCountryIssues(result.records).length<41)
 const proof=result.proofs.find(p=>p.jobId==='8012144003');assert.equal(proof.officeId,4003396003);assert.equal(proof.originalPrimaryLocation,'San Francisco, CA');assert.equal(proof.nativeWorksiteLocation,'San Francisco, California, United States');assert.match(proof.method,/same-role/)
 assert.equal(result.records.find(r=>r.id===8012144003).location.name,proof.nativeWorksiteLocation)
})
test('city/world knowledge, remote labels and mismatched native office relationships cannot supply country',()=>{
 const f=current(),r=projectSigmaWorksiteCountries(f.boardPayload.jobs,f.officePayload),mismatched=f.boardPayload.jobs.find(j=>j.location.name==='New York, New York'&&j.offices.every(o=>o.name==='San Francisco'))
 assert.ok(mismatched);assert.ok(!r.proofs.some(p=>p.jobId===String(mismatched.id)));assert.ok(r.proofs.every(p=>!/remote|hybrid|global/i.test(p.originalPrimaryLocation)));assert.ok(r.proofs.every(p=>!p.originalPrimaryLocation.includes('New York City')))
})
test('exact current role membership, office country and employer board identity are required',()=>{
 for(const change of[
  f=>{for(const o of f.officePayload.offices)for(const d of o.departments)d.jobs=d.jobs.filter(j=>j.id!==8012144003)},
  f=>{f.officePayload.offices.find(o=>o.id===4003396003).location='San Francisco, California, India'},
  f=>{for(const o of f.officePayload.offices)for(const d of o.departments)for(const j of d.jobs)if(j.id===8012144003)j.absolute_url='https://job-boards.greenhouse.io/unrelated/jobs/8012144003'},
 ]){const f=current();change(f);const r=projectSigmaWorksiteCountries(f.boardPayload.jobs,f.officePayload);assert.ok(!r.proofs.some(p=>p.jobId==='8012144003'));assert.equal(r.records.find(j=>j.id===8012144003).location.name,'San Francisco, CA')}
})
test('native alternative country conflicts remain unresolved and cannot be erased by office proof',()=>{
 const f=current(),row=f.boardPayload.jobs.find(j=>j.id===8012144003);row.metadata=[{name:'Country',value:'India'}];const r=projectSigmaWorksiteCountries(f.boardPayload.jobs,f.officePayload);assert.ok(!r.proofs.some(p=>p.jobId===String(row.id)));assert.deepEqual(r.records.find(j=>j.id===row.id).metadata,row.metadata)
})
test('duplicate/invalid native directory envelopes never become empty country evidence',()=>{
 const f=current();for(const payload of[{}, {offices:null},{offices:[...f.officePayload.offices,f.officePayload.offices[0]]},{error:'denied',offices:[]}])assert.throws(()=>projectSigmaWorksiteCountries(f.boardPayload.jobs,payload),/Sigma.*office|worksite|directory/i)
})
test('new native office geography cannot be silently discarded by an older directory projection',()=>{
 const f=current();f.officePayload.offices.find(o=>o.id===4003396003).country='India';assert.throws(()=>projectSigmaWorksiteCountries(f.boardPayload.jobs,f.officePayload),/office.*directory|directory.*office/i)
})
