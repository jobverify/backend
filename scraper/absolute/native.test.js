import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
globalThis.fetch = async () => { throw new Error('ABSOLUTE_OFFLINE_NETWORK_TRIPWIRE') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const native = await import('./script.js')
const manifest = JSON.parse(fs.readFileSync(new URL('./fixtures/native-manifest.json', import.meta.url)))
const saved = new Map(manifest.responses.map(r => [r.requestedUrl, zlib.gunzipSync(fs.readFileSync(new URL(`./fixtures/${r.fixture}`, import.meta.url))).toString()]))
const careers = 'https://www.absolute.com/company/careers/'
const board = 'https://jobs.jobvite.com/absolute/'
const first = `${board}job/ogAUAfw4`
const fixed = '2026-10-27T11:00:00.000Z'
const fixtureSchema = html => JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)[1])
const replaceSchema = (html, mutate) => html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i, (_,a,b,c) => { const s=JSON.parse(b);mutate(s);return a+JSON.stringify(s)+c })
const fakeRole = ({countries=['India'], countryField, description='<p>SYNTHETIC FUTURE POSITIVE: Build secure systems.</p><ul><li>Write C++ &amp; C#.</li><li>5+ years experience.</li></ul>',date='2026-10-28',expiry, id='syntheticFuture', employer='Absolute Software',extra={}}={}) => {
  const s={'@context':'https://schema.org','@type':'JobPosting',identifier:id,title:'SYNTHETIC FUTURE POSITIVE Engineer',hiringOrganization:{'@type':'Organization',name:employer},industry:'Engineering',employmentType:'Regular Full-Time',datePosted:date,description,jobLocation:countries.map((c,i)=>({'@type':'Place',address:{'@type':'PostalAddress',addressLocality:i?'Secondary':'Bangalore',addressCountry:countryField??c}})),...extra}
  if(expiry!==undefined)s.validThrough=expiry
  return `<html><title>Absolute Security Careers</title><script type="application/ld+json">${JSON.stringify(s)}</script><h2 class="jv-header">${s.title}</h2><p class="jv-job-detail-meta">Engineering Bangalore, India</p><div class="jv-job-detail-description"><h3>Description</h3>${description}</div><a class="jv-button-apply" href="/absolute/job/${id}/apply">Apply</a><p>Powered by Jobvite</p></html>`
}
const fakeBoard = (location='Bangalore, India',id='syntheticFuture') => `<html><title>Absolute Security Careers</title><h2>Open Positions</h2><h3 class="h2">Engineering</h3><table class="jv-job-list"><tr><td class="jv-job-list-name"><a href="/absolute/job/${id}">SYNTHETIC FUTURE POSITIVE Engineer</a></td><td class="jv-job-list-location">${location}</td></tr></table><p>Powered by Jobvite</p><p>Absolute provides persistent endpoint security</p></html>`
const run = async ({transform=()=>null,synthetic=false,maxJobs,fetchOverride}={}) => {
  const calls=[]; const counts=new Map()
  const fetchPage=async url => {url=String(url);calls.push(url);counts.set(url,(counts.get(url)||0)+1);if(fetchOverride){const r=await fetchOverride(url,counts.get(url));if(r!==undefined)return r}const h=synthetic&&url===board?fakeBoard():synthetic&&url===`${board}job/syntheticFuture`?fakeRole():saved.get(url);assert.ok(h,`Unexpected public GET ${url}`);return transform(url,h,counts.get(url))??h}
  const provider=getScraperCatalog().find(p=>p.source==='absolute')
  const jobs=await createCatalogScraper(provider).run({fetchPage,fetchJson:async()=>{throw new Error('Unexpected JSON transport')},now:()=>fixed,maxJobs})
  return {jobs,evidence:readInventoryEvidence(jobs),calls}
}

test('retained native response fixtures independently match captured exact hashes',()=>{
  for(const r of manifest.responses){const bytes=zlib.gunzipSync(fs.readFileSync(new URL(`./fixtures/${r.fixture}`,import.meta.url)));assert.equal(bytes.length,r.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),r.sha256)}
})
test('registered native replay enumerates all 19 full global roles and proves current zero India',async()=>{
  const {jobs,evidence,calls}=await run();assert.equal(jobs.length,0);assert.equal(evidence.status,'complete-inventory');assert.equal(evidence.reportedTotal,19);assert.equal(evidence.indiaFacetCount,0);assert.equal(evidence.listingComplete,true)
  assert.equal(calls.filter(u=>/\/job\//.test(u)).length,38);assert.equal(calls.filter(u=>u===careers).length,2);assert.equal(calls.filter(u=>u===board).length,2);assert.ok(!calls.some(u=>/\/apply|oauth|login|register/i.test(u)))
})
test('native role extraction preserves independently read full schema HTML, dates, employer, identity and geography',()=>{
  const listing={jobId:'ogAUAfw4',title:'Business Development Representative, Enterprise',department:'Marketing',location:'Vancouver, British Columbia',detailUrl:first}
  const s=fixtureSchema(saved.get(first));const role=native.extractJobDetail(saved.get(first),listing)
  assert.equal(role.nativeDescriptionHtml,s.description);assert.equal(role.jobId,'ogAUAfw4');assert.equal(role.requisitionId,null);assert.equal(role.company,'Absolute Software');assert.equal(role.legalEmployer,null);assert.equal(role.postingDate,'2026-10-05');assert.equal(role.postingDatePrecision,'day');assert.equal(role.closingDate,null);assert.equal(role.updatedAt,null);assert.equal(role.applyUrl,first+'/apply');assert.deepEqual(role.nativeJobLocations,s.jobLocation);assert.deepEqual(role.workCountries,['Canada']);assert.match(role.jobDescription,/Equal Employment Opportunity/);assert.ok(role.jobDescription.endsWith('[email protected]'))
})
test('explicitly synthetic future India roles retain full criteria and public application identity',async()=>{
  const {jobs,evidence}=await run({synthetic:true});assert.equal(jobs.length,1);assert.equal(jobs[0].company,'Absolute Software');assert.equal(jobs[0].jobId,'syntheticFuture');assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].applyUrl,board+'job/syntheticFuture/apply');assert.match(jobs[0].jobDescription,/C\+\+ & C#/);assert.equal(evidence.listingComplete,true);assert.equal(evidence.reportedTotal,1)
})
test('native visible criteria omit display-none editor checklist artifacts while retaining exact raw HTML',()=>{
  const row=native.extractJobBoardListings(saved.get(board)).find(r=>r.jobId==='ogZNAfwm')
  const job=native.extractJobDetail(saved.get(row.detailUrl),row)
  assert.ok(!job.jobDescription.includes('[ ]'))
  assert.match(job.nativeDescriptionHtml,/display: none/)
})
test('secondary India work address counts as eligible and preserves primary country',async()=>{
 const {jobs}=await run({synthetic:true,transform:(u,h)=>u===board?fakeBoard('Remote, United States'):u.endsWith('/syntheticFuture')?fakeRole({countries:['United States','India']}):null});assert.equal(jobs.length,1);assert.equal(jobs[0].primaryWorkCountry,'United States');assert.deepEqual(jobs[0].workCountries,['United States','India']);assert.equal(jobs[0].nativeJobLocations.length,2)
})
for(const [name,mutate] of [
 ['changed same-ID geography',s=>s.jobLocation[0].address.addressCountry='India'],
 ['changed same-ID description',s=>s.description+='<p>Changed native criteria</p>'],
 ['changed same-ID date',s=>s.datePosted='2026-10-26'],
 ['changed same-ID employer',s=>s.hiringOrganization.name='Another Employer'],
])test(`closing ${name} prevents authoritative totals`,async()=>{
 const {evidence}=await run({transform:(u,h,n)=>u===first&&n===2?replaceSchema(h,mutate):null});assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})
for(const [name,transform] of [
 ['board growth',(u,h,n)=>u===board&&n===2?h.replace('</tbody>','<tr><td class="jv-job-list-name"><a href="/absolute/job/newRole">New Role</a></td><td class="jv-job-list-location">India</td></tr></tbody>'):null],
 ['unparsed role link',(u,h)=>u===board?h.replace('</body>','<a href="/absolute/job/unknown">Unparsed Role</a></body>'):null],
 ['unhandled pagination',(u,h)=>u===board?h.replace('</body>','<div class="pagination">Load more</div></body>'):null],
 ['new corporate hiring channel',(u,h,n)=>u===careers&&n===2?h.replace('</body>','<a href="https://hiring.example.test/positions">View current openings</a></body>'):null],
 ['new recruitment locale',(u,h)=>u===careers?h.replace('</head>','<link rel="alternate" hreflang="de" href="https://www.absolute.com/de/company/careers" /></head>'):null],
])test(`${name} suppresses complete totals`,async()=>{const {evidence}=await run({transform});assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)})
for(const [name,options] of [
 ['city-only Delhi',{countryField:'Delhi'}],['state abbreviation',{countryField:'KA'}],['regional APAC',{countryField:'APAC'}],['unknown object',{countryField:{label:'India'}}],['office country',{extra:{officeCountry:'India'}}],['geography object',{extra:{geography:{country:'India'}}}],['unsupported address',{extra:{address:{addressCountry:'India'}}}],['country list',{extra:{workCountries:['India']}}],['secondary address field',{extra:{workAddress:{addressCountry:'India'}}}],
])test(`unsupported ${name} cannot establish complete country inventory`,async()=>{
 const {jobs,evidence}=await run({synthetic:true,transform:(u,h)=>u.endsWith('/syntheticFuture')?fakeRole(options):null});assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);if(options.countryField)assert.equal(jobs.length,0)
})
test('no country is inferred from city, title, narrative or corporate headquarters',async()=>{
 const {jobs,evidence}=await run({synthetic:true,transform:(u,h)=>u===board?fakeBoard('Delhi'):u.endsWith('/syntheticFuture')?replaceSchema(fakeRole(),s=>delete s.jobLocation[0].address.addressCountry):null});assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)
})
test('missing detail retains healthy confirmed India with unknown whole-source totals',async()=>{
 const {jobs,evidence}=await run({synthetic:true,transform:(u,h)=>u===board?h.replace('</table>','<tr><td class="jv-job-list-name"><a href="/absolute/job/missing">Missing</a></td><td class="jv-job-list-location">Remote, Canada</td></tr></table>'):null,fetchOverride:u=>u.endsWith('/missing')?new Response('Not found',{status:404}):undefined});assert.equal(jobs.length,1);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
})
for(const code of [401,403,429])test(`first ${code} stops all requests without retry`,async()=>{let denied=false;await assert.rejects(run({fetchOverride:u=>{if(denied)assert.fail('network continued after denial');if(u===board){denied=true;return new Response('Denied',{status:code})}}}),new RegExp(String(code)))})
test('date-only expiry is preserved without inventing midnight; unknown/expired dates cannot prove healthy absence',async()=>{
 const {jobs}=await run({synthetic:true,transform:u=>u.endsWith('/syntheticFuture')?fakeRole({expiry:'2026-11-30'}):null});assert.equal(jobs[0].closingDate,'2026-11-30');assert.equal(jobs[0].closingDatePrecision,'day')
 const invalid=await run({synthetic:true,transform:u=>u.endsWith('/syntheticFuture')?fakeRole({date:'invalid'}):null});assert.equal(invalid.evidence.listingComplete,false)
})
test('job caps apply after full native proof and suppress cleanup completeness',async()=>{const {jobs,evidence,calls}=await run({synthetic:true,maxJobs:0});assert.equal(jobs.length,0);assert.ok(calls.some(u=>u.endsWith('/syntheticFuture')));assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)})
test('closing country change removes stale India eligibility',async()=>{
 const {jobs,evidence}=await run({synthetic:true,transform:(u,h,n)=>u.endsWith('/syntheticFuture')&&n===2?fakeRole({countries:['Canada']}):null});assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)
})
test('cyclic advertised next page cannot prove a finite inventory',async()=>{const {evidence}=await run({synthetic:true,transform:(u,h)=>u===board?h.replace('</html>',`<a rel="next" href="${board}">Next</a></html>`):null});assert.equal(evidence.listingComplete,false)})
test('published total larger than enumerated roles prevents truncation claims',async()=>{const {evidence}=await run({synthetic:true,transform:(u,h)=>u===board?h.replace('<table ','<table data-total-count="2" '):null});assert.equal(evidence.listingComplete,false)})
test('finite advertised GET pagination is fully enumerated before deciding India coverage',async()=>{
 const second=board+'?page=2'
 const {jobs,evidence,calls}=await run({synthetic:true,transform:(u,h)=>u===board?h.replace('</html>',`<a rel="next" href="${second}">Next</a></html>`):null,fetchOverride:u=>u===second?fakeBoard('Remote, Canada','syntheticCanada').replace('SYNTHETIC FUTURE POSITIVE Engineer','SYNTHETIC FUTURE POSITIVE Engineer'):u.endsWith('/syntheticCanada')?fakeRole({id:'syntheticCanada',countries:['Canada']}):undefined})
 assert.equal(jobs.length,1);assert.equal(evidence.listingComplete,true);assert.equal(evidence.reportedTotal,2);assert.equal(calls.filter(u=>u===second).length,2)
})
for(const [name,mutate] of [['posting ID',s=>s.identifier='anotherPosting'],['employer',s=>s.hiringOrganization.name='Other Company'],['title',s=>s.title='Another Role'],['schema URL',s=>s.url='https://example.test/another']])test(`contradictory native ${name} does not produce healthy India`,async()=>{
 const {jobs,evidence}=await run({synthetic:true,transform:(u,h)=>u.endsWith('/syntheticFuture')?replaceSchema(h,mutate):null});assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)
})
test('first detail-level denial stops before another detail or closing request',async()=>{let denied=false;await assert.rejects(run({fetchOverride:u=>{if(denied)assert.fail('request after denied detail');if(u===first){denied=true;return new Response('Denied',{status:429})}}}),/429/)})
test('actual live response contact-obfuscation rotation preserves stable full native role proof',async()=>{
 const later=zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/ogAUAfw4-live-closing.html.gz',import.meta.url))).toString()
 const record=JSON.parse(fs.readFileSync(new URL('./fixtures/live-closing-manifest.json',import.meta.url)))
 assert.equal(crypto.createHash('sha256').update(later).digest('hex'),record.sha256)
 const {evidence}=await run({transform:(u,h,n)=>u===first&&n===2?later:null})
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.reportedTotal,19)
})
test('a role removed from the closing board is not returned as healthy India',async()=>{
 const {jobs,evidence}=await run({synthetic:true,transform:(u,h,n)=>u===board&&n===2?h.replace(/<tr>[^]*?<\/tr>/,''):null})
 assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
})
