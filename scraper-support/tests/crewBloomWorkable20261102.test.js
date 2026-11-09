import assert from 'node:assert/strict'
import fs from 'node:fs'
import {syncBuiltinESMExports} from 'node:module'
import {gunzipSync} from 'node:zlib'
import nodeTest from 'node:test'
import {SOURCE,PROFILE,source,configPath,sha,fixture,bytes,account,nativeListing,nativeDetail,selected,hiddenIndia,provider,URLS,exercise,assertUnavailable,assertNativeJob} from './crewBloomWorkable20261102.helpers.mjs'
const test=(name,run)=>nodeTest(name,{concurrency:false,timeout:5000},run)

test('CrewBloom: six exact native observations preserve tenant,10-of42,raw full locations and Oct26 publication',()=>{
  assert.equal(fixture.syntheticResponsesStored,false)
  assert.equal(fixture.sourceScopeComplete,false)
  assert.equal(fixture.companyGlobalTotal,null)
  assert.equal(fixture.companyIndiaTotal,null)
  assert.equal(fixture.corporate.metadata.status,403)
  assert.equal(bytes(fixture.corporate).length,5478)
  assert.equal(nativeListing.total,42)
  assert.equal(nativeListing.results.length,10)
  assert.equal(hiddenIndia.length,2)
  assert.equal(account.uid,'53568b5e-6585-43a9-930b-705aec25df28')
  assert.equal(account.subdomain,SOURCE)
  assert.equal(account.name,'CrewBloom')
  assert.equal(account.url,URLS.corporate)
  const client=gunzipSync(Buffer.from(fixture.client.originalBodyGzipBase64,'base64'))
  assert.equal(sha(client),fixture.client.bodySHA256)
  assert.equal(sha(client),'b210be820f33ee0bc8a885b06e91908d193591ee8bc8d374cbd11e1a069d4ad9')
  const clientText=client.toString('utf8')
  const protocol=fixture.protocol
  assert.equal(clientText.slice(protocol.cursorRead.start,protocol.cursorRead.end),protocol.cursorRead.source)
  assert.equal(protocol.cursorRead.source,'e=k.nextPage')
  assert.equal(clientText.slice(protocol.nativeJobsCall.start,protocol.nativeJobsCall.end),protocol.nativeJobsCall.source)
  assert.equal(protocol.nativeJobsCall.source,'c.A.account(y).jobs(g({query:n,token:e},A(x)))')
  assert.equal(protocol.downloadedProgramsExecuted,0)
  assert.equal(nativeDetail.id,6226544)
  assert.equal(nativeDetail.shortcode,'B486B3B547')
  assert.equal(nativeDetail.published,'2026-10-26T00:00:00.000Z')
  assert.equal(nativeDetail.description.length,1616)
  assert.equal(nativeDetail.requirements.length,721)
  assert.equal(nativeDetail.benefits,'')
  assert.deepEqual(nativeDetail.locations,selected.locations)
  assert.deepEqual(nativeDetail.locations.map(l=>[l.countryCode,l.hidden,l.city,l.region]),[['PH',false,'',null],['PK',false,'',null],['IN',false,'',null]])
})

test('CrewBloom: original July29 verification declaration stays historical',()=>{
  assert.equal(source.VERIFIED_ON,'2026-07-29')
})

for(const registered of [false,true])test('CrewBloom: '+(registered?'registered':'direct')+' actual corporate403 rejects before any account,list or detail call',async t=>{
  const result=await exercise(t,{registered,change:s=>{s.primary={status:fixture.corporate.metadata.status,url:URLS.corporate,html:bytes(fixture.corporate).toString('utf8')}}})
  assertUnavailable(result)
  assert.match(result.error.message,/first-party careers page unavailable/i)
  assert.deepEqual(result.calls.map(c=>c.url),[URLS.corporate])
})

test('CrewBloom: default transport observes the retained403 and performs no API or fallback',async t=>{
  const result=await exercise(t,{defaultTransport:true,change:s=>{s.primary={status:403,url:URLS.corporate,html:bytes(fixture.corporate).toString('utf8')}}})
  assertUnavailable(result)
  assert.deepEqual(result.calls.map(c=>c.url),[URLS.corporate])
  assert.equal(result.calls[0].headers.Accept,'text/html')
  assert.equal(result.calls[0].headers['User-Agent'],'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)')
})

for(const registered of [false,true])test('CrewBloom: '+(registered?'registered':'direct')+' SYNTHETIC handoff and one-role closing retain the exact native India detail',async t=>{
  const result=await exercise(t,{registered})
  assertNativeJob(result)
  assert.equal(result.calls.filter(c=>c.url===URLS.corporate).length,2)
  assert.equal(result.calls.filter(c=>c.url===URLS.account).length,2)
  assert.equal(result.calls.filter(c=>c.url===URLS.listing).length,2)
  assert.equal(result.calls.filter(c=>c.url===URLS.detail).length,2)
  assert.equal(result.evidence.listingComplete,true,'Only the explicitly synthetic one-role model is reconciled')
  assert.equal(result.evidence.reportedTotal,1)
  assert.equal(provider().verifiedPublicJobCount,null)
  assert.equal(provider().verifiedIndiaJobCount,null)
})

test('CrewBloom: default native transport uses accountfull and workplace with the same exact native rows',async t=>{
  const result=await exercise(t,{defaultTransport:true})
  assertNativeJob(result)
  assert.equal(result.calls.length,8)
  for(const call of result.calls){
    assert.ok(call.signal instanceof AbortSignal)
    if(call.kind==='json')assert.equal(call.headers.Accept,'application/json')
    if(call.url===URLS.listing){assert.equal(Object.hasOwn(call.body,'remote'),false);assert.deepEqual(call.body.workplace,[])}
  }
})

test('CrewBloom: caller identity,account,board and verification flags cannot bypass the mandatory corporate check',async t=>{
  const result=await exercise(t,{change:s=>{s.primary.status=403},options:{source:'other',company:'Other Employer',tenant:'other',accountUid:'other',careersUrl:'https://other.example/',boardIdentityVerified:true,reconcileClosingInventory:false,config:{...PROFILE,tenant:'other'}}})
  assertUnavailable(result)
  assert.deepEqual(result.calls.map(c=>c.url),[URLS.corporate])
})

for(const [label,value]of [
  ['missing',null],['malformed','{'],['wrongUID',JSON.stringify({...PROFILE,accountUid:'other'})],['extraKey',JSON.stringify({...PROFILE,boardIdentityVerified:true})],['wrongSource',JSON.stringify({...PROFILE,source:'other'})],['noClosing',JSON.stringify({...PROFILE,reconcileClosingInventory:false})],
])test('CrewBloom: mandatory '+label+' profile rejects before any I/O',async t=>{
  const original=fs.readFileSync
  const mock=t.mock.method(fs,'readFileSync',(file,...args)=>{
    if(String(file)===configPath){if(value===null)throw Object.assign(new Error('CONTROLLED missing profile'),{code:'ENOENT'});return value}
    return original(file,...args)
  })
  syncBuiltinESMExports()
  let result
  try{result=await exercise(t)}finally{mock.mock.restore();syncBuiltinESMExports()}
  assertUnavailable(result)
  assert.equal(result.error.code,'CREWBLOOM_SOURCE_CONFIG_INVALID')
  assert.equal(result.calls.length,0)
})

test('CrewBloom: pre-aborted Error,hostile object,string,null and zero bypass profile and transport exactly',async t=>{
  const opaque=Object.freeze(Object.defineProperty({},'code',{get(){assert.fail('Caller reason must remain opaque')}}))
  for(const reason of [Object.freeze(new Error('controlled caller')),opaque,'caller',null,0]){
    const controller=new AbortController();controller.abort(reason)
    const result=await exercise(t,{options:{signal:controller.signal}})
    assertUnavailable(result)
    assert.equal(result.error,reason)
    assert.equal(result.calls.length,0)
  }
})

test('CrewBloom: direct caller abort retains owned callback until settlement and then returns exact reason without later I/O',async t=>{
  const controller=new AbortController(),reason=Object.freeze(new Error('controlled direct owned callback'))
  let rejectOwned,settled=false,result
  const pending=exercise(t,{options:{signal:controller.signal},onCall:({calls})=>{
    if(calls.length===1){queueMicrotask(()=>controller.abort(reason));return new Promise((resolve,reject)=>{rejectOwned=reject})}
  }}).then(value=>{settled=true;return value})
  try{
    for(let turn=0;turn<8;turn++)await new Promise(setImmediate)
    assert.equal(typeof rejectOwned,'function')
    assert.equal(settled,false)
  }finally{rejectOwned?.(new Error('CONTROLLED deferred callback drained'));result=await pending}
  assertUnavailable(result)
  assert.equal(result.error,reason)
  assert.equal(result.calls.length,1)
  assert.equal(result.calls[0].signal.aborted,true)
  assert.equal(result.calls[0].signal.reason,reason)
})

test('CrewBloom: exact10-of42 prefix sends unchanged native nextPage as token then retains uncaptured-continuation failure',async t=>{
  const result=await exercise(t,{mode:'native-prefix'})
  assertUnavailable(result)
  assert.equal(result.error,result.unavailable)
  const pages=result.calls.filter(c=>c.url===URLS.listing)
  assert.equal(pages.length,2)
  assert.equal(Object.hasOwn(pages[0].body,'token'),false)
  assert.equal(pages[1].body.token,nativeListing.nextPage)
  assert.equal(result.calls.some(c=>c.url.startsWith('https://apply.workable.com/api/v2/')),false)
  assert.equal(nativeListing.total,42)
  assert.equal(nativeListing.results.length,10)
})

test('CrewBloom: SYNTHETIC two-page opening and closing use exact native foreign/India records and literal token',async t=>{
  const result=await exercise(t,{mode:'two'})
  assertNativeJob(result)
  assert.deepEqual(result.calls.filter(c=>c.url===URLS.listing).map(c=>c.body.token??null),[null,nativeListing.nextPage,null,nativeListing.nextPage])
  assert.equal(result.evidence.reportedTotal,2,'Synthetic envelope total only')
})

test('CrewBloom: incomplete,repeated,duplicate or contradictory native cursor/count schemas fail closed',async t=>{
  for(const change of [
    s=>{s.initial[0].total=2},
    s=>{s.initial[0].nextPage=nativeListing.nextPage},
    s=>{s.initial=[{total:2,results:[structuredClone(selected)],nextPage:nativeListing.nextPage},{total:3,results:[structuredClone(selected)]}]},
    s=>{s.initial=[{total:2,results:[structuredClone(selected),structuredClone(selected)]}]},
  ]){const result=await exercise(t,{change});assertUnavailable(result)}
})

test('CrewBloom: two actual hidden-IN rows remain exact and missing native details cannot become vacancies or zero',async t=>{
  for(let hiddenIndex=0;hiddenIndex<2;hiddenIndex++){
    const result=await exercise(t,{mode:'hidden-one',hiddenIndex})
    assertUnavailable(result)
    assert.equal(result.error,result.unavailable)
    assert.equal(result.state.initial[0].results[0].locations.find(l=>l.countryCode==='IN').hidden,true)
    assert.equal(result.calls.at(-1).url,'https://apply.workable.com/api/v2/accounts/crewbloom/jobs/'+hiddenIndia[hiddenIndex].shortcode)
    assert.equal(Object.hasOwn(result.state.details,hiddenIndia[hiddenIndex].shortcode),false)
  }
})

test('CrewBloom: inert,hidden,role-only or foreign employer handoffs cannot establish the full board',async t=>{
  for(const html of [
    '<!--<a href="'+URLS.board+'">Careers</a>-->',
    '<template><a href="'+URLS.board+'">Careers</a></template>',
    '<script>const example='+JSON.stringify('<a href="'+URLS.board+'">Careers</a>')+'</script>',
    '<div hidden><a href="'+URLS.board+'">Careers</a></div>',
    '<style>.hidden-role{display:none}</style><a class="hidden-role" href="'+URLS.board+'">Careers</a>',
    '<a href="https://apply.workable.com/other/">Careers</a>',
    '<a href="https://apply.workable.com/crewbloom/j/B486B3B547/">Apply</a>',
  ]){
    const result=await exercise(t,{change:s=>{s.primary.html=html}})
    assertUnavailable(result)
    assert.equal(result.calls.length,1)
  }
})

test('CrewBloom: native account UID,brand,subdomain,reciprocal URL,error or shape conflicts stop before listing',async t=>{
  for(const change of [
    s=>{s.account.uid='foreign'},s=>{s.account.name='Other'},s=>{s.account.subdomain='other'},s=>{s.account.url='https://other.example/'},s=>{s.account.error='controlled unavailable'},s=>{s.account.id='598445'},
  ]){
    const result=await exercise(t,{change});assertUnavailable(result)
    assert.deepEqual(result.calls.map(c=>c.url),[URLS.corporate,URLS.account])
  }
})

test('CrewBloom: native detail numeric ID,shortcode,title,account and location identity conflicts reject',async t=>{
  for(const change of [
    d=>{d.id++},d=>{d.shortcode='OTHER0001'},d=>{d.title+=' changed'},d=>{d.accountUid='foreign'},d=>{d.locations=d.locations.filter(l=>l.countryCode!=='IN')},
  ]){const result=await exercise(t,{change:s=>change(s.details[nativeDetail.shortcode])});assertUnavailable(result)}
})

test('CrewBloom: supplied private,unpublished or unapproved native state cannot become a vacancy',async t=>{
  for(const change of [d=>{d.isInternal=true},d=>{d.state='draft'},d=>{d.approvalStatus='pending'}]){
    const result=await exercise(t,{change:s=>change(s.details[nativeDetail.shortcode])});assertUnavailable(result)
  }
})

test('CrewBloom: malformed or contradictory native country fields cannot default from remote or company',async t=>{
  for(const change of [d=>{d.locations[2].countryCode='US'},d=>{d.locations[2].country='Remote'},d=>{d.locations[2].countryCode=''}]){
    const result=await exercise(t,{change:s=>change(s.details[nativeDetail.shortcode])});assertUnavailable(result)
  }
})

test('CrewBloom: changed,malformed or future native publication dates reject without replacing Oct26',async t=>{
  for(const published of ['2026-10-27T00:00:00.000Z','2026-02-30T00:00:00.000Z','2099-01-01T00:00:00.000Z']){
    const result=await exercise(t,{change:s=>{s.details[nativeDetail.shortcode].published=published}});assertUnavailable(result)
    assert.equal(result.state.initial[0].results[0].published,'2026-10-26T00:00:00.000Z')
  }
})

test('CrewBloom: hidden native description or requirements stay unqualified with raw bytes retained',async t=>{
  for(const section of ['description','requirements']){
    const result=await exercise(t,{change:s=>{s.details[nativeDetail.shortcode][section]='<div hidden>'+s.details[nativeDetail.shortcode][section]+'</div>'}})
    if(result.rejected)assertUnavailable(result)
    else{
      assert.equal(result.jobs.length,0)
      assert.equal(result.evidence.listingComplete,false)
      assert.notEqual(result.evidence.status,'verified-empty')
      assert.equal(result.evidence.indiaFacetCount,null)
    }
    assert.equal(result.state.details[nativeDetail.shortcode][section].startsWith('<div hidden>'),true)
  }
})

test('CrewBloom: changed closing raw detail cannot acquire complete or empty authority',async t=>{
  const result=await exercise(t,{change:s=>{s.closingDetails=structuredClone(s.details);s.closingDetails[nativeDetail.shortcode].description+='<p>CONTROLLED changed closing criterion.</p>'}})
  assert.equal(result.rejected,false)
  assert.equal(result.jobs.length,0)
  assert.equal(result.evidence.listingComplete,false)
  assert.equal(result.evidence.indiaFacetCount,null)
  assert.notEqual(result.evidence.status,'verified-empty')
  assert.match(result.evidence.reason,/closing-native-role-details-changed/)
})

test('CrewBloom: an additional recruiting channel keeps valid source observations partial',async t=>{
  const result=await exercise(t,{change:s=>{s.primary.html+='<a href="https://recruit.example/careers">Other careers</a>'}})
  assertNativeJob(result)
  assert.equal(result.evidence.listingComplete,false)
  assert.equal(result.evidence.indiaFacetCount,null)
  assert.equal(result.jobs[0].sourceScopeComplete,false)
  assert.equal(result.jobs[0].lifecycleCleanupAllowed,false)
})

test('CrewBloom: opaque native transport failure retains identity with no extra read or empty snapshot',async t=>{
  const reason=Object.freeze(Object.defineProperty({},'message',{get(){assert.fail('Opaque transport reason must not be formatted')}}))
  const result=await exercise(t,{onCall:({call})=>{if(call.url===URLS.account)throw reason}})
  assertUnavailable(result)
  assert.equal(result.error,reason)
  assert.deepEqual(result.calls.map(c=>c.url),[URLS.corporate,URLS.account])
})

test('CrewBloom: source-local request mapping fails unrecognized legacy listing fields before native listing I/O',async t=>{
  for(const change of [body=>({...body,remote:['remote']}),body=>({...body,unqualified:true}),body=>({...body,query:'India'})]){
    const original=JSON.stringify
    const mock=t.mock.method(JSON,'stringify',(value,...args)=>original(value&&Object.hasOwn(value,'query')&&Object.hasOwn(value,'remote')?change(value):value,...args))
    let result
    try{result=await exercise(t)}finally{mock.mock.restore()}
    assertUnavailable(result)
    assert.equal(result.error.code,'CREWBLOOM_NATIVE_REQUEST_INVALID')
    assert.deepEqual(result.calls.map(c=>c.url),[URLS.corporate,URLS.account])
  }
})

const deadlineDeferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const deadlineFlush=async()=>{for(let turn=0;turn<6;turn++)await new Promise(setImmediate)}

// Owner regressions copied from the independent header/body reproductions.
// Only the corporate and bounded one-role envelopes are synthetic; original
// account/role bodies, publication and full country arrays remain unchanged.
for(const stage of ['headers','body'])test('CrewBloom: default native JSON own deadline rejects late '+stage+' after owned settlement',async t=>{
  const timeout=new AbortController(),gate=deadlineDeferred(),started=deadlineDeferred()
  const reason=Object.freeze(Object.assign(new Error('CONTROLLED local native JSON deadline'),{name:'TimeoutError'}))
  const originalTimeout=AbortSignal.timeout,originalJson=Response.prototype.json
  const timeoutMock=t.mock.method(AbortSignal,'timeout',ms=>ms===30000?timeout.signal:originalTimeout(ms))
  let lateAccountBodyStarts=0,settled=false,result
  const jsonMock=t.mock.method(Response.prototype,'json',function(...args){
    if(this.url===URLS.account){
      if(timeout.signal.aborted)lateAccountBodyStarts++
      if(stage==='body'){started.resolve();return gate.promise}
    }
    return Reflect.apply(originalJson,this,args)
  })
  const pending=exercise(t,{defaultTransport:true,onCall:({call})=>{
    if(call.url===URLS.account&&stage==='headers'&&!timeout.signal.aborted){started.resolve();return gate.promise}
  }}).then(value=>{settled=true;return value})
  try{
    await started.promise;timeout.abort(reason);await deadlineFlush()
    assert.equal(settled,false,'Direct IO ownership remains held until actual fetch/body settlement')
    gate.resolve(structuredClone(account));result=await pending
    assertUnavailable(result)
    assert.equal(result.error,reason)
    assert.deepEqual(result.calls.map(call=>call.url),[URLS.corporate,URLS.account])
    assert.equal(result.calls[1].signal.aborted,true)
    assert.equal(result.calls[1].signal.reason,reason)
    if(stage==='headers')assert.equal(lateAccountBodyStarts,0)
  }finally{gate.resolve(structuredClone(account));await pending;jsonMock.mock.restore();timeoutMock.mock.restore()}
})

test('CrewBloom: expired unread response disposal remains owned and observed before deadline rejection',async t=>{
  const timeout=new AbortController(),header=deadlineDeferred(),started=deadlineDeferred(),dispose=deadlineDeferred(),disposeStarted=deadlineDeferred()
  const reason=Object.freeze(Object.assign(new Error('CONTROLLED local JSON expiry before disposal'),{name:'TimeoutError'}))
  const originalTimeout=AbortSignal.timeout,originalCancel=ReadableStream.prototype.cancel,originalJson=Response.prototype.json
  const timeoutMock=t.mock.method(AbortSignal,'timeout',ms=>ms===30000?timeout.signal:originalTimeout(ms))
  let cancelCalls=0,jsonStarts=0,settled=false,result
  const cancelMock=t.mock.method(ReadableStream.prototype,'cancel',function(...args){
    if(timeout.signal.aborted&&cancelCalls++===0){disposeStarted.resolve();return dispose.promise.then(()=>Reflect.apply(originalCancel,this,args))}
    return Reflect.apply(originalCancel,this,args)
  })
  const jsonMock=t.mock.method(Response.prototype,'json',function(...args){if(this.url===URLS.account&&timeout.signal.aborted)jsonStarts++;return Reflect.apply(originalJson,this,args)})
  const pending=exercise(t,{defaultTransport:true,onCall:({call})=>{
    if(call.url===URLS.account&&!timeout.signal.aborted){started.resolve();return header.promise}
  }}).then(value=>{settled=true;return value})
  try{
    await started.promise;timeout.abort(reason);await deadlineFlush()
    assert.equal(settled,false)
    header.resolve(structuredClone(account))
    await Promise.race([disposeStarted.promise,pending.then(()=>assert.fail('Expired unread response disposal must be observed'))])
    await deadlineFlush()
    assert.equal(settled,false,'Source cannot settle before its observed response disposal completes')
    dispose.resolve();result=await pending
    assertUnavailable(result)
    assert.equal(result.error,reason)
    assert.equal(cancelCalls,1)
    assert.equal(jsonStarts,0)
    assert.deepEqual(result.calls.map(call=>call.url),[URLS.corporate,URLS.account])
  }finally{header.resolve(structuredClone(account));dispose.resolve();await pending;jsonMock.mock.restore();cancelMock.mock.restore();timeoutMock.mock.restore()}
})

test('CrewBloom: null,zero and opaque parent aborts retain priority over the local JSON deadline',async t=>{
  let reads=0
  const opaque=Object.freeze(Object.defineProperties({},{message:{get(){reads++;throw Error('message must remain opaque')}},code:{get(){reads++;throw Error('code must remain opaque')}}}))
  for(const parentReason of [null,0,opaque]){
    const timeout=new AbortController(),parent=new AbortController(),gate=deadlineDeferred(),started=deadlineDeferred()
    const localReason=Object.freeze(Object.assign(new Error('CONTROLLED local request expiry'),{name:'TimeoutError'}))
    const originalTimeout=AbortSignal.timeout,originalJson=Response.prototype.json
    const timeoutMock=t.mock.method(AbortSignal,'timeout',ms=>ms===30000?timeout.signal:originalTimeout(ms))
    let jsonStarts=0,settled=false,result
    const jsonMock=t.mock.method(Response.prototype,'json',function(...args){if(this.url===URLS.account)jsonStarts++;return Reflect.apply(originalJson,this,args)})
    const pending=exercise(t,{defaultTransport:true,options:{signal:parent.signal},onCall:({call})=>{
      if(call.url===URLS.account&&!timeout.signal.aborted){started.resolve();return gate.promise}
    }}).then(value=>{settled=true;return value})
    try{
      await started.promise;timeout.abort(localReason);parent.abort(parentReason);await deadlineFlush()
      assert.equal(settled,false)
      gate.resolve(structuredClone(account));result=await pending
      assertUnavailable(result)
      assert.equal(result.error,parentReason)
      assert.equal(jsonStarts,0)
      assert.deepEqual(result.calls.map(call=>call.url),[URLS.corporate,URLS.account])
    }finally{gate.resolve(structuredClone(account));await pending;jsonMock.mock.restore();timeoutMock.mock.restore()}
  }
  assert.equal(reads,0)
})
