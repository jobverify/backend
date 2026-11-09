import assert from 'node:assert/strict'
import nodeTest from 'node:test'
import {vanity,URLS,packet,clocks,actualHandoff,actualRedirect,actualReceipt,requireRedirect,responseFor,exercise,assertPrefixUnavailable,sha,fixture} from './cocaColaWorkday20261102.helpers.mjs'
const test=(name,operation)=>nodeTest(name,{concurrency:false,timeout:5000},operation)

test('exact saved Coca-Cola four packets remain raw observations with no India-zero or closing claim',()=>{
 assert.equal(fixture.responses.length,4)
 assert.equal(fixture.rawObservedRows,20)
 assert.equal(fixture.nativeReportedTotal,210)
 assert.equal(fixture.multipleLocationLabels,2)
 assert.equal(fixture.detailsObserved,0)
 assert.equal(fixture.companyIndiaTotal,null)
 assert.equal(fixture.syntheticResponsesStored,false)
 assert.equal(packet('bootstrap').body.length,7029)
 assert.equal(sha(packet('bootstrap').body),'6fdfcc2608d5922cebf1c48026dd8fd8f94dbd1eb13e91f6bb7bb9ce79a1d5ba')
})

test('existing current200HTML receipt keeps rejecting the actual301 without a fake HTML response',()=>{
 const handoff=actualHandoff()
 assert.equal(handoff.primary.status,200)
 assert.throws(()=>vanity.currentWorkdayVanityBoardReceipt({handoff,response:responseFor('redirect'),html:packet('redirect').body.toString('utf8'),clocks:clocks('redirect')}),/not HTTP200/)
})

test('explicit exact301 receipt binds actual primary,redirect and native config with three original clocks',()=>{
 const receipt=actualReceipt()
 assert.equal(receipt.method,'official-visible-vanity-redirect-and-literal-workday-config')
 assert.equal(receipt.board,URLS.board)
 assert.deepEqual(receipt.responses.map(r=>r.status),[200,301,200])
 assert.deepEqual(receipt.responses.map(r=>r.url),[URLS.primary,URLS.vanity,URLS.board])
 assert.deepEqual(receipt.responses.map(r=>r.sha256),['primary','redirect','bootstrap'].map(kind=>sha(packet(kind).body)))
 assert.deepEqual(receipt.responses.map(r=>r.capturedAt),['primary','redirect','bootstrap'].map(kind=>clocks(kind).capturedAt))
 assert.equal(receipt.responses[1].location,URLS.board)
 assert.equal(receipt.fetchedAt,clocks('primary').capturedAt)
 assert.deepEqual(receipt.nativeIdentity,{tenant:'coke',siteId:'coca-cola-careers',appName:'cxs',isExternal:true,locale:''})
 assert.equal(receipt.sourceScopeComplete,false)
 assert.equal(receipt.companyGlobalTotal,null)
 assert.equal(receipt.companyIndiaTotal,null)
})

test('opt-in engine reads each real hop once and then preserves exact20-of210 continuation unavailability',async t=>{
 assertPrefixUnavailable(await exercise(t))
})

test('no explicit301 opt-in leaves the old200HTML branch strict before native bootstrap',async t=>{
 const result=await exercise(t,{config:{officialVanityRedirectStatus:undefined}})
 assert.equal(result.rejected,true);assert.equal(result.jobs,undefined)
 assert.deepEqual(result.calls.map(c=>c.url),[URLS.primary,URLS.vanity])
})

test('unsupported explicit redirect statuses or missing vanity URL fail before transport',async t=>{
 for(const config of [{officialVanityRedirectStatus:'301'},{officialVanityRedirectStatus:302},{officialVanityRedirectStatus:null},{officialVanityCareersUrl:null}]){
  const result=await exercise(t,{config})
  assert.equal(result.rejected,true);assert.equal(result.jobs,undefined)
  assert.equal(result.calls.length,0)
 }
})

test('session reuse preserves the existing outage predicate even with valid canonical and literal native config',async t=>{
 const html=packet('bootstrap').body.toString('utf8').replace('</title>',' - Workday is currently unavailable</title>')
 assert.notEqual(html,packet('bootstrap').body.toString('utf8'))
 const result=await exercise(t,{responses:{bootstrap:{body:html}}})
 assert.equal(result.rejected,true);assert.equal(result.jobs,undefined)
 assert.deepEqual(result.calls.map(c=>c.url),[URLS.primary,URLS.vanity,URLS.board])
 assert.match([result.error?.message,result.error?.cause?.message].join(' '),/unavailable/i)
})

test('only proven board cookies and CSRF reach CXS and the intermediate session never leaks',async t=>{
 const result=await exercise(t,{cookies:true})
 assertPrefixUnavailable(result)
 for(const call of result.calls.filter(c=>c.url===URLS.api)){
  assert.match(call.headers.cookie,/SYNTHETIC_BOARD_COOKIE=included/)
  assert.match(call.headers.cookie,/CALYPSO_CSRF_TOKEN=SYNTHETIC_BOARD_ONLY/)
  assert.doesNotMatch(call.headers.cookie,/REDIRECT/)
  assert.equal(call.headers['x-calypso-csrf-token'],'SYNTHETIC_BOARD_ONLY')
  assert.equal(call.headers.referer,URLS.board)
  assert.equal(call.headers.origin,new URL(URLS.board).origin)
 }
})

test('an empty anonymous board session is still reused without a fallback bootstrap GET',async t=>{
 const result=await exercise(t)
 assertPrefixUnavailable(result)
 for(const call of result.calls.filter(c=>c.url===URLS.api)){
  assert.equal(call.headers.cookie,undefined)
  assert.equal(call.headers['x-calypso-csrf-token'],undefined)
 }
})

test('redirect proof cannot be cloned,serialized or moved to an equivalent but different primary handoff',()=>{
 requireRedirect()
 const handoff=actualHandoff(),redirect=actualRedirect(handoff),native={response:responseFor('bootstrap'),html:packet('bootstrap').body.toString('utf8'),clocks:clocks('bootstrap')}
 for(const bad of [{handoff:{...handoff},redirect},{handoff:actualHandoff(),redirect},{handoff,redirect:{...redirect}},{handoff,redirect:JSON.parse(JSON.stringify(redirect))}]){
  assert.throws(()=>vanity.currentWorkdayVanityRedirectBoardReceipt({...native,...bad}),/proof|handoff|redirect/i)
 }
})

test('redirect status and literal Location contradictions reject before any board read',async t=>{
 for(const changes of [
  {status:302},{status:307},{status:308},{status:200},{status:403},{status:429},
  {omitLocation:true},{location:'/coca-cola-careers'},{location:URLS.board+'/'},{location:URLS.board+'?tenant=other'},
  {location:URLS.board+'#other'},{location:'https://other.wd1.myworkdayjobs.com/coca-cola-careers'},
  {location:'https://user:password@coke.wd1.myworkdayjobs.com/coca-cola-careers'},{location:URLS.board+', https://other.example/'},
 ]){
  const result=await exercise(t,{responses:{redirect:changes}})
  assert.equal(result.rejected,true);assert.equal(result.jobs,undefined)
  assert.deepEqual(result.calls.map(c=>c.url),[URLS.primary,URLS.vanity])
 }
})

test('a string301 HTTP status cannot create an exact redirect receipt',()=>{
 requireRedirect()
 const response=responseFor('redirect');Object.defineProperty(response,'status',{value:'301'})
 assert.throws(()=>actualRedirect(actualHandoff(),{response}),/301|status/i)
})

test('primary handoff remains strict for hidden,inert,disabled or missing current anchors',async t=>{
 const original=packet('primary').body.toString('utf8'),target='href="'+URLS.vanity+'"'
 assert.ok(original.includes(target))
 for(const body of [original.replaceAll(target,'hidden '+target),original.replaceAll(target,'aria-hidden="true" '+target),original.replaceAll(target,'disabled '+target),'<!-- SYNTHETIC negative: <a '+target+'>Job search</a> -->','<template>'+original+'</template>']){
  const result=await exercise(t,{responses:{primary:{body}}})
  assert.equal(result.rejected,true);assert.equal(result.calls.length,1)
 }
})

test('new board proof keeps exact200 canonical and native literal identity guards',()=>{
 requireRedirect()
 const original=packet('bootstrap').body.toString('utf8')
 for(const html of [original.replace('href="'+URLS.board+'"','href="https://other.wd1.myworkdayjobs.com/coca-cola-careers"'),original.replace('</head>','<link rel="canonical" href="'+URLS.board+'"></head>'),original.replace('tenant: "coke"','tenant: "other"'),original.replace('siteId: "coca-cola-careers"','siteId: "other"'),original.replace('appName: "cxs"','appName: "other"'),original.replace('isExternal: true','isExternal: false'),original.replace('tenant: "coke"','tenant: "other",tenant: "coke"')])assert.throws(()=>actualReceipt({html}))
 for(const changes of [{status:301},{status:403},{url:'https://other.example/'},{headers:{'content-type':'application/json'}}])assert.throws(()=>actualReceipt({response:responseFor('bootstrap',changes)}))
})

for(const kind of ['inherited','accessor','reversed','untimed'])test('existing receipt API keeps '+kind+' supplied capture clocks unqualified without reading getters',()=>{
 let reads=0,input
 const original=clocks('primary')
 if(kind==='inherited')input=Object.create(original)
 if(kind==='accessor')input=Object.defineProperties({},{capturedAt:{get(){reads++;return original.capturedAt}},captureStartedAt:{get(){reads++;return original.captureStartedAt}}})
 if(kind==='reversed')input={capturedAt:original.captureStartedAt,captureStartedAt:original.capturedAt}
 if(kind==='untimed')input={captureStartedAt:original.captureStartedAt}
 const receipt=actualHandoff({clocks:input})
 assert.equal(receipt.primary.capturedAt,null)
 assert.equal(receipt.primary.captureStartedAt,null)
 assert.equal(reads,0)
})

test('new redirect and board APIs preserve unknown clocks and never invent a current capturedAt',()=>{
 requireRedirect()
 for(const kind of ['redirect','bootstrap'])for(const input of [{},Object.create(clocks(kind)),{capturedAt:123},{capturedAt:'yesterday'}, {capturedAt:clocks(kind).captureStartedAt,captureStartedAt:clocks(kind).capturedAt}]){
  const handoff=actualHandoff(),redirect=actualRedirect(handoff,kind==='redirect'?{clocks:input}:{})
  const receipt=vanity.currentWorkdayVanityRedirectBoardReceipt({handoff,redirect,response:responseFor('bootstrap'),html:packet('bootstrap').body.toString('utf8'),clocks:kind==='bootstrap'?input:clocks('bootstrap')})
  assert.equal(receipt.fetchedAt,null)
  assert.equal(receipt.responses[kind==='redirect'?1:2].capturedAt,null)
 }
})

test('valid existing receipt capture time stays exact when optional capture start is unknown null',()=>{
 const known=clocks('primary').capturedAt
 for(const supplied of [{capturedAt:known},{capturedAt:known,captureStartedAt:null}]){
  const receipt=actualHandoff({clocks:supplied})
  assert.equal(receipt.primary.capturedAt,known)
  assert.equal(receipt.primary.captureStartedAt,null)
 }
})

test('redirect reader bounds runtime bytes and rejects truncated identity Content-Length while compressed lengths stay distinct',async()=>{
 requireRedirect()
 const body=packet('redirect').body
 for(const changes of [{headers:{'content-length':String(1024*1024+1)}},{body:body.subarray(0,body.length-1),headers:{'content-length':String(body.length)}}])await assert.rejects(vanity.readBoundedWorkdayVanityRedirect(responseFor('redirect',changes),{expectedUrl:URLS.vanity,boardUrl:URLS.board,maxBytes:1024*1024}))
 const bytes=await vanity.readBoundedWorkdayVanityRedirect(responseFor('redirect',{headers:{'content-encoding':'gzip','content-length':'10'}}),{expectedUrl:URLS.vanity,boardUrl:URLS.board,maxBytes:1024*1024})
 assert.equal(sha(bytes),sha(body))
})
