import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {run} from '../perfios/script.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const currentBytes=readFileSync(new URL('../perfios/test-data/current-client-20261128.json.gz',import.meta.url))
const current=JSON.parse(gunzipSync(currentBytes)).registeredCurrent
const legacy=JSON.parse(gunzipSync(readFileSync(new URL('../perfios/test-data/deployment-20261125.json.gz',import.meta.url))))
const origin='https://perfios.darwinbox.in/ms/candidateapi/'
const graphs=[
  {name:'current',packets:current.packets,endpoint:origin+'getCompanyConfig?is_preview=false&companyId=main',ordinaryReads:11},
  {name:'legacy',packets:legacy.packets,endpoint:origin+'companyinfo',ordinaryReads:7},
]
function replay(graph,change=()=>{}){
  const reads=[],seen=new Map()
  return {reads,options:{fetchImpl:async(url,init)=>{
    assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
    const occurrence=(seen.get(url)??0)+1;seen.set(url,occurrence)
    const retained=graph.packets.filter(row=>row.url===url)[occurrence-1]
    assert.ok(retained,'No unacquired native URL, refresh or fallback is available: '+url)
    const bytes=Buffer.from(retained.bodyBase64,'base64')
    assert.equal(sha(bytes),retained.sha256)
    const packet=structuredClone(retained)
    reads.push({url,method:init.method,occurrence})
    change(packet,{url,occurrence})
    const headers=new Headers(packet.headers)
    for(const name of packet.setCookieNames??[])headers.append('set-cookie',name+'=controlled-offline-session; Path=/')
    return Object.defineProperty(new Response(bytes,{status:packet.status,headers}),'url',{value:packet.finalURL})
  }}}
}
const terminal=error=>error.httpStatus===403&&error.failureKind==='blocked_or_access_denied'
  &&error.abortRetries===true&&error.sourceScopeComplete===false&&error.lifecycleCleanupAllowed===false

test('genuine current and legacy denial graphs retain all complete response body hashes and no inventory proof',()=>{
  assert.equal(sha(currentBytes),'f752251712d6586905aae6bcaa4bc0ebefa7e293e76339fc3773a51e8b113289')
  assert.equal(current.packets.length,11)
  assert.equal(current.outcome.captureFinalization.drained,true)
  assert.equal(current.outcome.captureFinalization.pendingAtFreeze,0)
  for(const graph of graphs)for(const packet of graph.packets)assert.equal(sha(Buffer.from(packet.bodyBase64,'base64')),packet.sha256)
})

for(const graph of graphs){
  test(graph.name+' ordinary genuine403 retains exactly one anonymous-session refresh and its terminal denial',async()=>{
    const r=replay(graph)
    await assert.rejects(run(r.options),error=>terminal(error)&&error.accessChallenge!==true&&error.requestedUrl===graph.endpoint)
    assert.equal(r.reads.filter(row=>row.url===graph.endpoint).length,2)
    assert.equal(r.reads.length,graph.ordinaryReads)
  })

  for(const [header,value]of [['cf-mitigated','challenge'],['x-amzn-waf-action',' Challenge ']])test(graph.name+' explicit403 '+header+' challenge is terminal before any anonymous-session refresh',async()=>{
    const r=replay(graph,(packet,{url,occurrence})=>{
      if(url===graph.endpoint&&occurrence===1)packet.headers[header]=value
    })
    await assert.rejects(run(r.options),error=>terminal(error)&&error.accessChallenge===true&&error.requestedUrl===graph.endpoint)
    assert.equal(r.reads.filter(row=>row.url===graph.endpoint).length,1)
    assert.equal(r.reads.length,graph.ordinaryReads-2,'Neither another session seed nor a second API read may follow an explicit denial')
  })

  test(graph.name+' synthetic202 challenge remains a single typed terminal access denial',async()=>{
    const r=replay(graph,(packet,{url})=>{if(url===graph.endpoint){packet.status=202;packet.headers['cf-mitigated']='challenge'}})
    await assert.rejects(run(r.options),error=>error.httpStatus===202&&error.accessChallenge===true
      &&error.failureKind==='blocked_or_access_denied'&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false)
    assert.equal(r.reads.filter(row=>row.url===graph.endpoint).length,1)
    assert.equal(r.reads.length,graph.ordinaryReads-2)
  })

  test(graph.name+' synthetic429 retains Retry-After and never refreshes an anonymous session',async()=>{
    const r=replay(graph,(packet,{url})=>{if(url===graph.endpoint){packet.status=429;packet.headers['retry-after']='7'}})
    await assert.rejects(run(r.options),error=>error.httpStatus===429&&error.failureKind==='blocked_or_access_denied'
      &&error.abortRetries===true&&error.retryDelayMs===7000&&error.sourceScopeComplete===false&&error.lifecycleCleanupAllowed===false)
    assert.equal(r.reads.filter(row=>row.url===graph.endpoint).length,1)
    assert.equal(r.reads.length,graph.ordinaryReads-2)
  })

  test(graph.name+' a response identity mismatch stays terminal before any ordinary403 refresh',async()=>{
    const r=replay(graph,(packet,{url})=>{if(url===graph.endpoint)packet.finalURL='https://foreign.invalid/native'})
    await assert.rejects(run(r.options),/HTTP response URL changed/)
    assert.equal(r.reads.filter(row=>row.url===graph.endpoint).length,1)
  })

  test(graph.name+' exact caller cancellation at the first native denial prevents refresh',async()=>{
    const controller=new AbortController(),reason=Object.freeze({owner:'native-caller'}),r=replay(graph,(_,{url})=>{
      if(url===graph.endpoint)controller.abort(reason)
    })
    await assert.rejects(run({...r.options,signal:controller.signal}),error=>error===reason)
    assert.equal(r.reads.filter(row=>row.url===graph.endpoint).length,1)
  })
}

test('a pre-aborted opaque caller owns the exact reason before any source read',async()=>{
  const reason=Object.freeze({owner:'pre-aborted-native-caller'}),controller=new AbortController(),r=replay(graphs[0])
  controller.abort(reason)
  await assert.rejects(run({...r.options,signal:controller.signal}),error=>error===reason)
  assert.equal(r.reads.length,0)
})
