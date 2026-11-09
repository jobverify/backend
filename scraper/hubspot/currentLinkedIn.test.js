import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHubSpotScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const tenant="hubspot", companyName="HubSpot", companyId="68529", count=1
const dir=new URL('./fixtures/current-linkedin/',import.meta.url)
const company=await fs.readFile(new URL('company.html',dir),'utf8')
const board=await fs.readFile(new URL('jobs.html',dir),'utf8')
const ids=["4472768271"]
const details=new Map(await Promise.all(ids.map(async id=>[id,await fs.readFile(new URL(id+'.html',dir),'utf8')])))
const invoke=async(modify=()=>{},options={})=>{
 const calls=[]
 const fetchPage=async(url,context)=>{
  calls.push({url,context})
  const html=url.includes('/jobs/view/')?details.get(url.match(/-(\d+)(?:\?|$)/)?.[1]):url.includes('/company/')?company:board
  if(!html)throw new Error('Unregistered native URL '+url)
  const page={status:200,url,html};modify(page,calls);return page
 }
 const jobs=await createHubSpotScraper().run({fetchPage,now:()=> '2026-10-09T00:00:00.000Z',fetchGraphql:async()=>{throw new Error('Old upstream feed404')},fetchText:async()=>{throw new Error('Old marketing403')},fetchBrowserText:async()=>{throw new Error('Old marketing403')},...options})
 return{jobs,calls}
}
test('HubSpot current employer-published public roles have native India/JD/lifecycle evidence and partial coverage',async()=>{
 const {jobs,calls}=await invoke();assert.equal(jobs.length,count);assert.equal(new Set(jobs.map(j=>j.jobId)).size,count)
 for(const j of jobs){assert.equal(j.company,companyName);assert.equal(j.country,'India');assert.ok(j.jobDescription.length>1000);assert.equal(j.sourceListingComplete,false);assert.equal(j.applicationRequiresAccount,true);assert.ok(j.postingDate);assert.ok(j.closingDate)}
 const e=readInventoryEvidence(jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null)
 assert.ok(calls.every(c=>!c.url.includes('graphql')&&!c.url.includes('jhub')&&!c.url.includes('careers')));assert.equal(calls.length,count+3)
})
for(const [name,change] of [
 ['off-authority redirect',p=>{p.url='https://example.com/copied'}],
 ['company profile domain drift',p=>{if(p.url.includes('/company/'))p.html=p.html.replaceAll('hubspot.com','unrelated.example')}],
 ['company native ID drift',p=>{if(p.url.includes('/company/'))p.html=p.html.replaceAll(companyId,'999999')}],
 ['board native company filter drift',p=>{if(!p.url.includes('/company/')&&!p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('value="'+companyId+'"','value="999999"')}],
 ['board location control drift',p=>{if(!p.url.includes('/company/')&&!p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('value="India"','value="United States"')}],
 ['displayed count mismatch',p=>{if(!p.url.includes('/company/')&&!p.url.includes('/jobs/view/'))p.html=p.html.replace(/(results-context-header__job-count">)\d+/,'$1'+(count+1))}],
 ['noncanonical native ID',p=>{if(!p.url.includes('/company/')&&!p.url.includes('/jobs/view/'))p.html=p.html.replaceAll(ids[0],'0'+ids[0])}],
 ['native title missing',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('top-card-layout__title','unrelated-title')}],
 ['native hiring organization drift',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('"name":"'+companyName+'"','"name":"Other Employer"')}],
 ['foreign country conflicts with India listing',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('"addressCountry":"IN"','"addressCountry":"US"')}],
 ['missing native country',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('"addressCountry":"IN"','"addressCountry":null')}],
 ['malformed JSON',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace('"@type":"JobPosting"','"@type":oops')}],
 ['expired role',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace(/"validThrough":"[^"]+"/g,'"validThrough":"2026-01-01T00:00:00Z"')}],
 ['future posting',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace(/"datePosted":"[^"]+"/g,'"datePosted":"2027-01-01T00:00:00Z"')}],
 ['missing native positive apply',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('id="topbar-apply"','id="unknown-apply"')}],
 ['missing full native JD',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('show-more-less-html__markup','unrelated-markup')}],
 ['visible/schema JD disagreement',p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace('"description":"','"description":"Conflicting description ')}],
 ['detail access failure',p=>{if(p.url.includes('/jobs/view/'))p.status=403}],
 ['actual final snapshot drift',(p,c)=>{if(c.length===count+3)p.html=p.html.replaceAll(ids[0],String(Number(ids[0])+1))}],
 ['empty displayed inventory',p=>{if(!p.url.includes('/company/')&&!p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('base-search-card--link','unrelated-card')}],
])test('HubSpot fails closed on '+name,async()=>{await assert.rejects(invoke(change),/LinkedIn|HTTP|upstream|marketing/)})
test('HubSpot positive caller cap never claims complete inventory',async()=>{const {jobs}=await invoke(undefined,{maxJobs:1});assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false);for(const maxJobs of [0,-1,1.5,'1'])await assert.rejects(invoke(undefined,{maxJobs}),/positive integer/)})
test('HubSpot cancellation precedes employer authority fetch',async()=>{const c=new AbortController();c.abort();let calls=0;await assert.rejects(createHubSpotScraper().run({signal:c.signal,fetchPage:async()=>{calls++;throw new Error('Unexpected')}}),{name:'AbortError'});assert.equal(calls,0)})

test(companyName+' propagates a bounded request context to native pages',async()=>{const c=new AbortController();const {calls}=await invoke(undefined,{signal:c.signal});assert.ok(calls.every(call=>call.context.signal===c.signal))})
test(companyName+' rejects mixed schema workplace countries',async()=>{await assert.rejects(invoke(p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replace(/"jobLocation":(\{"@type":"Place","address":\{[^}]+\},"latitude":[^,]+,"longitude":[^}]+\})/,(_,place)=>'"jobLocation":['+place+','+place.replace('"addressCountry":"IN"','"addressCountry":"US"')+']')}),/country|geography|India/)})
test(companyName+' rejects conflicting structured India region',async()=>{await assert.rejects(invoke(p=>{if(p.url.includes('/jobs/view/'))p.html=p.html.replaceAll('"addressRegion":null','"addressRegion":"California"')}),/state|region|geography|India/)})
test(companyName+' abort during native traversal rejects partial output',async()=>{const c=new AbortController();await assert.rejects(invoke(p=>{if(p.url.includes('/jobs/view/'))c.abort()}, {signal:c.signal}),{name:'AbortError'})})
for(const middle of ['US','United States'])test('HubSpot rejects contradictory country tail '+middle,async()=>{await assert.rejects(invoke(p=>{p.html=p.html.replaceAll('Greater Bengaluru Area','Greater Bengaluru Area, '+middle+', India').replaceAll('"addressLocality":"Greater Bengaluru Area, '+middle+', India"','"addressLocality":"Greater Bengaluru Area"')}),/country|geography|India/)})
