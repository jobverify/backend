import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { scenario } from '../../scraper-support/tests/peopleStrongNativePair20261027.fixtures.js'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-programs-20261119.json.gz',import.meta.url))))
const origin='https://amararajacareers.peoplestrong.com'
const currentScenario=(change=()=>{})=>{
 const s=scenario('amararajaenergymobility',{copies:2,exactEmployerDelegation:false}),calls=[],fetchPage=async(url,init)=>{
  calls.push({url,...init});const p=original.packets.find(p=>p.url===url)
  let r
  if(p)r={url:p.finalUrl,status:p.status,headers:p.headers,body:Buffer.from(p.bodyBase64,'base64').toString()}
  else r=await s.fetchPage(url,init)
  change(r,url);return r
 }
 return{...s,calls,fetchPage}
}
test('reviewed current Amara native program acquires full typed roles using the exact declared empty public search',async()=>{
 const s=currentScenario();let report
 const jobs=await run({fetchPage:s.fetchPage,onReport:r=>{report=r},now:'2026-11-19T03:00:00Z'})
 assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.nativeRoleCompany==='Amara Raja Energy & Mobility Limited'))
 assert.equal(report.protocol.initialSearchBody,'{}');assert.equal(report.protocol.emptyInitialFilterVerified,true)
 assert.equal(report.reportedNativeTotal,2);assert.equal(report.closingMatches,true)
 assert.ok(s.calls.filter(c=>c.method==='POST').every(c=>c.body==='{}'&&c.headers['Content-Type']==='application/json'&&!c.headers.Authorization))
 assert.equal(jobs.sourceScopeComplete,false);assert.equal(jobs.lifecycleCleanupAllowed,false)
 assert.equal(report.sourceScopeComplete,false);assert.equal(report.verifiedZeroInventory,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
for(const part of ['chunk-QOT5H7Z2.js','chunk-ZKMRUQJB.js','chunk-P66I7TEB.js'])test('unreviewed '+part+' fails before any anonymous POST',async()=>{
 const s=currentScenario((r,url)=>{if(url.endsWith(part))r.body+=';unreviewedExecutableChange()'})
 await assert.rejects(run({fetchPage:s.fetchPage}),/Unverified|unreviewed|protocol/i)
 assert.equal(s.calls.some(c=>c.method==='POST'),false)
})
test('corporate page with an inactive group-board handoff cannot authorize native requests',async()=>{
 const s=currentScenario((r,url)=>{if(url==='https://amararaja.com/careers/')r.body=r.body.replaceAll('<a ','<a hidden ')})
 await assert.rejects(run({fetchPage:s.fetchPage}),/delegation/i)
 assert.equal(s.calls.some(c=>c.url.startsWith(origin+'/api/')),false)
})
