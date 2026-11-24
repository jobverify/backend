import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as script from './script.js'
import {getScraperCatalog,loadProviderExtensions,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readYourNestBoard} from './nativeData20261115.js'
import {yourNestFixture,withYourNestReplayClock,assertYourNestCurrentJobs} from './fixtures/replayNativeData20261115.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-deployment-20261121.json.gz',import.meta.url))))
const retained=yourNestFixture(),current=new Map(fixture.packets.map(packet=>[packet.requestedUrl,packet]))
const old=new Map(retained.packets.filter(packet=>packet.phase==='opening').map(packet=>[packet.requestedUrl,packet]))
const NOW='2026-11-21T01:00:00.000Z',sha=value=>createHash('sha256').update(value).digest('hex')
const authority=error=>error.code==='YOURNEST_COVERAGE_GAP'&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false

// Each discovery original is replayed twice. This is a closing simulation,
// independently labelled from the later registered live capture.
function replay({profile='current',select,change,controller,abortAt}={}){
 const calls=[],counts=new Map()
 return{calls,async fetchImpl(url,init){
  const key=String(url),count=(counts.get(key)??0)+1;counts.set(key,count)
  const selected=select?.(key,count)??profile,packet=(selected==='current'?current:old).get(key)
  assert(packet,'Only reviewed native URLs may be requested: '+key)
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(bytes.length,packet.bytes);assert.equal(sha(bytes),packet.sha256)
  calls.push({url:key,count,init,packet})
  if(calls.length===abortAt)controller.abort(controller.reason)
  const altered=change?.(bytes,packet,count,calls)
  const response=new Response(altered??bytes,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl,configurable:true})
  return response
 }}
}
const run=(entry,options)=>entry==='factory'?script.createYourNestScraper(options).run():entry==='registered'?createCatalogScraper(getScraperCatalog().find(row=>row.source==='yournest')).run(options):script.run(options)

test('fixture contains ten unmodified discovery originals and claims no physical closing observations',()=>{
 assert.equal(fixture.originalDiscoveryResponses,10);assert.equal(fixture.packets.length,10)
 assert.equal(fixture.newDiagnosticGETInvocations,9);assert.equal(fixture.retainedPriorBoardResponses,1)
 assert.equal(fixture.originalWholeEntityClosingPairs,false);assert.equal(fixture.currentRegisteredProductionCaptureProved,false)
 assert.equal(fixture.replayClosingIsSimulation,true)
 for(const packet of fixture.packets){
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.sha256);assert.equal(bytes.length,packet.bytes)
  assert.equal(packet.status,200);assert.equal(packet.provenance.bodyOriginalUnmodified,true);assert.equal(packet.provenance.closingObservationClaimed,false)
  if(packet.kind==='json')assert.equal(packet.bodyBase64,old.get(packet.requestedUrl).bodyBase64,'All five full JSON entities remain byte-identical')
 }
})

for(const profile of ['retained','current'])for(const entry of ['run','factory','registered'])test(profile+' coherent original data deployment preserves full criteria and holds via '+entry,async()=>{
 const io=replay({profile}),jobs=await withYourNestReplayClock(()=>run(entry,{fetchImpl:io.fetchImpl,now:()=>NOW}))
 assertYourNestCurrentJobs(jobs,retained);assert.equal(io.calls.length,20)
 assert(io.calls.every(call=>call.init.method==='GET'&&call.init.credentials==='omit'&&call.init.redirect==='manual'))
 assert(io.calls.every(call=>!call.url.includes('apply_now')&&!call.url.startsWith('https://yournest.in/')))
 assert.equal(jobs[0].nativeSSRSourceRecord.buildId,profile==='current'?'hGwYSswRdYk00b5WE7uoq':'-zl3jPji-ZXJ2VHuKkmQd')
})

for(const opening of ['current','retained'])for(const label of ['board','html-425748','html-376083','html-374870','html-43774'])test(opening+' opening rejects mixed deployment at closing '+label,async()=>{
 const other=opening==='current'?'retained':'current'
 const io=replay({profile:opening,select:(url,count)=>count===2&&current.get(url).label===label?other:opening})
 await withYourNestReplayClock(()=>assert.rejects(run('registered',{fetchImpl:io.fetchImpl,now:()=>NOW}),authority))
 const last=io.calls.at(-1);assert.equal(last.packet.label,label);assert.equal(last.count,2);assert(io.calls.length<=20)
})

for(const opening of ['current','retained'])test(opening+' board cannot select a different role deployment during opening',async()=>{
 const io=replay({profile:opening,select:url=>current.get(url).label==='html-425748'?(opening==='current'?'retained':'current'):opening})
 await withYourNestReplayClock(()=>assert.rejects(run('run',{fetchImpl:io.fetchImpl,now:()=>NOW}),authority))
 assert.equal(io.calls.length,4)
})

const alterJSON=(text,change)=>{const value=JSON.parse(text);change(value);return JSON.stringify(value)}
const mutants=[
 ['unknown board build ID','board',text=>text.replaceAll('hGwYSswRdYk00b5WE7uoq','hGwYSswRdYk00b5WE7uop')],
 ['outside HTML whitespace','html-425748',text=>text+' '],
 ['unknown required qualification','html-425748',text=>text.replace('</body>','<p>Mandatory new certificate.</p></body>')],
 ['fixed guessed application tenant','html-425748',text=>text.replaceAll('company_uuid=undefined','company_uuid=987EE7EF32')],
 ['changed native country','api-425748',text=>alterJSON(text,value=>{value.country='United States'})],
 ['changed native publication','api-425748',text=>text.replace('2026-11-06T16:48:45.086766+05:30','2026-11-20T16:48:45.086766+05:30')],
 ['changed full criteria','api-425748',text=>alterJSON(text,value=>{value.description+='<p>Mandatory changed engagement details.</p>'})],
 ['changed stylesheet declaration','board',text=>text.replace('</head>','<link rel="stylesheet" href="/unknown.css"></head>')],
]
for(const[name,label,mutate]of mutants)test('current exact deployment rejects '+name,async()=>{
 let mutated=false
 const io=replay({change:(bytes,packet)=>{if(packet.label!==label)return;const text=bytes.toString(),changed=mutate(text);assert.notEqual(changed,text,'Control must alter original bytes');mutated=true;return Buffer.from(changed)}})
 await withYourNestReplayClock(()=>assert.rejects(run('registered',{fetchImpl:io.fetchImpl,now:()=>NOW}),authority))
 assert.equal(mutated,true);assert.equal(io.calls.at(-1).packet.label,label)
})

test('current deployment still excludes the sole own internship after native expiry without verified empty',async()=>{
 const io=replay(),jobs=await withYourNestReplayClock(()=>run('registered',{fetchImpl:io.fetchImpl,now:()=> '2027-01-06T00:00:00Z'}))
 assert.equal(jobs.length,0);assert.equal(io.calls.length,20)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
})

test('caller abort on current final closing response is preserved without partial success',async()=>{
 const controller=new AbortController(),reason={currentFinalClosing:true}
 const io=replay({controller,abortAt:20});controller.reason=reason
 await withYourNestReplayClock(()=>assert.rejects(run('registered',{signal:controller.signal,fetchImpl:io.fetchImpl,now:()=>NOW}),error=>error===reason))
 assert.equal(io.calls.length,20)
})

const forgedBoard=()=>{
 const profile=JSON.parse(readFileSync(new URL('./reviewedNativeData20261121.json',import.meta.url),'utf8'))
 const packet=fixture.packets.find(packet=>packet.label==='board'),unknown='unreviewed-caller-build'
 const bytes=Buffer.from(Buffer.from(packet.bodyBase64,'base64').toString().replaceAll('hGwYSswRdYk00b5WE7uoq',unknown))
 const entity=profile.entities.find(entity=>entity.label==='board');entity.bytes=bytes.length;entity.sha256=sha(bytes)
 profile.boardFullSSR.buildId=unknown
 return{profile,page:{url:packet.requestedUrl,bytes,text:bytes.toString()}}
}
test('direct parser rejects a caller-provided profile that invents an unreviewed deployment',()=>{
 const {profile,page}=forgedBoard()
 assert.throws(()=>readYourNestBoard(page,profile),authority)
})
test('registered run ignores a caller-provided profile that invents an unreviewed deployment',async()=>{
 const {profile,page}=forgedBoard(),io=replay({change:(bytes,packet)=>packet.label==='board'?page.bytes:bytes})
 await withYourNestReplayClock(()=>assert.rejects(run('registered',{fetchImpl:io.fetchImpl,now:()=>NOW,profile}),authority))
 assert.equal(io.calls.length,1)
})
test('deployment profile preserves catalog order and every other provider independently of catalog size',()=>{
 const loaded=loadProviderExtensions(),selected=loaded.filter(row=>row.source==='yournest'&&row.modulePath==='../yournest/nativeData20261115.js')
 assert.equal(selected.length,1)
 const current=getScraperCatalog({providerExtensions:loaded}),before=getScraperCatalog({providerExtensions:loaded.filter(row=>row!==selected[0])})
 assert.equal(current.length,before.length);assert.deepEqual(current.map(row=>row.source),before.map(row=>row.source))
 assert.deepEqual(current.filter(row=>row.source!=='yournest'),before.filter(row=>row.source!=='yournest'))
 assert.equal(current.filter(row=>row.source==='yournest').length,1)
})
