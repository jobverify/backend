import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const dir=import.meta.dirname,ORIGIN='https://eptura.pinpointhq.com',CAREERS='https://eptura.com/careers/'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(dir+'/fixtures/runtime-native-20261021.json.gz')).toString('utf8'))
const attempt=(mutate=()=>{},extra={})=>{const pages=fixture();mutate(pages);const counts={};return run({now:'2026-10-21T19:11:24.530Z',detailConcurrency:1,fetchImpl:async(url,options)=>{assert.equal(options.method,'GET');assert.ok(Object.hasOwn(pages,url),'Unexpected unadvertised URL');counts[url]=(counts[url]??0)+1;const b=typeof pages[url]==='function'?pages[url](counts[url]):pages[url];return{status:200,url,text:async()=>b}},...extra})}
const changeRows=(pages,fn)=>{const v=JSON.parse(pages[ORIGIN+'/postings.json']);fn(v);pages[ORIGIN+'/postings.json']=JSON.stringify(v)}
test('title whitespace in an unrelated posting does not block India extraction', async () => {
 const jobs = await attempt(p => changeRows(p, v => { v.data[0].title += ' ' }))
 assert.equal(jobs.length, 2)
})
test('title whitespace on an India posting reconciles with normalized rendered headings', async () => {
 const jobs = await attempt(p => {
  const row = JSON.parse(p[ORIGIN + '/postings.json']).data[2]
  for (const url of Object.keys(p)) p[url] = p[url].replaceAll(row.title, row.title + ' ')
 })
 assert.equal(jobs.length, 2)
})
test('India city and sector location is qualified against matching role country schema', async () => {
 const jobs = await attempt(p => {
  changeRows(p, v => { v.data[2].location.name = 'Gurugram'; v.data[2].location.province = 'Sector 24' })
  const url = ORIGIN + '/en/postings/7320d3fb-5e5d-40fb-9963-0df5f216581f'
  p[url] = p[url].replaceAll('"name":"India","address"', '"name":"Gurugram","address"')
   .replaceAll('"addressRegion":"India"', '"addressRegion":"Sector 24"')
   .replaceAll(' - India | Eptura Careers', ' - Gurugram | Eptura Careers')
 })
 assert.equal(jobs.length, 2)
 assert.equal(jobs.find(j => j.jobId === '582829').country, 'India')
})
test('current native fixture returns full India roles with original dates and advertised application URLs',async()=>{const jobs=await attempt();assert.equal(jobs.length,2);const j=jobs.find(x=>x.jobId==='582829');assert.equal(j.city,'Gurugram');assert.equal(j.country,'India');assert.equal(j.postedAt,'2026-09-21T00:41:59.000Z');assert.equal(j.nativePublicationDate,'2026-09-21T01:41:59+01:00');assert.equal(j.nativeLegalEmployer,null);assert.match(j.applyUrl,/\/applications\/new$/);assert.ok(j.jobDescription.includes('Own Premium Support Cases'));assert.ok(j.jobDescription.includes('Health insurance'));assert.equal(j.sourceListingComplete,false);assert.equal(j.sourceIndiaJobCount,null)})
test('pagination activation is unqualified rather than silently truncated',async()=>{await assert.rejects(attempt(p=>{p[ORIGIN+'/']=p[ORIGIN+'/'].replace('"showPagination":false','"showPagination":true')}),/pagination/i)})
test('India country with a foreign typed city is rejected',async()=>{await assert.rejects(attempt(p=>changeRows(p,v=>{v.data[2].location.city='London'})),/city|geograph/i)})
test('foreign country with India typed city is rejected',async()=>{await assert.rejects(attempt(p=>changeRows(p,v=>{v.data[0].location.city='Gurugram'})),/city|geograph/i)})
test('missing core description cannot be filled by optional sections',async()=>{await assert.rejects(attempt(p=>changeRows(p,v=>{v.data[2].description=''})),/description/i)})
test('empty optional requirements and benefits preserve a substantive core description',async()=>{const jobs=await attempt(p=>changeRows(p,v=>{v.data[2].skills_knowledge_expertise='';v.data[2].benefits=''}));assert.equal(jobs.length,2);assert.ok(jobs[0].jobDescription.length>100)})
test('native dates never use observation time when genuinely missing',async()=>{const jobs=await attempt(p=>{p[ORIGIN+'/en/postings/7320d3fb-5e5d-40fb-9963-0df5f216581f']=p[ORIGIN+'/en/postings/7320d3fb-5e5d-40fb-9963-0df5f216581f'].replace('"datePosted":"2026-09-21T01:41:59+01:00",','')});assert.equal(jobs.find(x=>x.jobId==='582829').postedAt,null)})
test('wrong role identity in JSON-LD is rejected',async()=>{await assert.rejects(attempt(p=>{const k=ORIGIN+'/en/postings/7320d3fb-5e5d-40fb-9963-0df5f216581f';p[k]=p[k].replace('"value":"7320d3fb-5e5d-40fb-9963-0df5f216581f"','"value":"3d4dff0c-6d26-4031-b7fd-eb7c5385b623"')}),/identity|identifier/i)})
test('wrong organization is rejected',async()=>{await assert.rejects(attempt(p=>{const k=ORIGIN+'/en/postings/7320d3fb-5e5d-40fb-9963-0df5f216581f';p[k]=p[k].replace('"name":"Eptura"','"name":"Other"')}),/employer|organization|identity/i)})
test('instruction-only core description is rejected',async()=>{await assert.rejects(attempt(p=>changeRows(p,v=>{v.data[2].description='<p>Please click apply now to view the full job description.</p>'.repeat(5)})),/description/i)})
test('closed role core description is rejected',async()=>{await assert.rejects(attempt(p=>changeRows(p,v=>{v.data[2].description+='<p>This position is no longer available.</p>'})),/closed|description/i)})
test('unknown listing errors do not become verified empty',async()=>{await assert.rejects(attempt(p=>{p[ORIGIN+'/postings.json']='{"error":"unavailable","data":[]}'}),/error|envelope|empty/i)})
test('listing drift is rejected and returns no partial inventory',async()=>{await assert.rejects(attempt(p=>{const first=p[ORIGIN+'/postings.json'],v=JSON.parse(first);v.data.pop();p[ORIGIN+'/postings.json']=n=>n===1?first:JSON.stringify(v)}),/changed|drift/i)})
test('maxJobs truncation is forbidden',async()=>{await assert.rejects(attempt(()=>{},{maxJobs:1}),/truncation/i)})
test('HTTP failures remain failures',async()=>{await assert.rejects(run({fetchImpl:async url=>({status:403,url,text:async()=>''}),detailConcurrency:1}),/403|HTTP/)})
