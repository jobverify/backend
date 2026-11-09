import assert from 'node:assert/strict'
import test from 'node:test'
import {createAlliedDigitalServicesScraper,createWordPressJobsPageFetch} from '../../scraper/allieddigitalservices/script.js'
import {revisitFixture} from '../../scraper/castrolindia/revisitFixture.js'
import {structure} from '../../scraper/alohatechnology/publicRead.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const BASE='https://www.allieddigital.net',API=BASE+'/wp-json/wp/v2/awsm_job_openings',meta=new URL('../../scraper/allieddigitalservices/currentNative20261103.test.js',import.meta.url),f=revisitFixture(meta),rootHtml=f.text(BASE+'/'),careersHtml=f.text(BASE+'/careers/'),listingHtml=f.text(BASE+'/job-openings/'),records=JSON.parse(f.text(API+'?per_page=100&page=1')),firstPage={records,total:3,totalPages:1},details=new Map(records.map(r=>[r.link,f.text(r.link)])),serviceHtml=details.get(records[0].link),endpointHtml=details.get(records[1].link),networkHtml=details.get(records[2].link)
globalThis.fetch=async()=>{throw Error('Allied legacy/current tests prohibit network')}
const runFixture=(o={})=>createAlliedDigitalServicesScraper().run({now:'2026-11-03T04:45:00.000Z',onAudit:o.onAudit,fetchPage:async url=>{
 let body,headers=new Headers()
 if(url.startsWith(API+'?')){const page=o.fetchJobsPage?await o.fetchJobsPage(url):o.page??structuredClone(firstPage);body=JSON.stringify(page.records);if(page.total!==null&&page.total!==undefined)headers.set('x-wp-total',String(page.total));if(page.totalPages!==null&&page.totalPages!==undefined)headers.set('x-wp-totalpages',String(page.totalPages))}
 else if(url===BASE+'/')body=o.root??rootHtml
 else if(url===BASE+'/careers/')body=o.careers??careersHtml
 else if(url===BASE+'/job-openings/')body=o.listing??listingHtml
 else body=o.details?.get(url)??details.get(url)
 assert.equal(typeof body,'string','Only declared fixture URL '+url);return{url,status:200,body,headers}
}})
const changeSchema=(html,change)=>{const script=structure(html).scripts.find(s=>s.attrs.type==='application/ld+json'&&s.body.includes('JobPosting'));assert(script);const schema=JSON.parse(script.body);return html.replace(script.body,JSON.stringify(change(schema)))}
test('Allied current adapter keeps the full native criterion candidate and preserves unpublished countries/IDs',async()=>{
 let audit;const jobs=await runFixture({onAudit:r=>{audit=r}})
 assert.deepEqual(jobs.map(j=>[j.jobId,j.title,j.location,j.country]),[['4596','NETWORK ENGINEER L3','Navi Mumbai',null]])
 assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].remoteStatus,null);assert.equal(jobs[0].employmentType,'Full-time');assert.match(jobs[0].jobDescription,/L3 escalation support/)
 assert.equal(audit.publicWordPressRoles.length,3);assert.equal(audit.corporateAnnouncementObservations.length,4);assert.equal(audit.publicWordPressRoles.filter(j=>!j.sourceDetailComplete).length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Allied rejects changed corporate, careers and native board canonical identity',async()=>{
 for(const [key,html]of [['root',rootHtml],['careers',careersHtml],['listing',listingHtml]])await assert.rejects(runFixture({[key]:html.replace('rel="canonical"','rel="alternate"')}),/canonical identity/)
})
test('Allied native pagination rejects missing records, duplicate IDs, missing headers and zero without a native zero model',async()=>{
 for(const page of [{...firstPage,total:4},{...firstPage,records:[records[0],records[0],records[2]]},{...firstPage,totalPages:2},{...firstPage,total:null},{records:[],total:0,totalPages:0}])await assert.rejects(runFixture({page}),/native|REST|inventory/i)
})
test('Allied API IDs and links must bind the actual public opening cards',async()=>{
 await assert.rejects(runFixture({page:{...firstPage,records:records.map(r=>({...r,id:r.id+1}))}}),/inventory disagree/)
})
test('Allied details bind public canonical, alternate post ID and employer rather than private application controls',async()=>{
 for(const broken of [endpointHtml.replace('/awsm_job_openings/4717','/awsm_job_openings/9999'),changeSchema(endpointHtml,p=>({...p,hiringOrganization:{...p.hiringOrganization,name:'Unrelated Company'}})),changeSchema(endpointHtml,p=>({...p,hiringOrganization:{...p.hiringOrganization,sameAs:'https://unrelated.example'}})),endpointHtml.replace('rel="canonical"','rel="alternate"')])await assert.rejects(runFixture({details:new Map([[records[1].link,broken]])}),/identity|employer|canonical|post ID/)
 const jobs=await runFixture({details:new Map([[records[2].link,networkHtml.replace(/<input\b(?=[^>]*\bname=["']awsm_job_id["'])[^>]*>/gi,'')]])});assert.equal(jobs.length,1)
})
test('Allied excludes a full native foreign role while retaining all country evidence',async()=>{
 const foreign=changeSchema(networkHtml,p=>({...p,jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'New York',addressCountry:'US'}}})).replaceAll('Navi Mumbai','New York');let audit
 const jobs=await runFixture({details:new Map([[records[2].link,foreign]]),onAudit:r=>{audit=r}});assert.equal(jobs.length,0);assert.equal(audit.publicWordPressRoles.find(r=>r.jobId==='4596').country,'United States');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Allied unspecified remote country remains unqualified without a manufactured India label',async()=>{
 const remote=changeSchema(networkHtml,p=>({...p,jobLocation:{'@type':'Place',address:'Remote'}})).replaceAll('Navi Mumbai','Remote');let audit
 const jobs=await runFixture({details:new Map([[records[2].link,remote]]),onAudit:r=>{audit=r}});assert.equal(jobs.length,0);assert.equal(audit.publicWordPressRoles.find(r=>r.jobId==='4596').country,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
// Explicit synthetic pagination reduction/extension, never current live proof.
function paginatedInventory(){const all=structuredClone(records),detailMap=new Map(details);for(let index=0;index<98;index++){const id=5000+index,title='Synthetic Support Engineer '+index,link=BASE+'/jobs/synthetic-support-engineer-'+index+'/';all.push({...structuredClone(records[0]),id,title:{rendered:title},link});detailMap.set(link,changeSchema(serviceHtml,p=>({...p,title})).replaceAll('SERVICE DESK EXECUTIVE L3',title).replaceAll(records[0].link,link).replaceAll('/awsm_job_openings/4718','/awsm_job_openings/'+id))}const cards=all.slice(0,10).map(r=>'<div class="awsm-grid-item" id="awsm-grid-item-'+r.id+'"><a href="'+r.link+'"></a></div>').join(''),listing=listingHtml.replace(/<div class="awsm-job-listings[\s\S]*$/,'<div class="awsm-job-listings" data-listings="10">'+cards+'</div>');return{records:all,detailMap,listing}}
test('Allied traverses both counted pages again after all closing native details',async()=>{
 const f=paginatedInventory(),requested=[];let audit
 const jobs=await runFixture({listing:f.listing,details:f.detailMap,onAudit:r=>{audit=r},fetchJobsPage:async url=>{requested.push(url);const page=Number(new URL(url).searchParams.get('page'));return{records:f.records.slice((page-1)*100,page*100),total:101,totalPages:2}}})
 assert.deepEqual(requested,[API+'?per_page=100&page=1',API+'?per_page=100&page=2',API+'?per_page=100&page=1',API+'?per_page=100&page=2']);assert.equal(audit.publicWordPressRoles.length,101);assert.equal(jobs.length,1);assert.equal(audit.declaredBoardInventoryComplete,true);assert.equal(audit.ownDetailPasses,2)
})
test('Allied a second page transport error or changed native count never becomes a partial success',async()=>{
 const f=paginatedInventory();for(const failure of[Error('Second page unavailable'),{records:f.records.slice(100),total:102,totalPages:2}])await assert.rejects(runFixture({listing:f.listing,details:f.detailMap,fetchJobsPage:async url=>{if(new URL(url).searchParams.get('page')==='1')return{records:f.records.slice(0,100),total:101,totalPages:2};if(failure instanceof Error)throw failure;return failure}}),/Second page unavailable|pagination changed/)
})
test('Allied compatible REST count reader keeps count headers and rejects absent headers',async()=>{
 const response=headers=>new Response(JSON.stringify(records),{headers:{'content-type':'application/json',...headers}}),reader=createWordPressJobsPageFetch({fetchImpl:async()=>response({'x-wp-total':'3','x-wp-totalpages':'1'})});assert.deepEqual(await reader(API+'?per_page=100&page=1'),firstPage);await assert.rejects(createWordPressJobsPageFetch({fetchImpl:async()=>response({})})(API+'?per_page=100&page=1'),/count|inventory/i)
})
test('Allied configured native board can prove India exclusion only with all foreign countries and no unresolved corporate branch',async()=>{
 // The corporate announcement tables are explicitly removed only in this
 // synthetic board-only scope control; original captured HTML is immutable.
 const boardOnly=careersHtml.replace(/<table\b[^>]*id="tablepress-[^"]+"[\s\S]*?<\/table>/g,''),foreign=new Map([...details].map(([url,html])=>[url,changeSchema(html,p=>({...p,jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'New York',addressCountry:'US'}}})).replaceAll('Navi Mumbai','New York')]));let audit
 const jobs=await runFixture({careers:boardOnly,details:foreign,onAudit:r=>{audit=r}}),evidence=readInventoryEvidence(jobs);assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,true);assert.equal(evidence.reportedTotal,3);assert.equal(evidence.indiaFacetCount,0);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})
