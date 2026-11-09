import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from '../scraper/gati/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {gatiFixtureTransport as transport} from './helpers/gatiFixture.js'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {cssPermutationProof} from '../scraper/gati/corporateScope.js'
const corporateVariant=JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/gati/fixtures/corporate-variant-20261030.json.gz',import.meta.url))))
const origin='https://allcargologistics.darwinbox.in',seed=origin+'/ms/candidatev2/main/careers/allJobs'
const config=origin+'/ms/candidateapi/getCompanyConfig?is_preview=false&companyId=main'
const group=origin+'/ms/candidateapi/groupcompanycareersetting?companyId=main'
const listing=origin+'/ms/candidateapi/job?page=1&companyId=main'
const parent='https://www.allcargologistics.com/',careers=parent+'about-us/careers'
// The old source ignores fetchImpl. Replace fetch too so a RED run is offline.
async function execute(change,options={}){const t=transport(change),previous=globalThis.fetch;globalThis.fetch=t.fetchImpl;try{return {jobs:await run({fetchImpl:t.fetchImpl,...options}),calls:t.calls}}finally{globalThis.fetch=previous}}
test('Gati binds the actual 301 and current AllcargoGATI ownership chain to declared native zero',async()=>{
 const {jobs,calls}=await execute();assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs)?.status,'verified-empty');assert.equal(readInventoryEvidence(jobs).reportedTotal,0)
 assert.equal(jobs.sourceAudit.source,'gati');assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed,true)
 for(const url of ['https://www.gati.com/',parent,careers,config,group,listing])assert.equal(calls.filter(c=>c.url===url).length,2,url)
 assert.ok(calls.every(c=>c.method==='GET'));assert.ok(!calls.some(c=>c.url.includes('gatikwe')||c.url.includes('job/alljobs')))
})
for(const [label,url,transform]of[
 ['other alias redirect','https://www.gati.com/',r=>{r.location='https://other.example/'}],
 ['hidden ownership heading',parent,r=>{r.body=r.body.replace('AllcargoGATI:', '<template>AllcargoGATI:</template>')}],
 ['additional ATS',careers,r=>{r.body+='<a href="https://boards.greenhouse.io/other"></a>'}],
 ['new form',careers,r=>{r.body+='<form action="https://other.example/apply"></form>'}],
 ['new script',careers,r=>{r.body+='<script src="https://other.example/jobs.js"></script>'}],
 ['new iframe',careers,r=>{r.body+='<iframe src="https://other.example/jobs"></iframe>'}],
 ['unattributed visible role',careers,r=>{r.body+='<h2>Engineer India</h2><p>Apply via email</p>'}],
 ['changed client',origin+'/ms/candidatev2/main.71bd301266b6050c.js',r=>{r.body+=';fetch("https://other.example/jobs")'}],
 ['new native config channel',config,r=>{const p=JSON.parse(r.body);p.message.company.extraHiringBoard='https://other.example/jobs';r.body=JSON.stringify(p)}],
 ['additional native group',group,r=>{r.body=JSON.stringify({status:'success',message:{code:1,companies:[{id:'other'}]}})}],
 ['positive native records',listing,r=>{r.body=JSON.stringify({status:'success',message:{jobscount:1,jobs:[{id:'new',title:'Engineer',locations:'Unknown'}]}})}],
 ['truncated native page',listing,r=>{r.body=JSON.stringify({status:'success',message:{jobscount:1,jobs:[]}})}],
 ['extra native envelope',listing,r=>{const p=JSON.parse(r.body);p.next_page=2;r.body=JSON.stringify(p)}],
])test('Gati refuses whole-source empty for '+label,async()=>{
 const {jobs}=await execute(r=>{if(r.url===url)transform(r)});assert.equal(readInventoryEvidence(jobs)?.listingComplete,false);assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed,false)
 if(label==='positive native records')assert.equal(jobs.sourceAudit.unresolvedNativeRoles[0].id,'new')
})
test('closing-only config, identity or criteria drift cannot retain verified zero',async()=>{
 const {jobs}=await execute((r,n)=>{if(r.url===config&&n===2){const p=JSON.parse(r.body);p.message.company.custom_weblink='https://other.example/jobs';r.body=JSON.stringify(p)}})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('failed native envelope is partial and never empty',async()=>{
 const {jobs}=await execute(r=>{if(r.url===listing)r.body=JSON.stringify({status:'failed',message:{jobscount:0,jobs:[]}})});assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Gati requires exact response metadata and full bounded responses',async()=>{
 await assert.rejects(execute(r=>{if(r.url===parent)r.responseUrl='https://other.example/'}),/response URL/i)
 await assert.rejects(execute(r=>{if(r.url===parent)r.body='x'.repeat(8000001)}),/budget/i)
 await assert.rejects(execute(undefined,{maxJobs:1}),/caps/i)
 await assert.rejects(run({fetchPage:async()=>({html:'body only'})}),/metadata/i)
})
test('cancellation propagates before any request',async()=>{
 const c=new AbortController();c.abort(new Error('fixture cancellation'));await assert.rejects(run({signal:c.signal,fetchImpl:async()=>assert.fail('request after cancel')}),/fixture cancellation/)
})
test('Gati native reads use the actual successful public research profile rather than the observed failing one',async()=>{
 const {jobs}=await execute((row,n,init)=>{if(row.url.includes('/ms/candidateapi/')){
  if(init.headers['User-Agent']!=='Mozilla/5.0 (compatible; Jobverify scraper)'||Object.hasOwn(init.headers,'Accept')){row.status=403;row.body='Observed profile unavailable'}
 }})
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('actual corporate SSR serialization and hydration reference variants retain the identical source scope',async()=>{
 const {jobs}=await execute((row,n)=>{const actual=corporateVariant.records.find(r=>r.url===row.url);if(actual&&n===2)row.body=actual.body})
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
for(const label of ['new hiring data','new hydration key','broken hydration binding','script injection','form injection','CSS hiding criteria'])test('SSR normalization retains '+label+' as incomplete',async()=>{
 const {jobs}=await execute(row=>{if(row.url!==careers)return;row.body=corporateVariant.records.find(r=>r.url===careers).body
  if(label==='script injection')row.body+='<script>fetch("https://other.example/jobs")</script>'
  else if(label==='form injection')row.body+='<form action="https://other.example/apply"></form>'
  else if(label==='CSS hiding criteria')row.body=row.body.replace('.express--faqs{position:relative;z-index:5}', '.express--faqs{position:relative;z-index:5;opacity:0}')
  else row.body=row.body.replace(/(<script id="ng-state" type="application\/json">)([\s\S]*?)(<\/script>)/,(all,start,text,end)=>{
   const state=JSON.parse(text)
   if(label==='new hiring data')state.extraMandatoryHiringBoard='https://other.example/jobs'
   else if(label==='new hydration key')state.__nghData__[0].additionalMandatoryCriteria='Apply in another channel'
   else {let altered=false;const walk=v=>{if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(!altered&&k==='i'&&/^t\d+$/.test(v[k])){v[k]='t999999';altered=true}else if(typeof v[k]==='object')walk(v[k])}};walk(state.__nghData__);assert.ok(altered)}
   return start+JSON.stringify(state)+end
  })
 });assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const label of ['unreviewed CSS order','changed preload attributes','changed state wrapper','duplicate business keys','changed hydration number'])test('SSR signature rejects '+label,async()=>{
 const {jobs}=await execute(row=>{if(row.url!==careers)return
  if(label==='unreviewed CSS order'){
   const styles=[...row.body.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)];const a=styles[13][0],b=styles[14][0];row.body=row.body.replace(a,'<!--swap-known-style-->').replace(b,a).replace('<!--swap-known-style-->',b)
  }else if(label==='changed preload attributes')row.body=row.body.replace('rel="preload" fetchpriority="high"','rel="preload" fetchpriority="high" onload="fetch(\'/jobs\')"')
  else if(label==='changed state wrapper')row.body=row.body.replace('<script id="ng-state" type="application/json">','<script id="ng-state" type="application/json" data-jobs="extra">')
  else row.body=row.body.replace(/(<script id="ng-state" type="application\/json">)([\s\S]*?)(<\/script>)/,(all,start,text,end)=>{
   if(label==='duplicate business keys'){const i=text.lastIndexOf('}');return start+text.slice(0,i)+',"__nghData__":'+JSON.stringify(JSON.parse(text).__nghData__)+text.slice(i)+end}
   const state=JSON.parse(text);let changed=false;const walk=v=>{for(const k of Object.keys(v)){if(!changed&&typeof v[k]==='number'){v[k]++;changed=true}else if(v[k]&&typeof v[k]==='object')walk(v[k])}};walk(state.__nghData__);assert.ok(changed);return start+JSON.stringify(state)+end
  })
 });assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('CSS permutation proof rejects overlapping rules that could change visibility or interaction',()=>{
 const body=corporateVariant.records.find(r=>r.url===careers).body,reviewed=JSON.parse(fs.readFileSync(new URL('../scraper/gati/reviewedNativeScope.json',import.meta.url))).corporate[careers].styles,current=body.match(/<style\b[^>]*>[\s\S]*?<\/style>/g)
 assert.equal(cssPermutationProof(body,reviewed,current).valid,true)
 const overlapping=body.replace('</body>','<a class="static--banner-svg1 express--faqs" href="/jobs">Apply</a></body>')
 assert.equal(cssPermutationProof(overlapping,reviewed,current).valid,false)
})
