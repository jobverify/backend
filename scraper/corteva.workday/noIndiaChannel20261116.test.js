import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runNativeCorteva,readCortevaOriginalResponses} from './nativeCurrent.js'
import {CAREERS,PORTAL,BOARD,board} from './nativeDeclarations.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const load=name=>gunzipSync(readFileSync(new URL('./fixtures/'+name,import.meta.url)))
const shell=load('board-20261114.html.gz'),program=load('pcsx-client-20261114.js.gz')
const listing=JSON.parse(load('search-no-india-20261116.json.gz'))
const clientURL=board(shell.toString()).clientURL
function replay(change=()=>{}){
 const calls=[]
 const fetchResponse=async url=>{
  calls.push(url)
  const packet=listing.packets.find(p=>p.url===url)
  let bytes=packet?Buffer.from(packet.body):url===CAREERS?Buffer.from('<a href="'+PORTAL+'">Search all jobs</a>'):url===PORTAL?Buffer.from('Redirect to careers'):url===BOARD?shell:url===clientURL?program:null
  assert.ok(bytes,'Uncaptured public request '+url)
  if(packet){const payload=JSON.parse(bytes);change(payload,url,calls);bytes=Buffer.from(JSON.stringify(payload))}
  const contentType=packet?'application/json':url===clientURL?'text/javascript':'text/html'
  return{status:url===PORTAL?302:200,finalURL:url,headers:{'content-type':contentType,...(url===PORTAL?{location:'/careers'}:{})},contentType,bytes}
 }
 return{calls,fetchResponse,now:listing.capturedAt}
}
test('Corteva reconciles a channel with no India rows without claiming a complete empty company inventory',async()=>{
 const fixture=replay(),audits=[]
 const jobs=await runNativeCorteva({...fixture,onAudit:a=>audits.push(a)})
 assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(isVerifiedEmptyEvidence(evidence),false)
 assert.equal(audits.length,1)
 assert.equal(audits[0].reportedGlobalSearchCount,42)
 assert.equal(audits[0].IndiaObservations,0)
 assert.equal(audits[0].sourceScopeComplete,false)
 assert.equal(audits[0].lifecycleCleanupAllowed,false)
 assert.equal(fixture.calls.length,16)
 assert.equal(readCortevaOriginalResponses(jobs).length,16)
 assert.equal(readSourceObservationEvidence(jobs,'corteva').companyIndiaTotal,null)
})
for(const[variant,change]of[
 ['missing final page',p=>{if(p.data.positions.length<10)p.data.positions.pop()}],
 ['closing count drift',(p,url,calls)=>{if(calls.filter(u=>u===url).length>1)p.data.count++}],
 ['unreviewed geography',p=>{p.data.positions[0].additionalCountries=['India']}],
 ['contradictory India aliases',p=>{p.data.positions[0].locations=['Hyderabad, India']}],
])test('Corteva no-India channel still rejects '+variant,async()=>{
 await assert.rejects(runNativeCorteva(replay(change)))
})
