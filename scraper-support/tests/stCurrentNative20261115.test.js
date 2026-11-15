import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {buildScrapers} from '../providers/index.js'
import run from '../../scraper/stmicroelectronics/script.js'
import {eightfoldDocument,readEightfoldDataCarrier} from '../utils/recruitmentEightfoldData.js'
import {encodeHTML} from 'entities'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/stmicroelectronics/fixtures/native-20261115.json.gz',import.meta.url))))
const fixtureFetch=packets=>async url=>{
 const packet=packets[String(url)],response=new Response(packet?.html||'Legacy API denied',{status:packet?.status||403})
 Object.defineProperty(response,'url',{value:String(url)});return response
}
test('registered ST follows the current corporate India map and retains full own native roles with current open proof',async t=>{
 t.mock.method(globalThis,'fetch',fixtureFetch(original))
 const source=buildScrapers().find(s=>s.name==='stmicroelectronics')
 const jobs=await source.run({fetchImpl:fixtureFetch(original),now:'2026-11-15T06:00:00Z'})
 assert.equal(jobs.length,10)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false))
 const security=jobs.find(j=>j.jobId==='563637173400230')
 assert.match(security.jobDescription,/Key Responsibilities/)
 assert.match(security.jobDescription,/YOUR SKILLS/)
 assert.equal(security.sourceNativeOpen,true)
 assert.equal(security.closingDate,null)
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,10)
 assert.equal(jobs.nativeCollectionEvidence.reportedSelectedTotal,26)
})
const role='https://stmicroelectronics.eightfold.ai/careers/job/563637173400230'
const own='https://stmicroelectronics.eightfold.ai/api/apply/v2/jobs/563637173400230?domain=stmicroelectronics.com'
const insight='https://stmicroelectronics.eightfold.ai/api/apply/v2/jobs/563637173400230/insights?domain=stmicroelectronics.com'
const openURL=Object.keys(original).find(u=>u.includes('/jobs/open?'))
const rewriteJson=(packet,change)=>{const value=JSON.parse(packet.html);change(value);packet.html=JSON.stringify(value)}
const rewriteSchema=(packet,change)=>{
 const node=eightfoldDocument(packet.html).document.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0]
 const value=JSON.parse(node.raw);change(value);packet.html=packet.html.replace(node.raw,JSON.stringify(value))
}
const rewriteCarrier=(packet,change)=>{
 const carrier=readEightfoldDataCarrier(packet.html,{id:'smartApplyData',mountId:'EFSmartApplyContainer'})
 change(carrier.value);packet.html=packet.html.replace(carrier.rawText,encodeHTML(JSON.stringify(carrier.value)))
}
for(const [name,change,reason]of[
 ['closed opening state',p=>rewriteJson(p[openURL],v=>{v['563637173400230']=false}),/current-open/],
 ['wrong typed schema country',p=>rewriteSchema(p[role],v=>{v.jobLocation.address.addressCountry.name='GB'}),/schema country/],
 ['contradictory schema city with unchanged India country',p=>rewriteSchema(p[role],v=>{v.jobLocation.address.addressLocality='London'}),/schema country|schema worksite/],
 ['an inactive classic renderer mode',p=>{const m=/<script\b[^>]*\bsrc=(["'])([^"']*smartApply\.[^"']+)\1[^>]*>/i.exec(p[role].html);assert.ok(m);p[role].html=p[role].html.replace(m[0],'<script type="application/json" src="'+m[2]+'">')},/renderer.*mode/],
 ['wrong own model country',p=>rewriteCarrier(p[role],v=>{v.all_applicable_locations[0].country='GB'}),/typed India/],
 ['wrong own API role',p=>rewriteJson(p[own],v=>{v.id=12345}),/vacancy URL|role\/listing identity/],
 ['new insights description override',p=>rewriteJson(p[insight],v=>{v.job_description='<p>A new required certification.</p>'}),/insights description\/criteria override/],
 ['new native custom criteria',p=>rewriteJson(p[own],v=>{v.custom_JD={enable:true,data_fields:{extra:['Required certificate']}}}),/additional authored criteria/],
 ['changed authored numeric requirement',p=>rewriteJson(p[own],v=>{assert.match(v.job_description,/50,000/);v.job_description=v.job_description.replace('50,000','10,000')}),/authored criteria disagree/],
])test('ST withholds '+name+' while retaining all selected native observations',async()=>{
 const packets=structuredClone(original);change(packets)
 const jobs=await run({fetchImpl:fixtureFetch(packets),now:'2026-11-15T06:00:00Z'})
 assert.equal(jobs.length,9)
 assert.ok(!jobs.some(j=>j.jobId==='563637173400230'))
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,10)
 assert.equal(jobs.nativeCollectionEvidence.reportedSelectedTotal,26)
 assert.match(jobs.nativeCollectionEvidence.heldRecords.find(r=>r.id===563637173400230).reason,reason)
})
for(const [name,change,reason]of[
 ['a hidden corporate India map carrier',p=>{const u='https://www.st.com/content/st_com/en/about/careers/job-categories.html';assert.match(p[u].html,/data-country="India" data-link=/);p[u].html=p[u].html.replace('data-country="India" data-link=','hidden data-country="India" data-link=')},/corporate India map handoff/],
 ['a hidden first-map shadow before the declared India map',p=>{const u='https://www.st.com/content/st_com/en/about/careers/job-categories.html';assert.match(p[u].html,/<body\b[^>]*>/i);p[u].html=p[u].html.replace(/(<body\b[^>]*>)/i,'$1<div class="map" hidden></div>')},/first corporate job map/],
 ['a stylesheet-hidden corporate job map',p=>{const packet=p['https://www.st.com/content/st_com/en/about/careers/job-categories.html'];packet.html=packet.html.replace('</head>','<style>a,.map,.worldMap--mobile-country-1{display:none!important}</style></head>')},/corporate.*map.*visibility/],
 ['stylesheet-hidden corporate popup links',p=>{const packet=p['https://www.st.com/content/st_com/en/about/careers/job-categories.html'];packet.html=packet.html.replace('</head>','<style>a{display:none!important}</style></head>')},/corporate.*(?:stylesheet|visibility)/],
 ['an unreviewed corporate base',p=>{const packet=p['https://www.st.com/content/st_com/en/about/careers/job-categories.html'];packet.html=packet.html.replace('</head>','<base href="https://unrelated.invalid/"></head>')},/corporate.*base/],
 ['a changed corporate map controller',p=>{const u=Object.keys(p).find(u=>u.includes('/map/clientlibs.'));p[u].html+=';/*changed*/'},/map handoff client/],
 ['a changed classic criteria renderer',p=>{const u=Object.keys(p).find(u=>u.includes('/smartApply.'));p[u].html+=';/*changed*/'},/criteria renderer/],
 ['empty selected observations with a positive reported total',p=>rewriteCarrier(p['https://stmicroelectronics.eightfold.ai/careers?location=India'],v=>{v.positions=[]}),/coverage-gap/],
])test('ST refuses '+name,async()=>{
 const packets=structuredClone(original);change(packets)
 await assert.rejects(run({fetchImpl:fixtureFetch(packets),now:'2026-11-15T06:00:00Z'}),reason)
})
test('ST rechecks native current-open state after all closing role acquisitions',async()=>{
 let reads=0;const fetchOriginal=fixtureFetch(original)
 const jobs=await run({now:'2026-11-15T06:00:00Z',fetchImpl:async(url,init)=>{
  if(url===openURL&&++reads===2){const p=structuredClone(original);rewriteJson(p[openURL],v=>{v['563637173400230']=false});return fixtureFetch(p)(url,init)}
  return fetchOriginal(url,init)
 }})
 assert.equal(jobs.length,9)
 assert.match(jobs.nativeCollectionEvidence.heldRecords.find(r=>r.id===563637173400230).reason,/closed before publication/)
})
test('a changed closing native full role cannot certify the opening criteria',async()=>{
 let reads=0;const fetchOriginal=fixtureFetch(original)
 await assert.rejects(run({now:'2026-11-15T06:00:00Z',fetchImpl:async(url,init)=>{
  if(url===own&&++reads===2){const p=structuredClone(original);rewriteJson(p[own],v=>{v.job_description+='<p>Additional required certificate.</p>'});return fixtureFetch(p)(url,init)}
  return fetchOriginal(url,init)
 }}),/authored criteria disagree/)
})
