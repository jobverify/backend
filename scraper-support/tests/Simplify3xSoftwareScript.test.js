import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import * as source from '../../scraper/simplify3xsoftware/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const fixtures = new URL('./fixtures/simplify3x-current/', import.meta.url)
const texts = Object.fromEntries(await Promise.all(['home.html','life.html','about.html','contact.html','careers.html','app.js','careers.js','listing.json','details.json','availability.json'].map(async name => [name, await fs.readFile(new URL(name, fixtures), 'utf8')])))
const listing = JSON.parse(texts['listing.json'])
const details = JSON.parse(texts['details.json'])
const clone = value => structuredClone(value)
const createFetch = (mutate = () => {}) => async url => {
  let name = ({[source.HOMEPAGE_URL]:'home.html',[source.LIFE_PAGE_URL]:'life.html',[source.ABOUT_URL]:'about.html',[source.CONTACT_URL]:'contact.html',[source.CAREERS_URL]:'careers.html','https://www.hire3x.com/js/app.43b85d23.js':'app.js','https://www.hire3x.com/js/988.f36977f5.js':'careers.js'})[url]
  let page
  if (name) page = {status:200,url,html:texts[name]}
  else if (url === source.LISTING_URL) page = {status:200,url,html:JSON.stringify(listing)}
  else if (url.startsWith(source.DETAIL_BASE)) {const id = new URL(url).searchParams.get('jobID');page = {status:details[id].status,url,html:JSON.stringify(details[id].body)}}
  else if (url.startsWith(source.AVAILABILITY_BASE)) {const id = new URL(url).searchParams.get('jobID');page = {status:200,url,html:JSON.stringify({type:'Success',data:{JobID:id,customerID:id.split('JD')[0]}})}}
  else throw new Error('Unexpected request: '+url)
  mutate(page,url)
  return page
}
test('current published Hire3x migration retains raw unknown-geography observations and protects earlier inventory', async () => {
 const jobs = await source.run({fetchPage:createFetch()})
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),["L071122A001CU009JD010","L071122A001CU009JD012","L071122A001CU009JD013","L071122A001CU009JD014","L071122A001CU009JD015","L071122A001CU010JD017","L071122A001CU036JD027","L071122A001CU036JD028","L071122A001CU036JD029"])
 assert.ok(jobs.every(j=>j.country===null && j.city===null && j.location===null && j.nativeGeographyQualified===false && j.description.length>100 && j.sourceListingComplete===false && j.jobUrl===j.applyUrl))
 assert.ok(jobs.filter(j=>["L071122A001CU010JD017","L071122A001CU036JD027","L071122A001CU036JD028"].includes(j.jobId)).every(j=>j.description.length>1500))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
for (const [label,change,pattern] of [
 ['homepage identity',(p,u)=>{if(u===source.HOMEPAGE_URL)p.html=p.html.replace('info@simplify3x.com','other@example.com').replaceAll('info@simplify3x.com','other@example.com')},/identity/i],
 ['handoff drift',(p,u)=>{if(u===source.LIFE_PAGE_URL)p.html=p.html.replaceAll('https://www.hire3x.com/careers','https://other.example/careers')},/handoff/i],
 ['cross host redirect',(p,u)=>{if(u===source.CAREERS_URL)p.url='https://other.example/careers'},/redirect|identity/i],
 ['unpublished API',(p,u)=>{if(u.includes('/js/app.'))p.html=p.html.replaceAll('careers/jobs/','careers/old/')},/client|published/i],
 ['missing role renderer',(p,u)=>{if(u.includes('/js/988.'))p.html=p.html.replaceAll('https://recruitment.hire3x.com/JobRegistration/','https://example.org/jobs/')},/client|published/i],
 ['API outage',(p,u)=>{if(u===source.LISTING_URL)p.status=503},/HTTP 503/i],
 ['malformed listing',(p,u)=>{if(u===source.LISTING_URL)p.html='{}'},/listing/i],
 ['partial page',(p,u)=>{if(u===source.LISTING_URL){let b=JSON.parse(p.html);b.next='page2';p.html=JSON.stringify(b)}},/pagination|listing/i],
 ['employer drift',(p,u)=>{if(u===source.LISTING_URL){let b=JSON.parse(p.html);b.data[0].jobs[0].customerName='Other Employer';p.html=JSON.stringify(b)}},/employer|identity/i],
 ['conflicting duplicate',(p,u)=>{if(u===source.LISTING_URL){let b=JSON.parse(p.html);b.data.at(-1).jobs[0].title='Changed';p.html=JSON.stringify(b)}},/duplicate/i],
 ['detail ID mismatch',(p,u)=>{if(u.startsWith(source.DETAIL_BASE)&&u.endsWith('L071122A001CU036JD028')){let b=JSON.parse(p.html);b.data.jobID='wrong';p.html=JSON.stringify(b)}},/detail|identity/i],
 ['detail country mismatch',(p,u)=>{if(u.startsWith(source.DETAIL_BASE)&&u.endsWith('L071122A001CU036JD028')){let b=JSON.parse(p.html);b.data.location=['New York'];p.html=JSON.stringify(b)}},/detail|location/i],
 ['missing native form',(p,u)=>{if(u.startsWith(source.DETAIL_BASE)&&p.status===200){let b=JSON.parse(p.html);b.data.fields=[];p.html=JSON.stringify(b)}},/form/i],
 ['native outage',(p,u)=>{if(u.startsWith(source.DETAIL_BASE))p.status=503},/HTTP 503/i],
 ['unexpected closed response',(p,u)=>{if(u.startsWith(source.DETAIL_BASE)&&u.endsWith('L071122A001CU036JD028')){p.status=409;p.html=JSON.stringify({type:'Fail',data:{data:'Job Not found'}})}},/detail|active/i],
 ['availability identity',(p,u)=>{if(u.startsWith(source.AVAILABILITY_BASE)){let b=JSON.parse(p.html);b.data.JobID='other';p.html=JSON.stringify(b)}},/availability/i]
]) test('fails closed on '+label,async()=>assert.rejects(source.run({fetchPage:createFetch(change)}),pattern))
test('unknown locations remain raw and preserve an incomplete country inventory', async()=>{
 const jobs=await source.run({fetchPage:createFetch((p,u)=>{if(u===source.LISTING_URL||u.startsWith(source.DETAIL_BASE)){let b=JSON.parse(p.html);let rows=u===source.LISTING_URL?b.data.flatMap(g=>g.jobs):[b.data];for(const j of rows)if(j.jobID==='L071122A001CU036JD028')j.location=['Remote'];p.html=JSON.stringify(b)}})})
 assert.equal(jobs.length,9);assert.ok(jobs.every(j=>j.country===null && j.nativeGeographyQualified===false));assert.deepEqual(jobs.find(j=>j.jobId==='L071122A001CU036JD028').rawNativeWorkplaceEvidence.locations,['Remote']);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('no verified India rows never authorizes empty expiry',async()=>{
 const jobs=await source.run({fetchPage:createFetch((p,u)=>{if(u===source.LISTING_URL||u.startsWith(source.DETAIL_BASE)){let b=JSON.parse(p.html);let rows=u===source.LISTING_URL?b.data.flatMap(g=>g.jobs):[b.data];for(const j of rows)if(j?.licenseKey==='L071122A001'&&j.location?.some(l=>/bengaluru|bangalore/i.test(l)))j.location=['Remote'];p.html=JSON.stringify(b)}})})
 assert.equal(jobs.length,9);assert.ok(jobs.every(j=>j.country===null && j.nativeGeographyQualified===false));assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('a changing final snapshot is rejected',async()=>{
 let listingCalls=0
 await assert.rejects(source.run({fetchPage:createFetch((p,u)=>{if(u===source.LISTING_URL&&++listingCalls===2){let b=JSON.parse(p.html);b.data[0].jobs[0].title='Changed';p.html=JSON.stringify(b)}})}),/duplicate|changed during/i)
})
test('an aborted run makes no requests',async()=>{
 const controller=new AbortController();controller.abort(new Error('stop'))
 let called=false;await assert.rejects(source.run({signal:controller.signal,fetchPage:async()=>{called=true}}),/stop/)
 assert.equal(called,false)
})
test('default transport requests JSON for public APIs and supplies a bounded request signal',async()=>{
 const originalFetch=globalThis.fetch;const mock=createFetch();let calls=0
 try {globalThis.fetch=async(url,options)=>{calls++;assert.ok(options.signal);assert.equal(options.redirect,'follow');if(String(url).includes('-api.hire3x.com/')||String(url).includes('api-website.hire3x.com/'))assert.equal(options.headers.Accept,'application/json');const page=await mock(url);return {status:page.status,url:page.url,text:async()=>page.html}};assert.equal((await source.run()).length,9);assert.equal(calls,31)}finally{globalThis.fetch=originalFetch}
})
