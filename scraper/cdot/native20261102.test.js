import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {createCdotScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz',import.meta.url))))
for(const packet of packets)assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.sha256)
const recorded=(edit=()=>{})=>{
 const calls=[],counts=new Map()
 return {calls,options:{minIntervalMs:0,fetchImpl:async url=>{
  const packet=packets.find(p=>p.url===url);assert.ok(packet,'Unexpected C-DOT URL')
  const q=structuredClone(packet),n=(counts.get(url)||0)+1;counts.set(url,n);edit(q,n);calls.push(url)
  const response=new Response(Buffer.from(q.bodyBase64,'base64'),{status:q.status,headers:{'content-type':q.key==='listing'?'text/html':'application/pdf'}})
  Object.defineProperty(response,'url',{value:q.url});return response
 }}}
}
test('C-DOT retains complete original PDF criteria and native India deployment binding while company scope stays incomplete',async()=>{
 const r=recorded(),jobs=await createCdotScraper(r.options).run(),job=jobs[0],description=job.jobDescription.replace(/\s+/g,' ')
 assert.equal(jobs.length,1)
 for(const text of ['product development and sustenance','Minimum Percentage 70%','Python/Java/C++/JavaScript','continuous improvement of product architecture'])assert.ok(description.includes(text),text)
 assert.equal(job.sourceNativePDFSHA256,packets[1].sha256);assert.equal(job.sourceNativePDFPages,17);assert.equal(job.numberOfOpenings,5)
 assert.equal(job.nativeWorkplace,'Delhi');assert.equal(job.city,null);assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true)
 assert.equal(job.sourceNativeCriteriaContainerRetained,true);assert.equal(job.nativeRoleClosingReconciled,true)
 assert.deepEqual(r.calls,[packets[0].url,packets[1].url,packets[0].url,packets[1].url])
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.listingComplete,false)
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
})
test('C-DOT holds a changed closing official role identity before another advertisement read',async()=>{
 const r=recorded((q,n)=>{if(q.key==='listing'&&n===2)q.bodyBase64=Buffer.from(Buffer.from(q.bodyBase64,'base64').toString('utf8').replaceAll('adv_id=28','adv_id=999')).toString('base64')})
 const jobs=await createCdotScraper(r.options).run()
 assert.equal(jobs.length,0);assert.equal(r.calls.length,3);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 const audit=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(audit.heldNativeRows[0].opening.nativeRecord.pdf.pages.length,17)
})
test('C-DOT never substitutes a placeholder when the advertised PDF is missing',async()=>{
 const r=recorded(q=>{if(q.key==='advertisement')q.bodyBase64=Buffer.from('not the native PDF').toString('base64')})
 await assert.rejects(createCdotScraper(r.options).run(),/C-DOT native|Published PDF/)
 assert.equal(r.calls.length,2)
})
test('C-DOT preserves exact caller cancellation before any official request',async()=>{
 const reason=Error('Stop C-DOT source')
 await assert.rejects(createCdotScraper().run({signal:AbortSignal.abort(reason),fetchImpl:async()=>{assert.fail('No request after cancellation')}}),error=>error===reason)
})
