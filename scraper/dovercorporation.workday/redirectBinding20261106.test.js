import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {capturedSource,currentNativeTransport} from '../../test/helpers/replayCurrentNativeQuality.js'
import {run} from './script.js'
import metadata from './catalog.js'

const redirect=JSON.parse(readFileSync(new URL('./fixtures/official-careers-redirect.json',import.meta.url)))
const packets=()=>capturedSource('dovercorporation').requests.map(p=>p.requestedURL==='https://www.dovercorporation.com/about-us/careers/'?structuredClone(redirect):p)
const transport=mutate=>currentNativeTransport('dovercorporation',mutate,packets())
test('source-local catalog cannot advertise a verified empty sentinel for the current partial native adapter',()=>{
 assert.equal(metadata.verifiedPublicJobCount,null)
 assert.equal(metadata.verifiedIndiaJobCount,null)
 assert.equal(metadata.verifiedOn,null)
 assert.equal(metadata.sourceScopeComplete,false)
 assert.equal(metadata.atsPlatform,'workday')
})
test('official careers host redirect binds complete selected native roles and closing handoff without blocked corporate reads',async()=>{
 const t=transport(),jobs=await run({fetchImpl:(...args)=>t.fetch(...args),requestIntervalMs:0,now:()=>capturedSource('dovercorporation').completedAt})
 assert.equal(jobs.length,30);assert.equal(t.remaining,0)
 assert.ok(t.calls.every(c=>!c.url.startsWith('https://www.dovercorporation.com/')))
 for(const j of jobs){
  assert.equal(j.sourceOfficialBinding.careersURL,'https://careers.dovercorporation.com/')
  assert.equal(j.sourceOfficialBinding.bindingKind,'first-party-careers-host-redirect')
  assert.equal(j.sourceOfficialBinding.redirectStatus,301)
  assert.equal(j.sourceOfficialBinding.redirectTarget,'https://dover.wd103.myworkdayjobs.com/Dover')
  assert.equal(j.sourceOfficialBinding.currentHandoffRechecked,true)
  assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)
 }
})
for(const target of ['https://foreign.example/Dover','http://dover.wd103.myworkdayjobs.com/Dover','https://dover.wd103.myworkdayjobs.com/Other','https://dover.wd103.myworkdayjobs.com/Dover?x=1','https://dover.wd103.myworkdayjobs.com/Dover#x','https://user@dover.wd103.myworkdayjobs.com/Dover','/Dover'])test('unreviewed official redirect cannot bind or trigger a target fetch: '+target,async()=>{
 const t=transport(p=>{if(p.requestedURL===redirect.requestedURL)p.headers.location=target})
 await assert.rejects(run({fetchImpl:(...args)=>t.fetch(...args),requestIntervalMs:0}),/redirect.*handoff/i)
 assert.deepEqual(t.calls.map(c=>c.url),['https://careers.dovercorporation.com/'])
})
test('a readable HTML response cannot replace the reviewed official redirect',async()=>{
 const t=transport(p=>{if(p.requestedURL===redirect.requestedURL){p.status=200;p.headers={'content-type':'text/html'};p.text='<title>Dover</title><a href="https://foreign.example/">Jobs</a>'}})
 await assert.rejects(run({fetchImpl:(...args)=>t.fetch(...args),requestIntervalMs:0}),/redirect.*handoff/i)
 assert.equal(t.calls.length,1)
})
test('closing official redirect drift prevents candidate publication',async()=>{
 let reads=0
 const t=transport(p=>{if(p.requestedURL===redirect.requestedURL&&++reads===2)p.headers.location='https://dover.wd103.myworkdayjobs.com/Other'})
 await assert.rejects(run({fetchImpl:(...args)=>t.fetch(...args),requestIntervalMs:0,now:()=>capturedSource('dovercorporation').completedAt}),/redirect.*handoff/i)
})
