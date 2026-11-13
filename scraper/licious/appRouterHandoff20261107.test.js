import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createNativeLiciousScraper} from './nativeInventory.js'
import {readInventoryEvidence,isFreshCompleteInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {liciousCapture,liciousNativeOptions} from '../../scraper-support/tests/fixtures/liciousNativeOptions.js'

const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/app-router-handoff-20261107.json.gz',import.meta.url))))
for(const row of current.packets){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256)}
const JOBS='https://www.licious.in/careers/jobs',APP='https://www.licious.in/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js'
function options(change=()=>{},historical=liciousCapture()){
 const counts=new Map(),calls=[]
 return{calls,now:()=>historical.runAt,fetchPage:async(url,init)=>{
  init.signal?.throwIfAborted();const body=init.body??null;calls.push({url,body,method:init.method})
  assert.equal(init.method,body===null?'GET':'POST')
  const key=JSON.stringify([url,body]),index=counts.get(key)??0;counts.set(key,index+1)
  const packet=current.packets.find(row=>row.url===url)
  let row
  if(packet){assert.equal(body,null);assert.equal(index,0);row={url:packet.url,finalUrl:packet.finalUrl,status:packet.status,contentType:packet.contentType,body:Buffer.from(packet.bodyBase64,'base64').toString('utf8')}}
  else{row=structuredClone(historical.packets.filter(row=>row.url===url&&row.requestBody===body)[index]);assert.ok(row,'Only retained genuine native requests or explicitly labelled synthetic response mutations: '+url)}
  change(row,index);return{url:row.finalUrl,status:row.status,contentType:row.contentType,body:row.body}
 }}
}
const execute=async(change,historical)=>{const input=options(change,historical);return{jobs:await createNativeLiciousScraper({now:input.now}).run(input),calls:input.calls}}

test('mixed-time controlled replay: genuine App Router handoff preserves all33 original native role models and dates',async()=>{
 const legacy=liciousNativeOptions(),expected=await createNativeLiciousScraper({now:legacy.now}).run(legacy)
 const {jobs,calls}=await execute()
 assert.deepEqual(jobs,expected)
 assert.equal(jobs.length,33);assert.ok(jobs.every(row=>row.sourceDetailComplete&&row.country==='India'))
 for(const url of current.packets.map(row=>row.url))assert.equal(calls.filter(call=>call.url===url).length,1)
 assert.equal(calls.some(call=>/chunks\/pages\/content\/careers\/jobs-/.test(call.url)),false)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null)
 assert.match(evidence.reason,/app-router-company-scope-unqualified/)
})

const replace=(row,needle,value)=>{assert.equal(row.body.split(needle).length-1,1,'Mutation must target exactly one current original field');row.body=row.body.replace(needle,value)}
const page=change=>(row)=>{if(row.url===JOBS)change(row)}
for(const [label,change]of [
 ['unreviewed page chunk',page(row=>replace(row,'src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"','src="/_next/static/chunks/app/content/careers/jobs/page-0000000000000000.js"'))],
 ['duplicate page chunk',page(row=>replace(row,'src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"','src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"></script><script src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"'))],
 ['inert page chunk',page(row=>replace(row,'src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"','type="application/json" src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"'))],
 ['nomodule page chunk',page(row=>replace(row,'src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"','nomodule="" src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"'))],
 ['cross-origin page chunk',page(row=>replace(row,'src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"','src="https://example.com/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"'))],
 ['page chunk query',page(row=>replace(row,'src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"','src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js?changed=1"'))],
 ['forged legacy page carrier',page(row=>{row.body=row.body.replace('</body>','<script id="__NEXT_DATA__" type="application/json">{"page":"/content/careers/jobs"}</script></body>')})],
 ['changed SSR section binding',page(row=>replace(row,'aria-labelledby="careers-jobs-title"','aria-labelledby="different-jobs-title"'))],
 ['changed SSR heading binding',page(row=>replace(row,'id="careers-jobs-title"','id="different-jobs-title"'))],
 ['changed iframe title',page(row=>replace(row,'title="Licious open roles"','title="Other employer roles"'))],
 ['iframe srcdoc',page(row=>replace(row,'id="mnhembedded"','id="mnhembedded" srcdoc="<p>different</p>"'))],
 ['different iframe employer',page(row=>replace(row,'id="mnhembedded"','id="mnhembedded" src="https://other.mynexthire.com/employer/jobs/careers"'))],
 ['changed whole component program',row=>{if(row.url===APP)row.body+='\n/* changed unreviewed program */'}],
 ['changed original native integration program',row=>{if(row.url.endsWith('/careers-integration.js'))row.body+='\n/* changed unreviewed program */'}],
])test('synthetic App Router isolation rejects '+label,async()=>{
 await assert.rejects(()=>execute(change),/Licious native: (?:current|native)/)
})

test('synthetic empty native inventory behind the genuine App Router handoff cannot certify company India zero',async()=>{
 const historical=liciousCapture()
 for(const row of historical.packets){
  if(row.url.endsWith('/careers/reqlist/get')){const payload=JSON.parse(row.body);payload.reqDetailsBOList=[];row.body=JSON.stringify(payload)}
  if(row.url.endsWith('/careers/job-posting-dates/list')){const payload=JSON.parse(row.body);payload.data.careersJobPostingDatesList=[];row.body=JSON.stringify(payload);row.requestBody=JSON.stringify({srcShortName:'careers',requisitionIdList:[]})}
 }
 const {jobs}=await execute(()=>{},historical),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(isFreshCompleteInventoryEvidence(evidence,{now:historical.runAt}),false)
 assert.match(evidence.reason,/app-router-company-scope-unqualified/)
})

test('entire genuine current44-response acquisition retains all32 native models under unpublished role country holds',async()=>{
 const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-app-router-default-20261107.json.gz',import.meta.url))))
 const expectedBytes=Buffer.from(capture.fullOutputBase64,'base64')
 assert.equal(expectedBytes.length,capture.fullOutputBytes)
 assert.equal(createHash('sha256').update(expectedBytes).digest('hex'),capture.fullOutputSHA256)
 const expected=JSON.parse(expectedBytes),clocks=[capture.clocks.firstValidationClock,capture.clocks.closingValidationClock,expected.inventory.verifiedAt]
 let requestIndex=0,clockIndex=0
 const scraper=createNativeLiciousScraper({now:()=>{assert.ok(clockIndex<clocks.length);return clocks[clockIndex++]}})
 const jobs=await scraper.run({fetchPage:async(url,init)=>{
  init.signal?.throwIfAborted();const row=capture.packets[requestIndex++];assert.ok(row)
  assert.equal(url,row.requestedUrl);assert.equal(init.method,row.method);assert.equal(init.body??null,row.requestBody)
  assert.deepEqual(Object.fromEntries(new Headers(init.headers)),row.requestHeaders)
  assert.equal(row.redirect,'error');assert.equal(row.status,200);assert.equal(row.finalUrl,url)
  const body=Buffer.from(row.bodyBase64,'base64');assert.equal(body.length,row.bodyBytes)
  assert.equal(createHash('sha256').update(body).digest('hex'),row.sha256)
  return{status:row.status,url:row.finalUrl,contentType:row.contentType,body:body.toString('utf8')}
 }})
 assert.equal(requestIndex,44);assert.equal(clockIndex,3)
 const actual={jobs,inventory:readInventoryEvidence(jobs),observations:readSourceObservationEvidence(jobs,'licious')}
 assert.equal(jobs.length,0)
 assert.equal(actual.observations.observedRecordCount,32);assert.equal(actual.observations.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,32)
 assert.ok(jobs.nativeCollectionEvidence.observations.every(row=>row.listingRecord&&typeof row.detailRecord.jdDisplay==='string'))
 assert.equal(actual.inventory.lifecycleCleanupAllowed,false)
 assert.equal(actual.inventory.reportedTotal,32);assert.equal(actual.inventory.indiaFacetCount,null);assert.equal(actual.inventory.listingComplete,false)
 for(const reason of ['native-role-country-unpublished:1587','role-employer-scope-unresolved:1557','native-role-country-unpublished:1505'])assert.ok(actual.inventory.reason.includes(reason))
})

for(const [label,html]of [
 ['hidden legacy data','<script hidden id="__NEXT_DATA__" type="application/json">{"page":"/content/careers/jobs"}</script>'],
 ['hidden executable Pages component','<script hidden src="/_next/static/chunks/pages/content/careers/jobs-0000000000000000.js"></script>'],
 ['inert executable Pages component','<script inert src="/_next/static/chunks/pages/content/careers/jobs-0000000000000000.js"></script>'],
 ['hidden duplicate App component','<script hidden src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"></script>'],
 ['executable Pages component in hidden parent','<div hidden><script src="/_next/static/chunks/pages/content/careers/jobs-0000000000000000.js"></script></div>'],
])test('synthetic mixed-router isolation rejects '+label+' alongside the genuine App component',async()=>{
 await assert.rejects(()=>execute(page(row=>replace(row,'</head>',html+'</head>'))),/Licious native: current/)
})

for(const [label,html]of [
 ['hidden App component','<script hidden src="/_next/static/chunks/app/content/careers/jobs/page-a5324517c636287b.js"></script>'],
 ['hidden duplicate Next data','<script hidden id="__NEXT_DATA__" type="application/json">{"page":"/content/careers/jobs"}</script>'],
])test('synthetic mixed-router isolation rejects '+label+' alongside the genuine legacy component',async()=>{
 const input=liciousNativeOptions(liciousCapture(),row=>{if(row.url===JOBS){assert.equal(row.body.split('</head>').length-1,1);row.body=row.body.replace('</head>',html+'</head>')}})
 await assert.rejects(()=>createNativeLiciousScraper({now:input.now}).run(input),/Licious native: current/)
})
