import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {run} from './script.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const rows=['fresh-official-pages.json','fresh-linkedin-pages.json'].flatMap(f=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+f+'.gz',import.meta.url)))))
const replay=(edit=r=>r)=>async url=>{const original=rows.find(r=>r.url===url);assert.ok(original,'uncaptured '+url);const r=edit({...original});const response=new Response(r.body,{status:r.status});Object.defineProperty(response,'url',{value:r.finalUrl});return response}
const now=()=> '2026-10-23T14:00:00Z'
const options={now,fetchImpl:replay()}
test('fresh actual capture stops at rate limit, preserving nine existing-policy roles with country truth',async()=>{
 const jobs=await run(options);assert.equal(jobs.length,9);assert.equal(jobs.filter(j=>j.country==='India').length,6);assert.equal(jobs.filter(j=>j.country===null).length,3);assert.ok(jobs.every(j=>j.activeApplyVerified))
})
test('new primary public dates and native country/expiry carriers cannot be ignored',async()=>{
 for(const carrier of ['<time datetime="2025-01-01">First published January 1, 2025</time>','<time>First published January 1, 2025</time>','<meta itemprop="validThrough" content="2020-01-01">','<span itemprop="addressCountry">United States</span>']){
  await assert.rejects(run({...options,fetchImpl:replay(r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replace('</h1>','</h1>'+carrier);return r})}),{code:'PURPLLE_COVERAGE_GAP'})
 }
})
test('impossible native listing calendar dates cannot silently normalize',async()=>{
 await assert.rejects(run({...options,fetchImpl:replay(r=>{if(r.url.includes('/jobs/search/')){const d=document(r.body),card=d.nodes(n=>d.hasClass(n,'job-search-card'))[0],time=d.nodes(n=>n.tag==='time',card)[0];r.body=r.body.replace(d.outer(time),'<time datetime="2026-02-30">recent</time>')}return r})}),{code:'PURPLLE_COVERAGE_GAP'})
})
test('missing native JD remains eligible after identity, date, country and application validation',async()=>{
 const jobs=await run({...options,fetchImpl:replay(r=>{if(r.url.includes('/jobs/view/'))r.body=r.body.replaceAll('class="show-more-less-html__markup','hidden class="show-more-less-html__markup');return r})})
 assert.equal(jobs.length,9);assert.ok(jobs.every(j=>j.sourceDescription===null&&!j.sourceDetailComplete));assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,9)
})

test('inactive metadata and newly active corporate vacancies require review too',async()=>{
 for(const target of ['/careers','/jobs/view/'])await assert.rejects(run({...options,fetchImpl:replay(r=>{if(r.url.includes(target))r.body+='<span hidden itemprop="addressCountry">United States</span>';return r})}),{code:'PURPLLE_COVERAGE_GAP'})
})
