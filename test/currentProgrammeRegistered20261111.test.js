import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'

// The fixtures are actual acquired opening AND closing packets. Test-only
// mutations below are controls, never live source observations or recoveries.
const cases=[['huntress',46,6],['datafold',2,14],['cloudinary',8,6],['housecallpro',54,16]]
const fixtures=new Map(cases.map(([source])=>{
  const fixtureName=source==='datafold'?'datafold-current-programme-07dd-20261111':`${source}-current-programme-20261111`
  const fixture=JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${fixtureName}.json.gz`,import.meta.url))))
  for(const row of fixture.responses){
    const bytes=Buffer.from(row.bodyBase64,'base64')
    assert.equal(bytes.length,row.bodyBytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)
  }
  return[source,fixture]
}))
const registered=source=>buildScrapers().find(row=>row.name===source)
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Registered fixture controls must not make public requests'))
function replay(source,{changeLegacyPayload=payload=>payload}={}){
  const fixture=fixtures.get(source),nativeCalls=[],legacyCalls=[]
  const opening=new Map(fixture.responses.filter(row=>row.phase.startsWith('opening')).map(row=>[row.requestedURL,row]))
  const apiRow=fixture.responses.find(row=>/^application\/json/i.test(row.contentType)&&/api\.ashbyhq\.com|api\.lever\.co|boards-api\.greenhouse\.io/.test(row.requestedURL))
  assert.ok(apiRow)
  const originalPayload=JSON.parse(Buffer.from(apiRow.bodyBase64,'base64').toString('utf8'))
  return{fixture,nativeCalls,legacyCalls,originalPayload,options:{
    requestIntervalMs:0,
    fetchPage:async url=>{
      legacyCalls.push({url,kind:'legacy-page'})
      const row=opening.get(url)
      // The old discovery's optional asset probes are deliberately unavailable
      // here. They cannot become invented raw evidence in the native replay.
      if(!row)throw new Error('Uncaptured optional legacy resource: '+url)
      return{url:row.finalURL,status:row.status,headers:row.headers,html:Buffer.from(row.bodyBase64,'base64').toString('utf8')}
    },
    fetchJson:async url=>{
      legacyCalls.push({url,kind:'legacy-api'})
      assert.equal(url,apiRow.requestedURL)
      return changeLegacyPayload(structuredClone(originalPayload))
    },
    fetchImpl:async(url,init={})=>{
      const row=fixture.responses[nativeCalls.length]
      assert.ok(row,'Native programme must stay inside its acquired request budget')
      assert.equal(url,row.requestedURL,'Use each acquired opening/closing packet in its actual order')
      assert.equal(init.method||'GET','GET')
      nativeCalls.push({url,cache:init.cache})
      const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers})
      Object.defineProperty(response,'url',{value:row.finalURL});return response
    },
  }}
}

test('registered Huntress cancellation escapes an uncooperative final audit observer',async t=>{
  forbidNetwork(t)
  const r=replay('huntress'),controller=new AbortController()
  let entered=false,announce
  const observerEntered=new Promise(resolve=>{announce=resolve})
  const operation=registered('huntress').run({...r.options,sourceTimeoutMs:5000,signal:controller.signal,onAudit:()=>{
    entered=true;announce();controller.abort(new DOMException('Observer-triggered registered abort','AbortError'))
    return new Promise(()=>{})
  }}).then(()=> 'returned',error=>error.name==='AbortError'?'aborted':error)
  await Promise.race([observerEntered,operation,delay(4000)])
  assert.equal(entered,true,'The actual complete native transaction must reach the final observer')
  assert.equal(await Promise.race([operation,delay(150).then(()=> 'still-pending')]),'aborted')
})

for(const[source,count,reads]of cases){
  test(`registered ${source} qualifies only its complete current native programme and keeps cleanup forbidden`,async t=>{
    forbidNetwork(t)
    const r=replay(source),jobs=await registered(source).run(r.options)
    assert.equal(jobs.length,0)
    const inventory=readInventoryEvidence(jobs)
    assert.equal(inventory.status,'complete-inventory')
    assert.equal(inventory.firstParty,true)
    assert.equal(inventory.listingComplete,true)
    assert.equal(inventory.reportedTotal,count)
    assert.equal(inventory.indiaFacetCount,0)
    assert.equal(inventory.lifecycleCleanupAllowed,false)
    assert.equal(readSourceObservationEvidence(jobs,source).observedRecordCount,count)
    assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,r.originalPayload)
    assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
    assert.equal(jobs.nativeCollectionEvidence.companyGlobalScopeQualified,false)
    assert.equal(jobs.nativeCollectionEvidence.programmeRequestCount,reads)
    const provider=getScraperCatalog().find(row=>row.source===source)
    const terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),
      zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
    assert.equal(terminal.success,true)
    assert.equal(terminal.processingComplete,true)
    assert.equal(terminal.rawRecords,count)
    assert.equal(terminal.zeroJobEvidence,'fetched-zero')
    assert.deepEqual(inventoryCleanupOptions(JSON.parse(JSON.stringify(terminal))),{replaceExisting:false})
    assert.equal(r.nativeCalls.length,reads)
    assert.ok(r.nativeCalls.every(row=>row.cache==='no-store'))
  })

  test(`registered ${source} withholds zero when its earlier native criteria contradict the programme transaction`,async t=>{
    forbidNetwork(t)
    let changed=false
    const r=replay(source,{changeLegacyPayload:payload=>{
      const row=Array.isArray(payload)?payload[0]:payload.jobs[0],key=['huntress','housecallpro'].includes(source)?'content':source==='datafold'?'descriptionHtml':'description'
      const original=row[key]
      row[key]+='<p>Earlier same-attempt authored requirement retained by the bridge.</p>'
      assert.notEqual(row[key],original);changed=true;return payload
    }})
    await assert.rejects(registered(source).run(r.options),error=>error.softFailure===true&&error.failureKind==='coverage_gap')
    assert.equal(changed,true)
  })

  test(`registered ${source} keeps the existing positive India branch without demanding a zero-only renderer`,async t=>{
    forbidNetwork(t)
    const r=replay(source,{changeLegacyPayload:payload=>{
      const row=Array.isArray(payload)?payload[0]:payload.jobs[0]
      if(['huntress','housecallpro'].includes(source)){
        row.location={name:'Bengaluru, India'}
        row.offices=[{id:990001,name:'Bengaluru, India',location:'Bengaluru, India',child_ids:[],parent_id:null}]
      }else if(source==='datafold'){
        row.location='Bengaluru, India'
        row.address={postalAddress:{addressCountry:'IND',addressLocality:'Bengaluru',addressRegion:'Karnataka'}}
        row.secondaryLocations=[]
      }else{
        row.country='IN'
        row.categories.location='Bengaluru, India'
        row.categories.allLocations=['Bengaluru, India']
      }
      if(Array.isArray(payload))return[row]
      payload.jobs=[row]
      if(payload.meta)payload.meta={...payload.meta,total:1}
      if(Object.hasOwn(payload,'total'))payload.total=1
      return payload
    }})
    const jobs=await registered(source).run(r.options)
    assert.equal(jobs.length,1)
    assert.equal(jobs[0].source,source)
    assert.match(jobs[0].location,/India/)
    assert.equal(jobs[0].sourceScopeComplete,false)
    assert.equal(jobs[0].lifecycleCleanupAllowed,false)
    assert.equal(r.nativeCalls.length,0)
  })

  test(`pre-aborted registered ${source} does no legacy or native acquisition`,async t=>{
    forbidNetwork(t)
    const r=replay(source),controller=new AbortController()
    controller.abort(new DOMException('Root registered abort control','AbortError'))
    await assert.rejects(registered(source).run({...r.options,signal:controller.signal}),error=>error.name==='AbortError')
    assert.equal(r.legacyCalls.length,0)
    assert.equal(r.nativeCalls.length,0)
  })
}
