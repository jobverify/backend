import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-http-20261116.json.gz',import.meta.url))))
const corporate='https://www.gitbook.com/careers'
async function replay(mutate=()=>{}){
 let audit
 const requests=[]
 const read=async(url,kind)=>{
  const original=capture.packets.find(p=>p.requestUrl===url)
  assert.ok(original,'Only captured public endpoints: '+url)
  const packet={status:original.status,url:original.url,html:original.body,contentType:original.contentType}
  mutate(packet,url,requests.filter(r=>r===url).length+1);requests.push(url)
  return kind==='json'?JSON.parse(packet.html):packet
 }
 const jobs=await run({fetchPage:url=>read(url,'html'),fetchProgram:url=>read(url,'program'),fetchJson:url=>read(url,'json'),onAudit:value=>{audit=value}})
 return{jobs,audit,requests}
}

test('November16 GitBook deployment retains three native roles with full criteria and unresolved countries',async()=>{
 const{jobs,audit}=await replay()
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),['531ab2e2-af70-4b26-805e-1b4554184fd6','5d3d7b3d-0a50-4728-a9cc-18cfd8b14adb','cfd51d34-61c7-47c6-af41-04818008fea2'])
 assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.country===null&&j.lifecycleCleanupAllowed===false&&j.sourceScopeComplete===false))
 assert.ok(audit.detailProofs.every(p=>p.complete&&p.reasons.length===0))
 assert.equal(audit.employerOpening.declaredProgramProofs.length,11)
 assert.equal(audit.employerScopeStable,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const[name,mutate]of[
 ['additional hiring declaration',(p,u)=>{if(u===corporate)p.html=p.html.replace('Open roles','Open roles: India hiring')}],
 ['hidden role links',(p,u)=>{if(u===corporate)p.html=p.html.replaceAll('href="https://jobs.ashbyhq.com/GitBook/','hidden href="https://jobs.ashbyhq.com/GitBook/')}],
 ['changed closing renderer',(p,u,n)=>{if(u.includes('script_main.')&&n===2)p.html+=';window.unreviewed=true'}],
])test('November16 GitBook rejects '+name,async()=>{
 await assert.rejects(replay(mutate),/scope changed|binding unavailable|role handoff unavailable|program.*changed/)
})

test('November16 GitBook retains partial evidence for an altered native bootstrap',async()=>{
 const{jobs,audit}=await replay((p,u)=>{if(u.startsWith('https://jobs.ashbyhq.com/'))p.html=p.html.replace('const ENTRY_KEY = "index.html";','const ENTRY_KEY = "index.html";window.unreviewed=true;')})
 assert.ok(jobs.every(j=>j.sourceDetailComplete===false))
 assert.ok(audit.detailProofs.every(p=>p.reasons.some(reason=>reason.includes('reviewed-bootstrap'))))
})
