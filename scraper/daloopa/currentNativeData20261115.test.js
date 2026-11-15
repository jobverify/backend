import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {getSourceDescription} from '../../src/utils/jobSourceContent.js'
import * as script from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readDaloopaBoard,readDaloopaClient,readDaloopaListing,readDaloopaDetail as readCurrentDaloopaDetail,readDaloopaLanding,createDaloopaOriginalReader,readDaloopaStrictJSON} from './nativeData20261115.js'
import {daloopaFixture,createDaloopaReplay,withDaloopaReplayClock,assertDaloopaCurrentJobs} from './fixtures/replayNativeData20261115.js'

const fixture=daloopaFixture(),profile=JSON.parse(readFileSync(new URL('./reviewedNativeData20261115.json',import.meta.url),'utf8'))
const readDaloopaDetail=(value,id,row=profile.listing.reqDetailsBOList.find(item=>item.reqId===id))=>readCurrentDaloopaDetail(value,id,row)
const sha=value=>createHash('sha256').update(value).digest('hex'),authority=error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false
const packet=label=>fixture.packets.find(row=>row.label===label&&row.phase==='opening')
const page=(label,change=bytes=>bytes)=>{const item=packet(label),bytes=Buffer.from(change(Buffer.from(item.bodyBase64,'base64')));return{label,url:item.requestedUrl,method:item.method,requestBody:item.requestBody,bytes,text:bytes.toString('utf8')}}
const alterJSON=(bytes,change)=>{const value=JSON.parse(bytes);change(value);return Buffer.from(JSON.stringify(value))}
const diagnostic=(id,ts,uuid)=>{const role=profile.roles.find(row=>row.id===id),[a,b,c]=role.rawEnvelopeLiteralRunsBase64.map(value=>Buffer.from(value,'base64'));return Buffer.concat([a,Buffer.from(String(ts)),b,Buffer.isBuffer(uuid)?uuid:Buffer.from(uuid),c])}

for(const route of ['run','factory','registered'])test('genuine14Response replay preserves two complete India native records via '+route,async()=>{
 const io=createDaloopaReplay(),options={fetchImpl:io.fetchImpl}
 const jobs=await withDaloopaReplayClock(()=>route==='run'?script.run(options):route==='factory'?script.createDaloopaScraper(options).run():createCatalogScraper(getScraperCatalog().find(row=>row.source==='daloopa')).run(options))
 assertDaloopaCurrentJobs(jobs,fixture);assert.equal(io.calls.length,14)
 assert(io.calls.every(call=>call.init.credentials==='omit'&&call.init.redirect==='manual'&&!call.init.headers.Cookie&&!call.init.headers.Authorization))
 for(const call of io.calls.filter(call=>call.init.method==='POST')){assert.equal(call.init.headers['Content-Type'],'application/json;charset=UTF-8');assert.equal(call.init.body,call.packet.requestBody);assert.equal(call.init.headers['X-Requested-With'],undefined)}
})
test('fixture preserves all separate physical provenance and original stopped3 without a combined14closure claim',()=>{
 assert.equal(fixture.packets.length,14);assert.equal(fixture.historicalFailedThreeReadPhase.packets.length,3);assert.equal(fixture.physicalCombinedFourteenReadCaptureProved,false);assert.equal(fixture.currentRegisteredProductionCaptureProved,false);assert.equal(fixture.totalReplayOriginalBytes,283808)
 assert.equal(fixture.separateOriginalCaptureGroups.length,5)
 for(const item of [...fixture.packets,...fixture.historicalFailedThreeReadPhase.packets]){const raw=Buffer.from(item.bodyBase64,'base64');assert.equal(sha(raw),item.sha256);assert.equal(raw.length,item.bytes);assert.equal(item.provenance.physicalOriginalObserved,true)}
 assert.match(fixture.historicalFailedThreeReadPhase.originalError.message,/closing changed/)
})
test('static carriers preserve whole board/config/11orderedrows while projecting no cookie credential into jobs',async()=>{
 assert.equal(readDaloopaBoard(page('board')).scope.includes('Static carrier'),true)
 const client=readDaloopaClient(page('client')),all=JSON.parse(page('client').text);assert.equal(client.clientId,1165);assert.equal(client.clientName,'Daloopa Private Limited');assert.equal(Object.hasOwn(client,'cookie'),false);assert.equal(JSON.stringify(profile).includes(all.cookie),false)
 assert.deepEqual(readDaloopaListing(page('listing')),profile.listing)
 const io=createDaloopaReplay(),jobs=await withDaloopaReplayClock(()=>script.run({fetchImpl:io.fetchImpl}));assert.equal(JSON.stringify(jobs).includes(all.cookie),false)
})
for(const id of [46,45])test(id+': complete original4data/13role rich/plain fields remain separate and undated',()=>{
 const data=readDaloopaDetail(page('detail-'+id),id),role=profile.roles.find(row=>row.id===id)
 assert.deepEqual(data.data,role.data);assert.equal(data.rawDataSHA256,role.dataSHA256);assert.equal(data.nativeVersion,role.nativeVersion)
 assert.equal(readDaloopaLanding(page('landing-'+id),id).sourceRoleDataQualified,false)
 assert.equal(role.listRow.countryCode,null);assert.equal(role.listRow.educationList,null);assert.deepEqual(data.record.educationList,['SSC (Secondary School Certificate)'])
})
test('only typed outer ts/UUID vary and remain preserved while every other original byte stays exact',()=>{
 for(const ts of [0,15000]){const bytes=diagnostic(46,ts,'00000000-0000-4000-8000-000000000001'),value=readDaloopaDetail(page('detail-46',()=>bytes),46);assert.equal(value.envelope.ts,ts);assert.equal(value.envelope.requestId,'00000000-0000-4000-8000-000000000001');assert.deepEqual(value.data,profile.roles[0].data)}
 const old=fixture.historicalFailedThreeReadPhase.packets[0],bytes=Buffer.from(old.bodyBase64,'base64');assert.deepEqual(readDaloopaDetail({...page('detail-46'),bytes,text:bytes.toString('utf8')},46).data,profile.roles[0].data)
})

for(const key of Object.keys(profile.roles[0].data))test('full data field never excluded: '+key,()=>assert.throws(()=>readDaloopaDetail(page('detail-46',bytes=>alterJSON(bytes,value=>value.data[key]=value.data[key]===null?'changed':null)),46),authority))
for(const key of Object.keys(profile.roles[0].data.reqDetailsBO))test('full role field never excluded: '+key,()=>assert.throws(()=>readDaloopaDetail(page('detail-46',bytes=>alterJSON(bytes,value=>value.data.reqDetailsBO[key]=value.data.reqDetailsBO[key]===null?'changed':null)),46),authority))
for(const key of Object.keys(profile.listing.reqDetailsBOList[0]))test('complete original list row field never excluded: '+key,()=>assert.throws(()=>readDaloopaListing(page('listing',bytes=>alterJSON(bytes,value=>value.reqDetailsBOList[0][key]=value.reqDetailsBOList[0][key]===null?'changed':null))),authority))

for(const value of ['-1','15001','01','1.0','1e1','"1"','true','null','', '9'.repeat(40)])test('raw outer ts rejects noncanonical/out-of-bound representation '+JSON.stringify(value),()=>{
 assert.throws(()=>readDaloopaDetail(page('detail-46',()=>diagnostic(46,value,'00000000-0000-4000-8000-000000000001')),46),authority)
})
for(const value of ['00000000-0000-1000-8000-000000000001','00000000-0000-4000-7000-000000000001','0000000A-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000000','00000000-0000-4000-8000-0000000000000','00000000-0000-4000-8000-00000000000±','00000000-0000-4000-8000-0000000000\\u0061'])test('raw requestId rejects noncanonical UUID '+JSON.stringify(value),()=>{
 assert.throws(()=>readDaloopaDetail(page('detail-46',()=>diagnostic(46,5,value)),46),authority)
})
for(const[name,change]of [
 ['status',value=>value.status=201],['overbound opaque metadata',value=>value.v='v'.repeat(257)],['unknown key',value=>value.extra=1],['data missing',value=>delete value.data],['country rich criteria',value=>value.data.reqDetailsBO.jdDisplay=value.data.reqDetailsBO.jdDisplay.replace('India','United States')],['explicit closure',value=>value.data.reqDetailsBO.jdDisplay+='This position is closed.'],['unknown style',value=>value.data.reqDetailsBO.jdDisplay='<style>*{display:none}</style>'+value.data.reqDetailsBO.jdDisplay],['publication',value=>value.data.reqDetailsBO.datePosted='2026-11-15'],
])test('complete envelope rejects '+name,()=>assert.throws(()=>readDaloopaDetail(page('detail-46',bytes=>alterJSON(bytes,change)),46),authority))
for(const[name,change]of [['BOM',bytes=>Buffer.concat([Buffer.from([239,187,191]),bytes])],['duplicate data',bytes=>Buffer.from(bytes.toString().replace('"data":','"data":null,"data":'))],['reordered fields',bytes=>{const value=JSON.parse(bytes);return Buffer.from(JSON.stringify({data:value.data,status:value.status,ts:value.ts,requestId:value.requestId,v:value.v}))}]])test('complete raw byte contract rejects '+name,()=>assert.throws(()=>readDaloopaDetail(page('detail-46',change),46),authority))

for(const[name,change]of [['duplicate',value=>value.reqDetailsBOList[1]=value.reqDetailsBOList[0]],['new row',value=>value.reqDetailsBOList.push(value.reqDetailsBOList[0])],['unknown continuation',value=>value.next='?page=2'],['inferred city country',value=>value.reqDetailsBOList[0].countryCode='IN'],['active status',value=>value.reqDetailsBOList[0].statusId=0]])test('entire ordered native list rejects '+name,()=>assert.throws(()=>readDaloopaListing(page('listing',bytes=>alterJSON(bytes,change))),authority))
for(const[label,read]of [['board',readDaloopaBoard],['landing-46',value=>readDaloopaLanding(value,46)]])for(const[name,change]of [
 ['hidden owner',text=>text.replace('<app-root','<app-root hidden')],['inert ancestor',text=>text.replace('<body','<body inert')],['template owner',text=>text.replace('<app-root','<template><app-root').replace('</app-root>','</app-root></template>')],['duplicate owner',text=>text.replace('</body>','<app-root></app-root></body>')],['unknown CSS',text=>text.replace('</head>','<style>app-root{display:none}</style></head>')],['unknown executable event',text=>text.replace('<app-root','<app-root onclick="hidden=true"')],['changed program',text=>text.replace('</head>','<script>window.unknown=1</script></head>')],['extra byte',text=>text+' '],
])test(label+' whole carrier rejects '+name,()=>assert.throws(()=>read(page(label,bytes=>{const text=bytes.toString(),changed=change(text);assert.notEqual(changed,text,'mutation must reach original carrier');return Buffer.from(changed)})),authority))

for(let position=1;position<=14;position++)test('registered route rejects changed physical original '+position+' with no partial output or extra request',async()=>{
 const io=createDaloopaReplay((bytes,_packet,count)=>count===position?Buffer.concat([bytes,Buffer.from(' ')]):bytes),provider=getScraperCatalog().find(row=>row.source==='daloopa')
 await withDaloopaReplayClock(()=>assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),authority));assert.equal(io.calls.length,({3:10,4:11,6:13})[position]??position)
})

const response=(label,{bytes=Buffer.from(packet(label).bodyBase64,'base64'),status=200,mime=packet(label).headers['content-type'],url=packet(label).finalUrl,redirected=false,body}={})=>{
 const value=new Response(body??bytes,{status,headers:{'content-type':mime}});Object.defineProperties(value,{url:{value:url},redirected:{value:redirected}});return value
}
const readBoard=async(options={})=>{const reader=createDaloopaOriginalReader(options);try{return await reader.read('board')}finally{reader.close()}}
for(const[name,options]of [['plain response',{fetchImpl:async()=>({status:200,url:profile.nativeBoardUrl})}],['foreign final URL',{fetchImpl:async()=>response('board',{url:'https://example.org/'})}],['followed redirect',{fetchImpl:async()=>response('board',{redirected:true})}],['charset latin1',{fetchImpl:async()=>response('board',{mime:'text/html;charset=iso-8859-1'})}],['unbalanced charset',{fetchImpl:async()=>response('board',{mime:'text/html;charset="UTF-8'})}],['unknown MIME parameter',{fetchImpl:async()=>response('board',{mime:'text/html;charset=UTF-8;profile=native'})}],['BOM',{fetchImpl:async()=>response('board',{bytes:Buffer.concat([Buffer.from([239,187,191]),Buffer.from(packet('board').bodyBase64,'base64')])})}],['invalid UTF8',{fetchImpl:async()=>response('board',{bytes:Buffer.from([195,40])})}],['HTTP403',{fetchImpl:async()=>response('board',{status:403})}]])test('original Response boundary rejects '+name,async()=>{
 await assert.rejects(readBoard(options),error=>authority(error)||name==='foreign final URL'&&/final URL/.test(error.message))
})
test('original quoted UTF8 MIME is accepted without MIME or byte normalization',async()=>{
 const page=await readBoard({fetchImpl:async()=>response('board',{mime:'text/html; charset="UTF-8"'})});assert.equal(sha(page.bytes),packet('board').sha256)
})

for(const option of [{fetchText:()=>{}},{fetchJson:()=>{}},{fetchPage:()=>{}},{maxJobs:1},{maxRequests:17},{maxEntityBytes:4000001},{maxTotalBytes:24000001},{requestTimeoutMs:15001},{sourceTimeoutMs:45001},{timeoutMs:45001},{sourceTimeoutMs:0},{timeoutMs:NaN},{timeoutMs:1,sourceTimeoutMs:45001},{maxDiscoveryReads:7},{maxDetails:9}])test('invalid/body-only/truncation or upward option fails before I/O: '+Object.keys(option).join('/'),()=>{
 let calls=0;assert.throws(()=>createDaloopaOriginalReader({...option,fetchImpl:()=>{calls++}}),authority);assert.equal(calls,0)
})
test('all caller ceilings only reduce including both source aliases in either order',()=>{
 for(const options of [{sourceTimeoutMs:40000,timeoutMs:1000},{timeoutMs:40000,sourceTimeoutMs:1000}]){const reader=createDaloopaOriginalReader(options);try{assert.equal(reader.limits.sourceTimeoutMs,1000)}finally{reader.close()}}
 const reader=createDaloopaOriginalReader({maxRequests:14,maxPages:6,maxDiscoveryReads:5,maxDetails:7,maxEntityBytes:1000000,maxTotalBytes:10000000,requestTimeoutMs:1000});try{assert.deepEqual(reader.limits,{sourceTimeoutMs:45000,requestTimeoutMs:1000,maxRequests:14,maxPages:5,maxDetails:7,maxEntityBytes:1000000,maxTotalBytes:10000000})}finally{reader.close()}
})
for(const options of [{maxRequests:13},{maxPages:5},{maxDetails:7},{maxTotalBytes:2097152}])test('insufficient closure budget holds before any physical read: '+JSON.stringify(options),async()=>{
 let calls=0;await assert.rejects(script.run({...options,fetchImpl:async()=>{calls++;throw Error('Must not read')}}),authority);assert.equal(calls,0)
})
test('opaque pre-abort and in-flight caller reason are preserved by identity',async()=>{
 const reason=Symbol('native opaque caller'),before=new AbortController();before.abort(reason);let calls=0
 await assert.rejects(script.run({signal:before.signal,fetchImpl:()=>{calls++}}),value=>value===reason);assert.equal(calls,0)
 const active=new AbortController(),promise=script.run({signal:active.signal,fetchImpl:()=>{calls++;active.abort(reason);return new Promise(()=>{})}})
 await assert.rejects(promise,value=>value===reason);assert.equal(calls,1)
})
test('reader reserves its serial in-flight slot before pacing/header waits',async()=>{
 let calls=0;const controller=new AbortController(),reason={opaque:'stop'},reader=createDaloopaOriginalReader({signal:controller.signal,fetchImpl:()=>{calls++;return new Promise(()=>{})}})
 try{const pending=reader.read('board');await assert.rejects(reader.read('board'),authority);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);controller.abort(reason);await assert.rejects(pending,value=>value===reason)}finally{reader.close()}
})
test('request header deadline bounds ignored signals and cancels a late original body',async()=>{
 let finish,canceled=0;const reader=createDaloopaOriginalReader({requestTimeoutMs:20,fetchImpl:()=>new Promise(resolve=>{finish=resolve})})
 try{await assert.rejects(reader.read('board'),error=>error.name==='TimeoutError');assert.equal(reader.stats().requests,1);const late=response('board',{body:new ReadableStream({cancel(){canceled++}})});finish(late);await new Promise(resolve=>setTimeout(resolve,15));assert.equal(canceled,1)}finally{reader.close()}
})
test('request body deadline bounds an unresponsive reader, releases/cancels without late rejection leaks',async()=>{
 let cancelCalls=0,releaseCalls=0;const reader=createDaloopaOriginalReader({requestTimeoutMs:20,fetchImpl:async()=>({status:200,url:profile.nativeBoardUrl,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancelCalls++},releaseLock(){releaseCalls++}})}})})
 try{await assert.rejects(reader.read('board'),error=>error.name==='TimeoutError');await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelCalls,1);assert.equal(releaseCalls,1)}finally{reader.close()}
})
test('known403 status survives a body timeout',async()=>{
 await assert.rejects(readBoard({requestTimeoutMs:20,fetchImpl:async()=>response('board',{status:403,body:new ReadableStream({pull(){return new Promise(()=>{})}})})}),error=>error.status===403&&error.responseBodyError?.name==='TimeoutError')
})
test('source half-phase deadline keeps full closing reservation even when request signal is ignored',async()=>{
 let calls=0;const started=performance.now();await assert.rejects(script.run({sourceTimeoutMs:70,requestTimeoutMs:60,fetchImpl:()=>{calls++;return new Promise(()=>{})}}),error=>error.name==='TimeoutError');assert.equal(calls,1);assert(performance.now()-started<500)
})
test('500ms per-origin pacing rechecks monotonic time after every early timer wake',async()=>{
 const realTimer=globalThis.setTimeout,descriptor=Object.getOwnPropertyDescriptor(performance,'now'),starts=[];let now=0,wakes=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>now})
 globalThis.setTimeout=(fn,ms,...args)=>ms>=1&&ms<=500?realTimer(()=>{now+=Math.min(100,ms);wakes++;fn(...args)},0):realTimer(fn,ms,...args)
 const io=createDaloopaReplay((_bytes,_packet,_count,call)=>{starts.push({time:now,origin:new URL(call.url).origin})}),reader=createDaloopaOriginalReader({fetchImpl:io.fetchImpl})
 try{await reader.read('board');await reader.read('client');await reader.read('listing');assert.equal(starts.length,3);assert(starts[2].time-starts[1].time>=500);assert(wakes>=5)}finally{reader.close();globalThis.setTimeout=realTimer;if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now}
})
test('intrinsic byteLength/buffer/offset defeat shadow getters while retaining original valid subarray bytes',async()=>{
 const bytes=Buffer.from(packet('board').bodyBase64,'base64'),backing=Buffer.concat([Buffer.from('prefix'),bytes,Buffer.from('suffix')]),view=new Uint8Array(backing.buffer,backing.byteOffset+6,bytes.length)
 for(const name of ['byteLength','byteOffset','buffer'])Object.defineProperty(view,name,{get(){throw Error('Shadow getter must never run')}})
 let read=0;const value=await readBoard({fetchImpl:async()=>({status:200,url:profile.nativeBoardUrl,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({async read(){return read++?{done:true}:{done:false,value:view}},cancel(){},releaseLock(){}})}})})
 assert(value.bytes.equals(bytes))
})
test('intrinsic oversize chunk accounting enforces HTML and reduced original entity limits during reads',async()=>{
 for(const maxEntityBytes of [4000000,100]){let canceled=0;const size=maxEntityBytes===100?101:524289,view=new Uint8Array(size);Object.defineProperty(view,'byteLength',{value:0})
  await assert.rejects(readBoard({maxEntityBytes,fetchImpl:async()=>({status:200,url:profile.nativeBoardUrl,redirected:false,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({async read(){return{done:false,value:view}},cancel(){canceled++},releaseLock(){}})}})}),authority);assert.equal(canceled,1)
 }
})
test('JSON131072 ceiling and aggregate closing bytes remain enforced while original request counters are exact',async()=>{
 const io=createDaloopaReplay((bytes,item)=>item.label==='client'?Buffer.alloc(131073):bytes),reader=createDaloopaOriginalReader({fetchImpl:io.fetchImpl})
 try{await reader.read('board');await assert.rejects(reader.read('client'),authority);assert.equal(io.calls.length,2);assert.equal(reader.stats().requests,2)}finally{reader.close()}
 const constrained=createDaloopaOriginalReader({maxTotalBytes:2097152+100,fetchImpl:async()=>response('board')});try{await assert.rejects(constrained.read('board'),authority);assert.equal(constrained.stats().requests,1)}finally{constrained.close()}
})
test('closing phase requires all seven full opening responses and reserves exact reads/bytes through completion',async()=>{
 const io=createDaloopaReplay(),reader=createDaloopaOriginalReader({fetchImpl:io.fetchImpl})
 try{assert.throws(()=>reader.beginClosing(),authority);await withDaloopaReplayClock(async()=>{for(const [index,descriptor]of profile.readDescriptors.entries()){await reader.read(descriptor.label);if(index===2)reader.bindCandidates([46,45])}assert.equal(reader.stats().reservedClosingReads,7);assert.equal(reader.stats().reservedClosingBytes,2097152);reader.beginClosing();for(const descriptor of profile.readDescriptors)await reader.read(descriptor.label)});const stats=reader.stats();assert.equal(stats.requests,14);assert.equal(stats.discoveryReads,6);assert.equal(stats.detailReads,8);assert.equal(stats.reservedClosingReads,0);assert.equal(stats.reservedClosingBytes,0);await assert.rejects(reader.read('board'),authority)}finally{reader.close()}
})

test('review correction: downstream selected description preserves exact rich prefix and full plain/structured native criteria',async()=>{
 const io=createDaloopaReplay(),jobs=await withDaloopaReplayClock(()=>script.run({fetchImpl:io.fetchImpl}))
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
 for(const job of jobs){const selected=getSourceDescription(job);assert(selected.startsWith(job.nativeSourceRecord.jdDisplay));assert(selected.includes('SSC (Secondary School Certificate)'));assert(selected.includes('"expMin":5.0')&&selected.includes('"expMax":8.0'));assert(selected.includes(escape(job.nativeListingDescription)));assert(selected.includes(escape(job.nativeRawRoleRecordJSON)));assert.equal(job.minimumQualification,'SSC (Secondary School Certificate)');assert.equal(job.sourceExperienceRequired,'Native listing expMin: 5; expMax: 8. Native detail expMin: 5; expMax: 8. Original rich criteria retained separately.')}
})

async function finalClockProbe(kind){
 const clone=globalThis.structuredClone,timer=globalThis.setTimeout,clock=Object.getOwnPropertyDescriptor(performance,'now');let now=0,deadline,advanced=false,early=false,rescheduled=false
 let physicalCalls=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>now})
 globalThis.setTimeout=(callback,ms,...args)=>{if(ms===45000)deadline=()=>callback(...args);if(early&&ms===1)rescheduled=true;return ms>=1&&ms<=500?timer(()=>{now=kind==='early-source-timer'&&physicalCalls===12?44498:now+Math.ceil(ms);callback(...args)},0):timer(callback,ms,...args)}
 globalThis.structuredClone=value=>{const result=clone(value);if(kind==='final-processing'&&Array.isArray(value)&&value.length===14&&value.every(row=>row?.bodyComplete)){now=45001;advanced=true}return result}
 const io=createDaloopaReplay((_bytes,_packet,position)=>{physicalCalls=position;if(kind==='early-source-timer'&&position===14){assert.equal(now,44498,'Advance during pre-request pacing so the final15s request is still in bounds');now=44999;assert.equal(typeof deadline,'function');early=true;deadline()}})
 let jobs,error
 try{jobs=await script.run({fetchImpl:io.fetchImpl})}catch(caught){error=caught}finally{globalThis.structuredClone=clone;globalThis.setTimeout=timer;if(clock)Object.defineProperty(performance,'now',clock);else delete performance.now}
 return{jobs,error,now,advanced,early,rescheduled,calls:io.calls.length}
}
test('review correction: final synchronous serialization cannot return jobs after45000ms',async()=>{
 const result=await finalClockProbe('final-processing');assert.equal(result.advanced,true);assert.equal(result.calls,14);assert.equal(result.jobs,undefined);assert.equal(result.error?.name,'TimeoutError')
})
test('review correction:44999ms source timer wake reserves remaining1ms instead of rejecting final original',async()=>{
 const result=await finalClockProbe('early-source-timer');assert.equal(result.early,true);assert.equal(result.calls,14);assert.equal(result.error,undefined);assert.equal(result.now,44999);assert.equal(result.rescheduled,true);assert.deepEqual(result.jobs.map(row=>row.jobId),['46','45'])
})

// Explicitly synthetic supported-data mutations of complete saved originals.
// No mutated carrier is described as a physical HTTP observation.
function futureScenario(change){
 const packets=structuredClone(fixture.packets),listing=JSON.parse(Buffer.from(packets[2].bodyBase64,'base64')),details=[JSON.parse(Buffer.from(packets[3].bodyBase64,'base64')),JSON.parse(Buffer.from(packets[5].bodyBase64,'base64'))]
 change(listing,details)
 details.sort((left,right)=>listing.reqDetailsBOList.findIndex(row=>row.reqId===left.data.reqDetailsBO.reqId)-listing.reqDetailsBOList.findIndex(row=>row.reqId===right.data.reqDetailsBO.reqId))
 const replace=(index,value)=>{const bytes=Buffer.from(JSON.stringify(value));packets[index]={...packets[index],bodyBase64:bytes.toString('base64'),bytes:bytes.length,sha256:sha(bytes),syntheticCounterfactual:true}}
 replace(2,listing);replace(9,listing)
 for(let index=0;index<2;index++){
  const detail=details[index],id=detail.data.reqDetailsBO.reqId,context={...profile.roles[index].exactNativeContext,reqId:id},url=profile.roles[index].publicUrl.split('?')[0]+'?src%3Dcareers%26p%3D'+Buffer.from(JSON.stringify(context)).toString('base64')
  for(const position of [3+index*2,10+index*2]){replace(position,detail);packets[position]={...packets[position],label:'detail-'+id,requestBody:JSON.stringify({source:'careers',id:'',code:'',reqId:id})}}
  for(const position of [4+index*2,11+index*2])packets[position]={...packets[position],label:'landing-'+id,requestedUrl:url,finalUrl:url,syntheticCounterfactual:true}
 }
 return packets
}
function futureReplay(packets,change){
 const calls=[]
 return{calls,async fetchImpl(url,init={}){
  const item=packets[calls.length];assert(item,'No extra source request');assert.equal(String(url),item.requestedUrl);assert.equal(init.method,item.method);assert.equal(init.body,item.requestBody??undefined)
  const bytes=Buffer.from(item.bodyBase64,'base64');calls.push({url:String(url),init,item});const value=await change?.(bytes,item,calls.length)
  const response=new Response(value??bytes,{status:item.status,headers:item.headers});Object.defineProperty(response,'url',{value:item.finalUrl});return response
 }}
}
test('durability baseline RED: supported title criteria and opaque metadata updates are live data',async()=>{
 const packets=futureScenario((listing,details)=>{for(const[index,detail]of details.entries()){const row=listing.reqDetailsBOList.find(row=>row.reqId===detail.data.reqDetailsBO.reqId);row.reqTitle+=' synthetic current';row.jdDisplay+='\nAdditional complete native criterion.';detail.data.reqDetailsBO.reqTitle=row.reqTitle;detail.data.reqDetailsBO.jdDisplay+='<p>Additional complete native criterion.</p>';detail.v='opaque native metadata '+index}}),io=futureReplay(packets)
 const jobs=await withDaloopaReplayClock(()=>script.run({fetchImpl:io.fetchImpl}));assert.equal(io.calls.length,14);assert(jobs.every(job=>job.title.endsWith('synthetic current')));assert(jobs.every(job=>job.sourceDescription.includes('Additional complete native criterion.')))
})
test('durability baseline RED: coherent new IDs and changed ordered inventory count use the actual current emitter',async()=>{
 const packets=futureScenario((listing,details)=>{for(const[index,detail]of details.entries()){const row=listing.reqDetailsBOList.find(row=>row.reqId===detail.data.reqDetailsBO.reqId);row.reqId=146-index;detail.data.reqDetailsBO.reqId=row.reqId}const extra=structuredClone(listing.reqDetailsBOList[0]);extra.reqId=999;listing.reqDetailsBOList=[...listing.reqDetailsBOList.reverse(),extra]}),io=futureReplay(packets)
 const jobs=await withDaloopaReplayClock(()=>script.run({fetchImpl:io.fetchImpl}));assert.deepEqual(jobs.map(job=>job.jobId),['145','146']);assert.equal(jobs.nativeCollectionEvidence.nativeObservedRecordCount,12);assert.equal(io.calls.length,14)
})
test('durability baseline RED: even two observed opaque v values cannot switch inside one current role pair',async()=>{
 const io=createDaloopaReplay((bytes,item,count)=>count===11?alterJSON(bytes,value=>value.v=profile.roles[1].nativeVersion):bytes)
 await withDaloopaReplayClock(()=>assert.rejects(script.run({fetchImpl:io.fetchImpl}),authority));assert.equal(io.calls.length,11)
})
test('durability baseline RED: new bounded opaque v metadata is independent of example values and role ID',async()=>{
 const io=createDaloopaReplay((bytes,item)=>item.label.startsWith('detail-')?Buffer.from(bytes.toString().replace(/"v":"[^"]+"/, '"v":"opaque returned metadata"')):bytes)
 const jobs=await withDaloopaReplayClock(()=>script.run({fetchImpl:io.fetchImpl}));assert.equal(io.calls.length,14);assert(jobs.every(job=>job.nativeOriginalEnvelope.v==='opaque returned metadata'))
})
test('durability baseline RED: complete44listing and4data survive standard description projection',async()=>{
 const io=createDaloopaReplay(),jobs=await withDaloopaReplayClock(()=>script.run({fetchImpl:io.fetchImpl}))
 for(const job of jobs){const value=getSourceDescription(job);assert(value.includes('Original native listing record (all 44 fields)'));assert(value.includes('Original native detail data (all four fields)'));assert(value.includes('&quot;')===false);assert(value.includes('"careerStream":"Engineering"'));assert(value.includes('"ctcBandLowEnd":0.0'));assert(value.includes('"activeApplicationCount":'))}
})

test('durability: full44/4/13 original tokens survive strict Job serialization after native sidecars disappear',async()=>{
 const {default:Job}=await import('../../src/models/Job.js'),io=createDaloopaReplay(),jobs=await withDaloopaReplayClock(()=>script.run({fetchImpl:io.fetchImpl}));assertDaloopaCurrentJobs(jobs,fixture)
 for(const job of jobs){const persisted=new Job(job).toObject();assert.equal(Object.hasOwn(persisted,'nativeListingRecord'),false);assert.equal(getSourceDescription(persisted),job.sourceDescription);assert(persisted.sourceDescription.includes('"expMin":5.0'));assert(persisted.sourceDescription.includes('"ctcBandLowEnd":0.0'));assert(persisted.sourceDescription.includes('"careerStream":"Engineering"'));assert(persisted.sourceDescription.startsWith(job.nativeSourceRecord.jdDisplay))}
})
test('durability: labelled supported education/list-criteria/count changes persist without availability or salary inference',async()=>{
 const packets=futureScenario((listing,details)=>{for(const detail of details){const row=listing.reqDetailsBOList.find(row=>row.reqId===detail.data.reqDetailsBO.reqId);Object.assign(row,{careerStream:'Synthetic Research',jobLevel:'Synthetic Level',expMin:7.5,expMax:11,ctcBandLowEnd:150.25,ctcBandHighEnd:250.75});Object.assign(detail.data,{activeApplicationCount:2000,maxActiveApplication:1});Object.assign(detail.data.reqDetailsBO,{educationList:['Synthetic Diploma'],expMin:5,expMax:9});detail.v='opaque metadata ±'}}),io=futureReplay(packets)
 const jobs=await withDaloopaReplayClock(()=>script.run({fetchImpl:io.fetchImpl}));assert.equal(io.calls.length,14)
 for(const job of jobs){assert.equal(job.minimumQualification,'Synthetic Diploma');assert.equal(job.nativeDetailData.activeApplicationCount,2000);assert.equal(job.nativeDetailData.maxActiveApplication,1);assert.equal(job.nativeOriginalEnvelope.v,'opaque metadata ±');assert.match(getSourceDescription(job),/"careerStream":"Synthetic Research"/);assert.match(job.sourceDescription,/"ctcBandLowEnd":150\.25/);assert.match(job.sourceDescription,/"activeApplicationCount":2000/);assert.equal(job.sourceExperienceRequired,'Native listing expMin: 7.5; expMax: 11. Native detail expMin: 5; expMax: 9. Original rich criteria retained separately.');assert.equal(job.applyUrl,null);assert.equal(job.postingDate,null)}
})
for(const [name,change]of [
 ['v raw token despite identical decoded value',bytes=>Buffer.from(bytes.toString().replace('"v":"d17','"v":"\\u006417'))],
 ['complete independent count data',bytes=>alterJSON(bytes,value=>value.data.activeApplicationCount++)],
 ['complete native criterion data',bytes=>alterJSON(bytes,value=>value.data.reqDetailsBO.jdDisplay+='<p>New closing criterion.</p>')],
])test('durability: current full closing rejects '+name,async()=>{
 const io=createDaloopaReplay((bytes,_item,count)=>count===11?change(bytes):bytes)
 await withDaloopaReplayClock(()=>assert.rejects(script.run({fetchImpl:io.fetchImpl}),authority));assert.equal(io.calls.length,11)
})
for(const text of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','{"x":1e999}','{"x":1}false','{"x":"\\ud800"}','['.repeat(34)+'0'+']'.repeat(34)])test('durability: strict full JSON rejects '+text.slice(0,35),()=>assert.throws(()=>readDaloopaStrictJSON(text),authority))
for(const[name,change]of [
 ['populated custom controls',value=>value.reqDetailsBOList[0].customFields={screening:'unreviewed'}],
 ['question null-to-array model',value=>value.reqDetailsBOList[0].questionList=[]],
 ['extra location-country field',value=>value.reqDetailsBOList[0].locationList[0].country='India'],
 ['extra worksite cardinality',value=>value.reqDetailsBOList[0].locationList.push(value.reqDetailsBOList[0].locationList[0])],
 ['new boolean control branch',value=>value.reqDetailsBOList[0].fresher=true],
])test('durability: unsupported nested whole listing models stay held: '+name,()=>assert.throws(()=>readDaloopaListing(page('listing',bytes=>alterJSON(bytes,change))),authority))
for(const[name,change]of [
 ['negative count',value=>value.data.activeApplicationCount=-1],['fractional count',value=>value.data.maxActiveApplication=1.5],['unknown detail field',value=>value.data.reqDetailsBO.country='India'],['object education',value=>value.data.reqDetailsBO.educationList=[{degree:'unreviewed'}]],['additional rich country',value=>value.data.reqDetailsBO.jdDisplay+='<p><strong>Work Location:</strong> United States</p>'],['root-text rich closure',value=>value.data.reqDetailsBO.jdDisplay+='This role has been filled.'],['BR rich closure',value=>value.data.reqDetailsBO.jdDisplay+='<p>This role<br />has been filled.</p>'],['entity rich closure',value=>value.data.reqDetailsBO.jdDisplay+='<p>The position&nbsp;is closed.</p>'],
])test('durability: full detail typed-country/control/availability rejects '+name,()=>assert.throws(()=>readDaloopaDetail(page('detail-46',bytes=>alterJSON(bytes,change)),46),authority))
test('durability: Remote/city/currency never supplies missing current role-owned country',async()=>{
 const io=createDaloopaReplay((bytes,item)=>item.label==='listing'?alterJSON(bytes,value=>{for(const row of value.reqDetailsBOList)row.jdDisplay=row.jdDisplay.replace('Location: India (Remote)','Location: Remote')}):bytes)
 await withDaloopaReplayClock(()=>assert.rejects(script.run({fetchImpl:io.fetchImpl}),error=>authority(error)&&/Fewer than two/.test(error.message)));assert.equal(io.calls.length,3)
})

for(const[name,change,expectedReads]of [
 ['literal HTML in plain listing',listing=>listing.reqDetailsBOList.find(row=>row.reqId===46).jdDisplay+='\n<p>Additional Location: United States</p>',3],
 ['entity-escaped HTML in plain listing',listing=>listing.reqDetailsBOList.find(row=>row.reqId===46).jdDisplay+='\n&lt;p&gt;Additional Location: United States&lt;/p&gt;',3],
 ['literal HTML in plain education',(_listing,details)=>details[0].data.reqDetailsBO.educationList=['<p hidden>Additional mandatory professional license.</p>'],4],
 ['entity-escaped HTML in plain education',(_listing,details)=>details[0].data.reqDetailsBO.educationList=['&lt;p hidden&gt;Additional mandatory professional license.&lt;/p&gt;'],4],
])test('plain-domain correction: paired synthetic '+name+' is held by the actual registered route',async()=>{
 const io=futureReplay(futureScenario(change)),provider=getScraperCatalog().find(row=>row.source==='daloopa');let jobs,error
 try{jobs=await withDaloopaReplayClock(()=>createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}))}catch(failure){error=failure}
 assert.equal(error?.code,'DALOOPA_NATIVE_DATA_GAP',JSON.stringify({name,acceptedJobs:jobs?.map(row=>({id:row.jobId,country:row.country,complete:row.sourceDetailComplete})),actualPhysicalReads:io.calls.length}))
 assert(authority(error));assert.equal(io.calls.length,expectedReads)
})
