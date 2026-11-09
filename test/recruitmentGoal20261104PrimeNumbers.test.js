import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {run,CAREERS_URL,extractRoleListings} from '../scraper/primenumberstechnologies/script.js'
import {recruitmentJobPostings} from '../scraper-support/utils/verifiedRecruitment.js'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {filterIndiaJobs} from '../scraper-support/utils/indiaLocationFilter.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const dir=new URL('../scraper-support/tests/fixtures/primenumberstechnologies/',import.meta.url)
const original=new Map([[CAREERS_URL,fs.readFileSync(new URL('careers.html',dir),'utf8')],
 ...['3vsn','is77','c632'].map(id=>['https://primenumbers.in/careers/'+id+'/',fs.readFileSync(new URL('role-'+id+'.html',dir),'utf8')])])
const first='https://primenumbers.in/careers/3vsn/'
const changeModel=(text,change)=>text.replace(/(<script[^>]+type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(whole,start,raw,end)=>{
 const model=JSON.parse(raw);if(model['@type']!=='JobPosting')return whole;change(model);return start+JSON.stringify(model)+end
})
const replay=(change=(_url,text)=>text,options={})=>run({now:()=> '2026-11-05T00:00:00Z',...options,fetchText:async url=>{
 assert.ok(original.has(url),'No unpublished URL or application request: '+url);return change(url,original.get(url))
}})

test('PrimeNumbers retains each own full native model, employer, publication precision and published application anchor',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,3)
 for(const job of jobs){
  const raw=recruitmentJobPostings(readNativeDocument(original.get(job.sourceUrl)))[0]
  assert.deepEqual(job.nativeSourceRecord,raw)
  assert.deepEqual(job.nativeHiringOrganization,raw.hiringOrganization)
  assert.equal(job.sourceDescription,raw.description)
  assert.equal(job.postingDate,raw.datePosted)
  assert.equal(job.postingDatePrecision,'calendar-date')
  assert.equal(job.sourcePostingDateIsExact,false)
  assert.equal(new URL(job.applyUrl).searchParams.get('role'),job.title)
  assert.equal(job.firstEverPostedAt,null)
  assert.equal(job.applicationVisited,false)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})

for(const [label,mutate]of [
 ['missing country',n=>{delete n.jobLocation.address.addressCountry}],
 ['city used as country',n=>{n.jobLocation.address.addressCountry='Bengaluru'}],
 ['conflicting country labels',n=>{n.jobLocation.address.addressCountry={name:'India',alpha2Code:'US'}}],
 ['mixed-country workplaces',n=>{n.jobLocation=[n.jobLocation,{address:{addressCountry:'DE'}}]}],
])test('PrimeNumbers '+label+' cannot become India through city inference or provider defaults',async()=>{
 const jobs=await replay((url,text)=>url===first?changeModel(text,mutate):text),job=jobs[0]
 assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.location,null)
 assert.equal(job.sourceDetailComplete,false)
 assert.ok(job.sourceDetailFailureKind.startsWith('native-country-'))
 assert.equal(filterIndiaJobs([job]).length,0)
 const provider=getScraperCatalog().find(p=>p.source==='primenumberstechnologies')
 assert.equal(filterIndiaJobs([normalizeScrapedJob(job,provider)]).length,0)
 assert.ok(job.nativeSourceRecord)
})

for(const [label,mutate]of [
 ['wrong ID',n=>{n.identifier.value='other'}],['wrong title',n=>{n.title='Other role'}],
 ['explicit different legal employer',n=>{n.hiringOrganization.legalName='Other Company'}],
 ['future publication',n=>{n.datePosted='2027-01-01'}],['invalid publication date',n=>{n.datePosted='2026-02-31'}],
 ['criteria only in hidden content',n=>{n.description='<div hidden>'+n.description+'</div>'}],
])test('PrimeNumbers rejects '+label,async()=>assert.rejects(replay((url,text)=>url===first?changeModel(text,mutate):text),/Primenumbers|native/))

test('PrimeNumbers excludes inert structured data and ambiguous own-role declarations',async()=>{
 await assert.rejects(replay((url,text)=>url===first?text.replace(/(<script[^>]+type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
  (all,start,raw,end)=>JSON.parse(raw)['@type']==='JobPosting'?'<template>'+all+'</template>':all):text),/Primenumbers/)
 await assert.rejects(replay((url,text)=>url===first?text+text.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i)[0]:text),/Ambiguous/)
})

test('PrimeNumbers ignores hidden index cards and reads metadata within the correct active card',()=>{
 const text=original.get(CAREERS_URL),before=extractRoleListings(text)
 const fake='<a class="pn-role pn-role--link" href="/careers/fake/"><h2>Fake role</h2><p>Fake criteria</p><div class="pn-role-loc">Other</div></a>'
 assert.deepEqual(extractRoleListings(text+'<div hidden>'+fake+'</div><template>'+fake+'</template>'),before)
 assert.equal(new Set(before.map(row=>row.title)).size,3)
 assert.equal(before[1].department,'Technology & Engineering')
})

test('PrimeNumbers preserves earlier qualified roles when a later native read fails',async()=>{
 const jobs=await replay(url=>{if(url.endsWith('/is77/'))throw Error('HTTP 503 later role');return original.get(url)})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'3vsn')
 assert.equal(jobs[0].sourceNativeCollectionAudit.failures.length,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('PrimeNumbers cancellation and an explicit zero cap cannot produce a complete empty inventory',async()=>{
 const controller=new AbortController(),reason=Error('cancelled caller');controller.abort(reason)
 let reads=0
 await assert.rejects(run({signal:controller.signal,fetchText:async()=>{reads++;return ''}}),error=>error===reason)
 assert.equal(reads,0)
 const empty=await replay(undefined,{maxJobs:0})
 assert.equal(empty.length,0)
 assert.equal(readInventoryEvidence(empty).status,'coverage-gap')
})
