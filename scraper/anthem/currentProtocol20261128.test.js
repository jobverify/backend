import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {run} from './script.js'
import {createPeopleStrongPairScraper} from '../../scraper-support/shared/peopleStrongNativePair20261027.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {scenario} from '../../scraper-support/tests/peopleStrongNativePair20261027.fixtures.js'

globalThis.fetch=()=>{throw Error('OFFLINE_NETWORK_TRIPWIRE')}
const fixture=path=>JSON.parse(gunzipSync(readFileSync(new URL(path,import.meta.url))))
const capture=fixture('./test-data/current-programs-20261128.json.gz')
const amara=fixture('../amararajaenergymobility/test-data/current-programs-20261128.json.gz')
const origin='https://anthemhrcp.peoplestrong.com',base=origin+'/api/cp/rest/altone/cp/'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const main='main-N3GYSHED.js',job='chunk-5KKCXGYG.js',filter='chunk-ZKMRUQJB.js',service='chunk-B7GQ3CPB.js',helper='chunk-IIGMZVP4.js'
const text=packet=>Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const body=(packets,name)=>text(packets.find(packet=>packet.url.endsWith('/'+name)))
for(const packet of capture.packets){
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(sha(bytes),packet.sha256)
  assert.equal(bytes.length,packet.bodyBytes)
}
const rewrite=(packets,name,change)=>{
  const packet=packets.find(packet=>packet.url.endsWith('/'+name))
  assert.ok(packet,name)
  const original=text(packet),changed=change(original)
  assert.notEqual(changed,original,'The control must change the actual captured body: '+name)
  packet.bodyBase64=Buffer.from(changed).toString('base64')
}
async function attempt(mutate=()=>{},options={}){
  const packets=structuredClone(capture.packets),calls=[]
  mutate(packets)
  let error
  try{
    await run({...options,now:capture.startedAt,fetchPage:async(url,init)=>{
      calls.push({url,method:init.method??'GET',body:init.body??null})
      const packet=packets.find(packet=>packet.url===url&&(packet.method??'GET')===(init.method??'GET'))
      if(!packet)throw Error('CONTROLLED_UNCAPTURED_NATIVE_READ '+url)
      return{status:packet.status,url:packet.finalUrl,headers:packet.headers,body:text(packet)}
    }})
  }catch(caught){error=caught}
  assert.ok(error,'The captured program prefix cannot establish uncaptured API inventory or completion')
  return{calls,error}
}

test('genuine Anthem full current programmes equal the independently captured Amara bodies and declare exactly three direct imports',()=>{
  assert.equal(capture.packets.length,8)
  assert.equal(capture.validCurrentCheck,false)
  for(const filename of[main,job,filter,service,helper])assert.equal(body(capture.packets,filename),body(amara.packets,filename),filename)
  const imports=parse(body(capture.packets,job),{ecmaVersion:'latest',sourceType:'module'}).body
    .filter(statement=>statement.type==='ImportDeclaration').map(statement=>statement.source.value)
  assert.deepEqual(imports,['./'+filter,'./'+service,'./'+helper])
  assert.ok(capture.packets.every(packet=>packet.method==='GET'&&!packet.url.startsWith(base)))
})

test('genuine current Anthem graph reads and verifies all three complete direct imports before the uncaptured native tenant GET',async()=>{
  const result=await attempt()
  assert.equal(result.error.message,'CONTROLLED_UNCAPTURED_NATIVE_READ '+base+'urlinfo')
  for(const filename of[job,filter,service,helper])assert.ok(result.calls.some(call=>call.url===origin+'/'+filename),filename)
  assert.deepEqual(result.calls.filter(call=>call.url.startsWith(base)),[{url:base+'urlinfo',method:'GET',body:null}])
  assert.ok(result.calls.every(call=>call.method==='GET'&&call.body===null))
})

for(const[label,mutate]of[
  ['an altered initial filter constructor',packets=>rewrite(packets,job,value=>value.replace('this.filterTO=new q,','this.filterTO=Object.assign(new q,{searchString:"India"}),'))],
  ['a populated filter class',packets=>rewrite(packets,filter,value=>value.replace('class{','class{constructor(){this.searchString="India"}'))],
  ['a changed native page size',packets=>rewrite(packets,service,value=>value.replace(',ay=45,',',ay=100,'))],
  ['a different native search path',packets=>rewrite(packets,service,value=>value.replaceAll('jobs/v1?offset=','jobs/v2?offset='))],
  ['a changed initial request body projection',packets=>rewrite(packets,job,value=>value.replace('bandList:this.filterTO.bandList','bandList:["India"]'))],
  ['a different declared service import',packets=>rewrite(packets,job,value=>value.replace('./'+service,'./chunk-UNKNOWN0.js'))],
  ['a foreign declared helper import',packets=>rewrite(packets,job,value=>value.replace('./'+helper,'https://foreign.invalid/'+helper))],
  ['an omitted declared helper import',packets=>rewrite(packets,job,value=>value.replace('import"./'+helper+'";',''))],
  ['a duplicate declared helper import',packets=>rewrite(packets,job,value=>value+';import"./'+helper+'"')],
  ['an appended main executable',packets=>rewrite(packets,main,value=>value+';globalThis.changedPortalAuthority=true')],
  ['an appended job executable',packets=>rewrite(packets,job,value=>value+';globalThis.changedInitialFilter=true')],
  ['an appended service executable',packets=>rewrite(packets,service,value=>value+';globalThis.changedNativeAuthority=true')],
  ['an appended helper executable',packets=>rewrite(packets,helper,value=>value+';globalThis.changedNativeAuthority=true')],
  ['an unavailable filter body',packets=>{packets.find(packet=>packet.url.endsWith('/'+filter)).status=404}],
  ['an unavailable helper body',packets=>{packets.find(packet=>packet.url.endsWith('/'+helper)).status=404}],
  ['a foreign helper final URL',packets=>{packets.find(packet=>packet.url.endsWith('/'+helper)).finalUrl='https://foreign.invalid/'+helper}],
  ['a foreign service final URL',packets=>{packets.find(packet=>packet.url.endsWith('/'+service)).finalUrl='https://foreign.invalid/'+service}],
  ['a changed employer handoff',packets=>rewrite(packets,'careers/',value=>value.replaceAll(origin,'https://foreign.invalid'))],
])test('current Anthem graph refuses '+label+' before native API reads',async()=>{
  const result=await attempt(mutate)
  assert.equal(result.calls.some(call=>call.url.startsWith(base)),false,result.error.message)
  assert.match(result.error.message,/PeopleStrong native pair:/)
})

test('caller-supplied profile options cannot admit an altered current helper',async()=>{
  const result=await attempt(packets=>rewrite(packets,helper,value=>value+';globalThis.changed=true'),{
    currentProtocol:{jobSHA256:sha(body(capture.packets,job)),directImports:[]},
    protocolProfiles:{'current-20261128':{directImports:[]}},
  })
  assert.equal(result.calls.some(call=>call.url.startsWith(base)),false)
  assert.match(result.error.message,/PeopleStrong native pair:/)
})

test('the shared Amara reader retains its original rejection of the same genuine current programmes',async()=>{
  const calls=[]
  await assert.rejects(createPeopleStrongPairScraper('amararajaenergymobility').run({now:amara.startedAt,fetchPage:async(url,init)=>{
    calls.push(url)
    const packet=amara.packets.find(packet=>packet.url===url&&(packet.method??'GET')===(init.method??'GET'))
    assert.ok(packet,'No unexpected current Amara prefix read: '+url)
    return{status:packet.status,url:packet.finalUrl,body:text(packet)}
  }}),/PeopleStrong native pair: Unverified initial native filter\/search body/)
  assert.equal(calls.some(url=>url.includes('/api/cp/')),false)
})

// The following API/role responses are explicitly synthetic scenarios. Only
// their corporate/client prefix is the genuine current Anthem capture above.
async function currentWithSyntheticAPI(change={},mutatePacket=(_url,_init,result)=>result){
  const s=scenario('anthem',change),calls=[]
  let report
  const jobs=await run({now:'2026-11-27T22:12:32Z',fetchPage:async(url,init)=>{
    calls.push({url,method:init.method,body:init.body??null})
    const packet=capture.packets.find(packet=>packet.url===url)
    if(packet)return{status:packet.status,url:packet.finalUrl,body:text(packet)}
    assert.ok(url.startsWith(base),'Synthetic responses are restricted to the native API')
    return mutatePacket(url,init,await s.fetchPage(url,init),s)
  },onReport:value=>{report=value}})
  return{jobs,report,calls,evidence:readInventoryEvidence(jobs)}
}
const holds=result=>{
  assert.equal(result.report.sourceScopeComplete,false)
  assert.equal(result.report.sourceListingComplete,false)
  assert.equal(result.report.cleanupAllowed,false)
  assert.equal(result.report.verifiedZeroInventory,false)
  assert.equal(result.report.rawJobs,null)
  assert.equal(result.evidence.listingComplete,false)
  assert.equal(result.evidence.reportedTotal,null)
}

test('current programme admission preserves genuine corporate five versus synthetic native zero as an explicit incomplete inventory',async()=>{
  const result=await currentWithSyntheticAPI({empty:true})
  holds(result)
  assert.equal(result.report.delegation.advertisedCount,5)
  assert.equal(result.report.reportedNativeTotal,0)
  assert.equal(result.report.advertisedCountMismatch,true)
  assert.equal(result.report.nativeInventoryComplete,true)
  assert.equal(result.jobs.length,0)
  assert.deepEqual(result.report.pages,[{offset:0,rows:0}])
  assert.deepEqual(result.report.closingPages,result.report.pages)
  assert.equal(result.report.protocol.profile,'anthem-current-20261128')
  assert.equal(result.report.protocol.directImportGraphQualified,true)
  assert.equal(result.report.protocol.websiteProgramExecuted,false)
  assert.equal(result.report.protocol.initialSearchBody,'{}')
  assert.ok(result.calls.filter(call=>call.method==='POST').every(call=>call.body==='{}'&&call.url.includes('&limit=45')))
})

test('current programme admission still rejects a synthetic tenant identity conflict',async()=>{
  await assert.rejects(currentWithSyntheticAPI({empty:true},(url,_init,result)=>url===base+'urlinfo'
    ?{...result,body:JSON.stringify({messageCode:{code:200},response:{url:'foreign.peoplestrong.com'}})}:result),/Native tenant identity mismatch/)
})

test('current programme admission preserves a synthetic contradictory role country without India promotion',async()=>{
  const result=await currentWithSyntheticAPI({mutate:({listing})=>{listing.country='United States'}})
  holds(result)
  assert.equal(result.report.roles.length,1)
  assert.equal(result.report.roles[0].country,null)
  assert.equal(result.report.unknownCountryCount,1)
  assert.equal(result.jobs.length,0)
})

test('current programme admission retains unresolved synthetic HTML criteria and withholds complete details',async()=>{
  const raw='<style>.criteria{display:none}</style><p class="criteria">Unresolved eligibility</p>'
  const result=await currentWithSyntheticAPI({mutate:({detail})=>{detail.jobDescription=raw}})
  holds(result)
  assert.equal(result.report.roles[0].nativePublicFields.jobDescription,raw)
  assert.equal(result.report.roles[0].sourceDetailComplete,false)
  assert.equal(result.jobs.length,0)
})

test('current programme admission preserves the native detail posting identity guard',async()=>{
  const result=await currentWithSyntheticAPI({mutate:({detail})=>{detail.requisitionCode='P-9002'}})
  holds(result)
  assert.equal(result.report.observedNativeRecords,1)
  assert.equal(result.report.nativeInventoryComplete,false)
  assert.match(result.report.failures[0].reason,/Native detail\/request identity conflict/)
  assert.equal(result.jobs.length,0)
})

test('current programme admission preserves the same-posting application URL guard',async()=>{
  const result=await currentWithSyntheticAPI({mutate:({listing})=>{listing.jobDetailUrl='https://foreign.invalid/job/detail/P-9001'}})
  holds(result)
  assert.equal(result.report.nativeInventoryComplete,false)
  assert.match(result.report.failures[0].reason,/Native application\/formal requisition identity missing/)
  assert.equal(result.jobs.length,0)
})

test('current programme admission cannot exhaust pagination on a nonempty synthetic terminal page',async()=>{
  await assert.rejects(currentWithSyntheticAPI({},(url,_init,result,s)=>url===base+'jobs/v1?offset=45&limit=45'
    ?{...result,body:JSON.stringify({messageCode:{code:200},totalRecords:1,response:[s.listing]})}:result),/Native terminal page not empty/)
})
