import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import assert from'node:assert/strict';import test from'node:test';import{run}from'./script.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/current-native-20261115.json.gz',import.meta.url))));
const current=fs.readFileSync(new URL('./test-inputs/current-index-20261120.json',import.meta.url),'utf8'),manifest=JSON.parse(fs.readFileSync(new URL('./test-inputs/current-index-20261120.manifest.json',import.meta.url)));
assert.equal(createHash('sha256').update(current).digest('hex'),manifest.sha256);
async function replay(t,change=(text)=>text){let indexReads=0;
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const row=fixture.packets.find(p=>p.url===String(url)&&p.method===(init.method??'GET')&&p.requestBody===(init.body??null));
  assert.ok(row,'No uncaptured native request or network');let body=Buffer.from(row.bodyBase64,'base64').toString();
  if(String(url).includes('/index.json?'))body=change(current,++indexReads);
  const response=new Response(body,{status:row.status,headers:{'content-type':row.headers['content-type']??'text/html'}});Object.defineProperty(response,'url',{value:row.finalURL});return response;
 });
 const jobs=await run({now:'2026-11-15T10:00:00Z'});return{jobs,indexReads};
}
test('actual current index keeps its effective declared native module with historical full-role compatibility',async t=>{
 const{jobs,indexReads}=await replay(t);assert.equal(jobs.length,26);assert.equal(indexReads,2);assert.equal(jobs.nativeCollectionEvidence.observations.length,27);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false);
});
test('irrelevant index deployment metadata and unused fallback versions can change during closing',async t=>{
 const{jobs}=await replay(t,(text,pass)=>pass===1?text:JSON.stringify({...JSON.parse(text),verpVersion:'1.0.0-20261120000000-review-1',versions:['4.81.1','4.80.0']}));
 assert.equal(jobs.length,26);
});
for(const[label,change]of[
 ['different active module version',data=>{data.versions=['4.82.0','4.81.1']}],
 ['foreign virtualPath',data=>{data.virtualPath='https://other.example/module_${version}'}],
 ['different module owner',data=>{data.moduleName='other-company'}],
 ['nonanonymous module mode',data=>{data.smrf=true}],
])test('changed relevant native index holds '+label,async t=>{
 await assert.rejects(()=>replay(t,text=>{const data=JSON.parse(text);change(data);return JSON.stringify(data)}),/index|client|module|version/i);
});
