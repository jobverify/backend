import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {decorateJobsWithProviderMetadata,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-browser-20261021.json.gz',import.meta.url))))
const NOW='2026-10-21T14:23:38.854Z'
async function replay(mutate=()=>{},options={}){
 const packets=structuredClone(original);mutate(packets);let index=0
 const jobs=await run({now:NOW,...options,fetch:async(url,init)=>{
  const packet=packets[index++];assert.ok(packet,'unexpected request');assert.equal(url,packet.url);assert.equal(init.method,'GET')
  return{status:packet.status,url:packet.finalURL,headers:new Headers(packet.headers),text:async()=>packet.body}
 }})
 assert.equal(index,17);return jobs
}
test('actual seventeen public responses reconcile all six roles; two current and four old; company scope partial',async()=>{
 const jobs=await replay();assert.equal(jobs.length,6);assert.equal(analyzePublishableJobs(jobs,{now:NOW}).eligibleJobs.length,2)
 assert.ok(jobs.every(j=>j.source==='crestdatasystems'&&j.country==='India'&&j.sourceListingComplete===false&&j.sourceDetailComplete===true))
 assert.equal(jobs[1].title,'SSE/TL Fullstack Developer');assert.equal(jobs[1].nativeDetailTitle,'SSE Fullstack Developer')
 assert.equal(jobs[0].nativePostedAt,'2026-10-07T07:23:55');assert.equal(jobs[0].postedAtPrecision,'day');assert.equal(jobs[0].nativeCountry,null)
 assert.match(jobs[0].applyUrl,/#wpcf7-f47103-p49517-o3$/)
})
test('catalog canonical role URLs survive persistence normalization separately from application forms',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='crestdatasystems')
 const jobs=decorateJobsWithProviderMetadata(await replay(),provider)
 for(const job of jobs){
  const normalized=normalizeScrapedJob(job,provider)
  assert.equal(job.sourceUrl,job.sourceURL)
  assert.equal(normalized.sourceUrl,job.sourceURL)
  assert.equal(new URL(normalized.sourceUrl).hash,'')
  assert.equal(normalized.applyUrl,job.applyUrl)
  assert.match(new URL(normalized.applyUrl).hash,/^#wpcf7-f47103-p\d+-o3$/)
 }
 assert.equal(new Set(analyzePublishableJobs(jobs,{now:NOW}).eligibleJobs.map(job=>job.sourceUrl)).size,2)
})
const mutateFeed=(packets,fn)=>{for(const index of[5,14]){const rows=JSON.parse(packets[index].body);fn(rows);packets[index].body=JSON.stringify(rows)}}
for(const [name,mutation] of[
 ['HTTP success202',p=>p[5].status=202],
 ['redirect',p=>p[8].finalURL='https://example.com/'],
 ['error envelope',p=>p[5].body=JSON.stringify({error:'failure',data:[]})],
 ['missing total',p=>delete p[5].headers['x-wp-total']],
 ['unseen pages',p=>p[5].headers['x-wp-totalpages']='2'],
 ['duplicate ID',p=>mutateFeed(p,r=>r[1].id=r[0].id)],
 ['unknown office',p=>mutateFeed(p,r=>r[0].job_location=[999])],
 ['wrong host',p=>mutateFeed(p,r=>r[0].link='https://example.com/job/')],
 ['invalid calendar',p=>mutateFeed(p,r=>r[0].date='2026-02-30T12:00:00')],
 ['future date',p=>mutateFeed(p,r=>r[0].date='2099-01-01T12:00:00')],
 ['title drift',p=>mutateFeed(p,r=>r[0].title.rendered='Wrong role')],
 ['wrong detail ID',p=>p[8].body=p[8].body.replace('data-elementor-id="49517"','data-elementor-id="99999"')],
 ['wrong application ID',p=>p[8].body=p[8].body.replace('name="_wpcf7_container_post" value="49517"','name="_wpcf7_container_post" value="99999"')],
 ['final inventory drift',p=>{const r=JSON.parse(p[14].body);r.pop();p[14].body=JSON.stringify(r)}],
 ['inactive client',p=>p[2].body=p[2].body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,s=>s.includes('job_career?per_page=100')?s.replace('<script','<script inert'):s)],
])test(name,async()=>assert.rejects(replay(mutation)))
test('caps cannot certify zero',async()=>assert.rejects(replay(()=>{},{maxJobs:0})))
test('caller cancellation is respected',async()=>{const c=new AbortController();c.abort();await assert.rejects(replay(()=>{},{signal:c.signal}))})
const replaceDescription=(p,body)=>{
 const replace=html=>html.replace(/(<div\b[^>]*class="[^"]*elementor-widget-text-editor[^"]*"[^>]*>)[\s\S]*?(<\/div>)/,(_,open,close)=>open+'<p>No. Of Positions : 1 Location : Ahmedabad Experience : 6+ Years Job Description:</p>'+body+close)
 mutateFeed(p,r=>r[0].content.rendered=replace(r[0].content.rendered));p[8].body=replace(p[8].body)
}
for(const [name,body] of[
 ['placeholder','<p>Sample</p>'],
 ['long application instructions','<p>Please click the Apply now button to access the complete details about this position, the requirements, the application instructions and the recruitment process. Please submit your application to view further information.</p>'],
 ['closed role','<p>This role is no longer available. Thank you for your interest in our team and please visit our website for additional career opportunities.</p>'],
 ['hidden description','<div hidden>Design and build distributed software systems and operate customer services with engineering teams for enterprise clients and other stakeholders.</div>'],
 ['inert description','<div inert>Design and build distributed software systems and operate customer services with engineering teams for enterprise clients and other stakeholders.</div>'],
])test(name+' cannot become full JD',async()=>{const jobs=await replay(p=>replaceDescription(p,body));assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceDescription,null)})
test('genuine description with Apply footer remains meaningful',async()=>{const jobs=await replay(p=>replaceDescription(p,'<p>Design and build distributed software systems and operate customer services with engineering teams for enterprise clients and other stakeholders.</p><p>Please click Apply now to submit your application.</p>'));assert.equal(jobs[0].sourceDetailComplete,true)})
test('native row error signal is not healthy content',async()=>assert.rejects(replay(p=>mutateFeed(p,r=>r[0].ERROR='upstream failed'))))
test('hidden corporate binding cannot qualify',async()=>assert.rejects(replay(p=>p[0].body=p[0].body.replace('<body','<body inert'))))
test('final-response caller cancellation cannot return prior jobs',async()=>{
 const controller=new AbortController();let i=0
 await assert.rejects(run({now:NOW,signal:controller.signal,fetch:async(url)=>{const p=original[i++];return{status:200,url,headers:new Headers(p.headers),text:async()=>{if(i===17)controller.abort();return p.body}}}}))
})
test('uncooperative transport settles at the deadline',async()=>assert.rejects(run({now:NOW,timeoutMs:20,fetch:()=>new Promise(()=>{})})))
const mutateApplication=(packets,change)=>{
 let changed=0
 packets[8].body=packets[8].body.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi,form=>{
  if(!form.includes('name="_wpcf7_container_post" value="49517"'))return form
  changed++;const result=change(form);assert.notEqual(result,form);return result
 });assert.equal(changed,1)
}
for(const [name,change] of[
 ['empty application shell',f=>f.replace(/(>)[\s\S]*<\/form>$/,'$1<input type="hidden" name="_wpcf7_container_post" value="49517"></form>')],
 ['wrong CF7 form ID',f=>f.replace('name="_wpcf7" value="47103"','name="_wpcf7" value="99999"')],
 ['wrong CF7 unit tag',f=>f.replace('name="_wpcf7_unit_tag" value="wpcf7-f47103-p49517-o3"','name="_wpcf7_unit_tag" value="wpcf7-f99999-p99999-o3"')],
 ['all application controls disabled',f=>f.replace(/<(input|textarea|button|select)\b/g,'<$1 disabled')],
 ['submit disabled',f=>f.replace('type="submit"','disabled type="submit"')],
 ['applicant email readonly',f=>f.replace('type="email"','readonly type="email"')],
 ['controls inside disabled fieldset',f=>f.replace(/(<form\b[^>]*>)/,'$1<fieldset disabled>').replace('</form>','</fieldset></form>')],
 ['submit hidden',f=>f.replace('type="submit"','hidden type="submit"')],
 ['missing applicant email',f=>f.replace(/<input\b[^>]*\btype="email"[^>]*>/,'')],
 ['duplicate CF7 hidden identity',f=>f.replace('</form>','<input type="hidden" name="_wpcf7" value="47103"></form>')],
 ['missing required relevant experience',f=>f.replace(/<textarea\b[^>]*name="message-601"[^>]*>[\s\S]*?<\/textarea>/,'')],
 ['disabled required relevant experience',f=>f.replace('<textarea','<textarea disabled')],
 ['post identifier associated with another form',f=>f.replace('name="_wpcf7_container_post"','form="other" name="_wpcf7_container_post"')],
 ['post identifier empty form override',f=>f.replace('name="_wpcf7_container_post"','form="" name="_wpcf7_container_post"')],
])test(name+' cannot qualify an application',async()=>assert.rejects(replay(p=>mutateApplication(p,change))))
test('company introduction alone is not a role description',async()=>{const jobs=await replay(p=>replaceDescription(p,'<p>About Crest Data: Crest Data is a global provider of data analytics, security, cloud and digital transformation services. We partner with leading enterprises and technology companies around the world.</p>'));assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].description,null)})
test('company introduction followed by genuine role duties remains valid',async()=>{const jobs=await replay(p=>replaceDescription(p,'<p>About Crest Data: Crest Data is a global provider of data analytics, security, cloud and digital transformation services. We partner with leading enterprises and technology companies around the world.</p><p>Job Description: Design and build distributed software systems and operate customer services with engineering teams for enterprise clients and other stakeholders.</p>'));assert.equal(jobs[0].sourceDetailComplete,true)})
test('application instructions followed only by company introduction remain missing',async()=>{const jobs=await replay(p=>replaceDescription(p,'<p>Please click Apply now to submit your application.</p><p>About Crest Data: Crest Data is a global provider of data analytics, security, cloud and digital transformation services. We partner with leading enterprises and technology companies around the world.</p>'));assert.equal(jobs[0].sourceDetailComplete,false)})
