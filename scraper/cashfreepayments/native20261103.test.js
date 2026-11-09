import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createCashfreePaymentsScraper,run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const {captures}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const body=key=>Buffer.from(captures[key].body,'base64').toString('utf8')
const api=()=>JSON.parse(body('api'))
const replay=mutate=>{const counts=new Map();return async url=>{const key=url.startsWith('https://www.cashfree.com/')?'careers':url.includes('/api/internal/')?'api':'board',count=(counts.get(key)||0)+1;counts.set(key,count);let html=body(key);html=mutate?.(key,count,html)??html;return{status:200,url,html}}}
test('declared Cashfree Kula account returns all 35 full India criteria and exact native public role URLs',async()=>{
 const jobs=await createCashfreePaymentsScraper().run({fetchPage:replay()});assert.equal(jobs.length,35);assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(readInventoryEvidence(jobs).reportedTotal,35)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.requisitionId,null);assert.equal(job.sourceDetailComplete,true);assert.ok(job.jobDescription.length>300);assert.ok(job.sourceUrl.startsWith('https://careers.kula.ai/cashfree/'+job.jobId+'-'));assert.equal(job.closingDate,null);assert.match(job.postingDate,/^20\d\d-/)}
 const first=jobs.find(job=>job.jobId==='4467');assert.equal(first.sourceUrl,'https://careers.kula.ai/cashfree/4467-security-engineer-2?jobs=true');assert.equal(first.sourceNativeAccountId,1291);assert.match(first.jobDescription,/security/i);assert.equal(first.postingDate,'2026-08-11T06:02:43.000Z');assert.equal(first.nativeCollectionEvidence.closingInventoryMatches,true)
})
test('production run forwards bounded audit callback',async()=>{let audit;const jobs=await run({fetchPage:replay(),onAudit:value=>{audit=value}});assert.equal(jobs.length,35);assert.equal(audit.extractedDetailJobs,35)})
test('official handoff hidden in comments cannot bind another employer board',async()=>{
 await assert.rejects(createCashfreePaymentsScraper().run({fetchPage:replay((key,_n,html)=>key==='careers'?'<title>Cashfree Payments Careers</title><!--'+html+'-->':html)}),/handoff|identity/i)
})
test('wrong native account id fails closed despite a matching account slug',async()=>{
 await assert.rejects(createCashfreePaymentsScraper().run({fetchPage:replay((key,_n,html)=>key==='api'?html.replaceAll('"account_id":1291','"account_id":999'):html)}),/account|employer/i)
})
test('API total cannot qualify a truncated or repeated inventory',async()=>{
 await assert.rejects(createCashfreePaymentsScraper().run({fetchPage:replay((key,_n,html)=>{if(key!=='api')return html;const p=JSON.parse(html);p.data.pop();return JSON.stringify(p)})}),/inventory|total|count/i)
})
test('missing country is partial and never filled from an office name or city',async()=>{
 let audit;const jobs=await createCashfreePaymentsScraper().run({fetchPage:replay((key,_n,html)=>{if(key!=='api')return html;const p=JSON.parse(html);for(const office of p.data[0].ats_job.offices){office.country_code=null;office.country=null}return JSON.stringify(p)}),onAudit:value=>{audit=value}})
 assert.equal(jobs.length,34);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(audit.unknownCountryListingCount,1);assert.equal(audit.observedDetails[0].country,null)
})
test('teaser or mismatching public description is withheld instead of described as a full JD',async()=>{
 const jobs=await createCashfreePaymentsScraper().run({fetchPage:replay((key,_n,html)=>{if(key!=='api')return html;const p=JSON.parse(html);p.data[0].ats_job.job_description='<p>Apply now</p>';return JSON.stringify(p)})})
 assert.equal(jobs.length,34);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('closing removal and publication or criteria changes withhold affected roles',async()=>{
 const jobs=await createCashfreePaymentsScraper().run({fetchPage:replay((key,count,html)=>{if(key!=='api'||count!==2)return html;const p=JSON.parse(html);p.data[0].ats_job.job_description+='<p>New native required criterion.</p>';return JSON.stringify(p)})})
 assert.equal(jobs.length,34);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('result cap cannot authorize a complete inventory',async()=>{
 const jobs=await createCashfreePaymentsScraper().run({fetchPage:replay(),maxJobs:2});assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('network read and observer are bounded and caller abort is honored',async()=>{
 await assert.rejects(createCashfreePaymentsScraper().run({fetchPage:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(createCashfreePaymentsScraper().run({fetchPage:replay(),onAudit:()=>new Promise(()=>{}),timeoutMs:25}),/abort|timeout/i)
 await assert.rejects(createCashfreePaymentsScraper().run({fetchPage:replay(),signal:AbortSignal.abort(new Error('caller stopped'))}),/caller stopped/)
})
