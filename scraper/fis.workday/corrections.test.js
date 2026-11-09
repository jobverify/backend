import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {run} from './script.js'
import {readNativePage} from './native.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
const original=JSON.parse(readFileSync(new URL('./fixtures/native-india-001.json',import.meta.url)))
const base='https://careers.fisglobal.com',json=x=>JSON.stringify(x).replaceAll('<','\\u003c')
const fullRaw='&lt;h2&gt;Responsibilities&lt;/h2&gt;&lt;p&gt;Design services and obtain client sign-off for requirements.&lt;/p&gt;&lt;h2&gt;Qualifications&lt;/h2&gt;&lt;p&gt;Five years of C&#43;&#43; development experience is required.&lt;/p&gt;&lt;h2&gt;Benefits&lt;/h2&gt;&lt;p&gt;Competitive salary &amp; professional development.&lt;/p&gt;'
const fullDecoded='<h2>Responsibilities</h2><p>Design services and obtain client sign-off for requirements.</p><h2>Qualifications</h2><p>Five years of C++ development experience is required.</p><h2>Benefits</h2><p>Competitive salary & professional development.</p>'
const fixture=()=>{const f=structuredClone(original);f.posting.description=fullRaw;f.job.ml_Description='<p>Shortened ML summary.</p>';f.job.postedDate=f.posting.datePosted='2026-10-20';return f}
const listing=f=>({jobId:f.job.jobId,reqId:f.job.reqId,jobSeqNo:f.job.jobSeqNo,title:f.job.title,applyUrl:f.job.applyUrl,
 country:'India',city:f.job.city,state:f.job.state,cityStateCountry:f.job.cityStateCountry,siteType:'external',visibilityType:'External',jobVisibility:['external','internal'],postedDate:'2026-10-20'})
const app={widgetApiEndpoint:base+'/widgets',country:'us',deviceType:'desktop',locale:'en_us',refNum:'FIGLUS',pageName:'search-results'}
const bootstrap='<script>var phApp = phApp || '+json(app)+'; phApp.ddo = '+json({eagerLoadRefineSearch:{totalHits:1,hits:0,data:{jobs:[],aggregations:[{field:'country',value:{India:1}}]}},siteConfig:{data:{siteSettings:{refineSearch:{enabledFacets:['country','companyValue']}}}}})+';</script>'
const detail=(f,wrap=x=>x)=>'<link rel="canonical" href="'+f.canonical+'"><script>'+wrap('phApp.ddo = '+json({jobDetail:{status:200,data:{job:f.job}}})+';')+'</script><script type="application/ld+json">'+json(f.posting)+'</script>'
const execute=async(change=()=>{},wrap)=>{
 const f=fixture(),r=listing(f);change(f,r)
 return run({fetchText:async u=>u.includes('/search-results')?bootstrap:detail(f,wrap),fetchJson:async()=>({refineSearch:{status:200,totalHits:1,hits:1,data:{jobs:[r],ui_selections:{companyValue:['FIS']},aggregations:[{field:'country',value:{India:1}},{field:'companyValue',value:{FIS:1}}]}}})})
}
const blocked=async(change,wrap)=>{
 let jobs
 try{jobs=await execute(change,wrap)}catch(error){assert.match(error.message,/FIS|PHENOM/);return}
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(jobs[0].jobDescription,null)
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 // Keep the trusted listing for detail recovery. New rows without a prior
 // source description stay private; incomplete rescrapes preserve prior content.
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T20:00:00Z')}).eligibleJobs.length,1)
 assert.equal(hasSourceDescription(jobs[0]),false)
 return jobs
}

test('R1 complete authoritative JobPosting replaces the shortened ML projection and preserves exact raw evidence',async()=>{
 const jobs=await execute(),j=jobs[0]
 assert.equal(j.sourceDetailComplete,true)
 assert.equal(j.jobDescription,fullDecoded)
 assert.equal(j.sourceNativeJobPosting.description,fullRaw)
 assert.equal(j.sourceNativeMLDescription,'<p>Shortened ML summary.</p>')
 assert.equal(j.sourceDescriptionEvidence.authoritativeField,'JobPosting.description')
})

for(const [name,wrap] of [
 ['if false',s=>'if (false) { '+s+' }'],['while false',s=>'while (false) { '+s+' }'],
 ['uncalled function',s=>'function unused() { '+s+' }'],['uncalled arrow',s=>'const unused=()=>{ '+s+' };'],
 ['conditional expression',s=>'false && (function(){ '+s+' })();'],['class method',s=>'class Native { method(){ '+s+' } }'],
 ['if false without block',s=>'if(false) '+s],['for loop',s=>'for(;false;){ '+s+' }'],
])test('R2 nested '+name+' DDO cannot authenticate active native detail',async()=>{await blocked(()=>{},wrap)})
test('R2 dead app/bootstrap models cannot establish a verified empty inventory',async()=>{
 const dead='<script>if(false){ var phApp=phApp||'+json(app)+';phApp.ddo='+json({eagerLoadRefineSearch:{totalHits:0,hits:0,data:{jobs:[]}}})+'; }</script>'
 await assert.rejects(run({fetchText:async()=>dead,fetchJson:async()=>{throw Error('must not reach inventory')}}),/FIS|PHENOM/)
})
test('R2 top-level native app and DDO literals with comments still authenticate',()=>{
 const n=readNativePage('<script>/* native */ var phApp=phApp||'+json(app)+'; /* payload */ phApp.ddo={"accepted":true}; phApp.inlinePreview=false; phApp.pxPageState=\'stranger\';</script>')
 assert.equal(n.app.refNum,'FIGLUS');assert.deepEqual(n.ddo,{accepted:true})
})
test('R2 incidental non-model viewsFromPage initialization cannot supply or hide supported top-level models',()=>{
 const n=readNativePage('<script>if(phApp) {phApp.viewsFromPage=true} else {var phApp={"viewsFromPage":true}}</script>'
  +'<script>var phApp=phApp||'+json(app)+';phApp.ddo={"accepted":true};</script>')
 assert.equal(n.app.refNum,'FIGLUS');assert.deepEqual(n.ddo,{accepted:true})
})

for(const content of ['<p>Apply now</p>','&lt;p&gt;Apply now&lt;/p&gt;','<template>Invisible placeholder</template>',
 '<div hidden>Design services and obtain client sign-off for requirements.</div>',
 '<div style="display:none">Hidden full role responsibilities and qualifications.</div>',
 '<div aria-hidden="true">Hidden responsibilities and benefits.</div>','<script>fake role text</script>',
 '<textarea>Fake full role responsibilities</textarea>','<!-- full role text -->','<p>&nbsp;</p>','']){
 test('R3 inert or boilerplate authoritative JD fails full detail: '+content.slice(0,50),async()=>{await blocked(f=>{f.posting.description=content})})
}
test('R3 absent authoritative JD cannot fall back to ML summary',async()=>{await blocked(f=>{delete f.posting.description})})

test('R4 exact expired native validThrough is retained and excluded at its actual instant',async()=>{
 const jobs=await execute(f=>{f.posting.validThrough='2026-10-21T12:00:00Z'})
 assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].closingDate,'2026-10-21T12:00:00Z')
 assert.equal(jobs[0].sourceClosingDateIsExact,true)
 assert.equal(jobs[0].sourceClosingDatePrecision,'timestamp')
 const a=analyzePublishableJobs(jobs,{now:new Date('2026-10-21T20:00:00Z')})
 assert.equal(a.eligibleJobs.length,0);assert.equal(a.filterCounts.closed,1)
})
test('R4 date-only deadline preserves UTC-day precision through the same day',async()=>{
 const jobs=await execute(f=>{f.posting.validThrough='2026-10-21'})
 assert.equal(jobs[0].closingDate,'2026-10-21');assert.equal(jobs[0].sourceClosingDateIsExact,false)
 assert.equal(jobs[0].sourceClosingDatePrecision,'utc-day')
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T20:00:00Z')}).eligibleJobs.length,1)
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-22T00:00:00Z')}).eligibleJobs.length,0)
})
test('R4 native detail expiryDate remains an explicit closing timestamp',async()=>{
 const jobs=await execute(f=>{f.job.expiryDate='2026-09-01T00:00:00Z'})
 assert.equal(jobs[0].closingDate,'2026-09-01T00:00:00Z')
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T20:00:00Z')}).eligibleJobs.length,0)
})
for(const [name,change] of [
 ['malformed',f=>{f.posting.validThrough='2026-09-01Tbroken'}],
 ['impossible date',f=>{f.posting.validThrough='2026-02-30'}],
 ['conflicting',f=>{f.posting.validThrough='2026-10-21';f.job.expiryDate='2026-10-22'}],
])test('R4 '+name+' explicit closing evidence fails closed',async()=>{await blocked(change)})

for(const [field,value] of [['detail','2026-08-06Tmalformed'],['listing','2026-02-30'],['posting','not a native date'],
 ['detail','2026-08-06T25:00:00Z'],['posting',{unsupported:'date'}],['detail','2026-08-06T00:00:00']]){
 test('R5 any provided malformed '+field+' publication cannot disappear behind a recent field '+String(value),async()=>{
  const jobs=await blocked((f,r)=>{if(field==='listing')r.postedDate=value;else if(field==='detail')f.job.postedDate=value;else f.posting.datePosted=value})
  if(jobs){assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].sourceNativePublicationEvidence.reconciliation,'invalid')}
 })
}
test('R5 all absent publications remain unknown without created/updated date invention',async()=>{
 const jobs=await execute((f,r)=>{delete r.postedDate;delete f.job.postedDate;delete f.posting.datePosted;f.job.dateCreated='2026-10-20';f.job.jobUpdatedDate='2026-10-21'})
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].postingDate,null)
})
test('R5 future native publication remains raw evidence without a source policy rewrite',async()=>{
 const jobs=await execute((f,r)=>{r.postedDate=f.job.postedDate=f.posting.datePosted='2099-01-01'})
 assert.equal(jobs[0].postingDate,'2099-01-01');assert.equal(jobs[0].sourceDetailComplete,true)
})

for(const [where,value] of [['listing','not-external'],['detail','not-external'],['detail',['not-external']],['listing',['external',null]],['detail',{external:true}]]){
 test('R6 '+where+' requires typed exact external array membership '+JSON.stringify(value),async()=>{await blocked((f,r)=>{(where==='listing'?r:f.job).jobVisibility=value})})
}

test('R7 explicit foreign listing primary cannot be replaced by an India detail primary',async()=>{
 await blocked((_f,r)=>{r.country='Philippines';r.multi_location=['Bengaluru, Karnātaka, India']})
})
test('R7 coherent foreign primary and typed India secondary retain explicit India scope',async()=>{
 const jobs=await execute((f,r)=>{
  const foreign={city:'Manila',state:'Metro Manila',country:'Philippines',postalCode:'1231',cityStateCountry:'Manila, Metro Manila, Philippines',cityState:'Manila, Metro Manila',cityCountry:'Manila, Philippines',stateCountry:'Metro Manila, Philippines',address:'Native Office, Manila, Metro Manila, Philippines',location:'Native Office, Manila, Metro Manila, Philippines'}
  r.country='Philippines';r.city='Manila';r.state='Metro Manila';r.cityStateCountry=foreign.cityStateCountry
  r.multi_location=[foreign.location,'Bengaluru, Karnātaka, India']
  f.job.country=f.job.standardisedCountry=f.job.ml_country='Philippines';f.job.city='Manila';f.job.state='Metro Manila';f.job.postalCode='1231';f.job.cityStateCountry=foreign.cityStateCountry
  f.job.multi_location=[foreign,...f.job.multi_location];f.posting.jobLocation=[{address:{addressLocality:'Manila',addressRegion:'Metro Manila',addressCountry:'Philippines',postalCode:'1231'}},...f.posting.jobLocation]
 })
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,'Bengaluru')
 assert.equal(jobs[0].sourceNativeListing.country,'Philippines');assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('R7 contradictory explicit JobPosting streetAddress cannot hide behind matching typed office fields',async()=>{
 await blocked(f=>{f.posting.jobLocation[0].address.streetAddress='Foreign office, Manila, Philippines'})
})

for(const [name,change] of [
 ['canonical unrelated path',f=>{f.canonical=base+'/not-a-job/JR0305635/job/JR0305635/placeholder'}],
 ['canonical credentials',f=>{f.canonical=f.canonical.replace('https://','https://user:password@')}],
 ['canonical query',f=>{f.canonical+='?jobId=JR9999999'}],['canonical fragment',f=>{f.canonical+='#other-role'}],
 ['canonical extra segment',f=>{f.canonical+='/other'}],['canonical nonstandard port',f=>{f.canonical=f.canonical.replace('careers.fisglobal.com','careers.fisglobal.com:444')}],
 ['application nonstandard port',(f,r)=>{r.applyUrl=f.job.applyUrl=f.job.applyUrl.replace('myworkdayjobs.com','myworkdayjobs.com:444')}],
 ['application extra route',(f,r)=>{r.applyUrl=f.job.applyUrl=f.job.applyUrl.replace('/SearchJobs/job/','/SearchJobs/job/extra/')}],
 ['application query',(f,r)=>{r.applyUrl=f.job.applyUrl=f.job.applyUrl+'?jobId=JR9999999'}],
])test('R8 '+name+' cannot authenticate native role identity',async()=>{await blocked(change)})
test('R8 supported default HTTPS ports and native requisition suffix remain valid',async()=>{
 const jobs=await execute((f,r)=>{f.canonical=f.canonical.replace('careers.fisglobal.com','careers.fisglobal.com:443');r.applyUrl=f.job.applyUrl=f.job.applyUrl.replace('myworkdayjobs.com','myworkdayjobs.com:443').replace('_JR0305635/apply','_JR0305635-1/apply')})
 assert.equal(jobs[0].sourceDetailComplete,true)
})
