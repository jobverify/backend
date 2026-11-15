import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {collectPurplleTurboHire,API,BOARD_URL,ORIGIN} from './turboHire.js'

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
