import assert from 'node:assert/strict'
import test from 'node:test'
import {createSmartStreamTechnologiesScraper,run} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {createSmartStreamOriginalReader,readSmartStreamJSON} from './currentNative.js'
import {fixture,replay,ROLES,LISTING,CLIENT,ACCOUNT,detailURL,changeJSON,response,packet} from './test-data/replay20261114.js'

for(const [name,invoke]of [
 ['factory',options=>createSmartStreamTechnologiesScraper().run(options)],
 ['run',options=>run(options)],
 ['registered',options=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='smartstreamtechnologies')).run(options)],
])test('actual four complete native pairs survive the '+name+' emitter with14bounded reads',async()=>{
 const transport=replay(),jobs=await invoke(transport.options)
 assert.equal(jobs.length,4)
 assert.deepEqual(jobs.map(job=>job.requisitionId),ROLES)
 assert.deepEqual(transport.requests.map(row=>row.url),[ACCOUNT,CLIENT,LISTING,...ROLES.map(detailURL),ACCOUNT,CLIENT,LISTING,...ROLES.map(detailURL)])
 for(const [index,job]of jobs.entries()){
  const original=fixture.roles[index].original
  assert.deepEqual(job.sourceNativeDetailRecord,original)
  assert.equal(Object.keys(job.sourceNativeDetailRecord).length,23)
  assert.equal(job.sourceDescription,original.description+original.requirements+original.benefits)
  assert.equal(job.postingDate,original.published)
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceUrl,'https://apply.workable.com/smartstream/j/'+original.shortcode+'/')
  assert.equal(job.applyUrl,null);assert.equal(job.link,null);assert.equal(job.nativeApplicationURL,null)
  assert.equal(job.nativeApplicationActionVerified,false)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.currentCSSCoverage,false);assert.equal(job.activationVerified,false)
 }
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.advertisedNativeTotal,52);assert.equal(audit.observedRecordCount,10)
 assert.equal(audit.unseenAdvertisedCount,42);assert.equal(audit.unhydratedRecordCount,6)
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null)
 assert.equal(audit.reader.requests,14);assert.equal(audit.reader.discoveryPages,6);assert.equal(audit.reader.detailReads,8)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length,4)
})

for(const field of ['remote','isInternal'])test('unhydrated native '+field+' retains boolean authority',async()=>{
 const transport=replay(({url,bytes})=>url===LISTING?{bytes:changeJSON(bytes,page=>{page.results[2][field]='false'})}:{})
 await assert.rejects(run(transport.options),/field type/)
})

test('current data uses literal client landing navigation and keeps application action unknown',async()=>{
 const transport=replay(),provider=getScraperCatalog().find(row=>row.source==='smartstreamtechnologies')
 const jobs=await createCatalogScraper(provider).run(transport.options)
 for(const [index,job]of jobs.entries()){
  const original=fixture.roles[index].original,normalized=normalizeScrapedJob(job,provider)
  assert.equal(job.sourceUrl,'https://apply.workable.com/smartstream/j/'+original.shortcode+'/')
  assert.equal(normalized.applyUrl,job.sourceUrl)
  assert.equal(normalized.nativeApplicationURL,null)
  assert.equal(normalized.nativeApplicationActionVerified,false)
  assert.match(job.nativeDetailAPIProvenance,/\/api\/v2\//)
  assert.notEqual(job.sourceUrl,job.nativeDetailAPIProvenance)
 }
 assert.equal(jobs[0].nativePriorHeadObservation.canonicalURL,'https://apply.workable.com/smartstream/j/87B3E6ED0F')
 assert.notEqual(jobs[0].sourceUrl,jobs[0].nativePriorHeadObservation.canonicalURL)
 assert.ok(jobs.slice(1).every(job=>job.nativePriorHeadObservation===null))
})

test('all requests are the original read-only SDK contracts with no corporate or application reads',async()=>{
 const transport=replay();await run(transport.options)
 for(const {url,init}of transport.requests){
  assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  assert.match(init.headers['User-Agent'],/Chrome\/138/)
  assert.ok(init.signal.aborted,'No pending transport survives collector return')
  assert.equal(init.method,url===LISTING?'POST':'GET')
  assert.equal(init.body,url===LISTING?'{}':undefined)
  if(url===LISTING)assert.equal(init.headers['Content-Type'],'application/json')
  assert.ok(!Object.keys(init.headers).some(name=>/authorization|cookie|token/i.test(name)))
  assert.ok(!/smart\.stream|\/apply(?:\/|$)|\/form(?:\/|$)|\/count/.test(url))
 }
})

for(const [name,changes,pattern]of [
 ['status403',{status:403},/HTTP 403/],
 ['status404 job body',{status:404},/HTTP 404/],
 ['redirect status',{status:302},/HTTP 302/],
 ['wrong finalURL',{url:'https://apply.workable.com/foreign/'},/final URL/],
 ['followed redirect',{redirected:true},/redirect authority/],
 ['unknown redirect authority',{redirected:undefined},/redirect authority/],
 ['Latin1 MIME',{headers:{'content-type':'application/json; charset=iso-8859-1'}},/MIME/],
 ['missing MIME',{headers:{}},/MIME/],
 ['HTML MIME',{headers:{'content-type':'text/html; charset=utf-8'}},/MIME/],
 ['JSON with UTF8 BOM',{bytes:Buffer.concat([Buffer.from([239,187,191]),Buffer.from(packet('native-account-metadata').bodyBase64,'base64')])},/BOM/],
 ['invalid UTF8',{bytes:Buffer.concat([Buffer.from(packet('native-account-metadata').bodyBase64,'base64'),Buffer.from([255])])},/UTF8/],
])test('original Response '+name+' rejects before native authority or later reads',async()=>{
 const transport=replay(({url})=>url===ACCOUNT?changes:{})
 await assert.rejects(run(transport.options),pattern)
 assert.equal(transport.requests.length,1)
})

for(const [name,change]of [
 ['whole program text',bytes=>Buffer.concat([bytes,Buffer.from('\n')])],
 ['program UTF8 BOM',bytes=>Buffer.concat([Buffer.from([239,187,191]),bytes])],
 ['program invalid UTF8',bytes=>Buffer.concat([bytes.subarray(0,-1),Buffer.from([255])])],
])test('immutable original '+name+' is never normalized into the reviewed pin',async()=>{
 const transport=replay(({url,bytes})=>url===CLIENT?{bytes:change(bytes)}:{})
 await assert.rejects(run(transport.options),/whole role-client original entity/)
 assert.equal(transport.requests.length,2)
})

for(const [name,mutate]of [
 ['legal employer',value=>{value.name='Other Employer'}],
 ['official website',value=>{value.url='https://other.example/'}],
 ['native account',value=>{value.uid='other-account'}],
 ['native language activation',value=>{value.languages.options[0].published=false}],
 ['extra employer EEO',value=>{value.details.eeo='Unreviewed employer criteria'}],
])test('current complete '+name+' metadata binds exact own account',async()=>{
 const transport=replay(({url,bytes})=>url===ACCOUNT?{bytes:changeJSON(bytes,mutate)}:{})
 await assert.rejects(run(transport.options),/complete native legal employer/)
 assert.equal(transport.requests.length,1)
})

for(const [name,mutate]of [
 ['missing known role',page=>{page.results[6].id=1}],
 ['duplicate id',page=>{page.results[2].id=page.results[1].id}],
 ['duplicate shortcode',page=>{page.results[2].shortcode=page.results[1].shortcode}],
 ['advertised below observed',page=>{page.total=1}],
 ['wrong observed count',page=>{page.results.pop()}],
 ['unknown criteria carrier',page=>{page.results[2].attachments=['file.pdf']}],
 ['primary country missing',page=>{page.results[6].location.country=''}],
 ['primary country contradictory',page=>{page.results[6].location.country='United States'}],
 ['secondary foreign country',page=>{page.results[6].locations[0].country='United States'}],
 ['secondary countrycode',page=>{page.results[6].locations[0].countryCode='US'}],
 ['secondary hidden country',page=>{page.results[6].locations[0].hidden=true}],
 ['unpublished status',page=>{page.results[6].state='draft'}],
 ['unapproved status',page=>{page.results[6].approvalStatus='pending'}],
 ['internal role',page=>{page.results[6].isInternal=true}],
 ['invalid native date',page=>{page.results[6].published='2026-02-30T00:00:00.000Z'}],
 ['wrong native employer',page=>{page.results[6].accountUid='other-employer'}],
])test('full native firstpage rejects '+name+' without dropping contradictory inventory',async()=>{
 const transport=replay(({url,bytes})=>url===LISTING?{bytes:changeJSON(bytes,mutate)}:{})
 await assert.rejects(run(transport.options),/native|Native|Reviewed|Duplicate/)
 assert.equal(transport.requests.length,3)
})

test('unknown unhydrated geography is counted and retained without country promotion',async()=>{
 const transport=replay(({url,bytes})=>url===LISTING?{bytes:changeJSON(bytes,page=>{
  page.results[2].location.country='';page.results[2].location.countryCode=''
  page.results[2].locations[0].country='';page.results[2].locations[0].countryCode=''
 })}:{})
 const jobs=await run(transport.options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,4);assert.equal(audit.unknownOrForeignCountryRecordCount,1)
 assert.equal(audit.unhydratedRecords.find(row=>row.id===6254572).location.country,'')
 assert.equal(audit.companyIndiaTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const [name,mutate]of [
 ['identity',record=>{record.id=123}],
 ['listing title',record=>{record.title+=' changed'}],
 ['raw criteria preview',record=>{record.description=record.title}],
 ['missing requirements',record=>{delete record.requirements}],
 ['new requirements',record=>{record.requirements+='<p>Additional criteria</p>'}],
 ['hidden criteria',record=>{record.description='<div hidden>'+record.description+'</div>'}],
 ['attachment criteria',record=>{record.attachments=['https://example.test/JD.pdf']}],
 ['extra EEO criteria',record=>{record.eeo='Additional terms'}],
 ['salary criteria',record=>{record.salary_to+=1}],
 ['publication',record=>{record.published='2026-11-15T00:00:00.000Z'}],
 ['explicit closed notice',record=>{record.description+='<p>This position is closed. No longer accepting applications.</p>'}],
])test('all23 original full detail fields reject changed '+name,async()=>{
 const transport=replay(({url,bytes})=>url===detailURL(ROLES[0])?{bytes:changeJSON(bytes,mutate)}:{})
 await assert.rejects(run(transport.options),/native|Native|Reviewed|Unreviewed/)
 assert.equal(transport.requests.length,4)
})

for(const [name,target,mutate]of [
 ['ordered listing',LISTING,page=>{[page.results[0],page.results[1]]=[page.results[1],page.results[0]]}],
 ['listing total',LISTING,page=>{page.total++}],
 ['next-page declaration',LISTING,page=>{page.nextPage='otherNativeNextPageToken'}],
 ['unhydrated original row',LISTING,page=>{page.results[2].title+=' changed'}],
 ['whole employer metadata',ACCOUNT,account=>{account.details.overview.description+=' changed'}],
 ['full criteria',detailURL(ROLES[0]),record=>{record.requirements+='<p>Later terms</p>'}],
])test('closing '+name+' drift rejects all output and stops the pool',async()=>{
 const transport=replay(({url,count,bytes})=>url===target&&count===2?{bytes:changeJSON(bytes,mutate)}:{})
 await assert.rejects(run(transport.options),/closing|metadata changed|criteria changed/)
 const count=transport.requests.length
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(transport.requests.length,count)
 assert.ok(transport.requests.every(row=>row.init.signal.aborted))
})

test('native full dates are not replaced with the observation time',async()=>{
 const transport=replay(),jobs=await run(transport.options)
 assert.deepEqual(jobs.map(job=>job.postingDate),fixture.roles.map(role=>role.original.published))
 assert.ok(jobs.every(job=>job.postingDate!==job.scrapedAt&&job.closingDate===null&&job.nativeFirstEverPublicationUnverified))
 const future=replay()
 await assert.rejects(run({...future.options,now:()=> '2026-10-01T00:00:00.000Z'}),/future/)
})

for(const [name,maximum]of Object.entries({sourceTimeoutMs:45000,requestTimeoutMs:15000,maxRequests:16,maxPages:6,maxDetails:8,maxEntityBytes:4000000,maxTotalBytes:24000000})){
 for(const value of [0,maximum+1])test('original '+name+' bound cannot expand or disappear: '+value,async()=>{
  const transport=replay()
  await assert.rejects(run({...transport.options,[name]:value}),new RegExp(name+' ceiling'))
  assert.equal(transport.requests.length,0)
 })
}
for(const [name,value]of [['maxRequests',13],['maxPages',5],['maxDetails',7],['maxEntityBytes',1000]])test('insufficient '+name+' fails before opening work',async()=>{
 const transport=replay()
 await assert.rejects(run({...transport.options,[name]:value}),/Insufficient native/)
 assert.equal(transport.requests.length,0)
})

test('closing byte budget is reserved before accepting opening entities',async()=>{
 const transport=replay()
 await assert.rejects(run({...transport.options,maxTotalBytes:3500000}),/byte budget|closing reserve/)
 assert.ok(transport.requests.length<=2)
})

for(const name of ['fetchText','fetchJson'])test('body-only '+name+' is rejected before I/O',async()=>{
 let reads=0
 await assert.rejects(run({[name]:async()=>{reads++;return '{}'}}),/Original HTTP metadata/)
 assert.equal(reads,0)
})

test('explicit original byte fetchPage adapter remains supported',async()=>{
 const transport=replay(),options={...transport.options}
 delete options.fetchImpl
 assert.equal((await run(options)).length,4)
 assert.equal(transport.requests.length,14)
})

test('fetchPage must supply explicit redirect authority rather than a collector default',async()=>{
 const transport=replay(),original=transport.options.fetchPage
 await assert.rejects(run({fetchPage:async(...args)=>{
  const value=await original(...args);delete value.redirected;return value
 }}),/redirect authority is required/)
 assert.equal(transport.requests.length,1)
})

test('duplicate and unsafe JSON fields never vanish through JSON.parse',()=>{
 assert.throws(()=>readSmartStreamJSON('{"name":1,"name":2}'),/Duplicate/)
 assert.throws(()=>readSmartStreamJSON('{"__proto__":{}}'),/unsafe/)
})

for(const stage of ['before-read','in-flight-body','in-flight-fetch'])test('opaque external abort '+stage+' preserves exact reason and stops later work',async()=>{
 const controller=new AbortController(),reason={opaque:'caller cancellation '+stage},transport=replay()
 let canceled=0,released=0
 if(stage==='before-read')controller.abort(reason)
 const options={...transport.options,signal:controller.signal}
 if(stage==='in-flight-body')options.fetchImpl=async(url,init)=>{
  transport.requests.push({url,init})
  return{status:200,url,redirected:false,headers:new Headers({'content-type':'application/json; charset=utf-8'}),body:{getReader:()=>({read:async()=>{controller.abort(reason);return new Promise(()=>{})},cancel:()=>{canceled++},releaseLock:()=>{released++}})}}
 }
 if(stage==='in-flight-fetch')options.fetchImpl=async(url,init)=>{
  transport.requests.push({url,init});controller.abort(reason)
  return new Promise(resolve=>setImmediate(()=>resolve({status:200,url,redirected:false,headers:new Headers(),body:{cancel:()=>{canceled++}}})))
 }
 await assert.rejects(run(options),error=>error===reason)
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))
 assert.equal(transport.requests.length,stage==='before-read'?0:1)
 if(stage!=='before-read')assert.equal(canceled,1)
 if(stage==='in-flight-body')assert.equal(released,1)
})

test('request deadline aborts an uncooperative transport without another request',async()=>{
 let reads=0,signal
 await assert.rejects(run({requestTimeoutMs:10,fetchImpl:async(_url,init)=>{reads++;signal=init.signal;return new Promise(()=>{})}}),{name:'TimeoutError'})
 assert.equal(reads,1);assert.equal(signal.aborted,true)
})

test('source deadline aborts an uncooperative transport within its smaller opening reserve',async()=>{
 let reads=0
 await assert.rejects(run({sourceTimeoutMs:10,fetchImpl:async()=>{reads++;return new Promise(()=>{})}}),{name:'TimeoutError'})
 assert.equal(reads,1)
})

test('original stream entity overflow cancels and releases before further reads',async()=>{
 let canceled=0,released=0,reads=0
 const reader=createSmartStreamOriginalReader({fetchImpl:async url=>({status:200,url,redirected:false,headers:new Headers({'content-type':'application/json; charset=utf-8'}),body:{getReader:()=>({read:async()=>{reads++;return{done:false,value:new Uint8Array(262145)}},cancel:()=>{canceled++},releaseLock:()=>{released++}})}})})
 try{await assert.rejects(reader.read(ACCOUNT),/entity byte budget/)}finally{reader.close()}
 assert.equal(reads,1);assert.equal(canceled,1);assert.equal(released,1)
})

test('forged byteLength cannot defeat intrinsic byte accounting',async()=>{
 let canceled=0
 const chunk=new Uint8Array(262145);Object.defineProperty(chunk,'byteLength',{value:0})
 const reader=createSmartStreamOriginalReader({fetchImpl:async url=>({status:200,url,redirected:false,headers:new Headers({'content-type':'application/json; charset=utf-8'}),body:{getReader:()=>({read:async()=>({done:false,value:chunk}),cancel:()=>{canceled++},releaseLock(){}})}})})
 try{await assert.rejects(reader.read(ACCOUNT),/entity byte budget/)}finally{reader.close()}
 assert.equal(canceled,1)
})

test('intrinsic byteOffset and buffer preserve the actual sliced entity despite forged properties',async()=>{
 const bytes=Buffer.from(packet('native-account-metadata').bodyBase64,'base64'),backing=new Uint8Array(bytes.length+20)
 backing.fill(255);backing.set(bytes,10)
 const chunk=backing.subarray(10,10+bytes.length)
 Object.defineProperties(chunk,{byteOffset:{value:0},buffer:{value:new ArrayBuffer(1)},byteLength:{value:1}})
 let reads=0,released=0
 const reader=createSmartStreamOriginalReader({fetchImpl:async url=>({status:200,url,redirected:false,headers:new Headers({'content-type':'application/json; charset=utf-8'}),body:{getReader:()=>({read:async()=>++reads===1?{done:false,value:chunk}:{done:true},cancel(){},releaseLock(){released++}})}})})
 try{
  const value=await reader.read(ACCOUNT)
  assert.deepEqual(value.bytes,bytes)
  assert.equal(reader.stats().decodedBytes,bytes.length)
 }finally{reader.close()}
 assert.equal(released,1)
})

test('original4MB program ceiling is enforced on streaming bytes before hash qualification',async()=>{
 let canceled=0,released=0
 const reader=createSmartStreamOriginalReader({fetchImpl:async url=>({status:200,url,redirected:false,headers:new Headers({'content-type':'application/javascript'}),body:{getReader:()=>({read:async()=>({done:false,value:new Uint8Array(4000001)}),cancel(){canceled++},releaseLock(){released++}})}})})
 try{await assert.rejects(reader.read(CLIENT),/entity byte budget/)}finally{reader.close()}
 assert.equal(canceled,1);assert.equal(released,1)
})

test('aggregate stream ceiling cancels an entity before original bytes can be admitted',async()=>{
 let canceled=0,released=0
 const bytes=Buffer.from(packet('native-account-metadata').bodyBase64,'base64')
 const reader=createSmartStreamOriginalReader({maxTotalBytes:100,fetchImpl:async url=>({status:200,url,redirected:false,headers:new Headers({'content-type':'application/json; charset=utf-8'}),body:{getReader:()=>({read:async()=>({done:false,value:bytes}),cancel(){canceled++},releaseLock(){released++}})}})})
 try{await assert.rejects(reader.read(ACCOUNT),/Aggregate original native byte budget/)}finally{reader.close()}
 assert.equal(canceled,1);assert.equal(released,1)
})

for(const [name,value,url]of [['maxRequests',1,ACCOUNT],['maxPages',1,ACCOUNT],['maxDetails',1,detailURL(ROLES[0])]])test('reader independently enforces downward '+name+' across requests',async()=>{
 const transport=replay(),reader=createSmartStreamOriginalReader({...transport.options,[name]:value})
 try{
  await reader.read(url)
  await assert.rejects(reader.read(url),/request|budget/)
  assert.equal(transport.requests.length,1)
 }finally{reader.close()}
})

test('reader rejects all unbound URLs without invoking any transport',async()=>{
 const transport=replay(),reader=createSmartStreamOriginalReader(transport.options)
 try{await assert.rejects(reader.read('https://apply.workable.com/api/v2/accounts/other/jobs/'+ROLES[0]),/Unbound/)}finally{reader.close()}
 assert.equal(transport.requests.length,0)
})

test('exact JS MIME and original closing client entity remain mandatory',async()=>{
 const wrongMIME=replay(({url})=>url===CLIENT?{headers:{'content-type':'application/javascript; charset=iso-8859-1'}}:{})
 await assert.rejects(run(wrongMIME.options),/MIME/)
 assert.equal(wrongMIME.requests.length,2)
 const closing=replay(({url,count,bytes})=>url===CLIENT&&count===2?{bytes:Buffer.concat([bytes,Buffer.from('\n')])}:{})
 await assert.rejects(run(closing.options),/whole role-client/)
 assert.equal(closing.requests.length,9)
})

test('opaque caller cancellation wins a simultaneous transport failure',async()=>{
 const controller=new AbortController(),reason={arbitrary:'opaque external reason'},failure=Error('simultaneous transport failure')
 let reads=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:async()=>{reads++;controller.abort(reason);throw failure}}),error=>error===reason)
 assert.equal(reads,1)
})

test('late response after request deadline is canceled and causes no new request',async()=>{
 let reads=0,canceled=0,resolveResponse
 const completed=run({requestTimeoutMs:10,fetchImpl:async()=>{reads++;return new Promise(resolve=>{resolveResponse=resolve})}})
 await assert.rejects(completed,{name:'TimeoutError'})
 resolveResponse({status:200,url:ACCOUNT,redirected:false,headers:new Headers({'content-type':'application/json; charset=utf-8'}),body:{cancel(){canceled++}}})
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))
 assert.equal(reads,1);assert.equal(canceled,1)
})

test('real Response byte receipt and originals remain distinct from synthetic body-only callbacks',()=>{
 const original=response(packet('native-account-metadata'))
 assert.equal(original.redirected,false)
 assert.equal(original.url,ACCOUNT)
 assert.equal(fixture.packets.length,17)
 assert.match(fixture.logicalClosingReplayWarning,/one genuine observation/)
})
