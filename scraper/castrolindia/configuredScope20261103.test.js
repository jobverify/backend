import test from 'node:test'
import assert from 'node:assert/strict'
import {revisitFixture} from './revisitFixture.js'
import {parseCastrolBoard,validateCastrolInventory,CORPORATE,BOARD,API} from './nativeContract.js'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from './nativeHtml.js'
const f=revisitFixture(import.meta.url),payload=()=>JSON.parse(f.text(API)),board=()=>parseCastrolBoard(f.text(CORPORATE),f.text(BOARD))
globalThis.fetch=async()=>{throw Error('Current Castrol fixtures prohibit live network')}
test('current own India alternative determines configured membership while London stays country-unknown',()=>{
 const result=validateCastrolInventory(payload(),board()),multi=result.rows.find(r=>r.raw.id===4983338101)
 assert.equal(result.rows.length,96);assert.equal(result.india.length,25);assert.deepEqual(multi.unresolvedLocations,['London']);assert.equal(multi.scopeComplete,false)
 assert.equal(multi.configuredCountryMembershipComplete,true);assert.equal(result.configuredCountryMembershipComplete,true);assert.equal(result.scopeComplete,false)
})
test('foreign primary with an unknown secondary location cannot establish India exclusion',()=>{
 const p=payload(),b=board(),row=p.jobs.find(r=>r.location.name.startsWith('United States - '));assert.ok(row)
 row.location.name='United States - Remote; Unpublished secondary workplace';const card=b.posts.data.find(r=>r.id===row.id);if(card)card.location=row.location.name
 const result=validateCastrolInventory(p,b),changed=result.rows.find(r=>r.raw.id===row.id)
 assert.equal(changed.india,false);assert.equal(changed.configuredCountryMembershipComplete,false);assert.equal(result.configuredCountryMembershipComplete,false)
})
test('conflicting native country evidence inside the same India workplace slot remains held',()=>{
 for(const change of [row=>row.location.name='India - Delhi, United Kingdom',row=>row.location.addressCountry={name:'India',identifier:'CA'}]){
  const p=payload(),b=board(),row=p.jobs.find(r=>r.id===4983338101);change(row);const card=b.posts.data.find(r=>r.id===row.id);if(card)card.location=row.location.name
  assert.throws(()=>validateCastrolInventory(p,b))
 }
})
test('current complete configured India extraction retains all global observations and reconciles two detail passes before final inventories',async()=>{
 const calls=[],reports=[],jobs=await run({fetchImpl:async(url,request)=>{calls.push(url);return f.fetchImpl(url,request)},onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,25);assert.ok(jobs.every(j=>j.sourceDetailComplete));assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,25)
 assert.equal(reports.length,1);assert.equal(reports[0].observations.length,96);assert.equal(reports[0].nativeGlobalGeographyComplete,false);assert.equal(reports[0].configuredCountryMembershipComplete,true);assert.equal(reports[0].lifecycleCleanupAllowed,false);assert.equal(reports[0].sourceScopeComplete,false)
 const multi=jobs.find(j=>j.jobId==='4983338101');assert.deepEqual(multi.nativeUnresolvedLocations,['London']);assert.equal(multi.sourceNativeGlobalGeographyComplete,false)
 assert.equal(calls.filter(url=>url.includes('/castrol/jobs/')).length,50);const last=calls.findLastIndex(url=>url.includes('/castrol/jobs/'));assert.ok(calls.findLastIndex(url=>url===API)>last);assert.ok(calls.findLastIndex(url=>url===BOARD)>last)
})
test('closing own criteria changes cannot survive an unchanged final native feed',async()=>{
 const target='https://job-boards.eu.greenhouse.io/castrol/jobs/4983338101';let visits=0
 await assert.rejects(run({fetchImpl:async(url,request)=>{const response=await f.fetchImpl(url,request);if(url===target&&++visits===2){const html=await response.text(),doc=readNativeDocument(html),script=doc.nodes(n=>n.tag==='script'&&n.raw?.trim().startsWith('window.__remixContext'))[0],match=script.raw.match(/^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/),model=JSON.parse(match[1]),post=model.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost,paragraph=[...post.content.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)].find(m=>m[0].replace(/<[^>]*>/g,'').length>30);assert.ok(paragraph);post.content=post.content.slice(paragraph.index+paragraph[0].length);assert.ok(post.content.length>100);return{status:200,url,text:async()=>html.replace(script.raw,script.raw.replace(match[1],JSON.stringify(model)))}}return response}}),/Closing own-role criteria/)
 assert.equal(visits,2)
})
test('an ignoring audit callback receives bounded opaque caller cancellation',async()=>{
 const controller=new AbortController(),reason={opaqueStop:'current-castrol-observer'}
 const work=run({signal:controller.signal,fetchImpl:f.fetchImpl,onAudit:()=>{controller.abort(reason);return new Promise(()=>{})}})
 assert.equal(await work.then(()=>null,e=>e),reason)
})
for(const [name,change]of [['clipped own-role SSR',html=>html.replace('class="job__description body"','class="job__description body" style="height:1px;overflow:hidden"')],['stylesheet-hidden own-role SSR',html=>html.replace('</head>','<style>.job__description{display:none}</style></head>')]])test(name+' retains a criteria gap',async()=>{
 const target='https://job-boards.eu.greenhouse.io/castrol/jobs/4983338101',jobs=await run({fetchImpl:async(url,request)=>{const r=await f.fetchImpl(url,request);if(url===target){const original=await r.text(),html=change(original);assert.notEqual(html,original);return{status:200,url,text:async()=>html}}return r}})
 const held=jobs.find(j=>j.jobId==='4983338101');assert.equal(held.sourceDetailComplete,false);assert.equal(held.jobDescription,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('nontext native role criteria is retained as raw evidence and never silently marked full',async()=>{
 const target='https://job-boards.eu.greenhouse.io/castrol/jobs/4983338101',jobs=await run({fetchImpl:async(url,request)=>{const r=await f.fetchImpl(url,request);if(url===target){const html=await r.text(),doc=readNativeDocument(html),script=doc.nodes(n=>n.tag==='script'&&n.raw?.trim().startsWith('window.__remixContext'))[0],match=script.raw.match(/^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/),model=JSON.parse(match[1]);model.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost.content+='<img src="https://example.invalid/public-criteria.png" alt="Mandatory certification matrix">';return{status:200,url,text:async()=>html.replace(script.raw,script.raw.replace(match[1],JSON.stringify(model)))}}return r}})
 const held=jobs.find(j=>j.jobId==='4983338101');assert.equal(held.sourceDetailComplete,false);assert.equal(held.jobDescription,null);assert.match(held.nativeRoleCriteriaHtml,/Mandatory certification matrix/);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('an unrelated private consent change does not veto the unchanged public vacancy inventory',async()=>{
 let reads=0
 const jobs=await run({fetchImpl:async(url,request)=>{const r=await f.fetchImpl(url,request);if(url===API&&++reads===2){const p=JSON.parse(await r.text());p.jobs[0].data_compliance=[{type:'gdpr',requires_consent:true,privateCopy:'Updated application consent copy'}];return{status:200,url,text:async()=>JSON.stringify(p)}}return r}})
 assert.equal(jobs.length,25);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('a supplied public reader stays on the current Castrol native adapter',async()=>{
 const reports=[],jobs=await run({fetchPage:f.fetchImpl,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,25);assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(reports.length,1);assert.equal(reports[0].ownDetailPasses,2)
})
