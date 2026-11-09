import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { decodeGemList, parseGemJSON, runBigeye, validateGemPublisher } from './nativeGemCurrent20261108.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261108/native-gem-public.json.gz',import.meta.url))))
const row=()=>structuredClone(fixture.synthetic.row)
const now='2026-11-08T00:00:00.000Z'
const decode=value=>decodeGemList(value,now)
const rejects=(value,pattern=/Bigeye/)=>assert.throws(()=>decode(value),pattern)
test('real native empty bytes are exact; no fabricated positive fixture',()=>{
 assert.equal(createHash('sha256').update(fixture.actualEmpty.body).digest('hex'),fixture.actualEmpty.sha256)
 assert.deepEqual(parseGemJSON(fixture.actualEmpty.body),[])
 assert.deepEqual(decode([]),{models:[],observations:[],holds:[]})
})
test('documented synthetic row remains whole unknown-country/legal/full-role hold',()=>{
 const value=row(),r=decode([value]);assert.deepEqual(r.models,[value]);assert.deepEqual(r.holds[0].model,value)
 assert.equal(r.observations[0].nativeId,value.id);assert.equal(r.observations[0].country,null)
 assert.equal(r.holds[0].legalEmployer,null);assert.equal(r.holds[0].postingDate,value.first_published_at)
 assert.deepEqual(r.holds[0].rawCriteria,{content:value.content,content_plain:value.content_plain})
 assert.deepEqual(r.holds[0].rawLocations,{location:value.location,offices:value.offices})
 assert.ok(r.holds[0].reasons.includes('no-native-typed-country-carrier'))
})
test('unknown field is held with entire raw model; never silently zero',()=>{
 const value=row();value.country='India';value.legalEmployer='Synthetic uncertain declaration';const r=decode([value])
 assert.equal(r.holds.length,1);assert.deepEqual(r.holds[0].model,value)
 assert.ok(r.holds[0].reasons.includes('unsupported-native-fields'))
 assert.equal(r.observations[0].country,null)
})
for(const [name,change]of[
 ['missing ID',x=>delete x.id],['nonstring ID',x=>x.id=1],['blank ID',x=>x.id=''],
 ['missing title',x=>delete x.title],['wrong content type',x=>x.content={}],
 ['malformed date',x=>x.first_published_at='2026-02-30T10:00:00Z'],
 ['future publication',x=>x.first_published_at='2099-01-01T00:00:00Z'],
 ['untyped location',x=>x.location='India'],['office wrong shape',x=>x.offices=[null]],
 ['location country extra',x=>x.location.country='India'],['office country extra',x=>x.offices[0].country='India'],
 ['foreign URL',x=>x.absolute_url='https://unrelated.invalid/a'],['URL credential',x=>x.absolute_url='https://user@jobs.gem.com/bigeye/a'],
 ['URL port',x=>x.absolute_url='https://jobs.gem.com:444/bigeye/a'],['URL query',x=>x.absolute_url+='?x=1'],
 ['wrong account',x=>x.absolute_url='https://jobs.gem.com/another/a'],['non-array departments',x=>x.departments={}],
 ])test('synthetic schema refusal: '+name,()=>{const x=row();change(x);rejects([x])})
test('missing optional schema members preserves discovery hold',()=>{
 const x={id:'synthetic-minimal',title:'Synthetic minimal'};const r=decode([x]);assert.deepEqual(r.models,[x]);assert.equal(r.holds[0].postingDate,null)
})
test('duplicate identity refuses entire list',()=>rejects([row(),row()]))
test('inherited/getter carriers refuse without executing accessor',()=>{
 const x=row();let called=0;Object.defineProperty(x,'country',{enumerable:true,get(){called++;return 'India'}})
 rejects([x]);assert.equal(called,0);rejects([Object.assign(Object.create({country:'India'}),row())])
})
for(const value of ['null','{}','{"error":"denied"}','[null]','[1]','[[]]'])test('not a list of native records: '+value,()=>assert.throws(()=>decode(parseGemJSON(value)),/Bigeye/))
for(const value of ['[{"id":"x","id":"y"}]','[{"id":"x","\\u0069d":"y"}]','[{"a":{"x":1,"\\u0078":2}}]','[1,]','["unterminated]','[] false'])test('strict JSON refusal '+value,()=>assert.throws(()=>parseGemJSON(value),/Bigeye/))
test('JSON string contents and repeated keys in different objects remain data',()=>assert.deepEqual(parseGemJSON('[{"x":"\\\"id\\\":1"},{"x":2}]'),[{x:'"id":1'},{x:2}]))
test('unknown publisher cannot reach vendor or generic fallback',async()=>{
 const calls=[];await assert.rejects(runBigeye({fetchImpl:async url=>{calls.push(url);const r=new Response('<html><head><title>Other</title></head><body></body></html>',{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}}),/Bigeye/)
 assert.deepEqual(calls,[fixture.authority.home])
})
for(const status of[403,429,500])test('controlled own HTTP '+status+' never returns empty',async()=>{
 await assert.rejects(runBigeye({fetchImpl:async url=>{const r=new Response('Controlled negative',{status,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}}),e=>e.status===status&&e.upstreamOutage===true&&e.abortRetries===true&&e.receipt.body==='Controlled negative')
})
test('foreign final URL cannot acquire own403 provenance',async()=>{
 await assert.rejects(runBigeye({fetchImpl:async()=>{const r=new Response('Controlled foreign',{status:403});Object.defineProperty(r,'url',{value:'https://unrelated.invalid/'});return r}}),e=>e.status===undefined&&e.failureKind==='coverage_gap')
})
test('known own403 remains primary through body read failure',async()=>{
 const failure=Object.freeze(new Error('Controlled denied stream'))
 await assert.rejects(runBigeye({fetchImpl:async url=>{const r=new Response(new ReadableStream({start(c){c.error(failure)}}),{status:403});Object.defineProperty(r,'url',{value:url});return r}}),e=>e.status===403&&e.cause===failure&&e.upstreamOutage===true)
})
for(const reason of[null,Symbol('opaque'),Object.freeze(Object.create(null))])test('exact caller abort reason '+typeof reason,async()=>{
 const c=new AbortController();c.abort(reason);let calls=0;let caught=false
 try{await runBigeye({signal:c.signal,fetchImpl:async()=>{calls++;throw Error('must not run')}})}catch(e){caught=true;assert.equal(e,reason)}assert.equal(caught,true);assert.equal(calls,0)
})
test('opaque callback error identity is unchanged',async()=>{const reason=Object.freeze(Object.create(null));await assert.rejects(runBigeye({fetchImpl:async()=>{throw reason}}),e=>e===reason)})
test('caller abort during response body wins even after own403',async()=>{
 const c=new AbortController(),reason=Symbol('caller');let called=0
 let caught=false;try{await runBigeye({signal:c.signal,fetchImpl:async url=>{called++;const r=new Response(new ReadableStream({start(){queueMicrotask(()=>c.abort(reason))}}),{status:403});Object.defineProperty(r,'url',{value:url});return r}})}catch(e){caught=true;assert.equal(e,reason)}assert.equal(caught,true);assert.equal(called,1)
})
test('budget option cannot broaden original defaults',async()=>{
 for(const options of[{sourceTimeoutMs:90001},{maxRequests:49},{maxRequests:0},{sourceTimeoutMs:NaN},{fetchPage:()=>{}}])await assert.rejects(runBigeye(options),/Bigeye/)
})
test('unrecognized authority input type is refused',()=>assert.throws(()=>validateGemPublisher({},'home'),/Bigeye/))
test('aggregate deadline bounds an unresponsive callback without another read',async()=>{
 let calls=0;await assert.rejects(runBigeye({sourceTimeoutMs:15,fetchImpl:()=>{calls++;return new Promise(()=>{})}}),/aggregate deadline/);assert.equal(calls,1)
})
test('verified own403 remains primary through aggregate body deadline',async()=>{
 await assert.rejects(runBigeye({sourceTimeoutMs:15,fetchImpl:async url=>{const r=new Response(new ReadableStream({start(){}}),{status:403});Object.defineProperty(r,'url',{value:url});return r}}),e=>e.status===403&&e.upstreamOutage===true&&e.cause?.message.includes('aggregate deadline')&&e.receipt.complete===false)
})
test('known ownHTTP preserves hostile opaque body-error cause without inspecting it',async()=>{
 const reason=Object.create(null);for(const key of['receipt','message','name',Symbol.toPrimitive])Object.defineProperty(reason,key,{get(){throw Error('Forbidden opaque inspection')}});Object.freeze(reason)
 await assert.rejects(runBigeye({fetchImpl:async url=>{const r=new Response(new ReadableStream({start(c){c.error(reason)}}),{status:403});Object.defineProperty(r,'url',{value:url});return r}}),e=>e.status===403&&e.cause===reason)
})
