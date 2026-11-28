import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {nativeFixture} from './nativeFixture.js'
import {inspectPublicMain} from './publicClientContract.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const archive=readFileSync(new URL('./test-data/current-router-20261128.json.gz',import.meta.url))
const fixture=JSON.parse(gunzipSync(archive)),historical=nativeFixture(import.meta.url)
const main=fixture.packets.find(row=>/^https:\/\/alkem\.turbohire\.co\/main\.[a-f0-9]{20}\.chunk\.js$/.test(row.requestedUrl))
const corporate='https://www.alkemlabs.com/career',api='https://thapi-stage2.azurewebsites.net'

// Current public scripts/styles are genuine dated responses. The older API
// zero, organization and synthetic visitor token are compatibility controls;
// no test below presents them as current vacancy or employer observations.
async function replay(transform=({body})=>body,options={}){
  const reads=[],counts=new Map();let audit
  const jobs=await run({...options,onAudit:value=>{audit=value;return options.onAudit?.(value)},fetchPage:async(url,init)=>{
    const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
    reads.push({url,method:init.method,occurrence})
    let response
    if(url.startsWith(api+'/api/'))response=await historical.fetchPage(url,init)
    else{
      const row=fixture.packets.find(row=>row.requestedUrl===url)
      assert.ok(row,'No read outside actual declared current public graph: '+url)
      assert.equal(sha(row.body),row.sha256)
      response={status:row.status,url:row.url,body:row.body,contentType:row.headers?.['content-type']||'text/plain'}
    }
    return{...response,body:transform({url,body:response.body,occurrence,init})}
  }})
  return{jobs,audit,reads}
}

test('genuine current fixture retains24 complete public bodies and no current native job/session API facts',()=>{
  assert.equal(sha(archive),'f4bceb24e6910b1728133dfafdb3bdc8e0def13571c7cbcf15eddc679a352808')
  assert.equal(fixture.packets.length,24)
  for(const row of fixture.packets){assert.equal(sha(row.body),row.sha256);assert.ok(!row.requestedUrl.startsWith(api+'/api/'))}
  assert.equal(Buffer.byteLength(main.body),10394315)
  assert.equal(main.sha256,'c6e9e2c42c3c58be844502081294c78a9be4285803322e2b3b432e94f3629000')
  assert.deepEqual(fixture.employerRouter,{moduleId:3903,functionSHA256:'783ce9d25e0d6f674178d44facda78a8227e19fd72128b501f6a7f6cd82f63b1',functionBytes:431320})
})

test('current public main retains exact API, root router and five-chunk bootstrap contract',()=>{
  assert.deepEqual(inspectPublicMain(main.body),fixture.mainContract)
  assert.equal(fixture.mainContract.publicLazyBootstrap,'7f63dfaa3e456d318151f44eb96deaa12d673b946dc67d9b8a0fd837aacc3687')
  assert.deepEqual(fixture.mainContract.publicChunkIds,[13,17,25,38,40])
})

test('current router and unchanged defaults reconcile historical zero API controls through both public contexts',async()=>{
  const{jobs,audit,reads}=await replay()
  assert.equal(jobs.length,0)
  assert.equal(audit.closingReconciled,true)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(reads.filter(row=>row.url===main.requestedUrl).length,2)
  assert.equal(reads.filter(row=>row.url.includes('/filteredjobs?')).length,2)
  assert.equal(audit.anonymousSessionCredentialsRetained,false)
})

test('a legacy bootstrap combined with current chunks cannot certify a missing employer router as native zero',async()=>{
  let changed=false
  await assert.rejects(replay(({url,body})=>{
    if(url!==main.requestedUrl)return body
    const next=body.replace('a.bind(null,3903)','a.bind(null,3902)')
    assert.notEqual(next,body);changed=true;return next
  }),/employer router|native.*contract/i)
  assert.equal(changed,true)
})

for(const [name,transform] of [
  ['an unreviewed bootstrap module',({url,body})=>url===main.requestedUrl?body.replace('a.bind(null,3903)','a.bind(null,3904)'):body],
  ['a changed public jobs API',({url,body})=>url===main.requestedUrl?body.replaceAll('/api/careerpagev2/filteredjobs?','/api/careerpagev2/otherjobs?'):body],
  ['a hidden corporate handoff',({url,body})=>url.endsWith('.css')?body+'\n.work-with-us{display:none!important}':body],
])test('current profile rejects '+name+' before it can publish a zero',async()=>{
  await assert.rejects(replay(transform),/Alkem|native|public/i)
})

test('a narrowed native default filter is still rejected after current bootstrap admission',async()=>{
  let changed=false
  await assert.rejects(replay(({url,body})=>{
    if(!url.includes('/40.'))return body
    const next=body.replace('Keyword:"",ClientIds:','Keyword:"India",ClientIds:')
    assert.notEqual(next,body);changed=true;return next
  }),/inventory controller|default filters/i)
  assert.equal(changed,true)
})

test('the current employer router must exist at its declared module ID',async()=>{
  let changed=false
  await assert.rejects(replay(({url,body})=>{
    if(!url.includes('/40.'))return body
    const next=body.replace('3903:function(','3904:function(')
    assert.notEqual(next,body);changed=true;return next
  }),/employer router/i)
  assert.equal(changed,true)
})

test('an unreviewed closing current bootstrap cannot commit a valid opening compatibility snapshot',async()=>{
  let closingReached=false
  await assert.rejects(replay(({url,body,occurrence})=>{
    if(url!==main.requestedUrl||occurrence!==2)return body
    closingReached=true
    const next=body.replace('a.bind(null,3903)','a.bind(null,3904)')
    assert.notEqual(next,body);return next
  }),/Alkem|native|public/i)
  assert.equal(closingReached,true)
})

test('synthetic future positive native records retain raw observations and cannot become zero or qualified roles',async()=>{
  let audit,positiveReached=false
  await assert.rejects(replay(({url,body})=>{
    if(!url.includes('/filteredjobs?'))return body
    positiveReached=true
    return JSON.stringify({Total:1,Result:[{JobId:'synthetic-protocol-control',JobTitle:'Synthetic future control'}]})
  },{onAudit:value=>{audit=value}}),error=>error.code==='PUBLIC_NATIVE_ROLE_COLLECTOR_REQUIRED')
  assert.equal(positiveReached,true)
  assert.equal(audit.observations.length,1)
  assert.equal(audit.scopeComplete,false)
  assert.equal(audit.inventoryEvidence.listingComplete,false)
})

test('current profile retains exact opaque pre-abort and performs no reads',async()=>{
  let reads=0;const reason={caller:'current router independent transport control'}
  await assert.rejects(run({signal:AbortSignal.abort(reason),fetchPage:async()=>{reads++;throw Error('unexpected read')}}),value=>value===reason)
  assert.equal(reads,0)
})

test('current configured native zero never grants unread corporate CMS or company cleanup authority',async()=>{
  const{jobs,audit}=await replay()
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(audit.configuredBoardComplete,true)
  assert.equal(audit.scopeComplete,false)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.companyInventoryComplete,false)
  assert.deepEqual(readSourceObservationEvidence(jobs,'alkemlaboratories'),{source:'alkemlaboratories',recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
})

test('legacy native zero also keeps company scope and cleanup held without corporate CMS inventory proof',async()=>{
  // Explicit historical compatibility control, not a fresh current zero.
  let audit
  const jobs=await run({fetchPage:historical.fetchPage,onAudit:value=>{audit=value}})
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(audit.configuredBoardComplete,true)
  assert.equal(audit.scopeComplete,false)
  assert.equal(readSourceObservationEvidence(jobs,'alkemlaboratories').companyIndiaTotal,null)
})

test('a synthetic visible corporate CMS vacancy cannot be erased into an authoritative company zero',async()=>{
  let mutations=0
  const{jobs,audit}=await replay(({url,body})=>{
    if(url!==corporate)return body
    const next=body.replace('</body>','<section id="synthetic-scope-control"><h2>Experienced Careers</h2><article><h3>Synthetic Noida Engineer</h3><p>Noida, India. Explicit synthetic negative control.</p></article></section></body>')
    assert.notEqual(next,body);mutations++;return next
  })
  assert.equal(mutations,2)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.equal(audit.scopeComplete,false)
  const observations=readSourceObservationEvidence(jobs,'alkemlaboratories')
  assert.equal(observations.sourceScopeComplete,false)
  assert.equal(observations.companyGlobalTotal,null)
  assert.equal(observations.companyIndiaTotal,null)
})
