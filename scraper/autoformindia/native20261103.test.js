import assert from'node:assert/strict'
import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import test from'node:test'
import{run}from'./native.js'
import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
const{captures}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const pages=new Map();for(const row of captures.filter(row=>row.key.startsWith('production-'))){if(!pages.has(row.url))pages.set(row.url,[]);pages.get(row.url).push({...row,body:Buffer.from(row.body,'base64').toString()})}
const replay=mutate=>{const counts=new Map();return async(url,options)=>{const count=(counts.get(url)||0)+1;counts.set(url,count);assert.ok(pages.has(url),'unexpected URL '+url);const page=structuredClone(pages.get(url)[Math.min(count-1,pages.get(url).length-1)]);mutate?.(page,{url,count,options});return page}}
const editSchema=(html,edit)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i,(_match,start,json,end)=>{const value=JSON.parse(json);edit(value);return start+JSON.stringify(value)+end})
test('actual four current role inventories prove India exclusion while preserving Germany/Netherlands conflict',async()=>{
 let audit;const jobs=await run({fetchPage:replay(),onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(audit.observedNative,4);assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
 assert.equal(audit.companyComplete,false);assert.equal(audit.wholeCompanyGlobal,null);assert.equal(audit.sourceCompanyWideScopeComplete,false)
 assert.equal(audit.indiaEligibilityProof.complete,true);assert.equal(audit.indiaEligibilityProof.nonIndiaExclusions.length,4)
 const role=audit.nativeJobs.find(job=>job.jobId==='5150');assert.equal(role.country,null);assert.equal(role.sourceCountryConflict,true);assert.deepEqual(new Set(role.sourceNativeCountryInterpretations),new Set(['Netherlands','Germany']));assert.equal(role.sourceIndiaEligibilityClosingVerified,true)
 assert.equal(role.sourceNativeDescriptionFormattingOnly,true);assert.equal(role.sourceIssues.includes('native-description-visibility-or-schema-differs'),false)
 assert.equal(role.sourceIssues.includes('native-country-conflict'),true);assert.match(role.jobDescription,/9 years of experience/)
})
test('an independently bound India interpretation keeps the target inventory partial',async()=>{
 let audit;const jobs=await run({fetchPage:replay(page=>{if(page.body.includes('jobuid-single-5150'))page.body=editSchema(page.body,s=>{s.jobLocation.address.addressCountry='India'})}),onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(audit.indiaEligibilityProof.complete,false);assert.ok(audit.indiaEligibilityProof.unresolvedRoles.some(row=>row.id==='5150'))
})
test('unknown workplace geography cannot qualify India absence from a different known country field',async()=>{
 const jobs=await run({fetchPage:replay(page=>{page.body=page.body.replaceAll('<strong>The Netherlands:','<strong>Undisclosed:')})})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('an additional declared workplace without an address remains unknown instead of disappearing from country proof',async()=>{
 const jobs=await run({fetchPage:replay(page=>{if(page.body.includes('jobuid-single-5150'))page.body=editSchema(page.body,s=>{s.jobLocation=[s.jobLocation,{'@type':'Place'}]})})})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('a changed actual word remains a source description conflict even when the role is explicitly foreign',async()=>{
 let audit;const jobs=await run({fetchPage:replay(page=>{if(page.body.includes('jobuid-single-5150'))page.body=editSchema(page.body,s=>{s.description=s.description.replace('9 years','12 years')})}),onAudit:value=>{audit=value}})
 const role=audit.nativeJobs.find(job=>job.jobId==='5150');assert.equal(role.sourceNativeDescriptionFormattingOnly,false);assert.equal(role.sourceDetailComplete,false);assert.ok(role.sourceIssues.includes('native-description-visibility-or-schema-differs'));assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0);assert.equal(audit.companyComplete,false)
})
test('closing foreign criteria drift preserves the India exclusion proof and the exact global detail gap',async()=>{
 let audit;const jobs=await run({fetchPage:replay((page,{count})=>{if(count===2&&page.body.includes('jobuid-single-5162'))page.body=page.body.replace('Your Responsibilities','Changed native responsibilities')}),onAudit:value=>{audit=value}})
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(audit.companyComplete,false);assert.ok(audit.issues.some(issue=>issue==='closing-native-detail-drift:5162'));assert.equal(audit.nativeJobs.find(job=>job.jobId==='5162').sourceIndiaEligibilityClosingVerified,true)
})
test('closing changed country interpretations cannot qualify the opening India absence',async()=>{
 const jobs=await run({fetchPage:replay((page,{count})=>{if(count===2&&page.body.includes('jobuid-single-5150'))page.body=editSchema(page.body,s=>{s.jobLocation.address.addressCountry='India'})})})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('an unobserved detail or changed listing membership remains an inventory gap',async()=>{
 for(const kind of['detail','listing']){const jobs=await run({fetchPage:replay((page,{count})=>{if(count===2&&kind==='listing')page.body=page.body.replaceAll('id="jobuid-5162"','id="archived-5162"');if(kind==='detail'&&page.body.includes('jobuid-single-5150')){page.status=404;page.body='Not found'}})});assert.equal(readInventoryEvidence(jobs).listingComplete,false)}
})
test('source reads and audit observer are bounded and preserve caller cancellation',async()=>{
 await assert.rejects(run({fetchPage:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(run({fetchPage:replay(),onAudit:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 const controller=new AbortController(),reason=Error('stop AutoForm');let calls=0
 await assert.rejects(run({signal:controller.signal,fetchPage:async(_url,options)=>{calls++;assert.equal(options.signal,controller.signal);controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason);assert.equal(calls,1)
})
test('excluded foreign-role full criteria are not a prerequisite for India absence',async()=>{
 let audit;const jobs=await run({fetchPage:replay(page=>{if(page.body.includes('jobuid-single-5150'))page.body=page.body.replace('itemprop="articleBody"','itemprop="summaryOnly"')}),onAudit:value=>{audit=value}})
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);const role=audit.nativeJobs.find(job=>job.jobId==='5150');assert.equal(role.sourceDetailComplete,false);assert.equal(role.jobDescription,'');assert.equal(audit.companyComplete,false)
})
test('malformed excluded-role expiry stays raw and unresolved while explicit foreign worksite exclusion remains usable',async()=>{
 let audit;const raw='2026-11-30T12:00:00INVALIDZ',jobs=await run({fetchPage:replay(page=>{if(page.body.includes('jobuid-single-5150'))page.body=editSchema(page.body,s=>{s.validThrough=raw})}),onAudit:value=>{audit=value}})
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);const role=audit.nativeJobs.find(job=>job.jobId==='5150');assert.equal(role.closingDate,raw);assert.equal(role.sourceClosingDateIsExact,false);assert.ok(role.sourceIssues.includes('native-expiry-unresolved'));assert.equal(audit.companyComplete,false)
})
