import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const originals = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/own-native-20261119.json.gz', import.meta.url))))
const replay = (change = () => {}) => {
 const calls = [],counts = new Map()
 return { calls, fetchPage: async (url,init) => {
  calls.push({url,...init}); const at=counts.get(url)||0;counts.set(url,at+1)
  const packet=structuredClone(originals.packets.filter(row=>row.url===url)[at]);assert.ok(packet,url+' #'+at)
  packet.body=Buffer.from(packet.bodyBase64,'base64').toString();change(packet,at)
  return {status:packet.status,url:packet.finalUrl,headers:packet.headers,body:packet.body}
 } }
}
const held = jobs => {
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.sourceScopeComplete,false);assert.equal(jobs.lifecycleCleanupAllowed,false)
}
test('current official handoff acquires two approved own-role criteria pairs, explicit India and declared applications',async()=>{
 const f=replay();let audit
 const jobs=await run({...f,onReport:value=>{audit=value}})
 assert.deepEqual(jobs.map(j=>j.jobId),['8EB0D411FD','4F290B09C1'])
 assert.ok(jobs.every(j=>j.country==='India'&&j.company==='Flatgigs'&&j.sourceDetailComplete&&j.nativeSameModeClosingQualified))
 assert.match(jobs[0].jobDescription,/5\+ years/);assert.match(jobs[1].jobDescription,/4\+ years/)
 assert.ok(jobs.every(j=>j.nativeRawEvidence.detail.locations.length===4&&j.nativeLegalEmployer===null))
 assert.equal(audit.observedNativeRecords,7);assert.equal(audit.countrySelected,2);assert.equal(audit.companyGlobalTotal,null)
 assert.ok(f.calls.every(c=>c.method==='GET'&&c.redirect==='manual'&&!c.body&&!c.url.endsWith('/apply')))
 assert.equal(f.calls.length,20);held(jobs)
 const assessment=assessSoftFailureAcquisition({source:'flatgigs'},jobs)
 assert.equal(assessment.indiaJobs,2);assert.equal(assessment.eligibleJobs,2)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})
for(const [label,change] of [
 ['reciprocal account',p=>{if(p.url.includes('/api/v1/accounts/')){const d=JSON.parse(p.body);d.uid='wrong';p.body=JSON.stringify(d)}}],
 ['inactive corporate handoff',p=>{if(p.url==='https://flatgigs.com/')p.body=p.body.replaceAll('href="https://apply.workable.com/flatgigs/"','hidden href="https://apply.workable.com/flatgigs/"')}],
 ['unpublished native role',p=>{if(p.url.includes('/api/v2/')){const d=JSON.parse(p.body);d.state='draft';p.body=JSON.stringify(d)}}],
 ['future native publication',p=>{p.body=p.body.replaceAll('2026-11-18','2099-01-01')}],
 ['widget preview as criteria',p=>{if(p.url.includes('/widget/')){const d=JSON.parse(p.body);for(const j of d.jobs)j.description='PREVIEW';p.body=JSON.stringify(d)}}],
 ['foreign application',p=>{if(p.url.includes('/widget/')){const d=JSON.parse(p.body);d.jobs.find(j=>j.country==='India').application_url='https://other.invalid/apply';p.body=JSON.stringify(d)}}],
 ['different own Markdown criteria',p=>{if(p.url.endsWith('.md'))p.body=p.body.replace('5+ years','1+ years').replace('4+ years','1+ years')}],
 ['changed closing criteria',(p,at)=>{if(at===1&&p.url.includes('/api/v2/')){const d=JSON.parse(p.body);d.requirements+='<p>New criterion</p>';p.body=JSON.stringify(d)}}],
]) test(label+' cannot certify a current role',async()=>{
 const f=replay(change)
 await assert.rejects(run(f))
})
test('India is selected from explicit visible native locations, never the remote label',async()=>{
 const f=replay(p=>{if(p.url.includes('/widget/')){const d=JSON.parse(p.body);for(const j of d.jobs)for(const l of j.locations)if(l.countryCode==='IN')l.hidden=true;p.body=JSON.stringify(d)}})
 const jobs=await run(f);assert.equal(jobs.length,0);held(jobs)
})
test('caller cancellation settles a stalled public read without fallback',async()=>{
 const c=new AbortController(),reason=Error('stop Flatgigs current')
 await assert.rejects(run({signal:c.signal,fetchPage:()=>{c.abort(reason);return new Promise(()=>{})}}),e=>e===reason)
})
