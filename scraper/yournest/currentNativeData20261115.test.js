import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import * as script from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {createYourNestOriginalReader,readYourNestPair,readYourNestBoard,readYourNestListing} from './nativeData20261115.js'
import {createYourNestReplay,withYourNestReplayClock,assertYourNestCurrentJobs,yourNestFixture} from './fixtures/replayNativeData20261115.js'

const fixture=yourNestFixture(),profile=JSON.parse(readFileSync(new URL('./reviewedNativeData20261115.json',import.meta.url),'utf8'))
const NOW='2026-11-14T23:24:49.822Z',sha=value=>createHash('sha256').update(value).digest('hex')
const authority=error=>error.code==='YOURNEST_COVERAGE_GAP'&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false
const packet=label=>fixture.packets.find(row=>row.label===label&&row.phase==='opening')
const page=(label,change=bytes=>bytes)=>{const item=packet(label),bytes=Buffer.from(change(Buffer.from(item.bodyBase64,'base64')));return{url:item.requestedUrl,bytes,text:bytes.toString('utf8')}}

for(const entry of ['run','factory','registered'])test('genuine20fullResponses preserve sole own425748 criteria via '+entry,async()=>{
 const io=createYourNestReplay(),options={fetchImpl:io.fetchImpl,now:()=>NOW}
 const jobs=await withYourNestReplayClock(()=>entry==='run'?script.run(options):entry==='factory'?script.createYourNestScraper(options).run():createCatalogScraper(getScraperCatalog().find(row=>row.source==='yournest')).run(options))
 assertYourNestCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,20)
 assert(io.calls.every(call=>!call.url.startsWith('https://yournest.in/')&&!call.url.includes('apply_now')&&call.init.credentials==='omit'&&call.init.redirect==='manual'))
})
test('fixture retains all20 complete genuine originals with actual10closingpairs and no corporate substitution',()=>{
 assert.equal(fixture.packets.length,20);assert.equal(fixture.originalTotalDecodedBytes,439094);assert.equal(fixture.currentRegisteredProductionCaptureProved,false)
 for(const item of fixture.packets){const bytes=Buffer.from(item.bodyBase64,'base64');assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256);assert.equal(item.provenance.physicalOriginalObserved,true);assert.equal(item.status,200)}
 for(let i=0;i<10;i++)assert.equal(fixture.packets[i].sha256,fixture.packets[i+10].sha256)
})
test('whole board/list data pins retain exact4orderedrecords',()=>{
 assert.deepEqual(readYourNestBoard(page('board')).ssr,profile.boardFullSSR)
 assert.deepEqual(readYourNestListing(page('listing')),profile.listing)
})
for(const id of [425748,376083,374870,43774])test(id+': all35fields/fullSSR/schema/criteria/questions and country/dates remain original data',()=>{
 const row=profile.listing.results.find(row=>row.id===id),result=readYourNestPair(page('api-'+id),page('html-'+id),row,NOW)
 assert.deepEqual(result.api,profile.roles.find(role=>role.id===id).APIRecord);assert.deepEqual(result.api,result.ssr.props.pageProps.jobDetails)
 assert.equal(result.api.description,result.schema.description);assert.equal(result.api.country,'India');assert.equal(result.schema.jobLocation.address.addressCountry,'India')
 assert.equal(result.rawApplyHref.includes('company_uuid=undefined'),true)
})
test('generic portfolio pool is excluded independently before its native expiry',()=>{
 const row=profile.listing.results.find(row=>row.id===43774),result=readYourNestPair(page('api-43774'),page('html-43774'),row,'2023-06-01T00:00:00Z')
 assert.equal(result.exclusionReason,'generic-talent-pool');assert.equal(result.ownEmployerRole,false)
})
test('native first publication is not refreshed and a future snapshot clock holds',()=>{
 const row=profile.listing.results[0]
 assert.throws(()=>readYourNestPair(page('api-425748'),page('html-425748'),row,'2026-11-01T00:00:00Z'),authority)
 const expired=readYourNestPair(page('api-425748'),page('html-425748'),row,'2027-01-06T00:00:00Z')
 assert.equal(expired.exclusionReason,'native-expired');assert.equal(expired.posted.raw,'2026-11-06T16:48:45.086766+05:30')
})

const alterJSON=(bytes,change)=>{const value=JSON.parse(bytes);change(value);return Buffer.from(JSON.stringify(value))}
for(const key of Object.keys(profile.roles[0].APIRecord))test('every original API field stays finite: '+key,()=>{
 const changed=page('api-425748',bytes=>alterJSON(bytes,value=>{const item=value[key];value[key]=typeof item==='string'?item+' changed':typeof item==='boolean'?!item:typeof item==='number'?item+1:Array.isArray(item)?[...item,'unknown']:item===null?'unknown':{unknown:true}}))
 assert.throws(()=>readYourNestPair(changed,page('html-425748'),profile.listing.results[0],NOW),authority)
})
const htmlNegatives=[
 ['hidden body',text=>text.replace(/<body\b/i,'<body hidden')],
 ['inert body',text=>text.replace(/<body\b/i,'<body inert')],
 ['template data owners',text=>text.replace('<head>','<head><template>').replace('</head>','</template></head>')],
 ['changed CSS class',text=>text.replace(/<body\b/i,'<body class="disN"')],
 ['hidden inline style',text=>text.replace(/<body\b/i,'<body style="display:none"')],
 ['body event',text=>text.replace(/<body\b/i,'<body onload="hide()"')],
 ['unknown stylesheet',text=>text.replace('</head>','<link rel="stylesheet" href="/changed.css"></head>')],
 ['unknown style',text=>text.replace('</head>','<style>p{display:none}</style></head>')],
 ['unknown executable',text=>text.replace('</head>','<script>hide()</script></head>')],
 ['changed script declaration',text=>text.replace('<script ','<script data-unknown="true" ')],
 ['missing SSR owner',text=>text.replace('id="__NEXT_DATA__"','id="changed"')],
 ['duplicate SSR carrier',text=>text.replace('</body>','<script id="__NEXT_DATA__" type="application/json">{}</script></body>')],
 ['additional hidden JobPosting',text=>text.replace('</body>','<template><script type="application/ld+json">{"@type":"JobPosting"}</script></template></body>')],
 ['additional visible JobPosting',text=>text.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting"}</script></head>')],
 ['new date microdata',text=>text.replace('</body>','<time itemprop="datePosted">2026-11-14</time></body>')],
 ['base authority',text=>text.replace('</head>','<base href="https://foreign.example/"></head>')],
 ['refresh authority',text=>text.replace('</head>','<meta http-equiv="refresh" content="0;url=/other"></head>')],
 ['guessed corrected application tenant',text=>text.replaceAll('company_uuid=undefined','company_uuid=987EE7EF32')],
 ['guessed corrected application header',text=>text.replaceAll('isHeaderVisible=undefined','isHeaderVisible=true')],
 ['extra required qualification',text=>text.replace('</body>','<p>Mandatory additional certification.</p></body>')],
 ['explicit closed notice',text=>text.replace('</body>','<p>This position is closed. We are no longer accepting applications.</p></body>')],
 ['outside one-byte whitespace',text=>text+' '],
]
for(const[label,change]of htmlNegatives)test('whole original public carrier rejects '+label,()=>{
 const original=page('html-425748'),text=change(original.text);assert.equal(text!==original.text,true,'Mutation changes actual original')
 assert.throws(()=>readYourNestPair(page('api-425748'),{...original,text,bytes:Buffer.from(text)},profile.listing.results[0],NOW),authority)
})
const schemaNegatives=[
 ['foreign country',value=>value.jobLocation.address.addressCountry='United States'],
 ['missing country',value=>delete value.applicantLocationRequirements],
 ['unknown legal employer',value=>value.hiringOrganization.name='Portfolio Company'],
 ['unknown legal property',value=>value.hiringOrganization.legalName='Invented Legal Entity'],
 ['changed employer website',value=>value.hiringOrganization.sameAs='https://other.example/'],
 ['changed native ID',value=>value.identifier.value=999],
 ['changed title',value=>value.title+=' changed'],
 ['changed publication',value=>value.datePosted='2026-11-14T00:00:00.000000+05:30'],
 ['changed expiry',value=>value.validThrough='2027-12-01T00:00:00.000000+05:30'],
 ['partial criteria',value=>value.description=value.description.slice(0,500)],
 ['new criteria',value=>value.description+='<p>Unreviewed qualification</p>'],
 ['new nested carrier',value=>value['@graph']=[{'@type':'JobPosting'}]],
]
for(const[label,change]of schemaNegatives)test('complete JobPosting rejects '+label,()=>{
 const original=page('html-425748'),text=original.text.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const value=JSON.parse(raw);change(value);return start+JSON.stringify(value)+end})
 assert.equal(text!==original.text,true);assert.throws(()=>readYourNestPair(page('api-425748'),{...original,text,bytes:Buffer.from(text)},profile.listing.results[0],NOW),authority)
})
const listingNegatives=[
 ['count drift',value=>value.count=5],['new continuation',value=>value.next=LIST_URL+'2'],['previous cycle',value=>value.previous=LIST_URL],
 ['changed order',value=>value.results.reverse()],['duplicate row',value=>value.results[1]=value.results[0]],['new row',value=>value.results.push(value.results[0])],
 ['missing row',value=>value.results.pop()],['foreign country',value=>value.results[0].country='United States'],['new ID',value=>value.results[0].id=999],
 ['unknown field',value=>value.hidden=true],['unknown country metadata',value=>value.results[0].countryCode='IN'],
]
for(const[label,change]of listingNegatives)test('full native listing rejects '+label,()=>assert.throws(()=>readYourNestListing(page('listing',bytes=>alterJSON(bytes,change))),authority))
test('native carrier cannot pair genuine bytes with changed independent text',()=>{
 const original=page('board');assert.throws(()=>readYourNestBoard({...original,text:original.text+' '}),authority)
})
test('original native Unicode quotation marks remain lossless validUTF8 data',()=>{
 const original=page('api-425748'),question=JSON.parse(original.text).job_screening_questions[1].question
 assert(question.startsWith('\u201c')&&question.endsWith('\u201d'))
 const result=readYourNestPair(original,page('html-425748'),profile.listing.results[0],NOW)
 assert.equal(result.api.job_screening_questions[1].question,question)
 assert(Buffer.from(original.text).equals(original.bytes))
})
for(let position=0;position<20;position++)test('registered source holds without partial output on original observation'+position+' corruption',async()=>{
 const io=createYourNestReplay((bytes,_packet,_count,_call,calls)=>calls.length===position+1?Buffer.concat([bytes,Buffer.from(' ')]):undefined)
 await withYourNestReplayClock(()=>assert.rejects(createCatalogScraper(getScraperCatalog().find(row=>row.source==='yournest')).run({fetchImpl:io.fetchImpl,now:()=>NOW}),authority))
 assert.equal(io.calls.length,position+1)
})
test('consistent API/SSR/schema closed criteria changes cannot redefine the reviewed original profile',async()=>{
 const io=createYourNestReplay((bytes,item)=>{
  if(item.label==='api-425748')return alterJSON(bytes,value=>value.description+='<p>This position is closed.</p>')
  if(item.label==='html-425748')return Buffer.from(bytes.toString().replaceAll('Engagement details','This position is closed. Engagement details'))
 })
 await withYourNestReplayClock(()=>assert.rejects(script.run({fetchImpl:io.fetchImpl,now:()=>NOW,profile:{allowChanges:true}}),authority));assert.equal(io.calls.length,3)
})

const BOARD_URL=profile.boardUrl,LIST_URL=profile.listUrl
const originalResponse=(body,url=BOARD_URL,type='text/html; charset=utf-8',status=200)=>{const response=new Response(body,{status,headers:{'content-type':type}});Object.defineProperty(response,'url',{value:url,configurable:true});return response}
test('original reader rejects unavailable bounded streams as typed native gaps without text fallback',async()=>{
 let textCalls=0
 const reader=createYourNestOriginalReader({fetchImpl:async()=>({status:200,url:BOARD_URL,redirected:false,headers:new Headers({'content-type':'text/html'}),body:undefined,text(){textCalls++;return 'unbounded'}})})
 try{await assert.rejects(reader.read(BOARD_URL),authority);assert.equal(textCalls,0)}finally{reader.close()}
})
for(const options of [
 {fetchText:()=>''},{fetchJson:()=>({})},{fetchPage:()=>({})},{maxJobs:1},{timeoutMs:30001},{sourceTimeoutMs:30001},{timeoutMs:1000,sourceTimeoutMs:30001},
 {requestTimeoutMs:15001},{maxRequests:21},{maxEntityBytes:4000001},{maxTotalBytes:24000001},{timeoutMs:0},{sourceTimeoutMs:-1},{timeoutMs:1.5},{maxRequests:'20'},
])test('unsupported callback/truncation or increased/invalid budget rejects before I/O '+JSON.stringify(options),()=>{
 let calls=0;assert.throws(()=>createYourNestOriginalReader({...options,fetchImpl:async()=>{calls++}}),authority);assert.equal(calls,0)
})
test('both deadline aliases honor the stricter caller reduction in either order',()=>{
 for(const options of [{timeoutMs:30000,sourceTimeoutMs:1000},{timeoutMs:1000,sourceTimeoutMs:30000}]){const reader=createYourNestOriginalReader(options);assert.equal(reader.limits.sourceTimeoutMs,1000);reader.close()}
})
test('closing reservations reject an insufficient caller read/byte budget before fetch',async()=>{
 for(const options of [{maxRequests:10},{maxTotalBytes:3276800}]){let calls=0;const reader=createYourNestOriginalReader({...options,fetchImpl:async()=>{calls++}});try{await assert.rejects(reader.read(BOARD_URL),authority);assert.equal(calls,0)}finally{reader.close()}}
})
test('source truncation cannot start closing before all ten complete opening originals',()=>{
 const reader=createYourNestOriginalReader();try{assert.throws(()=>reader.beginClosing(),authority)}finally{reader.close()}
})
test('reader reserves inFlight before awaited pacing and preserves opaque abort',async()=>{
 const controller=new AbortController(),reason={opaque:true};let calls=0,ready
 const started=new Promise(resolve=>{ready=resolve}),reader=createYourNestOriginalReader({signal:controller.signal,fetchImpl:async()=>{calls++;ready();return new Promise(()=>{})}})
 const first=reader.read(BOARD_URL)
 try{await assert.rejects(reader.read(BOARD_URL),authority);await assert.rejects(reader.read(BOARD_URL),authority);await started;assert.equal(calls,1);controller.abort(reason);await assert.rejects(first,error=>error===reason)}finally{reader.close()}
})
test('pre-aborted caller reason is unchanged and starts no source work',async()=>{
 const controller=new AbortController(),reason={before:true};controller.abort(reason);let calls=0
 await assert.rejects(script.run({signal:controller.signal,fetchImpl:async()=>{calls++}}),error=>error===reason);assert.equal(calls,0)
})
test('an unknown URL never starts a public request',async()=>{
 let calls=0;const reader=createYourNestOriginalReader({fetchImpl:async()=>{calls++}})
 try{await assert.rejects(reader.read('https://api.pyjamahr.com/api/career/jobs/999/'),authority);assert.equal(calls,0)}finally{reader.close()}
})
test('opening elapsed time preserves the full closing half before any read starts',async()=>{
 const own=Object.getOwnPropertyDescriptor(performance,'now'),real=performance.now.bind(performance);let offset=0,calls=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>real()+offset})
 const reader=createYourNestOriginalReader({fetchImpl:async()=>{calls++}})
 try{offset=15001;await assert.rejects(reader.read(BOARD_URL),authority);assert.equal(calls,0)}finally{reader.close();if(own)Object.defineProperty(performance,'now',own);else delete performance.now}
})
for(const type of ['text/html; charset="utf-8','text/html; charset=utf-16','text/html; charset=utf-8;foo=bar','application/json'])test('HTML original MIME rejects '+type,async()=>{
 const reader=createYourNestOriginalReader({fetchImpl:async()=>originalResponse(Buffer.from(packet('board').bodyBase64,'base64'),BOARD_URL,type)})
 try{await assert.rejects(reader.read(BOARD_URL),authority)}finally{reader.close()}
})
for(const[label,bytes]of [['BOM',Buffer.concat([Buffer.from([239,187,191]),Buffer.from('x')])],['invalidUTF8',Buffer.from([255,254])]])test('original representation rejects '+label,async()=>{
 const reader=createYourNestOriginalReader({fetchImpl:async()=>originalResponse(bytes)})
 try{await assert.rejects(reader.read(BOARD_URL),authority)}finally{reader.close()}
})
test('original status403 survives a bounded denial-body timeout',async()=>{
 let cancelled=false
 const reader=createYourNestOriginalReader({requestTimeoutMs:20,fetchImpl:async()=>originalResponse(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}),BOARD_URL,'text/html',403)})
 try{await assert.rejects(reader.read(BOARD_URL),error=>authority(error)&&error.status===403);assert.equal(cancelled,true)}finally{reader.close()}
})
for(const variant of ['foreignURL','redirected','redirect302'])test('native HTTP identity holds without following '+variant,async()=>{
 let calls=0;const reader=createYourNestOriginalReader({fetchImpl:async()=>{calls++;const response=originalResponse('unqualified',variant==='foreignURL'?'https://other.example/':BOARD_URL,'text/html',variant==='redirect302'?302:200);if(variant==='redirected')Object.defineProperty(response,'redirected',{value:true});return response}})
 try{await assert.rejects(reader.read(BOARD_URL),authority);assert.equal(calls,1)}finally{reader.close()}
})
for(const[url,type,size]of [[BOARD_URL,'text/html',524289],[LIST_URL,'application/json',131073]])test('per-kind stream ceiling cancels '+type,async()=>{
 let cancelled=false;const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(size))},cancel(){cancelled=true}})
 const reader=createYourNestOriginalReader({fetchImpl:async()=>originalResponse(body,url,type)})
 try{await assert.rejects(reader.read(url),authority);assert.equal(cancelled,true)}finally{reader.close()}
})
test('stricter entity and aggregate byte reductions cancel before excess bytes are retained',async()=>{
 for(const options of [{maxEntityBytes:10},{maxTotalBytes:3276810}]){let cancelled=false;const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(100))},cancel(){cancelled=true}}),reader=createYourNestOriginalReader({...options,fetchImpl:async()=>originalResponse(body)});try{await assert.rejects(reader.read(BOARD_URL),authority);assert.equal(cancelled,true)}finally{reader.close()}}
})
test('intrinsic stream accounting ignores shadow byteLength/offset/buffer getters',async()=>{
 const bytes=Buffer.from(packet('board').bodyBase64,'base64'),chunk=new Uint8Array(bytes);let getterCalls=0
 for(const name of ['byteLength','byteOffset','buffer'])Object.defineProperty(chunk,name,{get(){getterCalls++;return 0}})
 const reader=createYourNestOriginalReader({fetchImpl:async()=>originalResponse(new ReadableStream({start(controller){controller.enqueue(chunk);controller.close()}}))})
 try{const actual=await reader.read(BOARD_URL);assert(actual.bytes.equals(bytes));assert.equal(getterCalls,0)}finally{reader.close()}
})
test('post-timer origin pacing rechecks monotonic time after a premature timer',async()=>{
 const io=createYourNestReplay(),starts=[],timer=globalThis.setTimeout;let shortened=0
 const reader=createYourNestOriginalReader({fetchImpl:async(...args)=>{starts.push(performance.now());return io.fetchImpl(...args)}})
 try{await reader.read(BOARD_URL);globalThis.setTimeout=(fn,ms,...args)=>{if(ms>=400&&ms<=501&&shortened===0){shortened++;return timer(fn,0,...args)}return timer(fn,ms,...args)};await reader.read(BOARD_URL);assert.equal(shortened,1);assert(starts[1]-starts[0]>=495)}finally{globalThis.setTimeout=timer;reader.close()}
})
test('body abort cancels original stream and preserves exact caller reason',async()=>{
 const controller=new AbortController(),reason={duringBody:true};let ready,cancelled=false;const started=new Promise(resolve=>{ready=resolve})
 const reader=createYourNestOriginalReader({signal:controller.signal,fetchImpl:async()=>originalResponse(new ReadableStream({pull(){ready();return new Promise(()=>{})},cancel(){cancelled=true}}))})
 const pending=reader.read(BOARD_URL);try{await started;controller.abort(reason);await assert.rejects(pending,error=>error===reason);assert.equal(cancelled,true)}finally{reader.close()}
})
test('late headers are disposed after request deadline without another source read',async()=>{
 let finish,cancelled=false;const pendingResponse=new Promise(resolve=>{finish=resolve}),reader=createYourNestOriginalReader({requestTimeoutMs:10,fetchImpl:()=>pendingResponse})
 try{await assert.rejects(reader.read(BOARD_URL),error=>error.name==='TimeoutError');finish(originalResponse(new ReadableStream({cancel(){cancelled=true}})));await new Promise(resolve=>setTimeout(resolve,10));assert.equal(cancelled,true)}finally{reader.close()}
})
test('opaque abort on final twentieth observation prevents partial success or generic fallback',async()=>{
 const controller=new AbortController(),reason={final:true},io=createYourNestReplay((_bytes,_packet,_count,_call,calls)=>{if(calls.length===20)controller.abort(reason)})
 await withYourNestReplayClock(()=>assert.rejects(script.run({signal:controller.signal,fetchImpl:io.fetchImpl,now:()=>NOW}),error=>error===reason));assert.equal(io.calls.length,20)
})
test('source and request deadlines stay bounded even for a stalled anonymous header response',async()=>{
 const started=performance.now();await assert.rejects(script.run({sourceTimeoutMs:30,fetchImpl:async()=>new Promise(()=>{})}),error=>error.name==='TimeoutError');assert(performance.now()-started<1000)
})
test('expired current internship yields held unknown company coverage, never verified empty',async()=>{
 const io=createYourNestReplay(),jobs=await withYourNestReplayClock(()=>script.run({fetchImpl:io.fetchImpl,now:()=> '2027-01-06T00:00:00Z'}))
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
})
