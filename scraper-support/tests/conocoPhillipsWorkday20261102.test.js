import assert from 'node:assert/strict'
import fs from 'node:fs'
import {syncBuiltinESMExports} from 'node:module'
import nodeTest from 'node:test'
import {createCatalogScraper} from '../providers/index.js'
import {acquireWorkdaySourceAdmission} from '../shared/workdaySourceAdmission.js'
import {runScraperWithTimeout} from '../runner.js'
import {
  SOURCE,PROFILE,source,configPath,sha,fixture,packet,nativeListing,nativeDetail,selected,provider,
  exercise,assertNativeIncomplete,assertNativeHeld,assertNoAuthority,
} from './conocoPhillipsWorkday20261102.helpers.mjs'
const test=(name,run)=>nodeTest(name,{concurrency:false,timeout:5000},run)

test('ConocoPhillips: exact five native observations retain20-of24, full US role and original metadata/clocks',()=>{
  assert.equal(fixture.capturedResponses.length,5)
  assert.equal(fixture.sourceScopeComplete,false)
  assert.equal(fixture.companyTotals,null)
  assert.equal(fixture.indiaTotals,null)
  assert.equal(fixture.syntheticClosingResponsesStored,false)
  assert.equal(nativeListing.total,24)
  assert.equal(nativeListing.jobPostings.length,20)
  const hashes={
    'official-careers':'994cc9b7cbb045b244489696fe76c1b913273bb34389c1a301e6695935b50b9c',
    'declared-board-html':'e283c405422fef75516a4048dd528ac37ab4f74a904adcbc55d34277544a980a',
    'session-bootstrap':'4d1d1f0ded5ca9b5557d34c3fe917c93a2906a10bbe75098f30241c03243e036',
    'unfiltered-listing-prefix':'229f6b498ae435cd397908034120d8cc0d2d143cea38beba95f8ac5c2af7e3ff',
    'selected-native-detail':'f973c0a9b966fe9e819530a0fc6f67fb51bcc8df3d3618c790fd25970df0ec65',
  }
  for(const [kind,hash]of Object.entries(hashes))assert.equal(sha(packet(kind).body),hash)
  for(const observation of fixture.observations){
    const b=Buffer.from(observation.rawBase64,'base64')
    assert.equal(b.length,observation.bytes)
    assert.equal(sha(b),observation.sha256)
    assert.deepEqual(JSON.parse(b),observation.data)
  }
  const info=nativeDetail.jobPostingInfo
  assert.equal(info.jobReqId,'REQ-006232')
  assert.equal(info.title,'Graduate, Engineering 2027')
  assert.equal(info.startDate,'2026-11-01')
  assert.equal(info.endDate,'2026-11-10')
  assert.equal(info.posted,true)
  assert.equal(info.canApply,true)
  assert.equal(info.jobDescription.length,7769)
  assert.equal(sha(info.jobDescription),'7f2d5ca0799d36721e9a21dc5eb771cc341a08485bf8cb263c4bea95565a69d6')
  assert.equal(info.country.descriptor,'United States of America')
  assert.equal(info.jobRequisitionLocation.country.alpha2Code,'US')
  assert.deepEqual(info.additionalLocations,['Dickinson, ND','Loving, NM','Carlsbad, NM','Anchorage, AK','Kenedy, TX','Watford City, ND','Midland, TX'])
  assert.equal(selected.locationsText,'8 Locations')
})

test('ConocoPhillips: original August1 verification declaration remains historical',()=>{
  assert.equal(source.VERIFIED_ON,'2026-08-01')
})

test('ConocoPhillips: synthetic one-role model reconciles while secondary-country scope stays unresolved',async t=>{
  assertNativeIncomplete(await exercise(t))
})

test('ConocoPhillips: registered source keeps unresolved-country coverage gaps and null catalog totals',async t=>{
  assertNativeIncomplete(await exercise(t,{registered:true}))
  const p=provider()
  assert.equal(p.source,SOURCE)
  assert.equal(p.adapter,'script')
  assert.equal(p.companyName,'ConocoPhillips')
  assert.equal(p.verifiedPublicJobCount,null)
  assert.equal(p.verifiedIndiaJobCount,null)
  assert.notEqual(p.bindingEvidence?.verified,true)
})

test('ConocoPhillips: exact retained20-of24 prefix cannot invent the uncaptured continuation or certify zero',async t=>{
  const result=await exercise(t,{mode:'native-prefix'})
  assert.equal(result.rejected,true)
  assertNoAuthority(result)
  assert.deepEqual(result.calls.filter(c=>c.method==='POST').map(c=>c.body.offset),[0,20])
  assert.equal(result.calls.some(c=>c.url===packet('selected-native-detail').nativeMetadata.url),false)
  assert.equal(nativeListing.total,24)
  assert.equal(nativeListing.jobPostings.length,20)
})

test('ConocoPhillips: caller fields cannot replace source,company,board,config directory or unfiltered geography',async t=>{
  assertNativeIncomplete(await exercise(t,{options:{
    source:'foreign-source',company:'Foreign Company',baseUrl:'https://foreign.example/Other',
    scraperDir:'C:/controlled-unavailable-foreign-dir',locationCountry:'c4f78be1a8f14da0ab49ce1162348a5e',
    boardIdentityVerified:true,searchText:'India',inventoryScope:'legacy-filtered',
  }}))
})

test('ConocoPhillips: pre-aborted opaque Error,object,string,null and zero settle exactly before config or IO',async t=>{
  const opaque=Object.freeze(Object.defineProperty({},'code',{get(){assert.fail('Opaque caller code getter must not be read')}}))
  for(const reason of [Object.freeze(new Error('caller')),opaque,'caller',null,0]){
    const controller=new AbortController()
    controller.abort(reason)
    const result=await exercise(t,{options:{signal:controller.signal}})
    assert.equal(result.rejected,true)
    assert.equal(result.error,reason)
    assert.equal(result.calls.length,0)
  }
})

test('ConocoPhillips: direct caller abort retains owned primary read then returns object,null and zero after drain',async t=>{
  for(const reason of [Object.freeze({opaque:'pending'}),null,0]){
    const controller=new AbortController()
    let rejectLate,result,settled=false,held=0,released=0
    const pending=exercise(t,{options:{signal:controller.signal,requestScheduler:{
      acquire:async()=>{held++;return ()=>{held--;released++}},recordRateLimit(){},
    }},handle:({calls})=>{
      if(calls.length===1){queueMicrotask(()=>controller.abort(reason));return new Promise((resolve,reject)=>{rejectLate=reject})}
    }}).then(value=>{settled=true;return value})
    try{
      for(let turn=0;turn<8;turn++)await new Promise(setImmediate)
      assert.equal(typeof rejectLate,'function','Expected the controlled primary reader to start')
      assert.equal(controller.signal.aborted,true)
      assert.equal(settled,false,'Direct source ownership must remain until its native read settles')
      assert.equal(held,1)
    }finally{
      rejectLate?.(Object.assign(new Error('CONTROLLED late primary rejection after caller abort'),{abortRetries:true}))
      result=await pending
    }
    assert.equal(result.rejected,true)
    assert.equal(result.error,reason)
    assert.equal(result.calls.length,1)
    assert.equal(result.calls[0].signal.aborted,true)
    assert.equal(result.calls[0].signal.reason,reason)
    assert.equal(held,0)
    assert.equal(released,1)
  }
})

test('ConocoPhillips: registered runner bounds caller wait but retains request and admission until owned primary settles',async t=>{
  const controller=new AbortController(),reason=Object.freeze(new Error('CONTROLLED registered Conoco caller abort'))
  const registered=createCatalogScraper(provider())
  const calls=[]
  let rejectRaw,held=0,released=0,sourceSettled=false,resolveStarted,resolveSourceSettlement,leaseAfterDrain,timer
  const started=new Promise(resolve=>{resolveStarted=resolve})
  const sourceSettlement=new Promise(resolve=>{resolveSourceSettlement=resolve})
  const mock=t.mock.method(globalThis,'fetch',(input,options={})=>{
    calls.push({url:String(input),method:options.method||'GET',signal:options.signal})
    assert.equal(calls.length,1,'No subsequent request may start after caller abort')
    assert.equal(calls[0].url,PROFILE.officialCareersUrl)
    assert.equal(calls[0].method,'GET')
    resolveStarted()
    return new Promise((resolve,reject)=>{rejectRaw=reject})
  })
  const admitted={...registered,run:options=>registered.run({
    ...options,requestTimeoutMs:1000,retryBaseDelayMs:0,
    requestScheduler:{acquire:async()=>{held++;return ()=>{held--;released++}},recordRateLimit(){}},
  }).finally(()=>{sourceSettled=true;resolveSourceSettlement()})}
  const operation=runScraperWithTimeout(admitted,1000,{
    signal:controller.signal,abortGraceMs:10,nativeDetailRecovery:false,admissionTimeoutMs:1000,
  }).then(value=>({rejected:false,value}),error=>({rejected:true,error}))
  let queueOutcome,next
  try{
    await Promise.race([started,operation.then(()=>assert.fail('Registered source must reach the controlled native primary read'))])
    queueOutcome=acquireWorkdaySourceAdmission(registered,{admissionTimeoutMs:40})
      .then(lease=>{lease.release();return {rejected:false}},error=>({rejected:true,error}))
    controller.abort(reason)
    const outcome=await Promise.race([
      operation,
      new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Runner caller wait exceeded controlled bound')),250)}),
    ])
    clearTimeout(timer)
    assert.equal(outcome.rejected,true)
    assert.equal(outcome.error,reason)
    assert.equal(sourceSettled,false)
    assert.equal(held,1)
    assert.equal(calls[0].signal.aborted,true)
    assert.equal(calls[0].signal.reason,reason)
    const queued=await queueOutcome
    assert.equal(queued.rejected,true,'A queued admission must retain its finite deadline while the read is held')
    assert.equal(queued.error.code,'WORKDAY_SOURCE_ADMISSION_TIMEOUT')
    assert.equal(queued.error.phase,'queue')
    let admittedAfterDrain=false
    next=acquireWorkdaySourceAdmission(registered,{admissionTimeoutMs:1000})
      .then(lease=>{admittedAfterDrain=true;leaseAfterDrain=lease;return lease})
    await new Promise(setImmediate)
    assert.equal(admittedAfterDrain,false,'Runner completion cannot release an unsettled native owner')
    rejectRaw(Object.assign(new Error('CONTROLLED owned primary finally drained'),{abortRetries:true}))
    await sourceSettlement
    await next
    assert.equal(held,0)
    assert.equal(released,1)
    assert.equal(calls.length,1)
  }finally{
    clearTimeout(timer)
    controller.abort(reason)
    rejectRaw?.(reason)
    await operation
    if(rejectRaw)await sourceSettlement
    if(queueOutcome)await queueOutcome
    if(next)await next
    leaseAfterDrain?.release()
    leaseAfterDrain?.release()
    mock.mock.restore()
  }
})

test('ConocoPhillips: unavailable, foreign-URL, wrong-board or inert primary handoffs stop before board/API',async t=>{
  for(const change of [
    s=>{s.primary.nativeMetadata={...s.primary.nativeMetadata,status:403}},
    s=>{s.primary.nativeMetadata={...s.primary.nativeMetadata,finalURL:'https://foreign.example/careers'}},
    s=>{s.primary.body=Buffer.from('<html><template><a href="'+PROFILE.detailUrlBase+'">Careers</a></template></html>')},
    s=>{s.primary.body=Buffer.from('<html><a href="'+PROFILE.detailUrlBase+'Wrong">Careers</a></html>')},
  ]){
    const r=await exercise(t,{change,options:{boardIdentityVerified:true}})
    assert.equal(r.rejected,true)
    assertNoAuthority(r)
    assert.equal(r.calls.length,1)
  }
})

test('ConocoPhillips: conflicting native requisition,title,site or canonical URL cannot acquire scope or full criteria',async t=>{
  for(const mutate of [
    info=>{info.jobReqId='WRONG-ID'},
    info=>{info.title='Unrelated Role'},
    info=>{info.jobPostingSiteId='WrongSite'},
    info=>{info.externalUrl=info.externalUrl.replace('myworkdayjobs.com','foreign.example')},
  ]){
    const r=await exercise(t,{change:s=>mutate(s.detail.jobPostingInfo)})
    assert.equal(r.rejected,true)
    assertNoAuthority(r)
    assert.ok(r.calls.some(c=>c.url===packet('selected-native-detail').nativeMetadata.url))
    assert.match(r.error?.cause?.message||r.error?.message||'',/requisition|identity|title|site|canonical/i)
  }
})

for(const field of ['posted','canApply'])test('ConocoPhillips: explicit native '+field+'false cannot fall through to an India or empty fallback',async t=>{
  const r=await exercise(t,{change:s=>{s.detail.jobPostingInfo[field]=false}})
  assertNativeHeld(r)
  assert.equal(r.state.detail.jobPostingInfo[field],false)
})

test('ConocoPhillips: missing all native country fields stays unknown and never takes a provider India default',async t=>{
  const r=await exercise(t,{change:s=>{delete s.detail.jobPostingInfo.country;delete s.detail.jobPostingInfo.jobRequisitionLocation.country}})
  assertNativeHeld(r)
  assert.ok(r.calls.some(c=>c.url===packet('selected-native-detail').nativeMetadata.url))
})

test('ConocoPhillips: conflicting native primary countries remain unqualified without changing the seven offices',async t=>{
  const r=await exercise(t,{change:s=>{s.detail.jobPostingInfo.country.alpha2Code='IN'}})
  assert.equal(r.rejected,true)
  assert.equal(r.error?.code,'WORKDAY_NATIVE_COUNTRY_MISMATCH')
  assertNoAuthority(r)
  assert.ok(r.calls.some(c=>c.url===packet('selected-native-detail').nativeMetadata.url))
  assert.equal(r.state.detail.jobPostingInfo.additionalLocations.length,7)
})

const configCases=[
  ['missing',()=>{throw Object.assign(new Error('CONTROLLED missing config'),{code:'ENOENT'})}],
  ['malformed JSON',()=>'{'],
  ['null',()=> 'null'],
  ['array',()=> '[]'],
  ['partial',()=>JSON.stringify({listingStrategy:'jobs-api'})],
  ['wrong scope',()=>JSON.stringify({...PROFILE,inventoryScope:'legacy-filtered'})],
  ['wrong primary',()=>JSON.stringify({...PROFILE,officialCareersUrl:'https://foreign.example/careers'})],
  ['wrong API',()=>JSON.stringify({...PROFILE,jobsApiUrl:PROFILE.jobsApiUrl+'?other=1'})],
  ['wrong board',()=>JSON.stringify({...PROFILE,detailUrlBase:PROFILE.detailUrlBase+'Wrong'})],
  ['implicit India facet',()=>JSON.stringify({...PROFILE,locationCountry:'c4f78be1a8f14da0ab49ce1162348a5e'})],
  ['filtered search',()=>JSON.stringify({...PROFILE,searchText:'India'})],
  ['extra authority',()=>JSON.stringify({...PROFILE,boardIdentityVerified:true})],
]
for(const [label,variant]of configCases)test('ConocoPhillips: '+label+' profile fails before IO instead of central defaults',async t=>{
  const originalRead=fs.readFileSync
  const mock=t.mock.method(fs,'readFileSync',(file,...args)=>String(file)===configPath?variant():originalRead(file,...args))
  syncBuiltinESMExports()
  try{
    const r=await exercise(t)
    assert.equal(r.rejected,true)
    assert.equal(r.error?.code,'WORKDAY_SOURCE_CONFIG_INVALID')
    assert.equal(r.error?.abortRetries,true)
    assert.equal(r.error?.sourceScopeComplete,false)
    assert.equal(r.error?.lifecycleCleanupAllowed,false)
    assert.equal(r.calls.length,0)
  }finally{mock.mock.restore();syncBuiltinESMExports()}
})

test('ConocoPhillips: existing registered Workday admission resolves wd1 without granting catalog authority',async()=>{
  const lease=await acquireWorkdaySourceAdmission(createCatalogScraper(provider()),{admissionTimeoutMs:1000})
  assert.ok(lease)
  try{assert.equal(lease.groupKey,'workday:wd1');assert.equal(lease.signal.aborted,false)}
  finally{lease.release()}
})

