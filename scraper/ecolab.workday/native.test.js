import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
const original=JSON.parse(readFileSync(new URL('./fixtures/native-india-001.json',import.meta.url)))
const base='https://jobs.ecolab.com',json=x=>JSON.stringify(x).replaceAll('<','\\u003c'),fresh=()=>structuredClone(original)
const bootstrap=(total=1,india=total,change=x=>x)=>'<script>var phApp=phApp||'+json(change({...original.app,pageName:'search-results'}))+';phApp.ddo='+json({eagerLoadRefineSearch:{status:200,totalHits:total,hits:0,data:{jobs:[],aggregations:[{field:'country',value:{India:india}}]}},siteConfig:{data:{siteSettings:{refineSearch:{enabledFacets:['country','city','state']}}}}})+';</script>'
const detail=(f,wrap=s=>s)=>'<link rel="canonical" href="'+f.canonical+'"><script>'+wrap('phApp.ddo='+json({jobDetail:{status:200,data:{job:f.job}}})+';')+'</script><script type="application/ld+json">'+json(f.posting)+'</script>'
const response=(rows,total=rows.length,india=rows.filter(r=>r.country==='India').length)=>({refineSearch:{status:200,totalHits:total,hits:rows.length,data:{jobs:rows,aggregations:[{field:'country',value:{India:india}}]}}})
const options=({fixture=fresh(),rows=[fixture.listing],total=rows.length,india=rows.filter(r=>r.country==='India').length,inventory,html,wrap,appChange,...rest}={})=>({
 fetchText:async url=>url.includes('/search-results')?html??bootstrap(total,india,appChange):detail(fixture,wrap),
 fetchJson:async(url,r)=>{assert.equal(url,base+'/widgets');assert.equal(r.method,'POST');const b=JSON.parse(r.body);assert.deepEqual(b.selected_fields,{});assert.deepEqual(b.all_fields,['country']);assert.equal(b.size,500);assert.equal(b.ddoKey,'refineSearch');return inventory?inventory(b):response(rows,total,india)},...rest,
})
const blocked=async change=>{
 const fixture=fresh();change(fixture)
 const jobs=await run(options({fixture}));assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription,null)
 assert.equal(jobs[0].sourceListingComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 // Keep the trusted listing for detail recovery. New rows without a prior
 // source description stay private; incomplete rescrapes preserve prior content.
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T21:00:00Z')}).eligibleJobs.length,1)
 assert.equal(hasSourceDescription(jobs[0]),false)
 return jobs
}
test('real native India detail retains complete authoritative JD, exact dates, offices and employer assertions',async()=>{
 const jobs=await run(options()),j=jobs[0]
 assert.equal(jobs.length,1);assert.equal(j.sourceDetailComplete,true)
 assert.equal(j.jobDescription,original.job.description);assert.match(j.jobDescription,/Qualifications and certifications/)
 assert.match(j.jobDescription,/DP-600/);assert.match(j.jobDescription,/Our Commitment/)
 assert.equal(j.sourceNativeJobPosting.description,original.posting.description)
 assert.equal(j.sourceNativeMLDescription,original.job.ml_Description)
 assert.equal(j.sourceDescriptionEvidence.authoritativeField,'JobPosting.description')
 assert.equal(j.country,'India');assert.equal(j.location,'Bangalore, Karnātaka, India')
 assert.deepEqual(j.sourceNativeLocations,original.job.multi_location)
 assert.equal(j.postingDate,'2026-09-24T00:00:00.000+0000')
 assert.equal(j.sourceNativePublicationEvidence.jsonLdDatePosted,'2026-10-01')
 assert.equal(j.sourceNativePublicationEvidence.originalPublicationVerified,false)
 assert.equal(j.sourceEmployerEvidence.jobCompany,'(IND) Ecolab Global Services Private Limited')
 assert.equal(j.sourceEmployerEvidence.legalEmployerVerified,false)
 assert.equal(j.applyUrl,original.job.applyUrl);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('all-country pagination counts unique foreign identities and reconciles the India subset',async()=>{
 const f=fresh(),foreign={...f.listing,jobId:'R00000001',reqId:'R00000001',jobSeqNo:'EIYEIEUSR00000001EXTERNALENGLOBAL',country:'Korea, Republic of',city:'Seoul',state:'',cityStateCountry:'Seoul, Korea, Republic of',location:'Seoul, Korea, Republic of',multi_location:[],multi_location_array:[],applyUrl:f.listing.applyUrl.replaceAll('R00305812','R00000001')},offsets=[]
 const jobs=await run(options({fixture:f,total:2,india:1,inventory:b=>{offsets.push(b.from);return response(b.from===0?[foreign]:[f.listing],2,1)}}))
 assert.deepEqual(offsets,[0,1]);assert.equal(jobs.length,1);assert.equal(readInventoryEvidence(jobs).reportedTotal,2);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('verified empty native global inventory has explicit evidence',async()=>{
 const jobs=await run(options({rows:[]}));assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'verified-empty');assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('native Saint Lucia country alias stays foreign while completing the all-country inventory',async()=>{
 const f=fresh(),foreign={...f.listing,jobId:'R00305006',reqId:'R00305006',jobSeqNo:'EIYEIEUSR00305006EXTERNALENGLOBAL',country:'Saint Lucia',city:'Castries',state:'',cityStateCountry:'Castries, Saint Lucia',location:'Castries, Saint Lucia',multi_location:[],multi_location_array:[],applyUrl:'https://ecolab.wd1.myworkdayjobs.com/Ecolab_External/job/LCA---Saint-Lucia---Point-Seraphine-Castries/Technical-Service-Representative_R00305006/apply'}
 const jobs=await run(options({fixture:f,rows:[f.listing,foreign]}));assert.equal(jobs.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('optional parentRefNum absence does not override exact native tenant, sequence and application identity',async()=>{
 const f=fresh();delete f.job.parentRefNum;const jobs=await run(options({fixture:f}));assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].jobDescription,original.job.description)
})
test('capped pagination keeps verified jobs but prevents cleanup',async()=>{
 const jobs=await run(options({total:2,india:2,maxPages:1}));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].sourceListingComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('detail failure preserves the listing as incomplete and never uses the teaser',async()=>{
 const o=options(),get=o.fetchText;o.fetchText=u=>u.includes('/search-results')?get(u):Promise.reject(Error('upstream offline'))
 const jobs=await run(o);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const state of ['CLOSED','FILLED'])test('native '+state+' is distinct from HTTP failure and never invents a closing date',async()=>{
 const f=fresh();f.job.postingStatus=state;const jobs=await run(options({fixture:f})),j=jobs[0]
 assert.equal(j.sourceDetailFailureKind,'native-closed');assert.equal(j.sourceNativeLifecycleEvidence.postingStatus,state)
 assert.equal(j.closingDate,null);assert.equal(j.sourceNativeClosingEvidence.reconciliation,'unknown');assert.equal(j.sourceDetailComplete,false)
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T21:00:00Z')}).filterCounts.closed,0)
})
for(const invalid of [false,true])test((invalid?'malformed':'missing')+' authoritative JobPosting stays distinct from a transport failure',async()=>{
 const o=options(),fetch=o.fetchText;o.fetchText=async u=>{const html=await fetch(u);return u.includes('/search-results')?html:html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,invalid?'<script type="application/ld+json">{"@type":"JobPosting", invalid}</script>':'')}
 const jobs=await run(o),j=jobs[0];assert.equal(j.sourceDetailFailureKind,'missing-authoritative-jobposting');assert.equal(j.sourceDetailComplete,false);assert.equal(j.sourceNativeDetail.jobId,original.job.jobId);assert.equal(j.sourceNativeJobPosting,null);assert.equal(j.jobDescription,null)
})
for(const [name,alter]of [
 ['failed status',r=>{r.refineSearch.status=500}],['missing jobs',r=>{delete r.refineSearch.data.jobs}],
 ['wrong hits',r=>{r.refineSearch.hits=10}],['hidden filter',r=>{r.refineSearch.data.ui_selections={country:['India']}}],
 ['foreign application',r=>{r.refineSearch.data.jobs[0].applyUrl=r.refineSearch.data.jobs[0].applyUrl.replace('ecolab.wd1','unrelated.wd1')}],
 ['different native sequence',r=>{r.refineSearch.data.jobs[0].jobSeqNo='OTHER'+r.refineSearch.data.jobs[0].jobId}],
 ['internal visibility',r=>{r.refineSearch.data.jobs[0].jobVisibility=['internal']}],
 ['missing country',r=>{delete r.refineSearch.data.jobs[0].country}],
])test('invalid native inventory '+name+' fails closed',async()=>{await assert.rejects(run(options({inventory:()=>{const r=response([fresh().listing]);alter(r);return r}})),/ECOLAB|PHENOM/)})
test('duplicate page before completion never becomes zero or complete',async()=>{await assert.rejects(run(options({total:2,india:2})),/ECOLAB|PHENOM/)})
test('dead bootstrap cannot establish a verified empty inventory',async()=>{await assert.rejects(run(options({rows:[],html:'<script>if(false){'+bootstrap(0,0).replace(/<\/?script>/g,'')+'}</script>'})),/ECOLAB|PHENOM/)})
test('unadvertised widget endpoint cannot authorize a request',async()=>{await assert.rejects(run(options({appChange:a=>({...a,widgetApiEndpoint:'https://other.example/widgets'})})),/ECOLAB|PHENOM/)})
for(const [name,wrap]of [['if false',s=>'if(false){'+s+'}'],['function',s=>'function unused(){'+s+'}'],['arrow',s=>'const unused=()=>{'+s+'};'],['loop',s=>'while(false){'+s+'}'],['template',s=>'</script><template><script>'+s+'</script></template><script>']])test('inactive '+name+' detail does not authenticate native identity',async()=>{
 const jobs=await run(options({wrap}));assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const [name,change]of [
 ['wrong job ID',f=>{f.job.jobId='R99999999'}],['wrong canonical',f=>{f.canonical=f.canonical.replace('R00305812','R99999999')}],
 ['other company',f=>{f.job.companyName='Other Company'}],['wrong refNum',f=>{f.job.refNum='OTHER'}],['conflicting supplied parentRefNum',f=>{f.job.parentRefNum='OTHER'}],
 ['other organization',f=>{f.posting.hiringOrganization.name='Other Company'}],['wrong application',f=>{f.job.applyUrl+='?redirect=other'}],
 ['country conflict',f=>{f.job.standardisedCountry='United States'}],['office country conflict',f=>{f.job.multi_location[0].country='United States'}],
 ['office city conflict',f=>{f.job.multi_location[0].city='Pune'}],['office postal conflict',f=>{f.posting.jobLocation.address.postalCode='00000'}],
 ['closed native role',f=>{f.job.postingStatus='CLOSED'}],['skipJob native role',f=>{f.job.skipJob=true}],
 ['missing authoritative body',f=>{delete f.posting.description}],['hidden body',f=>{f.posting.description='<div hidden>Complete engineering responsibilities and qualifications.</div>'}],
 ['teaser body',f=>{f.posting.description='Apply now'}],['malformed native publication',f=>{f.job.postedDate='2026-08-12Tbroken'}],
 ['impossible native publication',f=>{f.listing.postedDate='2026-02-30'}],['closing conflict',f=>{f.job.expiryDate='2026-10-22';f.posting.validThrough='2026-10-23'}],
])test('detail '+name+' stays incomplete and protects prior records',async()=>{await blocked(change)})
test('full JSON-LD replaces shortened ML and preserves encoded raw evidence',async()=>{
 const f=fresh();f.job.ml_Description='<p>Short ML projection.</p>'
 const jobs=await run(options({fixture:f}));assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].jobDescription,original.job.description)
})
test('earliest native publication survives newer JSON-LD and prevents age renewal',async()=>{
 const f=fresh();f.listing.postedDate='2026-08-12';f.job.postedDate=f.posting.datePosted='2026-10-20'
 const jobs=await run(options({fixture:f}));assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].postingDate,'2026-08-12');assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T21:00:00Z')}).eligibleJobs.length,0)
})
test('creation and update timestamps never replace missing native publication',async()=>{
 const f=fresh();delete f.listing.postedDate;delete f.job.postedDate;delete f.posting.datePosted
 const jobs=await run(options({fixture:f}));assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].sourceDetailComplete,true)
})
test('native closing timestamp retains exact precision and excludes at its instant',async()=>{
 const f=fresh();f.posting.validThrough='2026-10-21T12:00:00Z';const jobs=await run(options({fixture:f}));assert.equal(jobs[0].closingDate,'2026-10-21T12:00:00Z');assert.equal(jobs[0].sourceClosingDateIsExact,true);assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T21:00:00Z')}).eligibleJobs.length,0)
})
test('native date-only closing preserves the whole UTC day',async()=>{
 const f=fresh();f.posting.validThrough='2026-10-21';const jobs=await run(options({fixture:f}));assert.equal(jobs[0].sourceClosingDatePrecision,'utc-day');assert.equal(jobs[0].sourceClosingDateIsExact,false);assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T21:00:00Z')}).eligibleJobs.length,1)
})
