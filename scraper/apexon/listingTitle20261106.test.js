import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {createApexonScraper,hasOfficialExploreJobsSignal,EXPLORE_JOBS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

// Original November2 HTML is historical evidence. Only the title mutations
// below are synthetic; repeated offline responses do not establish a new live
// opening/closing inventory or current vacancy count.
const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz',import.meta.url))))
for(const row of captures){
 const bytes=Buffer.from(row.html)
 assert.equal(bytes.length,row.bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256)
}
const original=url=>{
 const row=captures.findLast(row=>row.requestedUrl===url&&row.status===200)
 assert.ok(row,'Unrecorded historical request '+url)
 return row
}
const historicalListing=original(EXPLORE_JOBS_URL).html
const title=value=>historicalListing.replace(/<title>[^<]*<\/title>/,'<title>'+value+'</title>')
const usaTitle='Job Search, Job Opportunities &amp; Openings in USA - Apexon'
const usaListing=title(usaTitle)
const clock=()=>captures.map(row=>row.capturedAt).sort().at(-1)
const run=async transform=>{
 const calls=[]
 const jobs=await createApexonScraper().run({now:clock,fetchText:async(url,options)=>{
  assert.equal(options.includeResponseMetadata,true);calls.push(url)
  const row=original(url)
  return {status:row.status,url:row.finalUrl,html:url===EXPLORE_JOBS_URL?transform(row.html):row.html}
 }})
 return {jobs,calls}
}

test('current USA title permits unchanged historical India native criteria and paired listing checks',async()=>{
 assert.equal(hasOfficialExploreJobsSignal(usaListing),true)
 const {jobs,calls}=await run(()=>usaListing)
 assert.equal(jobs.length,18)
 assert.ok(jobs.every(row=>row.country==='India'&&row.jobDescription.length>500))
 assert.ok(jobs.every(row=>row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(calls.filter(url=>url===EXPLORE_JOBS_URL).length,2)
})

test('the retained India title still qualifies the historical native listing',()=>{
 assert.equal(hasOfficialExploreJobsSignal(historicalListing),true)
})

test('USA title cannot qualify another employer or a page without native job routes',()=>{
 assert.equal(hasOfficialExploreJobsSignal(title(usaTitle.replace('Apexon','Other Employer'))),false)
 assert.equal(hasOfficialExploreJobsSignal(usaListing.replaceAll('career-job-detail/?','other-route/?')),false)
})

test('an inert matching title cannot qualify a different active page title',()=>{
 const html=title('Other Employer Jobs').replace('</head>','<template><title>'+usaTitle+'</title></template></head>')
 assert.equal(hasOfficialExploreJobsSignal(html),false)
})

test('an earlier conflicting head title owns identity even when hidden or inert',()=>{
 for(const attributes of ['',' hidden',' inert']){
  const html=historicalListing.replace('<title>','<title'+attributes+'>Other Employer Jobs</title><title>')
  assert.equal(hasOfficialExploreJobsSignal(html),false)
 }
})

test('a later SEO title cannot override the first India or USA document title',()=>{
 for(const html of [historicalListing,usaListing]){
  assert.equal(hasOfficialExploreJobsSignal(html.replace('</head>','<title>Other Employer Jobs</title></head>')),true)
 }
})

test('a body title cannot replace the main document head identity',()=>{
 const html=title('Other Employer Jobs').replace('</body>','<title>'+usaTitle+'</title></body>')
 assert.equal(hasOfficialExploreJobsSignal(html),false)
})

test('an earlier hidden or inert head cannot transfer identity to a later head',()=>{
 for(const attributes of [' hidden',' inert']){
  const html=usaListing.replace('<head>','<head'+attributes+'><title>Other Employer Jobs</title></head><head>')
  assert.equal(hasOfficialExploreJobsSignal(html),false)
 }
})

test('an earlier hidden or inert HTML root cannot transfer identity to a later document',()=>{
 for(const attributes of [' hidden',' inert']){
  const html='<html'+attributes+'><head><title>Other Employer Jobs</title></head><body></body></html>'+usaListing
  assert.equal(hasOfficialExploreJobsSignal(html),false)
 }
})

test('the USA page label cannot resolve an unknown native worksite country',async()=>{
 const {jobs}=await run(()=>usaListing.replaceAll('data-country="us"','data-country="unknown"'))
 assert.equal(jobs.length,18)
 assert.ok(jobs.every(row=>row.country==='India'&&row.nativeBoardListingComplete===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})


// Synthetic country-join contract records only; no live role or company-zero claim.
import {readNativeTable as readCountryJoinTable} from './nativeInventory.js'
import {extractListingCards as extractCountryJoinCards} from './script.js'
import {readFileSync as readCountryJoinFile,existsSync as hasCountryJoinFile} from 'node:fs'
const countryJoinSynthetic=(location,options=[],extra='')=>`<ul>${options.map(([country,label])=>`<li data-country="${country}">${label}</li>`).join('')}</ul><div class="LocationsearchTable"><div class="table_row"><div class="table_small jobTitle"><a href="/career-job-detail/?id=0&amp;jobid=123" title="Synthetic contract record">Synthetic contract record</a></div><div class="table_small openPosiTitle"><a href="#">1</a></div><div class="table_small locationTitle"><a href="#">${location}</a></div><div>Find out more</div></div></div>${extra}`
const countryJoinRead=html=>readCountryJoinTable(html,extractCountryJoinCards)
test('country join: own India needs no optional exact location filter option',()=>{const x=countryJoinRead(countryJoinSynthetic('Synthetic locality, India'));assert.equal(x.complete,true);assert.equal(x.listings.length,1)})
test('country join: existing India exact filter remains accepted',()=>assert.equal(countryJoinRead(countryJoinSynthetic('Synthetic locality, India',[['India','Synthetic locality, India']])).complete,true))
test('country join: joined foreign row remains resolved and outside India selection',()=>{const x=countryJoinRead(countryJoinSynthetic('Synthetic locality, US',[['us','Synthetic locality, US']]));assert.equal(x.complete,true);assert.equal(x.listings.length,0)})
test('country join: non-India without country mapping stays unresolved',()=>assert.ok(countryJoinRead(countryJoinSynthetic('Synthetic locality')).reasons.has('native-location-country-unresolved')))
test('country join: unsupported filter country still creates gap',()=>assert.ok(countryJoinRead(countryJoinSynthetic('Synthetic locality, India',[['unknown','Synthetic locality, India']])).reasons.has('native-location-country-unresolved')))
test('country join: mapped foreign country conflicting with own India still throws',()=>assert.throws(()=>countryJoinRead(countryJoinSynthetic('Synthetic locality, India',[['us','Synthetic locality, India']]))))
test('country join: mapped India without own India label keeps disagreement',()=>assert.ok(countryJoinRead(countryJoinSynthetic('Synthetic locality',[['India','Synthetic locality']])).reasons.has('native-India-location-disagreement')))
test('country join: conflicting filter declarations remain a gap',()=>assert.ok(countryJoinRead(countryJoinSynthetic('Synthetic locality, India',[['India','Synthetic locality, India'],['us','Synthetic locality, India']])).reasons.has('native-location-country-unresolved')))
test('country join: pagination remains unresolved',()=>assert.ok(countryJoinRead(countryJoinSynthetic('Synthetic locality, India',[],'<a rel="next" href="/next/">Next</a>')).reasons.has('native-pagination-unresolved')))
test('country join: duplicate native requisition remains unresolved',()=>{const html=countryJoinSynthetic('Synthetic locality, India'),row=html.slice(html.indexOf('<div class="table_row">'),html.lastIndexOf('</div>'));assert.ok(countryJoinRead(html.slice(0,html.lastIndexOf('</div>'))+row+'</div>').reasons.has('duplicate-native-requisition'))})
const countryJoinActual=new URL('../../../artifacts/scraper-all-repair-2026-11-06/apexon-auzmor-isolated-capture-preparation-20261108/apexon/local-only/003-response.body',import.meta.url)
test('country join: retained genuine 52-row opening country reconciliation',{skip:!hasCountryJoinFile(countryJoinActual)},()=>{const x=countryJoinRead(readCountryJoinFile(countryJoinActual,'utf8'));assert.equal(x.total,52);assert.equal(x.listings.length,22);assert.equal(x.complete,true)})
