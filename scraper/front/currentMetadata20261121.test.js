import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runCurrentFrontProgramme} from './currentProgramme.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-corporate-20261121.json.gz',import.meta.url))))
const CORPORATE='https://front.com/jobs',FEED=CORPORATE+'/feed'
const boundary=()=>Object.assign(Error('UNREAD_DECLARED_FEED_BOUNDARY'),{code:'OFFLINE_BOUNDARY'})
function transport({metadata={},mutate,caller,abortAtClose=false}={}){
 let reads=0,cancels=0;const calls=[]
 const fetchImpl=async(url,init)=>{
  calls.push(String(url));assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  if(String(url)!==CORPORATE){assert.equal(String(url),FEED);throw boundary()}
  const p=fixture.corporate;let body=Buffer.from(p.bodyBase64,'base64').toString('utf8');if(mutate)body=mutate(body)
  const native=new Response(body,{status:metadata.status??p.status,headers:{...p.headers,...metadata.headers}})
  const readerBody=native.body
  const stream={getReader(){reads++;return readerBody.getReader()},cancel(reason){cancels++;return readerBody.cancel(reason)}}
  if(abortAtClose)init.signal.addEventListener('abort',()=>caller.abort(metadata.reason),{once:true})
  return {status:metadata.status??p.status,url:metadata.finalURL??p.finalURL,headers:native.headers,body:stream}
 }
 return {fetchImpl,calls,get reads(){return reads},get cancels(){return cancels}}
}
test('actual current corporate metadata and intact five-role SSR advance to declared feed',async()=>{const t=transport();await assert.rejects(runCurrentFrontProgramme({fetchImpl:t.fetchImpl,requestIntervalMs:0}),/UNREAD_DECLARED_FEED_BOUNDARY/);assert.deepEqual(t.calls,[CORPORATE,FEED]);assert.equal(t.reads,1)})
test('unrelated marketing text does not alter the retained native SSR authority',async()=>{const t=transport({mutate:b=>b.replace('</body>','<p>Unrelated marketing sentence.</p></body>')});await assert.rejects(runCurrentFrontProgramme({fetchImpl:t.fetchImpl,requestIntervalMs:0}),/UNREAD_DECLARED_FEED_BOUNDARY/);assert.equal(t.calls.length,2)})
test('a foreign native account in a current corporate role remains held',async()=>{const t=transport({mutate:b=>b.replaceAll('jobs.ashbyhq.com/frontcareers/','jobs.ashbyhq.com/other/')});await assert.rejects(runCurrentFrontProgramme({fetchImpl:t.fetchImpl,requestIntervalMs:0}),e=>e.code==='FRONT_PROGRAMME_HOLD'&&e.reason==='feed-shape');assert.equal(t.calls.length,1)})
for(const [label,metadata] of Object.entries({denied403:{status:403},rateLimited429:{status:429},redirect302:{status:302,headers:{location:'https://other.example/'}},foreignFinal:{finalURL:'https://other.example/'},wrongMime:{headers:{'content-type':'application/json'}},attachment:{headers:{'content-disposition':'attachment'}},foreignCORS:{headers:{'access-control-allow-origin':'https://other.example'}},changedCSP:{headers:{'content-security-policy':"frame-ancestors *"}}})){
 test(label+' is rejected on original metadata without opening entity reader',async()=>{const t=transport({metadata});await assert.rejects(runCurrentFrontProgramme({fetchImpl:t.fetchImpl,requestIntervalMs:0}));assert.equal(t.calls.length,1);assert.equal(t.reads,0);assert.equal(t.cancels,1)})
}
test('opaque frozen and null caller reasons survive request-close cancellation',async()=>{for(const reason of [null,Object.freeze({caller:'late-source-cancel'})]){const caller=new AbortController(),t=transport({caller,abortAtClose:true,metadata:{reason}});let caught=false;try{await runCurrentFrontProgramme({fetchImpl:t.fetchImpl,requestIntervalMs:0,signal:caller.signal})}catch(error){caught=true;assert.equal(error,reason)}assert.equal(caught,true);assert.equal(t.calls.length,1)}})

function mutateNext(body,fn){return body.replace(/(<script id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const data=JSON.parse(raw);fn(data);return start+JSON.stringify(data)+end})}
for(const [label,mutate] of Object.entries({experimentalCompile:b=>mutateNext(b,d=>{d.isExperimentalCompile=true}),filteredRoute:b=>mutateNext(b,d=>{d.query={country:'US'}}),unknownRoot:b=>mutateNext(b,d=>{d.additionalPublication={country:'India'}}),hiddenForeignHiring:b=>b.replace('</body>','<div hidden><a href="https://jobs.ashbyhq.com/other">Open roles</a></div></body>')})){
 test(label+' remains held before any feed read',async()=>{const t=transport({mutate});await assert.rejects(runCurrentFrontProgramme({fetchImpl:t.fetchImpl,requestIntervalMs:0}),e=>e.code==='FRONT_PROGRAMME_HOLD');assert.equal(t.calls.length,1)})
}
