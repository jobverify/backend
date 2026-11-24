import fs from'node:fs';import{gunzipSync}from'node:zlib';import test from'node:test';import assert from'node:assert/strict';import{run}from'./script.js';import{parseEightfoldJson}from'../../scraper-support/utils/recruitmentEightfoldData.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url)))),corporate=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-20261120.json.gz',import.meta.url))));
async function replay(t,{currentCorporate=false,foreignFacetDrift=false,corporateMutation,countryMutation}={}){
 const counts=new Map();t.mock.method(globalThis,'fetch',()=>{throw Error('Real network prohibited during native compatibility replay')});
 return run({now:()=>fixture.capturedAt,requestIntervalMs:0,fetchImpl:async(value,init)=>{
  const url=String(value),index=counts.get(url)??0;counts.set(url,index+1);
  const original=fixture.packets.filter(row=>row.requestedURL===url)[index];assert.ok(original,'Only declared exact original native response sequence');
  const row=structuredClone(currentCorporate&&url===corporate.url?corporate:original);let body=Buffer.from(row.bodyBase64,'base64').toString();
  if(corporateMutation&&url===corporate.url){const changed=corporateMutation(body);assert.notEqual(changed,body);body=changed}
  if(foreignFacetDrift&&init.method==='POST'){const data=parseEightfoldJson(body),other=data.facets.map.country.find(item=>item.name!=='IN');other.count++;body=JSON.stringify(data)}
  if(countryMutation&&init.method==='POST'){const data=parseEightfoldJson(body);countryMutation(data);body=JSON.stringify(data)}
  const response=new Response(Buffer.from(body),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response;
 }});
}
test('actual current corporate declaration admits the historical full native role protocol without marketing body pin',async t=>{
 const jobs=await replay(t,{currentCorporate:true});assert.ok(jobs.length>0);assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,27);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false);
});
test('unrelated foreign native country counts are data rather than a fixed whole-facet fingerprint',async t=>{
 const jobs=await replay(t,{foreignFacetDrift:true});assert.ok(jobs.length>0);assert.equal(jobs.nativeCollectionEvidence.nativeCountrySelectorRecord.name,'IN');
});

test('current corporate marketing wording is independent of native role authority',async t=>{
 const jobs=await replay(t,{currentCorporate:true,corporateMutation:html=>html.replaceAll('combines agentic AI','combines current AI')});assert.ok(jobs.length>0);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false);
});

for(const[name,corporateMutation]of[
 ['foreign canonical owner',html=>html.replace('rel="canonical" href="https://www.atos.ai"','rel="canonical" href="https://unrelated.example"')],
 ['foreign website identity',html=>html.replace('"name":"Atos","publisher"','"name":"Another Employer","publisher"')],
 ['hidden native application delegation',html=>html.replace('href="https://jobs.atos.net/job/"','style="display:none" href="https://jobs.atos.net/job/"')],
 ['foreign native board',html=>html.replaceAll('https://jobs.atos.net/job/','https://jobs.unrelated.example/job/')],
])test('current corporate qualification rejects '+name,async t=>{
 await assert.rejects(replay(t,{currentCorporate:true,corporateMutation}),/Atos current native/);
});

for(const[name,countryMutation]of[
 ['foreign India label',data=>{data.facets.map.country.find(row=>row.name==='IN').translated='Indonesia'}],
 ['duplicate India identity',data=>{data.facets.map.country.push(data.facets.map.country.find(row=>row.name==='IN'))}],
 ['string country count',data=>{data.facets.map.country.find(row=>row.name==='IN').count='27'}],
 ['unreviewed country authority field',data=>{data.facets.map.country.find(row=>row.name==='IN').employer='Another Employer'}],
])test('native country model rejects '+name,async t=>{
 await assert.rejects(replay(t,{countryMutation}),/Atos current native/);
});
