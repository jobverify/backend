import assert from 'node:assert/strict'
import test from 'node:test'
import {createEnerparcEnergyScraper,run} from './script.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {fixture,packet,response,replay,BOARD,CORPORATE,COMMON,DETAIL_CLIENT,ROLE,changeDetailBinding,changeHiddenCarrier} from './test-data/replay20261114.js'
import {createEnerparcOriginalReader} from './currentNative.js'
function assertCurrent(jobs,requests){
 assert.equal(jobs.length,1,'The current own native full criteria pair must be acquired')
 const job=jobs[0]
 assert.equal(job.jobId,fixture.expectedRole.id);assert.equal(job.title,fixture.expectedRole.Posting_Title)
 assert.equal(job.country,'India');assert.equal(job.sourceDescription,fixture.expectedRole.Job_Description)
 assert.deepEqual(job.sourceNativeDetailRecord,fixture.expectedRole)
 assert.deepEqual(job.sourceNativeClosingDetailRecord,fixture.expectedRole)
 assert.equal(job.postingDate,'2026-05-18');assert.equal(job.nativeFirstEverPublicationUnverified,true)
 assert.equal(job.experienceRequired,'4-5 years');assert.match(job.sourceDescription,/5–8 years/)
 assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceClosingReconciled,true)
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(job.currentCSSCoverage,false);assert.equal(job.activationVerified,false)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,25)
 assert.equal(jobs.nativeCollectionEvidence.unhydratedRecordCount,24)
 assert.equal(jobs.nativeCollectionEvidence.reader.requests,8)
 assert.equal(jobs.nativeCollectionEvidence.reader.discoveryPages,6)
 assert.equal(jobs.nativeCollectionEvidence.reader.detailReads,2)
 assert.equal(jobs.nativeCollectionEvidence.currentCorporateBindingVerified,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(requests.length,8);assert.equal(requests.some(row=>row.url===CORPORATE||row.legacy),false)
 for(const request of requests){assert.equal(request.init.method,'GET');assert.equal(request.init.redirect,'manual');assert.equal(request.init.credentials,'omit');assert.equal(request.init.headers['User-Agent'],'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36')}
 assert.equal(requests.some(row=>/\/(?:apply|candidateportal|webform)(?:\/|\?)/i.test(new URL(row.url).pathname)),false)
}
test('factory acquires genuine complete current Enerparc native criteria with all24unhydrated holds',async()=>{const transport=replay();assertCurrent(await createEnerparcEnergyScraper().run(transport.options),transport.requests)})
test('exported run uses the same genuine full Response current native collector',async()=>{const transport=replay();assertCurrent(await run(transport.options),transport.requests)})
test('registered catalog route acquires current native criteria with no generic extra recovery reads',async()=>{const transport=replay(),provider=getScraperCatalog().find(row=>row.source==='enerparcenergy');assertCurrent(await createCatalogScraper(provider).run(transport.options),transport.requests)})

for(const [entry,execute]of [['factory',options=>createEnerparcEnergyScraper().run(options)],['registered',options=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='enerparcenergy')).run(options)]])for(const target of [BOARD,COMMON,ROLE,DETAIL_CLIENT])for(const authority of ['redirected','charset'])test(entry+' rejects changed original '+authority+' authority for '+(target===BOARD?'listing':target===COMMON?'common-client':target===ROLE?'detail':'detail-client'),async()=>{
 const transport=replay(({url,row})=>url!==target?{}:authority==='redirected'?{redirected:true}:{headers:{...row.headers,'content-type':(target===COMMON||target===DETAIL_CLIENT?'text/javascript':'text/html')+';charset=windows-1252'}})
 await assert.rejects(execute(transport.options),authority==='redirected'?/redirect authority/:/MIME changed/)
 assert.ok(transport.requests.length<=4)
})

test('a full Response without original redirect authority rejects before qualification',async()=>{
 const transport=replay(({url})=>url===BOARD?{redirected:undefined}:{})
 await assert.rejects(run(transport.options),/redirect authority/)
 assert.equal(transport.requests.length,1)
})

for(const redirected of [undefined,true])test('original-byte fetchPage adapter requires explicit unredirected authority '+redirected,async()=>{
 const transport=replay();delete transport.options.fetchImpl
 const original=transport.options.fetchPage
 transport.options.fetchPage=async(...args)=>{const page=await original(...args);if(redirected===undefined)delete page.redirected;else page.redirected=redirected;return page}
 await assert.rejects(run(transport.options),/redirect authority/)
 assert.equal(transport.requests.length,1)
})

test('future native Date_Opened rejects at its first complete detail before redundant closing work',async()=>{
 const transport=replay(({url,bytes})=>url===ROLE?{bytes:changeDetailBinding(bytes,'jobs',jobs=>{jobs[0].Date_Opened='2026-12-01'})}:{})
 await assert.rejects(run(transport.options),/Date_Opened is in the future/)
 assert.equal(transport.requests.length,3)
})

test('a failing observation clock closes its source timer before any request',async t=>{
 const scheduled=new Set(),schedule=setTimeout,clear=clearTimeout,reason={clock:'unavailable'}
 t.mock.method(globalThis,'setTimeout',(...args)=>{const timer=schedule(...args);scheduled.add(timer);return timer})
 t.mock.method(globalThis,'clearTimeout',timer=>{scheduled.delete(timer);return clear(timer)})
 try{
  await assert.rejects(run({now:()=>{throw reason},fetchImpl:()=>assert.fail('Clock failure must precede I/O')}),error=>error===reason)
  assert.equal(scheduled.size,0)
 }finally{for(const timer of scheduled)clear(timer);t.mock.restoreAll()}
})

const textChange=(bytes,from,to)=>{const text=bytes.toString('utf8');assert.ok(text.includes(from),'Mutation must target genuine original text');return Buffer.from(text.replace(from,to))}
const lastTextChange=(bytes,from,to)=>{const text=bytes.toString('utf8'),index=text.lastIndexOf(from);assert.ok(index>=0,'Mutation must target the genuine final document boundary');return Buffer.from(text.slice(0,index)+to+text.slice(index+from.length))}
const jobChange=(bytes,mutate)=>changeDetailBinding(bytes,'jobs',jobs=>{mutate(jobs[0]);return jobs})
const negativeCases=[
 ['HTML BOM is not silently stripped',BOARD,()=>({bytes:Buffer.concat([Buffer.from([239,187,191]),Buffer.from(packet('opening-native').bodyBase64,'base64')])}),/BOM/],
 ['invalid original HTML UTF8 is rejected',BOARD,({bytes})=>({bytes:Buffer.concat([bytes.subarray(0,100),Buffer.from([255]),bytes.subarray(101)])}),/UTF8/],
 ['native HTTP403 is retained as failure rather than certified zero',BOARD,()=>({status:403}),error=>error.status===403],
 ['original native final URL is required',BOARD,()=>({url:'https://unrelated.example/jobs'}),/final URL changed/],
 ['original HTML MIME is required',BOARD,()=>({headers:{'content-type':'text/plain'}}),/MIME changed/],
 ['full job bodies at HTTP404 cannot qualify a role',ROLE,()=>({status:404}),error=>error.status===404],
 ['current internal native employer cannot be remapped to PeoplePlus',BOARD,({bytes})=>({bytes:changeHiddenCarrier(bytes,'meta',meta=>{meta.org_info.company_name='PeoplePlus'})}),/employer|model/],
 ['detail employer metadata must remain exactly native and internal',ROLE,({bytes})=>({bytes:changeDetailBinding(bytes,'meta',meta=>{meta.org_info.type='agency'})}),/metadata/],
 ['selected literal country cannot be replaced with a city',BOARD,({bytes})=>({bytes:changeHiddenCarrier(bytes,'jobs',jobs=>{jobs[0].Country='Bengaluru'})}),/country/],
 ['selected absent country cannot be inferred from native Indian city',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Country=''})}),/Country|country/],
 ['foreign detail country conflicts with India listing',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Country='United States'})}),/Country/],
 ['native ID mismatch rejects the whole role',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.id='74895000002746053'})}),/id mismatch/],
 ['native title mismatch rejects the whole role',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Posting_Title='Unrelated Role';row.Job_Opening_Name='Unrelated Role'})}),/mismatch/],
 ['native title is not a full description',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Job_Description=row.Posting_Title})}),/criteria unavailable/],
 ['missing native full description is rejected',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{delete row.Job_Description})}),/schema/],
 ['unknown additional structured criteria cannot be dropped',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Additional_Requirements='Must hold a professional engineering licence.'})}),/schema/],
 ['native external attachment criteria requires separate review',ROLE,({bytes})=>({bytes:changeDetailBinding(bytes,'public_attachments_info',()=>[{id:'new-criteria',download_url:'https://example.invalid/requirements.pdf'}])}),/metadata|criteria/],
 ['native extra EEO criteria cannot be silently discarded',ROLE,({bytes})=>({bytes:changeDetailBinding(bytes,'meta',meta=>{meta.eeo_disclaimer='Additional requirements are supplied here.'})}),/metadata|criteria/],
 ['new native field-render layout cannot be ignored',ROLE,({bytes})=>({bytes:changeDetailBinding(bytes,'moduleMeta',modules=>{modules[0].layouts[0].sections[0].fields.push({api_name:'Extra_Requirements',data_type:'richtext',id:'74895000009999999'})})}),/metadata/],
 ['impossible native Date_Opened is rejected',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Date_Opened='2026-02-31'})}),/Date_Opened/],
 ['unpublished native selected row does not qualify',BOARD,({bytes})=>({bytes:changeHiddenCarrier(bytes,'jobs',jobs=>{jobs[0].Publish=false})}),/publication/],
 ['locked selected native row does not qualify',BOARD,({bytes})=>({bytes:changeHiddenCarrier(bytes,'jobs',jobs=>{jobs[0].Is_Locked=true})}),/publication/],
 ['native retention flag is compared instead of treated as publication',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Keep_on_Career_Site=true})}),/Keep_on_Career_Site/],
 ['hidden full criteria rejects even with all original content retained',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Job_Description='<div hidden>'+row.Job_Description+'</div>'})}),/hidden|incomplete/],
 ['native criteria class changes cannot hide original criteria',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Job_Description=row.Job_Description.replace('class="font"','class="disN"')})}),/presentation changed/],
 ['explicit closed role text rejects the native record',ROLE,({bytes})=>({bytes:jobChange(bytes,row=>{row.Job_Description=row.Job_Description.replace('opportunities within a global renewable energy leader.','opportunities within a global renewable energy leader. This position is closed.')})}),/closed role notice/],
 ['hidden native mount cannot grant criteria authority',ROLE,({bytes})=>({bytes:textChange(bytes,'id="career-website-main"','hidden id="career-website-main"')}),/document|owner|hidden/],
 ['hidden duplicate owner cannot be ignored',ROLE,({bytes})=>({bytes:textChange(bytes,'<div id="career-website-main"','<div hidden id="career-website-main"></div><div id="career-website-main"')}),/document|owner/],
 ['template owner ambiguity cannot be ignored',ROLE,({bytes})=>({bytes:textChange(bytes,'<div id="career-website-main"','<template id="career-website-main"></template><div id="career-website-main"')}),/document|owner/],
 ['external-CSS hidden mount class is outside the reviewed input envelope',ROLE,({bytes})=>({bytes:textChange(bytes,'id="career-website-main"','class="disN" id="career-website-main"')}),/document|owner/],
 ['document CSS cannot alter the mount visibility unnoticed',ROLE,({bytes})=>({bytes:lastTextChange(bytes,'</head>','<style>#career-website-main{display:none!important}</style></head>')}),/document|presentation/],
 ['inactive duplicate listing carrier cannot become authority',BOARD,({bytes})=>({bytes:textChange(bytes,'<input','<input hidden id="jobs" value="[]"><input')}),/document|owner/],
 ['additional native carrier program is never executed',ROLE,({bytes})=>({bytes:lastTextChange(bytes,'</body>','<script>globalThis.__enerparcUnreviewedProgram=true;</script></body>')}),/document|program|owner/],
]
for(const [name,target,mutate,expected]of negativeCases)test(name,async()=>{
 const transport=replay(context=>context.url===target?mutate(context):{})
 await assert.rejects(run(transport.options),expected)
 assert.equal(globalThis.__enerparcUnreviewedProgram,undefined)
 assert.ok(transport.requests.length<=3)
})
for(const url of [COMMON,DETAIL_CLIENT])for(const mutation of ['BOM','invalidUTF8','append'])test('actual Response '+mutation+' changes reject pinned original client '+(url===COMMON?'common':'detail'),async()=>{
 const transport=replay(context=>context.url!==url?{}:{bytes:mutation==='BOM'?Buffer.concat([Buffer.from([239,187,191]),context.bytes]):mutation==='invalidUTF8'?Buffer.concat([Buffer.from([255]),context.bytes.subarray(1)]):Buffer.concat([context.bytes,Buffer.from('\n/* changed native program */')])})
 await assert.rejects(run(transport.options),/critical client original entity changed/)
})
test('whole closing inventory order remains significant',async()=>{
 const transport=replay(({url,count,bytes})=>url===BOARD&&count===2?{bytes:changeHiddenCarrier(bytes,'jobs',jobs=>jobs.reverse())}:{})
 await assert.rejects(run(transport.options),/ordered listing\/model changed at closing/)
 assert.equal(transport.requests.length,5)
})
test('closing inventory row loss cannot certify a smaller complete inventory',async()=>{
 const transport=replay(({url,count,bytes})=>url===BOARD&&count===2?{bytes:changeHiddenCarrier(bytes,'jobs',jobs=>jobs.slice(1))}:{})
 await assert.rejects(run(transport.options),/listing count changed/)
})
test('closing full native criteria change is held even when each carrier is complete',async()=>{
 const transport=replay(({url,count,bytes})=>url===ROLE&&count===2?{bytes:jobChange(bytes,row=>{row.Job_Description=row.Job_Description.replace('opportunities within a global renewable energy leader.','opportunities within a global renewable energy leader. Follow written review procedures.')})}:{})
 await assert.rejects(run(transport.options),/full detail changed at closing/)
 assert.equal(transport.requests.length,8)
})
for(const url of [COMMON,DETAIL_CLIENT])test('closing original client entity is revalidated '+(url===COMMON?'common':'detail'),async()=>{
 const transport=replay(context=>context.url===url&&context.count===2?{bytes:Buffer.concat([context.bytes,Buffer.from(' ')])}:{})
 await assert.rejects(run(transport.options),/critical client original entity changed/)
 assert.equal(transport.requests.length,url===COMMON?6:8)
})
test('ordinary full-criteria copy may change within the exact same reviewed element inputs',async()=>{
 const transport=replay(({url,bytes})=>url===ROLE?{bytes:jobChange(bytes,row=>{row.Job_Description=row.Job_Description.replace('opportunities within a global renewable energy leader.','opportunities within a global renewable energy leader. Follow written engineering review procedures.')})}:{})
 const jobs=await run(transport.options)
 assert.equal(jobs.length,1);assert.match(jobs[0].sourceDescription,/written engineering review procedures/)
 assert.equal(jobs[0].sourceNativeDetailRecord.Job_Description,jobs[0].sourceDescription)
})
test('unknown geography in an unhydrated native row remains counted and never promoted',async()=>{
 const transport=replay(({url,bytes})=>url===BOARD?{bytes:changeHiddenCarrier(bytes,'jobs',jobs=>{jobs[1].Country=''})}:{})
 const jobs=await run(transport.options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,fixture.expectedRole.id)
 assert.equal(audit.observedRecordCount,25);assert.equal(audit.unknownCountryRecordCount,1)
 assert.equal(audit.unhydratedRecordCount,24);assert.equal(audit.unhydratedRecords[0].Country,'')
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})
test('authoritative full original-byte fetchPage receipts remain supported',async()=>{
 const transport=replay();delete transport.options.fetchImpl
 const jobs=await run(transport.options)
 assert.equal(jobs.length,1);assert.equal(transport.requests.length,8)
 assert.deepEqual(jobs[0].sourceNativeDetailRecord,fixture.expectedRole)
})
for(const key of ['fetchText','fetchJson'])test(key+' body-only input rejects before I/O',async()=>{
 let calls=0;await assert.rejects(run({[key]:()=>{calls++;throw Error('Must not run')}}),/Original HTTP metadata/);assert.equal(calls,0)
})
for(const [key,value]of Object.entries({sourceTimeoutMs:45001,requestTimeoutMs:15001,maxRequests:17,maxPages:7,maxDetails:9,maxEntityBytes:4000001,maxTotalBytes:24000001}))test('original '+key+' ceiling cannot be enlarged',async()=>{
 let calls=0;await assert.rejects(run({[key]:value,fetchImpl:()=>{calls++;throw Error('Must not run')}}),/ceiling/);assert.equal(calls,0)
})
for(const [key,value]of Object.entries({maxRequests:7,maxPages:5,maxDetails:1}))test('insufficient '+key+' fails before acquisition rather than emitting zero',async()=>{
 let calls=0;await assert.rejects(run({[key]:value,fetchImpl:()=>{calls++;throw Error('Must not run')}}),/Insufficient native budget/);assert.equal(calls,0)
})
test('closing byte room is reserved before any unsafe partial acquisition',async()=>{
 let calls=0;await assert.rejects(run({maxTotalBytes:1000000,fetchImpl:()=>{calls++;throw Error('Must not run')}}),/reserved closing byte budget/);assert.equal(calls,0)
})
test('original4MB entity ceiling stops and cancels a real Response stream',async()=>{
 let delivered=0,cancelled=0,calls=0
 const original=new Response(new ReadableStream({pull(controller){if(delivered>=8000000){controller.close();return}const length=Math.min(100000,8000000-delivered);delivered+=length;controller.enqueue(new Uint8Array(length))},cancel(){cancelled++}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(original,'url',{value:BOARD})
 await assert.rejects(run({fetchImpl:async()=>{calls++;return original}}),/entity byte budget/)
 assert.equal(calls,1);assert.equal(cancelled,1);assert.ok(delivered<=4200000)
})
test('a poisoned Uint8Array byteLength cannot bypass the original4MB entity limit',async()=>{
 const chunk=new Uint8Array(4000001);Object.defineProperty(chunk,'byteLength',{value:0})
 const original=new Response(new ReadableStream({start(controller){controller.enqueue(chunk);controller.close()}}),{headers:{'content-type':'text/html'}});Object.defineProperty(original,'url',{value:BOARD})
 await assert.rejects(run({fetchImpl:async()=>original}),/entity byte budget/)
})
test('aggregate24MB stream ceiling counts all original response bodies',async()=>{
 let calls=0,cancelled=0
 const reader=createEnerparcOriginalReader({fetchImpl:async url=>{calls++;const original=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(3500000));controller.close()},cancel(){cancelled++}}),{headers:{'content-type':'text/html;charset=UTF-8'}});Object.defineProperty(original,'url',{value:url});return original}})
 try{for(let index=0;index<6;index++)await reader.read(BOARD);await assert.rejects(reader.read(ROLE),/Aggregate original native byte budget/);assert.equal(calls,7);assert.ok(reader.stats().decodedBytes>24000000)}finally{reader.close()}
 assert.ok(cancelled<=1)
})
for(const [kind,elapsed]of [['request',15001],['source',45001]])test('original '+kind+' deadline rejects elapsed real-reader work',async t=>{
 let clock=0,calls=0;t.mock.method(performance,'now',()=>clock)
 try{await assert.rejects(run({fetchImpl:async()=>{calls++;clock=elapsed;return response(packet('opening-native'))}}),error=>error.name==='TimeoutError'&&(kind!=='source'||/source deadline/.test(error.message)));assert.equal(calls,1)}finally{t.mock.restoreAll()}
})
test('pre-aborted opaque caller reason propagates before I/O',async()=>{
 const controller=new AbortController(),reason={opaque:'caller'};controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,fetchImpl:()=>assert.fail('Unexpected I/O')}),error=>error===reason)
})
test('opaque caller abort cancels a late genuine Response and schedules no later work',async()=>{
 const controller=new AbortController(),reason={opaque:'stop'},gate=Promise.withResolvers();let calls=0,cancelled
 const pending=run({signal:controller.signal,fetchImpl:async()=>{calls++;await gate.promise;const original=new Response(new ReadableStream({cancel(value){cancelled=value}}),{headers:{'content-type':'text/html'}});Object.defineProperty(original,'url',{value:BOARD});return original}})
 await new Promise(setImmediate);assert.equal(calls,1);controller.abort(reason);await assert.rejects(pending,error=>error===reason)
 gate.resolve();await new Promise(setImmediate);await new Promise(setImmediate)
 assert.equal(calls,1);assert.equal(cancelled,reason)
})

export {fixture,packet,response,replay,BOARD,CORPORATE,COMMON,DETAIL_CLIENT,ROLE}
