import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {decorateJobsWithProviderMetadata,getScraperCatalog} from '../../scraper-support/providers/index.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz',import.meta.url))))
const NOW=fixture.originalObservedWindow.latest
async function replay(mutate=()=>{},options={}){
 const packets=structuredClone(fixture.packets);mutate(packets);let index=0
 const jobs=await run({now:NOW,...options,fetch:async(url,init)=>{
  const p=packets[index++];assert.ok(p,'Uncaptured request');assert.equal(String(url),p.url);assert.equal(init.method,'GET')
  return{status:p.status,url:p.url,text:async()=>p.body}
 }})
 assert.equal(index,packets.length);return jobs
}
const mutateAPI=(p,fn)=>{for(const i of[3,p.length-1]){const d=JSON.parse(p[i].body);fn(d);p[i].body=JSON.stringify(d)}}
const mutateRole=(p,fn)=>{p[4].body=p[4].body.replace(/window\.__remixContext = ([\s\S]*?);<\/script>/,(all,json)=>{const d=JSON.parse(json);fn(d.state.loaderData['routes/$url_token_.jobs_.$job_post_id'],d);return'window.__remixContext = '+JSON.stringify(d)+';</script>'})}
const currentDate=p=>{mutateAPI(p,d=>d.jobs[0].first_published='2026-10-06T23:44:28-04:00');mutateRole(p,r=>r.jobPost.published_at='2026-10-06T23:44:28-04:00')}
test('current native India role retains July publication rather than October edit and is age-rejected',async()=>{
 const jobs=await replay();assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'5180972007')
 assert.equal(jobs[0].postedAt,'2026-07-07T03:44:28.000Z');assert.equal(jobs[0].nativeUpdatedAt,'2026-10-12T17:55:05-04:00')
 assert.match(jobs[0].sourceDescription,/Key Responsibilities/);assert.equal(jobs[0].sourceListingComplete,false)
 const metrics=analyzePublishableJobs(jobs,{now:NOW});assert.equal(metrics.eligibleJobs.length,0);assert.equal(metrics.filterCounts.old,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const provider=getScraperCatalog().find(r=>r.source==='datahub'),decorated=decorateJobsWithProviderMetadata(jobs,provider)
 assert.equal(decorated[0].sourceUrl,'https://job-boards.greenhouse.io/acryldata/jobs/5180972007')
})
for(const[name,mutate]of[
 ['wrong corporate canonical',p=>p[1].body=p[1].body.replace('href="https://datahub.com/company/careers/"','href="https://example.com/careers/"')],
 ['wrong deferred tenant',p=>p[1].body=p[1].body.replace('js?for=acryldata','js?for=other')],
 ['commented deferred configuration',p=>p[1].body=p[1].body.replace(/(<script\b[^>]*id="datahub-greenhouse-board-js"[^>]*><\/script>)/,'<!--$1-->')],
 ['missing active loader',p=>p[1].body=p[1].body.replace('class RocketLazyLoadScripts','class OtherLoader')],
 ['wrong native embed tenant',p=>p[2].body=p[2].body.replace('job_board?for=acryldata','job_board?for=other')],
 ['upstream HTTP403',p=>p[3].status=403],
 ['error envelope',p=>mutateAPI(p,d=>d.error='upstream failed')],
 ['missing total',p=>mutateAPI(p,d=>delete d.meta.total)],
 ['truncated inventory',p=>mutateAPI(p,d=>d.meta.total++)],
 ['duplicate inventory identity',p=>mutateAPI(p,d=>d.jobs[1].id=d.jobs[0].id)],
 ['wrong native company',p=>mutateAPI(p,d=>d.jobs[0].company_name='Another Company')],
 ['contradictory native country',p=>mutateAPI(p,d=>d.jobs[0].country='United States')],
 ['foreign application',p=>mutateAPI(p,d=>d.jobs[0].absolute_url='https://example.com/job')],
 ['invalid calendar',p=>mutateAPI(p,d=>d.jobs[0].first_published='2026-02-30T00:00:00Z')],
 ['future posting date',p=>mutateAPI(p,d=>d.jobs[0].first_published='2099-01-01T00:00:00Z')],
 ['wrong application path',p=>p[4].body=p[4].body.replace('action="/acryldata/jobs/5180972007"','action="/other/jobs/5180972007"')],
 ['wrong native role ID',p=>mutateRole(p,r=>r.jobPostId='999')],
 ['later active model override',p=>p[4].body=p[4].body.replace('</body>','<script>window.__remixContext=null;</script></body>')],
 ['disabled submit',p=>p[4].body=p[4].body.replace('type="submit"','disabled type="submit"')],
 ['final inventory drift',p=>{const d=JSON.parse(p[5].body);d.jobs.pop();d.meta.total--;p[5].body=JSON.stringify(d)}]
])test(name+' cannot become a successful result',async()=>assert.rejects(replay(mutate)))
for(const[name,content]of[
 ['missing description',''],['instruction-only description','<p>Please click Apply now to access the complete role description, requirements, responsibilities and application instructions. Submit your application to read further information.</p>'],
 ['closed role','<p>This role is closed.</p>'],['hidden duties','<div hidden>Design and build reliable cloud platforms, monitor production systems, and improve service performance with engineering teams.</div>']
])test(name+' preserves native row with incomplete content',async()=>{
 const jobs=await replay(p=>{currentDate(p);mutateRole(p,r=>r.jobPost.content=content)})
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDescription,null);assert.equal(jobs[0].sourceDetailComplete,false)
 const m=analyzePublishableJobs(jobs,{now:NOW});assert.equal(m.eligibleJobs.length,name==='closed role'?0:1)
 assert.equal(m.filterCounts.closed,name==='closed role'?1:0);assert.equal(m.filterCounts.emptyDescription,0)
 if(name==='closed role')assert.equal(jobs[0].sourceAvailabilityEvidence?.state,'closed')
})
test('genuine role duties with application footer remain usable',async()=>{
 const jobs=await replay(p=>{currentDate(p);mutateRole(p,r=>r.jobPost.content+='<p>Please click Apply now to submit your application.</p>');mutateAPI(p,d=>d.jobs[0].content+='<p>Please click Apply now to submit your application.</p>')})
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(analyzePublishableJobs(jobs,{now:NOW}).eligibleJobs.length,1)
})

test('a current role-scoped native header closure overrides an unchanged full JD without inventing a closing date',async()=>{
 const jobs=await replay(p=>{currentDate(p);const start=p[4].body.indexOf('class="job__header"');assert.ok(start>=0);const end=p[4].body.indexOf('>',start);p[4].body=p[4].body.slice(0,end+1)+'<p>This position is closed.</p>'+p[4].body.slice(end+1)})
 const job=jobs[0],metrics=analyzePublishableJobs(jobs,{now:NOW})
 assert.equal(job.sourceDescription,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceAvailabilityEvidence.state,'closed')
 assert.equal(job.sourceAvailabilityEvidence.notice,'This position is closed.');assert.match(job.nativeRejectedDescription,/Key Responsibilities/)
 assert.equal(job.closingDate,null);assert.equal(metrics.filterCounts.closed,1);assert.equal(metrics.eligibleJobs.length,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const notice of['<p hidden>This position is closed.</p>','<p inert>This position is closed.</p>',
 '<p>If this position is closed, please browse other vacancies.</p>'])test('inactive or conditional DataHub header does not create closure: '+notice,async()=>{
 const replayStatus=()=>replay(p=>{currentDate(p);const start=p[4].body.indexOf('class="job__header"');assert.ok(start>=0);const end=p[4].body.indexOf('>',start);p[4].body=p[4].body.slice(0,end+1)+notice+p[4].body.slice(end+1)+'<footer>This position is closed.</footer>'})
 // Bare inert leaves text visually present; it cannot establish OPEN availability.
 if(notice==='<p inert>This position is closed.</p>'){await assert.rejects(replayStatus,error=>error.code==='NATIVE_STATUS_LAYOUT_UNQUALIFIED');return}
 const jobs=await replayStatus()
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceAvailabilityEvidence.state,'open')
 assert.equal(analyzePublishableJobs(jobs,{now:NOW}).eligibleJobs.length,1)
})
test('explicit stable scoped empty remains company coverage gap',async()=>{
 const jobs=await replay(p=>{mutateAPI(p,d=>{d.jobs=[];d.meta.total=0});p.splice(4,1)})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.match(readInventoryEvidence(jobs).reason,/scoped.*empty/i)
})
test('partial caps are rejected',async()=>assert.rejects(replay(()=>{},{maxJobs:0})))
test('caller cancellation is respected',async()=>{const c=new AbortController();c.abort();await assert.rejects(replay(()=>{},{signal:c.signal}))})
test('an uncooperative public transport is bounded by the deadline',async()=>assert.rejects(run({timeoutMs:20,fetch:()=>new Promise(()=>{})})))
for(const[name,change]of[
 ['unrelated form controls',form=>'<form method="get" action="/acryldata/jobs/5180972007" id="application-form"></form>'+form.replace(/^<form\b[^>]*>/,'').replace(/<\/form>$/,'')],
 ['disabled fieldset',form=>form.replace(/^(<form\b[^>]*>)/,'$1<fieldset disabled>').replace('</form>','</fieldset></form>')],
 ['applicant reassigned to another form',form=>form.replace('id="first_name"','form="other" id="first_name"')]
])test(name+' cannot establish an available application',async()=>assert.rejects(replay(p=>{
 let count=0;p[4].body=p[4].body.replace(/<form\b[^>]*\bid="application-form"[^>]*>[\s\S]*?<\/form>/g,form=>{count++;return change(form)});assert.equal(count,1)
})))
test('later native embed account overwrite is rejected',async()=>assert.rejects(replay(p=>p[2].body+='\nGrnhse.Settings = {};')))
test('commented loader cannot bind deferred recruitment configuration',async()=>assert.rejects(replay(p=>{
 p[1].body=p[1].body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,body,close)=>body.includes('class RocketLazyLoadScripts')?open+'/*'+body+'*/'+close:all)
})))
test('company introduction alone remains a missing role description',async()=>{
 const content='<p>DataHub is an enterprise data platform that supports teams around the world. Our software brings discovery, observability, governance and trusted context to data organizations and helps customers accelerate their data investments.</p>'
 const jobs=await replay(p=>{currentDate(p);mutateRole(p,r=>r.jobPost.content=content);mutateAPI(p,d=>d.jobs[0].content=content)})
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(analyzePublishableJobs(jobs,{now:NOW}).eligibleJobs.length,1)
})
for(const[name,mutate]of[
 ['foreign role canonical',p=>p[4].body=p[4].body.replace('href="http://job-boards.greenhouse.io/acryldata/jobs/5180972007"','href="https://example.com/wrong"')],
 ['inert application ancestor',p=>p[4].body=p[4].body.replace(/(<form\b[^>]*\bid="application-form"[^>]*>[\s\S]*?<\/form>)/,'<div inert>$1</div>')],
 ['hidden applicant input type',p=>p[4].body=p[4].body.replace(/<input\b[^>]*\bid="first_name"[^>]*>/,input=>input.replace('type="text"','type="hidden"'))],
 ['uncalled loader expression',p=>p[1].body=p[1].body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,body,close)=>body.includes('class RocketLazyLoadScripts')?open+body.replace(/\(\)\s*;?\s*$/,';')+close:all)],
 ['wrong direct settings hidden by archived correct text',p=>{
  const match=p[2].body.match(/Grnhse\.Settings\s*=\s*\{([\s\S]*?)\};/);assert.ok(match)
  let changed=match[1]
  for(const key of['targetDomain','boardURI','applicationURI'])changed=changed.replace(new RegExp('(\\b'+key+'\\s*:\\s*)\'[^\']*\''),'$1("https://example.com/wrong")')
  const archived="targetDomain: 'https://job-boards.greenhouse.io', boardURI: 'https://job-boards.greenhouse.io/embed/job_board?for=acryldata', applicationURI: 'https://job-boards.greenhouse.io/embed/job_app?for=acryldata'"
  p[2].body=p[2].body.replace(match[0],'Grnhse.Settings = {'+changed+', archivedSettings: '+JSON.stringify(archived)+'\n};')
 }],
 ['conflicting foreign office label',p=>mutateAPI(p,d=>d.jobs[0].offices[0].location='Boston, United States, India')]
])test(name+' must reject',async()=>assert.rejects(replay(mutate)))
test('instructions mentioning responsibilities and requirements cannot substitute for role sections',async()=>{
 const content='<p>Before you submit your resume, review the responsibilities and requirements that will be displayed during the application process. Use the application form below to provide your contact information and upload your documents. Follow the instructions on the next screen to learn more about this opportunity and complete the application.</p>'
 const jobs=await replay(p=>{currentDate(p);mutateRole(p,r=>r.jobPost.content=content);mutateAPI(p,d=>d.jobs[0].content=content)})
 assert.equal(jobs[0].sourceDescription,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(analyzePublishableJobs(jobs,{now:NOW}).eligibleJobs.length,1)
})
test('instruction paragraphs under role headings still remain missing content',async()=>{
 const paragraph='Before you submit your resume, review the responsibilities and requirements that will be displayed during the application process. Use the application form below to provide your contact information and upload your documents. Follow the instructions on the next screen to learn more about this opportunity and complete the application.'
 const content='<h2>Key Responsibilities</h2><p>'+paragraph+'</p><h2>Requirements</h2><p>'+paragraph+'</p>'
 const jobs=await replay(p=>{currentDate(p);mutateRole(p,r=>r.jobPost.content=content);mutateAPI(p,d=>d.jobs[0].content=content)})
 assert.equal(jobs[0].sourceDescription,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(analyzePublishableJobs(jobs,{now:NOW}).eligibleJobs.length,1)
})
