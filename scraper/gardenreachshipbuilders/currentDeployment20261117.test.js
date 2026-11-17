import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {corporateDelegates,createCurrentNoticeScraper} from './currentNotice20261110.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-20261117.json.gz',import.meta.url))))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8'),corporate=text(fixture.corporate)
function replay(change=(_url,p)=>p){const calls=[];return{calls,fetchImpl:async(url,init={})=>{
 init.signal?.throwIfAborted();assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');calls.push(url)
 const p=url===fixture.corporate.requestedURL?fixture.corporate:fixture.originals.find(p=>p.requestedURL===url);assert.ok(p,'Uncaptured current native route '+url)
 const row=change(url,{...p,body:Buffer.from(p.bodyBase64,'base64')}),response=new Response(row.body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});return response
}}}
test('current native corpus preserves all original hashes and exact current programme entities',()=>{
 for(const p of [fixture.corporate,...fixture.originals])assert.equal(createHash('sha256').update(Buffer.from(p.bodyBase64,'base64')).digest('hex'),p.bodySHA256)
 assert.equal(fixture.observedNativeNotices.active.length,1);assert.equal(fixture.observedNativeNotices.active[0].notificationId,'2026/05(J&OP)')
})
test('current exact activation contract binds runtime-selected CJO even though its server class is active',()=>{
 const result=corporateDelegates(corporate);assert.equal(result.notificationId,'2026/05(J&OP)');assert.equal(result.reviewedAssets.length,2)
 assert.equal(result.corporateActivationModel.runtimeSelectedPanel,'CJO');assert.equal(result.corporateActivationModel.sourceScopeComplete,false)
})
test('current native activation restores notice acquisition while preserving the actual PDF/country/group-vacancy hold',async()=>{
 const io=replay();await assert.rejects(createCurrentNoticeScraper({asOfDate:'2026-11-17'}).run(io),error=>{
  const evidence=error.nativeEvidence;assert.equal(evidence.observedListingCount,1);assert.equal(evidence.indexNoticeObservations[0].notices.length,4);assert.equal(evidence.indexNoticeObservations[1].notices.length,11)
  assert.equal(evidence.jobs.length,0);assert.equal(evidence.companyIndiaTotal,null);assert.equal(evidence.inventoryComplete,false);assert.equal(evidence.lifecycleCleanupAllowed,false)
  assert.ok(['native-pdf-extraction','individual-role-country-contract'].includes(evidence.failures[0].stage));return true
 });assert.equal(io.calls.length,7)
})
for(const [name,change]of[
 ['unreviewed tab programme version',h=>h.replace('index.js?v=20261113-1','index.js?v=unreviewed')],
 ['additional executable under hidden ancestor',h=>h.replace('</body>','<div hidden><script>document.querySelector(".bucket").remove()</script></div></body>')],
 ['duplicate native root',h=>h.replace('</body>','<div class="bucket" tabindex="0"></div></body>')],
 ['duplicate current panel',h=>h.replace('</body>','<div id="CJO" class="tabcontent active"></div></body>')],
 ['different current tab button',h=>h.replace('data-tab-target="CJO"','data-tab-target="OP"')],
 ['current buttons outside the programme root',h=>{const block=h.match(/<div\b(?=[^>]*\bclass="tab")[^>]*>[\s\S]*?<\/div>/)?.[0];assert.ok(block);return h.replace(block,'').replace('</body>',block+'</body>')}],
 ['missing reviewed native CSS declaration',h=>h.replace('<link rel="stylesheet" href="assets/css/index.css">','')],
])test('current activation refuses '+name,()=>{const changed=change(corporate);assert.notEqual(changed,corporate);assert.throws(()=>corporateDelegates(changed),/corporate|activation|programme/)} )
for(const name of ['javascript','css'])test('current exact '+name+' entity bytes must qualify before any native notice index',async()=>{
 const io=replay((url,p)=>{if(name==='javascript'?url.includes('/js/'):url.includes('/css/'))p.body=Buffer.concat([p.body,Buffer.from('\n/* changed */')]);return p})
 await assert.rejects(createCurrentNoticeScraper().run(io),/reviewed corporate activation asset bytes changed/)
 assert.equal(io.calls.some(url=>url.includes('jobapply.in')),false)
})
test('opaque caller cancellation during current programme fetch retains the exact reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'stop-current-GRSE-programme'}),io=replay((url,p)=>{if(url.includes('/js/'))controller.abort(reason);return p})
 await assert.rejects(createCurrentNoticeScraper().run({...io,signal:controller.signal}),error=>error===reason);assert.equal(io.calls.length,2)
})
