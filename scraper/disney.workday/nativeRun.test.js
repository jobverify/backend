import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {originalDate} from './nativeContract.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'

const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-radancy-41.json.gz',import.meta.url))))
const now=new Date(original.records[0].startedAt)
const replay=async(mutate=()=>{},options={})=>{
 const records=structuredClone(original.records);mutate(records);let index=0
 const jobs=await run({now,...options,fetch:async(url,init={})=>{
  const p=records[index++];assert.ok(p,'Unexpected request');assert.equal(String(url),p.url);assert.equal(init.method||'GET',p.method)
  return{status:p.status,url:p.finalURL,text:async()=>p.body}
 }})
 assert.equal(index,records.length);return jobs
}
test('actual 41 HTTP packets yield 32 full India roles with original dates and partial employer scope',async()=>{
 const jobs=await replay();assert.equal(jobs.length,32)
 assert.equal(jobs.every(j=>j.source==='disney'&&j.country==='India'&&j.sourceDetailComplete===true&&j.sourceListingComplete===false),true)
 assert.equal(new Set(jobs.map(j=>j.jobId)).size,32)
 assert.equal(jobs.find(j=>j.jobId==='10152359').postedAt,'2026-05-27T00:00:00.000Z')
 assert.equal(jobs.find(j=>j.jobId==='10163368').postedAt,'2026-10-21T00:00:00.000Z')
 assert.equal(analyzePublishableJobs(jobs,{now}).eligibleJobs.length,9)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

function pageMutation(records,index,fn){const body=JSON.parse(records[index].body);fn(body);records[index].body=JSON.stringify(body)}
function replaceDescription(packet,html){
 const start=packet.body.indexOf('<div class="ats-description">');assert.ok(start>=0)
 const scan=/<\/?div\b[^>]*>/gi;scan.lastIndex=start;let depth=0,end=-1,m
 while((m=scan.exec(packet.body))){depth+=m[0].startsWith('</')?-1:1;if(depth===0){end=scan.lastIndex;break}}
 assert.ok(end>start);packet.body=packet.body.slice(0,start)+'<div class="ats-description">'+html+'</div>'+packet.body.slice(end)
}
for(const[name,mutate]of[
 ['HTTP 202',p=>p[1].status=202],
 ['HTTP 403 retains failure',p=>p[5].status=403],
 ['unexpected redirect',p=>p[5].finalURL='https://example.com/'],
 ['inert search identity',p=>p[0].body=p[0].body.replace('<body','<body inert')],
 ['hidden search identity',p=>p[0].body=p[0].body.replace('<body','<body hidden')],
 ['wrong native migration handoff',p=>p[0].body=p[0].body.replaceAll('https://join.disneycareers.com/global/en/home','https://example.com/')],
 ['conflicting canonical',p=>p[0].body=p[0].body.replace('</head>','<link rel="canonical" href="https://example.com/"></head>')],
 ['wrong India facet type',p=>p[0].body=p[0].body.replace('data-facet-type="2" data-id="1269750"','data-facet-type="1" data-id="1269750"')],
 ['native error envelope',p=>pageMutation(p,1,b=>b.ERROR='upstream unavailable')],
 ['nested error envelope',p=>pageMutation(p,1,b=>b.meta={Status:500})],
 ['string hasJobs',p=>pageMutation(p,1,b=>b.hasJobs='true')],
 ['first count drift',p=>pageMutation(p,1,b=>b.results=b.results.replace('data-total-job-results="32"','data-total-job-results="33"'))],
 ['final count drift',p=>pageMutation(p,40,b=>b.results=b.results.replace('data-total-job-results="32"','data-total-job-results="31"'))],
 ['native nonterminal page masquerades as terminal',p=>pageMutation(p,1,b=>b.results=b.results.replace('data-total-pages="4"','data-total-pages="1"'))],
 ['repeated page number',p=>pageMutation(p,2,b=>b.results=b.results.replace('data-current-page="2"','data-current-page="1"'))],
 ['cross-page duplicate IDs',p=>pageMutation(p,2,b=>b.results=b.results.replaceAll('100801537904','102237954144').replaceAll('10160889','10149306'))],
 ['truncated page',p=>pageMutation(p,1,b=>b.results=b.results.replace(/<li class="">\s*<a href="\/en\/job\/[\s\S]*?<\/li>/,''))],
 ['final title drift',p=>pageMutation(p,37,b=>b.results=b.results.replace('Solutions Engineer II','Different active role'))],
 ['foreign listing office',p=>pageMutation(p,1,b=>b.results=b.results.replace('Bengaluru,  India','New York, United States'))],
 ['conflicting India country label',p=>p[5].body=p[5].body.replaceAll('Bengaluru,  India','Bengaluru, United States, India')],
 ['foreign typed metadata',p=>p[5].body=p[5].body.replaceAll('Bengaluru~Karnataka~India','Bengaluru~Karnataka~United States')],
 ['changed native location ID',p=>p[5].body=p[5].body.replaceAll('1269750-1267701-1277331-1277333','6252001-5128581')],
 ['different legal employer',p=>p[5].body=p[5].body.replaceAll('Disney (India) Private Limited','Unrelated Company Limited')],
 ['wrong native requisition',p=>p[5].body=p[5].body.replaceAll('10149306','99999999')],
 ['wrong visible title',p=>p[5].body=p[5].body.replace('<h1>Solutions Engineer II</h1>','<h1>Different role</h1>')],
 ['inert visible title',p=>p[5].body=p[5].body.replace('<h1>Solutions Engineer II</h1>','<h1 inert>Solutions Engineer II</h1>')],
 ['inert application anchors',p=>p[5].body=p[5].body.replaceAll('class="button job-apply','inert class="button job-apply')],
 ['wrong Workday application tenant',p=>p[5].body=p[5].body.replaceAll('disney.wd5.myworkdayjobs.com','other.wd5.myworkdayjobs.com')],
 ['wrong Phenom application sequence',p=>p[7].body=p[7].body.replaceAll('TWNTWDUS10163368EXTERNALENGLOBAL','TWNTWDUS99999999EXTERNALENGLOBAL')],
 ['date disagreement',p=>p[6].body=p[6].body.replaceAll('5/27/2026','10/21/2026')],
])test(name+' rejects the entire unqualified attempt',async()=>assert.rejects(replay(mutate)))

for(const[name,html]of[
 ['missing full JD',''],
 ['inert full JD','<div inert>Responsibilities: Design and build reliable production services. Required qualifications: extensive software engineering skills and successful delivery of complex distributed systems.</div>'],
 ['hidden full JD','<div hidden>Responsibilities: Design and build reliable production services. Required qualifications: extensive software engineering skills and successful delivery of complex distributed systems.</div>'],
 ['script-only JD','<script>var text="Responsibilities: Design production systems with required skills and qualifications for global customers and deployment pipelines";</script>'],
 ['closed role','<p>This role is closed. Responsibilities: Design production systems with required skills and qualifications for global customers and deployment pipelines.</p>'],
 ['filled position','<p>This position has been filled. Responsibilities: Design production systems with required skills and qualifications for global customers and deployment pipelines.</p>'],
 ['unavailable description','<p>The full job description is currently unavailable. Please check back later for details about the qualifications and responsibilities of this position.</p>'],
 ['instruction-only','<p>Please click Apply now to view the full responsibilities, required skills and qualifications and submit your application to view more information about this position.</p>'],
 ['company-only','<p>About The Walt Disney Company: Disney is a global entertainment company that produces films, television, streaming and immersive experiences for families throughout the world.</p>'],
])test(name+' retains the enumerated row with missing-detail health',async()=>{const jobs=await replay(p=>replaceDescription(p[5],html));assert.equal(jobs.length,32);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceDescription,null);const a=analyzePublishableJobs(jobs,{now}),closed=['closed role','filled position'].includes(name);assert.equal(a.eligibleJobs.length,closed?8:9);assert.equal(a.filterCounts.closed,closed?1:0);assert.equal(a.filterCounts.emptyDescription,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('genuine full JD followed by apply instructions stays full',async()=>{const jobs=await replay(p=>{p[5].body=p[5].body.replace('Education:','Please click Apply now to submit your application. Education:')});assert.equal(jobs[0].sourceDetailComplete,true)})

test('native Disney role-header closure retains the unchanged raw JD and explicit availability proof',async()=>{
 const jobs=await replay(p=>{const start=p[5].body.indexOf('id="job-details-1"');assert.ok(start>=0);const end=p[5].body.indexOf('>',start);p[5].body=p[5].body.slice(0,end+1)+'<p>This position is closed.</p>'+p[5].body.slice(end+1)})
 const job=jobs[0],metrics=analyzePublishableJobs(jobs,{now})
 assert.equal(job.sourceDescription,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceAvailabilityEvidence.state,'closed')
 assert.equal(job.sourceAvailabilityEvidence.notice,'This position is closed.');assert.ok(job.nativeRejectedDescription.length>100)
 assert.equal(job.closingDate,undefined);assert.equal(metrics.filterCounts.closed,1);assert.equal(metrics.eligibleJobs.length,8)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const notice of['<p hidden>This position is closed.</p>','<p inert>This position is closed.</p>',
 '<p>If this position is closed, please browse other vacancies.</p>'])test('inactive or conditional Disney header does not create closure: '+notice,async()=>{
 const replayStatus=()=>replay(p=>{const start=p[5].body.indexOf('id="job-details-1"');assert.ok(start>=0);const end=p[5].body.indexOf('>',start);p[5].body=p[5].body.slice(0,end+1)+notice+p[5].body.slice(end+1)+'<footer>This position is closed.</footer>'})
 // Bare inert leaves text visually present; neither availability state is qualified.
 if(notice==='<p inert>This position is closed.</p>'){await assert.rejects(replayStatus,error=>error.code==='NATIVE_STATUS_LAYOUT_UNQUALIFIED');return}
 const jobs=await replayStatus()
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceAvailabilityEvidence.state,'open')
 assert.equal(analyzePublishableJobs(jobs,{now}).eligibleJobs.length,9)
})
for(const value of['2/30/2026','13/1/2026','10/21/2099'])test('invalid/future original date '+value,()=>assert.throws(()=>originalDate(value,now)))
test('unknown original date never borrows migration date',()=>assert.throws(()=>originalDate(null,now)))
for(const options of[{maxJobs:0},{maxJobs:1},{maxPages:1},{timeoutMs:0}])test('cap/deadline '+JSON.stringify(options),async()=>assert.rejects(replay(()=>{},options)))
test('caller cancellation on final response rejects even an uncooperative fetch',async()=>{let index=0;const c=new AbortController();await assert.rejects(run({now,signal:c.signal,fetch:async url=>{const p=original.records[index++];return{status:p.status,url,text:async()=>{if(index===41)c.abort(Error('caller aborted'));return p.body}}}}),/aborted/)})
test('uncooperative transport remains bounded',async()=>assert.rejects(run({now,timeoutMs:10,fetch:()=>new Promise(()=>{})}),/timeout/))
test('catalog decoration and storage normalization preserve exact canonical source and native apply identities',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='disney');let i=0
 const jobs=await createCatalogScraper(provider).run({now,fetch:async url=>{const p=original.records[i++];assert.equal(url,p.url);return{url,status:200,text:async()=>p.body}}})
 assert.equal(i,41);assert.equal(jobs.length,32)
 for(const job of jobs){const normalized=normalizeScrapedJob(job,provider);assert.equal(normalized.source,'disney');assert.equal(normalized.sourceUrl,job.sourceUrl);assert.equal(normalized.applyUrl,job.applyUrl);assert.equal(job.companyDomain,'thewaltdisneycompany.com');assert.equal(job.companyCareerPage,'https://join.disneycareers.com/global/en/home')}
 assert.equal(analyzePublishableJobs(jobs,{now}).eligibleJobs.length,9)
})
for(const[name,html]of[
 ['conditional full-description access','<p>To view the job description, click Apply now.</p><p>Responsibilities and required skills are available only after completing the application process on our careers site and cannot be displayed on this page.</p>'],
 ['conditional details after submission','<p>Click Apply Now.</p><p>The responsibilities, qualifications and required experience for this position will be provided after you submit a completed application through our recruitment system.</p>'],
])test(name+' retains rejected native evidence without qualifying a JD',async()=>{const j=(await replay(p=>replaceDescription(p[5],html)))[0];assert.equal(j.sourceDetailComplete,false);assert.equal(j.sourceDescription,null);assert.match(j.nativeRejectedDescription,/responsibilities/i);assert.equal(j.nativeRejectedDescriptionRawHTML,'<div class="ats-description">'+html+'</div>');assert.equal(j.sourceDetailFailureReason,'native-description-instruction-or-unavailable-only')})
for(const notice of['This role has expired.','This position is not available.'])test(notice+' cannot qualify a closed role',async()=>{const jobs=await replay(p=>{p[5].body=p[5].body.replace('Job Summary:','Job Summary: '+notice+' ')}),j=jobs[0];assert.equal(j.sourceDetailComplete,false);assert.equal(j.sourceDescription,null);assert.ok(j.nativeRejectedDescription.includes(notice));assert.equal(j.sourceDetailFailureReason,'native-role-explicitly-closed');assert.equal(j.sourceAvailabilityEvidence?.state,'closed');assert.equal(analyzePublishableJobs(jobs,{now}).filterCounts.closed,1)})
test('aria-disabled native application links reject instead of source-URL fallback',async()=>assert.rejects(replay(p=>{p[5].body=p[5].body.replaceAll('class="button job-apply','aria-disabled="true" class="button job-apply')})))
test('rejected company-only native content is retained outside publishable fallback fields',async()=>{const html='<p>About The Walt Disney Company: Disney is a global entertainment company that produces films, television, streaming and immersive experiences for families throughout the world.</p>',j=(await replay(p=>replaceDescription(p[5],html)))[0];assert.equal(j.sourceDescription,null);assert.equal(j.jobDescription,null);assert.match(j.nativeRejectedDescription,/About The Walt Disney Company/);assert.equal(j.nativeRejectedDescriptionRawHTML,'<div class="ats-description">'+html+'</div>');assert.equal(j.sourceDetailFailureReason,'native-description-no-role-content')})
for(const notice of['This role has expired','This position is not available'])test(notice+' in a complete unpunctuated paragraph cannot qualify the original JD',async()=>{
 const jobs=await replay(p=>{p[5].body=p[5].body.replace('<div class="ats-description">','<div class="ats-description"><p>'+notice+'</p>')})
 const j=jobs[0];assert.equal(jobs.length,32);assert.equal(j.sourceDescription,null);assert.equal(j.jobDescription,null);assert.equal(j.sourceDetailComplete,false)
 assert.equal(j.sourceDetailFailureReason,'native-role-explicitly-closed');assert.ok(j.nativeRejectedDescription.startsWith(notice));assert.ok(j.nativeRejectedDescriptionRawHTML.startsWith('<div class="ats-description"><p>'+notice+'</p>'))
 assert.equal(analyzePublishableJobs(jobs,{now}).eligibleJobs.length,8)
})
for(const[name,html]of[
 ['until-application access','<p>The responsibilities, qualifications and required experience for this position cannot be provided until you complete an application through our recruitment system. Further information about the job description is withheld until an application has been received.</p>'],
 ['once-you-apply access','<p>The responsibilities, qualifications and required experience for this position will be available once you apply through our recruitment system. The full job description and position details can be accessed only by registered applicants through their candidate portal.</p>'],
])test(name+' alone retains the row and rejected evidence without qualifying a JD',async()=>{
 const jobs=await replay(p=>replaceDescription(p[5],html)),j=jobs[0]
 assert.equal(jobs.length,32);assert.equal(j.sourceDescription,null);assert.equal(j.jobDescription,null);assert.equal(j.sourceDetailComplete,false)
 assert.equal(j.sourceDetailFailureReason,'native-description-instruction-or-unavailable-only');assert.match(j.nativeRejectedDescription,/responsibilities/i);assert.equal(j.nativeRejectedDescriptionRawHTML,'<div class="ats-description">'+html+'</div>')
 assert.equal(analyzePublishableJobs(jobs,{now}).eligibleJobs.length,9)
})
function appendNativeParagraph(packet,html){
 const start=packet.body.indexOf('<div class="ats-description">'),scan=/<\/?div\b[^>]*>/gi;assert.ok(start>=0);scan.lastIndex=start
 let depth=0,end=-1,m;while((m=scan.exec(packet.body))){depth+=m[0].startsWith('</')?-1:1;if(depth===0){end=m.index;break}}
 assert.ok(end>start);packet.body=packet.body.slice(0,end)+html+packet.body.slice(end)
}
for(const footer of[
 '<p>The responsibilities and qualifications will be available once you apply through our recruitment system.</p>',
 '<p>The job description cannot be provided until you complete an application through our recruitment system.</p>',
 '<p>If this role has expired, please search our other vacancies and apply through our careers site.</p>',
])test('genuine full JD remains qualified with separate paragraph footer '+footer,async()=>{
 const jobs=await replay(p=>appendNativeParagraph(p[5],footer)),j=jobs[0]
 assert.equal(jobs.length,32);assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceDetailFailureReason,null)
 assert.equal(typeof j.sourceDescription,'string');assert.equal(j.sourceDescription,j.jobDescription);assert.ok(j.sourceDescription.includes(footer.slice(3,-4)))
 assert.equal(j.nativeRejectedDescriptionRawHTML,undefined);assert.equal(analyzePublishableJobs(jobs,{now}).eligibleJobs.length,9)
})
