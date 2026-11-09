import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeFixture} from '../alohatechnology/nativeFixture.js'
import {extractSearchResults,run,JOBS_API_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=nativeFixture(import.meta.url),records=JSON.parse(fixture.get(JOBS_API_URL)),timeout=v=>new Promise(r=>setTimeout(()=>r(v),80))
test('WordPress posting IDs and generic organization identifier are not fabricated formal requisitions',()=>{
 const jobs=extractSearchResults(records);assert.equal(jobs.length,23);assert.ok(jobs.every(j=>j.requisitionId===null));assert.ok(jobs.every(j=>j.country===null))
})
test('all published archive/API/detail criteria reconcile before returning complete native descriptions with unknown countries',async()=>{
 const reports=[],jobs=await run({fetchJson:async()=>records,fetchPage:fixture.fetchPage,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,22);assert.equal(reports.length,1);assert.equal(reports[0].observations.length,23);assert.equal(reports[0].nativeArchivePagesEnumerated,3);assert.equal(reports[0].closingReconciled,true)
 assert.equal(reports[0].scopeGapRecords.length,1);assert.match(reports[0].scopeGapRecords[0].nativeEmployerName,/CWEGE/);assert.equal(reports[0].scopeGapRecords[0].jobId,'26893')
 assert.ok(jobs.every(j=>j.sourceDetailComplete===true&&j.country===null&&j.requisitionId===null));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const field=jobs.find(j=>j.jobId==='58601');assert.ok(field.jobDescription.includes('20000'),'published native salary criterion must not be dropped')
})
test('an API/detail native title mismatch remains an identity gap',async()=>{
 await assert.rejects(run({fetchJson:async()=>records,fetchPage:async u=>{const r=await fixture.fetchPage(u);if(u.includes('/job/field-investigator/'))r.body=r.body.replaceAll('Field Investigator','Changed public role');return r}}),/title|identity/i)
})
test('API total headers cannot be ignored for an incomplete cohort',async()=>{
 await assert.rejects(run({fetchJson:async()=>records,fetchPage:async u=>{const r=await fixture.fetchPage(u);if(u===JOBS_API_URL)r.headers.set('x-wp-total','24');return r}}),/total|pagination|cardinality|inventory/i)
})
test('unknown-country collector audit errors remain exact and bounded by caller cancellation',async()=>{
 const c=new AbortController(),reason={abort:'ammachi-observer'},p=run({fetchJson:async()=>records,fetchPage:fixture.fetchPage,signal:c.signal,onAudit:()=>{c.abort(reason);return new Promise(()=>{})}})
 assert.equal(await Promise.race([p.then(()=>null,e=>e),timeout('hung')]),reason)
})
test('native hiring organizations are preserved by the API mapper without relabelling the CWEGE posting as Labs',()=>{
 assert.match(extractSearchResults(records).find(j=>j.jobId==='26893').company,/CWEGE/)
})
test('explicit native detail and API role countries must reconcile before India selection',async()=>{
 await assert.rejects(run({fetchPage:async url=>{
  const r=await fixture.fetchPage(url)
  if(url===JOBS_API_URL){const p=JSON.parse(r.body);p.find(j=>j.id===58601).position_job_location_addressCountry='IN';r.body=JSON.stringify(p)}
  if(url.includes('/job/field-investigator/'))r.body=r.body.replace(/(<script[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/,(_all,start,json,end)=>{const schema=JSON.parse(json);schema.jobLocation={'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'CA'}};return start+JSON.stringify(schema)+end})
  return r
 }}),/country.*conflict|conflicting.*country/i)
})
test('an announced native REST continuation cannot be discarded behind a terminal numeric count',async()=>{
 await assert.rejects(run({fetchPage:async url=>{const r=await fixture.fetchPage(url);if(url===JOBS_API_URL)r.headers.set('link','<https://ammachilabs.org/wp-json/wp/v2/jobs?per_page=100&page=2>; rel="next"');return r}}),/continuation|pagination/i)
})
const withNativeLocations=location=>async url=>{const r=await fixture.fetchPage(url);if(url.includes('/job/field-investigator/'))r.body=r.body.replace(/(<script[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/,(_all,start,json,end)=>{const schema=JSON.parse(json);schema.jobLocation=location;return start+JSON.stringify(schema)+end});return r}
test('known India plus an unresolved native workplace keeps every raw alternative and holds country qualification',async()=>{
 const locations=[{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'IN'}},{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'Toronto'}}],reports=[]
 const jobs=await run({fetchPage:withNativeLocations(locations),onAudit:r=>reports.push(r)}),job=jobs.find(j=>j.jobId==='58601')
 assert.equal(job.country,null);assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeLocationEvidence.countryQualified,false)
 assert.equal(job.nativeLocationEvidence.detailWorkplaceAlternatives.length,2);assert.deepEqual(job.nativeLocationEvidence.detailWorkplaceAlternatives.map(a=>a.rawPlace),locations)
 assert.ok(reports[0].observations.find(j=>j.jobId==='58601').jobDescription.includes('20000'))
})
test('conflicting country name and identifier is preserved without selecting India',async()=>{
 const country={'@type':'Country',name:'India',identifier:'CA'},location={'@type':'Place',address:{'@type':'PostalAddress',addressCountry:country}}
 const jobs=await run({fetchPage:withNativeLocations(location)}),job=jobs.find(j=>j.jobId==='58601')
 assert.equal(job.country,null);assert.equal(job.nativeLocationEvidence.countryQualified,false);assert.equal(job.sourceDetailComplete,true)
 assert.deepEqual(job.nativeLocationEvidence.detailWorkplaceAlternatives[0].rawAddress.addressCountry,country)
})
test('a complete native workplace with agreeing country name and ISO identifier remains qualified',async()=>{
 const jobs=await run({fetchPage:withNativeLocations({'@type':'Place',address:{'@type':'PostalAddress',addressCountry:{'@type':'Country',name:'India',identifier:'IN'}}})}),job=jobs.find(j=>j.jobId==='58601')
 assert.equal(job.country,'India');assert.equal(job.nativeLocationEvidence.countryQualified,true);assert.equal(job.sourceDetailComplete,true)
})
