import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {collectPurplleTurboHire,API,BOARD_URL,ORIGIN} from './turboHire.js'
import {createPurplleScraper,run as runCurrent} from './script.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {getSourceDescription} from '../../src/utils/jobSourceContent.js'
import Job from '../../src/models/Job.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-deployment-20261114.json.gz',import.meta.url))))
const originals=new Map(fixture.packets.map(packet=>[packet.url,packet]))
const hash=body=>createHash('sha256').update(body).digest('hex')
const stop=Object.freeze(new Error('Owned offline boundary: anonymous bootstrap and all job data are outside this deployment fixture'))
const collect=options=>collectPurplleTurboHire({signal:AbortSignal.timeout(15000),now:'2026-11-14T21:45:00Z',
  retainedResponses:[],maxJobs:2,requestIntervalMs:0,...options})

const replay=({change=packet=>packet,seen=[]}={})=>async(url,init={})=>{
  seen.push({url,method:init.method??'GET'})
  if(url===API+'/api/token/noauth'){
    assert.equal(init.method,'GET')
    assert.equal(init.body,undefined)
    assert.equal(init.headers.Authorization,undefined)
    throw stop
  }
  const packet=originals.get(url)
  assert.ok(packet,'No genuine original for '+url)
  const current=change(structuredClone(packet))
  const response=new Response(current.body,{status:current.status,headers:current.headers})
  Object.defineProperty(response,'url',{value:current.finalUrl})
  return response
}

test('the genuine current six-program deployment reaches the owned pre-bootstrap boundary',async()=>{
  const seen=[]
  await assert.rejects(collect({fetchImpl:replay({seen})}),error=>error===stop)
  assert.deepEqual(seen.slice(0,-1).map(call=>call.url),fixture.packets.map(packet=>packet.url))
  assert.equal(seen.length,11)
  assert.ok(seen.every(call=>call.method==='GET'))
})

test('deployment regression data retains ten genuine public responses and no issued credentials',()=>{
  assert.equal(fixture.genuineOriginalObservationsOnly,true)
  assert.equal(fixture.packets.length,10)
  for(const packet of fixture.packets){
    assert.equal(Buffer.byteLength(packet.body),packet.bytes)
    assert.equal(hash(packet.body),packet.sha256)
    assert.ok(!packet.url.includes('/api/token/'))
  }
  assert.equal(fixture.packets.filter(packet=>packet.url.endsWith('.js')).length,6)
})

for(const original of fixture.packets.filter(packet=>packet.url.endsWith('.js'))){
  test('current whole-program hash rejects a mutation of '+new URL(original.url).pathname,async()=>{
    let reached=false
    const seen=[]
    await assert.rejects(collect({fetchImpl:replay({seen,change:packet=>{
      if(packet.url!==original.url)return packet
      reached=true
      packet.body+='\n/* owned unreviewed deployment mutation */'
      assert.notEqual(hash(packet.body),original.sha256)
      return packet
    }})}),/current native client bytes changed/)
    assert.equal(reached,true)
    assert.equal(seen.at(-1).url,original.url)
    assert.ok(!seen.some(call=>call.url.includes('/api/')))
  })
}

for(const [name,edit,message]of [
  ['mixed old and new script filenames',html=>html.replace('/runtime-main.22581bcb0af0126ad3a1.js','/runtime-main.a3801c5ec8c75a558b86.js'),/native public program declarations changed/],
  ['unknown hidden program',html=>html.replace('</body>','<script hidden src="https://unknown.invalid/native.js"></script></body>'),/native public program declarations changed/],
  ['current inline program mutation',html=>html.replace('<script>','<script>window.ownedUnknown=true;'),/native inline programs changed/],
  ['current stylesheet change',html=>html.replace('/static/css/main.a21a9906.chunk.css','/static/css/main.unreviewed.chunk.css'),/native stylesheets changed/],
])test('current shell rejects '+name,async()=>{
  let reached=false
  const seen=[]
  await assert.rejects(collect({fetchImpl:replay({seen,change:packet=>{
    if(packet.url!==BOARD_URL)return packet
    const before=packet.body
    packet.body=edit(packet.body)
    assert.notEqual(packet.body,before)
    reached=true
    return packet
  }})}),message)
  assert.equal(reached,true)
  assert.equal(seen.at(-1).url,BOARD_URL)
})

test('synthetic public-bootstrap denial stays an error with no role or credential retention',async()=>{
  const retainedResponses=[],seen=[],original=replay({seen})
  await assert.rejects(collect({retainedResponses,fetchImpl:async(url,init)=>{
    if(url!==API+'/api/token/noauth')return original(url,init)
    seen.push({url,method:init.method})
    const denied=new Response(null,{status:403})
    Object.defineProperty(denied,'url',{value:url})
    return denied
  }}),error=>error.status===403&&error.requestUrl===API+'/api/token/noauth')
  assert.equal(seen.length,11)
  assert.equal(seen.at(-1).url,API+'/api/token/noauth')
  assert.deepEqual(Object.keys(retainedResponses.at(-1)).sort(),['bodyUnread','capturedAt','contentType','finalUrl','method','status','url'])
  assert.equal(retainedResponses.at(-1).bodyUnread,true)
})

const legacyShell=body=>body.replace('/runtime-main.22581bcb0af0126ad3a1.js','/runtime-main.a3801c5ec8c75a558b86.js')
  .replace('/18.31a01dec5cce83de3a1c.chunk.js','/18.0a0a3f53b49041744779.chunk.js')
  .replace('/30.726ffa16663af89e0bd8.chunk.js','/30.812b9abed47cf2099f54.chunk.js')
  .replace('/main.abf08ac7a40e59d79668.chunk.js','/main.bc8f2fdf0fa9e74f4468.chunk.js')

test('the legacy declaration profile still selects its original first client',async()=>{
  const legacyBoundary=Object.freeze(new Error('Owned legacy first-client boundary'))
  const expected=ORIGIN+'/runtime-main.a3801c5ec8c75a558b86.js'
  let reached=false
  const original=replay({change:packet=>packet.url===BOARD_URL?{...packet,body:legacyShell(packet.body)}:packet})
  await assert.rejects(collect({fetchImpl:async(url,init)=>{
    if(url===expected){reached=true;throw legacyBoundary}
    return original(url,init)
  }}),error=>error===legacyBoundary)
  assert.equal(reached,true)
})

test('a synthetic role shell from the legacy deployment cannot be paired with the current board',async()=>{
  // Deliberately synthetic negative data only. No historical/current role,
  // publication, application or issued credential is qualified by this test.
  const id='11111111-2222-3333-4444-555555555555'
  const org={OrgID:'3ed17e54-f66f-4ade-90b9-ef064dc6fbd6',OrgName:'Purplle.com',OrgURL:'https://www.purplle.com/',CareerPageSubdomain:'purplle',IsCareerPagePublished:true}
  const row={JobId:id,JobTitle:'Owned negative only',OrgDetails:org}
  let legacyRoleReached=false
  const current=replay()
  await assert.rejects(collect({fetchImpl:async(url,init)=>{
    if(originals.has(url))return current(url,init)
    let body,contentType='application/json'
    if(url===API+'/api/token/noauth')body=JSON.stringify({access_token:'synthetic-public-session',token_type:'Bearer',expires_in:3600,ShouldRedirect:false})
    else if(url.startsWith(API+'/api/publicorganizations'))body=JSON.stringify(org)
    else if(url.startsWith(API+'/api/careerpagev2/filteredjobs?'))body=JSON.stringify({Total:1,Result:[row]})
    else if(url===ORIGIN+'/job/publicjobs/'+id+'?utm_source=CareerPage'){
      legacyRoleReached=true
      body=legacyShell(originals.get(BOARD_URL).body)
      contentType='text/html'
    }else if(url===API+'/api/publicjobs/'+id+'?fieldVisibility=CareerPage')body=JSON.stringify({ownedNegativeOnly:true})
    else assert.fail('Unexpected synthetic negative URL '+url)
    const response=new Response(body,{status:200,headers:{'content-type':contentType}})
    Object.defineProperty(response,'url',{value:url})
    return response
  }}),/native board\/role client deployment disagreement/)
  assert.equal(legacyRoleReached,true)
})

// The nine packets below are genuine current observations13–21. Reusing an
// opening role packet for a second visit is offline replay, never a physical
// current closing observation. No issued token body/value/digest is retained.
const criteriaFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-criteria-20261115.json.gz',import.meta.url))))
const currentPackets=[...fixture.packets,...criteriaFixture.packets]
const selectedIDs=['0e971602-5277-4d35-aad7-a11fce3a2c06','dbb5c4fa-69fa-4bea-ad2b-ee8c86180cf7']
const rolePackets=criteriaFixture.packets.filter(packet=>[16,17,18,19].includes(packet.originalReceiptIndex))
const nativeListing=JSON.parse(criteriaFixture.packets.find(packet=>packet.originalReceiptIndex===15).body)
const syntheticSession='synthetic-owned-current-data-replay-never-issued'
const listBody=JSON.stringify({SortByV2:{Key:'PostedDate',Order:2},
  ...Object.fromEntries(['BunitIds','Experience','JobTypes','JobTypeV2','Locations','CreatedDate','Compensation','Skills','ClientIds'].map(key=>[key,{Value:null,FilterType:0}])),
  Keyword:'',Department:'',CustomFields:{}})
const fullReplay=({change=packet=>packet,seen=[],controller=null}={})=>async(url,init={})=>{
  const visit=seen.filter(call=>call.url===url).length+1
  seen.push({url,method:init.method??'GET',visit})
  assert.equal(init.redirect,'manual')
  assert.ok(init.signal)
  let packet
  if(url===API+'/api/token/noauth'){
    assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.headers.Authorization,undefined)
    packet={url,finalUrl:url,status:200,headers:{'content-type':'application/json;charset=utf-8'},
      body:JSON.stringify({access_token:syntheticSession,token_type:'Bearer',expires_in:3600,ShouldRedirect:false})}
  }else{
    const choices=currentPackets.filter(packet=>packet.url===url)
    assert.ok(choices.length,'No genuine current input for '+url)
    packet=structuredClone(choices[Math.min(visit-1,choices.length-1)])
    if(new URL(url).origin===API){
      assert.equal(init.headers.Authorization,'Bearer '+syntheticSession)
      assert.equal(init.headers.Origin,ORIGIN)
      assert.equal(init.headers.Referer,ORIGIN+'/')
    }else assert.equal(init.headers.Authorization,undefined)
    if(init.method==='POST'){assert.equal(init.body,listBody);assert.equal(init.headers['Content-Type'],'application/json;charset=UTF-8')}
  }
  packet=change(packet,{visit,init,controller})
  const response=new Response(packet.stream??packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
}
const fullCollect=options=>collectPurplleTurboHire({signal:AbortSignal.timeout(20000),now:'2026-11-15T05:06:30Z',retainedResponses:[],maxJobs:2,requestIntervalMs:0,...options})
const supplement=(description,label)=>{
  const match=description.match(new RegExp('<h2>'+label+'</h2>(?:<p>[^<]*</p>)?<pre>([\\s\\S]*?)</pre>'))
  assert.ok(match,'Missing complete native supplement: '+label)
  return JSON.parse(decodeNativeEntities(match[1]))
}

test('current criteria fixture preserves only nine genuine originals and excludes issued credentials',()=>{
  assert.equal(criteriaFixture.genuineOriginalObservationsOnly,true)
  assert.equal(criteriaFixture.packets.length,9)
  assert.deepEqual(criteriaFixture.packets.map(packet=>packet.originalReceiptIndex),[13,14,15,16,17,18,19,20,21])
  assert.equal(criteriaFixture.physicalSelectedRoleClosingObserved,false)
  for(const packet of criteriaFixture.packets){assert.equal(Buffer.byteLength(packet.body),packet.bytes);assert.equal(hash(packet.body),packet.sha256);assert.ok(!packet.url.includes('/api/token/'))}
})

test('current complete JobPosting and native criteria persist after strict Job serialization',async()=>{
  const seen=[],retainedResponses=[],result=await fullCollect({fetchImpl:fullReplay({seen}),retainedResponses})
  assert.deepEqual(result.jobs.map(job=>job.jobId),selectedIDs)
  for(const [index,job]of result.jobs.entries()){
    const dto=JSON.parse(rolePackets[index*2+1].body),stored=new Job({...job,description:getSourceDescription(job)}).toObject(),description=getSourceDescription(stored)
    assert.equal(Object.hasOwn(stored,'nativeSourceRecord'),false)
    assert.equal(description,job.sourceDescription)
    assert.equal(description,job.jobDescription)
    // The approved active rich prefix is retained exactly; its native source
    // extraction is not identical to the raw V2 carrier's wrapper bytes.
    const priorRich=[
      {length:3075,sha256:'2dea374bfd99766071a30020eacca5a8a10fa90aa08130fda373198936551bff'},
      {length:3726,sha256:'e819c1eb4cb8e79b5306efb5c329ce2d00d240915d0edd0b7be85417ddbb8ee2'},
    ][index]
    assert.equal(hash(description.slice(0,priorRich.length)),priorRich.sha256)
    const posting=supplement(description,'Original native JobPosting'),criteria=supplement(description,'Original native role criteria')
    assert.deepEqual(posting,job.nativeSourceRecord.nativeJobPosting)
    assert.equal(posting.workHours,'40 hours per week');assert.equal(posting.industry,'Computer Software')
    for(const key of ['JobDescription','JobDescriptionV2','ClientDesc','ClientDescV2','Department','NumberOfVacancy','HideVacancy','Experience','Skills','PublishedDate','PublishedDates','ExpiryDates'])assert.deepEqual(criteria.detail[key],dto[key],key)
    for(const key of ['RolesAndResponsibilities','RolesAndResponsibilitiesV2','Eligibility','EligibilityV2'])assert.equal(Object.hasOwn(criteria.detail,key),Object.hasOwn(dto,key))
    assert.equal(criteria.detail.Department,index===0?'Operations_PB':'Online Distribution')
    assert.equal(criteria.detail.AdditionalFields[0].Value,'')
    assert.deepEqual(criteria.detail.AdditionalFields[0].JobCustomField,{FieldName:'Department',FieldDescription:'Department',FieldType:'SingleOption',IsMandatory:true})
    assert.equal(Object.hasOwn(criteria.detail,'CTCInfo'),index===1)
    assert.deepEqual(criteria.listing.CTCInfo,nativeListing.Result[index].CTCInfo)
    if(index===1)assert.deepEqual(criteria.detail.CTCInfo.HiddenFrom,['JobSeekers','Interviewers','OfferApprovers','CandidateSharedList'])
    for(const value of [criteria.listing,criteria.detail])for(const key of ['OrgDetails','CreatedByEmail','CreatedByName','CreatedById','ResumeStates','ScorecardTemplateId'])assert.equal(Object.hasOwn(value,key),false,key)
    assert.equal(Object.hasOwn(criteria.detail.AdditionalFields[0].JobCustomField,'FieldMetadata'),false)
    assert.equal(job.country,'India');assert.equal(job.activeApplyVerified,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceScopeComplete,false)
  }
  assert.equal(seen.length,24)
  for(const packet of rolePackets)assert.equal(seen.filter(call=>call.url===packet.url).length,2)
  const anonymous=retainedResponses.find(packet=>packet.url.endsWith('/api/token/noauth'))
  for(const key of ['body','bodySHA256','originalBodySHA256'])assert.equal(Object.hasOwn(anonymous,key),false)
})

test('maxJobs1 respects first native order and reserves its complete closing pair',async()=>{
  const seen=[],result=await fullCollect({maxJobs:1,fetchImpl:fullReplay({seen})})
  assert.deepEqual(result.jobs.map(job=>job.jobId),selectedIDs.slice(0,1));assert.equal(seen.length,20)
  for(const packet of rolePackets.slice(0,2))assert.equal(seen.filter(call=>call.url===packet.url).length,2)
  assert.ok(!seen.some(call=>call.url.includes(selectedIDs[1])))
})

test('maxJobs13 rejects closing-capacity overcommit before any native role hydration',async()=>{
  const seen=[],boundary=Object.freeze(new Error('Owned first-known-role observation boundary')),normal=fullReplay({seen})
  let roleStarted=false
  await assert.rejects(fullCollect({maxJobs:13,fetchImpl:async(url,init)=>{
    if(url===rolePackets[0].url){roleStarted=true;throw boundary}
    return normal(url,init)
  }}),error=>error!==boundary&&/closing read capacity/i.test(error.message)&&error.abortRetries===true)
  assert.equal(roleStarted,false);assert.equal(seen.length,14)
})

for(const [label,target,edit]of [
  ['whole HTML comment outside rich criteria',rolePackets[0].url,packet=>({...packet,body:packet.body+'<!-- closing carrier changed -->'})],
  ['full DTO administration excluded from criterion projection',rolePackets[1].url,packet=>{const dto=JSON.parse(packet.body);dto.CreatedByName='Owned closing-only administrative mutation';return{...packet,body:JSON.stringify(dto)}}],
  ['full DTO Department',rolePackets[1].url,packet=>{const dto=JSON.parse(packet.body);dto.Department='Different closing Department';return{...packet,body:JSON.stringify(dto)}}],
])test('closing rejects changed '+label+' before returning jobs',async()=>{
  let reached=false
  await assert.rejects(fullCollect({fetchImpl:fullReplay({change:(packet,{visit})=>{
    if(packet.url!==target||visit!==2)return packet
    reached=true;return edit(packet)
  }})}),/closing native role original bytes changed/)
  assert.equal(reached,true)
})

test('closing compares original streamed bytes when different same-length bytes decode identically',async()=>{
  let reached=false,openingBytes
  await assert.rejects(fullCollect({fetchImpl:fullReplay({change:(packet,{visit})=>{
    if(packet.url!==rolePackets[0].url)return packet
    const prefix=Buffer.from(packet.body+'<!-- owned raw bytes '),suffix=Buffer.from(' -->')
    const raw=Buffer.concat([prefix,Buffer.from([visit===1?0x80:0x81]),suffix])
    if(visit===1)openingBytes=raw
    else{reached=true;assert.equal(raw.length,openingBytes.length);assert.equal(raw.toString('utf8'),openingBytes.toString('utf8'));assert.notEqual(hash(raw),hash(openingBytes))}
    return{...packet,body:raw}
  }})}),/closing native role original bytes changed/)
  assert.equal(reached,true)
})

test('opening streaming bytes reserve mirror closure before another role starts',async()=>{
  let cancelled=false,delivered=0,dtoStarted=false
  const raw=Buffer.concat([Buffer.from(rolePackets[0].body),Buffer.alloc(8500000,32)])
  assert.ok(raw.length<15000000)
  await assert.rejects(fullCollect({fetchImpl:fullReplay({change:packet=>{
    if(packet.url===rolePackets[1].url)dtoStarted=true
    if(packet.url!==rolePackets[0].url)return packet
    return{...packet,stream:new ReadableStream({pull(controller){const chunk=raw.subarray(delivered,delivered+65536);delivered+=chunk.length;if(chunk.length)controller.enqueue(chunk);else controller.close()},cancel(){cancelled=true}})}
  }})}),/closing byte reservation|bounded native body exceeded/)
  assert.equal(dtoStarted,false);assert.equal(cancelled,true);assert.ok(delivered<raw.length)
})

test('fitting large mirror closes without double-charging its reserved bytes',async()=>{
  const seen=[],result=await fullCollect({fetchImpl:fullReplay({seen,change:packet=>packet.url===rolePackets[0].url?{...packet,body:packet.body+' '.repeat(6000000)}:packet})})
  assert.equal(result.jobs.length,2);assert.equal(seen.length,24)
})

test('opaque caller abort during selected closing preserves reason and stops following reads',async()=>{
  const controller=new AbortController(),reason=Object.freeze({ownedOpaqueReason:'stop-selected-closing'}),seen=[]
  let cancelled=false,reached=false
  await assert.rejects(fullCollect({signal:controller.signal,fetchImpl:fullReplay({seen,controller,change:(packet,{visit})=>{
    if(packet.url!==rolePackets[0].url||visit!==2)return packet
    reached=true
    return{...packet,stream:new ReadableStream({pull(){controller.abort(reason);return new Promise(()=>{})},cancel(){cancelled=true}})}
  }})}),error=>error===reason)
  assert.equal(reached,true);assert.equal(cancelled,true);assert.equal(seen.at(-1).url,rolePackets[0].url)
})

const corporateURL='https://www.purplle.com/careers'
for(const entry of ['factory','run'])test('current '+entry+' corporate247 route preserves full native criteria and25 physical replay reads',async()=>{
  // Separate-phase routing replay: simulated body-unread corporate247, saved
  // native19 packets and synthetic session/closing reuse. This exercises the
  // independent-channel outage route, never a refused LinkedIn origin.
  const seen=[],nativeSeen=[],native=fullReplay({seen:nativeSeen})
  const options={now:'2026-11-15T05:06:30Z',requestIntervalMs:0,fetchImpl:async(url,init)=>{
    seen.push(url)
    if(url===corporateURL){const response=new Response('Corporate upstream unavailable',{status:247});Object.defineProperty(response,'url',{value:url});return response}
    return native(url,init)
  }}
  const jobs=entry==='factory'?await createPurplleScraper(options).run():await runCurrent(options)
  assert.deepEqual(jobs.map(job=>job.jobId),selectedIDs);assert.equal(seen.length,25);assert.equal(nativeSeen.length,24)
  assert.equal(seen.includes('https://www.linkedin.com/company/purplle-com/'),false)
  assert.deepEqual(jobs[0].nativeSourceRecord.nativePublisher.corporateUnavailable,{url:corporateURL,status:247})
  assert.equal(supplement(getSourceDescription(jobs[0]),'Original native JobPosting').workHours,'40 hours per week')
  assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})
