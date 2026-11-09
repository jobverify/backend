import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS_URL,extractCurrentListings,extractCurrentFresherDetail} from '../scraper/winmansoftware/script.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261106/winman-criteria.json.gz',import.meta.url))))
const pages=new Map(fixture.packets.map(p=>[p.requestedURL,Buffer.from(p.bodyBase64,'base64').toString('utf8')])),primary=pages.get(CAREERS_URL),listings=extractCurrentListings(primary).freshers
const first=listings[0],html=pages.get(first.detailUrl),firstOracle=fixture.independentOracle.find(row=>row.requestedURL===first.detailUrl)
const provider=getScraperCatalog().find(p=>p.source==='winmansoftware'),run=options=>createCatalogScraper(provider).run(options)
const parse=(value=html,listing=first)=>extractCurrentFresherDetail(value,listing)

test('Winman criteria oracle preserves all fifteen original bodies and all fourteen own models',()=>{
 assert.equal(fixture.packets.length,15);assert.equal(fixture.independentOracle.length,14)
 for(const p of fixture.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(createHash('sha256').update(b).digest('hex'),p.bodySHA256);assert.equal(p.status,200);assert.equal(p.method,'GET');assert.equal(p.body,null)}
 assert.equal(firstOracle.minimumMarks,'75%');assert.equal(fixture.independentOracle.find(r=>r.title==='Software Engineer').minimumMarks,'70%')
})

for(const row of fixture.independentOracle)test('Winman retains every own criteria field and whole model: '+row.title,()=>{
 const listing=listings.find(l=>l.detailUrl===row.requestedURL),detail=parse(pages.get(row.requestedURL),listing)
 assert.equal(detail.description,row.criteriaText)
 assert.equal(detail.qualification,row.qualification)
 assert.equal(detail.nativeMinimumMarksThroughout,row.minimumMarks)
 assert.equal(detail.nativeCriteriaComplete,true)
 assert.deepEqual(detail.nativeCriteriaModel,row.model)
})

test('Winman registered mapping and normalization retain requirements without promoting country or inventory scope',async()=>{
 const calls=[],jobs=await run({fetchText:async url=>{calls.push(url);assert.ok(pages.has(url),'no unretained request');return pages.get(url)}})
 assert.equal(jobs.length,22);assert.deepEqual(calls,[CAREERS_URL,...listings.map(l=>l.detailUrl)])
 for(const row of fixture.independentOracle){
  const job=jobs.find(j=>j.sourceUrl===row.requestedURL),normalized=normalizeScrapedJob(job,provider)
  assert.equal(job.jobDescription,row.criteriaText)
  assert.ok(normalized.jobDescription.includes('Minimum Marks Throughout '+row.minimumMarks))
  assert.ok(normalized.jobDescription.includes(row.qualification))
  for(const record of [job,normalized]){assert.equal(record.sourceDescription,row.criteriaText);assert.equal(record.nativeMinimumMarksThroughout,row.minimumMarks);assert.deepEqual(record.nativeCriteriaModel,row.model);assert.equal(record.nativeCriteriaComplete,true);assert.equal(record.country,null);assert.equal(record.location,null);assert.equal(record.nativeGeographyQualified,false);assert.equal(record.sourceListingComplete,false)}
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readSourceObservationEvidence(jobs,'winmansoftware').observedRecordCount,22)
})

test('Winman includes nested new requirements after minimum marks instead of truncating to known fields',()=>{
 const detail=parse(html.replace('<p class="marks">75%</p>','<p class="marks">75%</p><section><h2>Additional requirements</h2><p>Complete a supervised <strong>coding assessment</strong>.</p></section>'))
 assert.match(detail.description,/Minimum Marks Throughout 75% Additional requirements Complete a supervised coding assessment\s*\./)
 assert.equal(detail.nativeCriteriaComplete,true)
})

for(const [label,change] of [
 ['hidden body',s=>s.replace('class="job-body"','class="job-body" hidden')],
 ['CSS hidden body',s=>s.replace('class="job-body"','class="job-body" style="display:none"')],
 ['hidden mandatory marks',s=>s.replace('class="marks"','class="marks" hidden')],
 ['unsupported criteria subtree',s=>s.replace('<p class="marks">75%</p>','<custom-requirement><p class="marks">75%</p></custom-requirement>')],
 ['duplicate body',s=>s.replace('class="job-body"','class="job-body"').replace('<h2 class="section-title">Job Summary</h2>','<div class="job-body"><p>Unbound criteria</p></div><h2 class="section-title">Job Summary</h2>')],
 ['another role header',s=>s.replace('<h1 class="job-title">Product Software Programmer</h1>','<h1 class="job-title">Another position</h1>')],
 ['another employer header',s=>s.replace(/Winman Software India LLP(?=\s*<\/div>)/,'Another Employer')],
])test('Winman does not accept truncated or unbound current criteria: '+label,()=>{
 const changed=change(html);assert.notEqual(changed,html,'control transformation must be effective')
 assert.throws(()=>parse(changed),/Winman current (?:job|role|criteria)/)
})

test('Winman comments, scripts and templates cannot inject requirements into the real role body',()=>{
 const decoy='<div class="job-container"><div class="job-body"><p>Unpublished decoy requirement</p></div></div>'
 for(const prefix of ['<!--'+decoy+'-->','<script>const example='+JSON.stringify(decoy)+'</script>','<template>'+decoy+'</template>']){
  const detail=parse(prefix+html);assert.equal(detail.description,firstOracle.criteriaText);assert.deepEqual(detail.nativeCriteriaModel,firstOracle.model)
 }
})

test('Winman reduced legacy detail stays compatible and does not acquire whole-criteria proof',()=>{
 const reduced='<h1 class="job-title">Product Software Programmer</h1><div>Winman Software India LLP Mangalore</div><ul class="job-summary"><li>Build software.</li></ul><p class="qualification">B.E.</p><a href="https://winman.in/jobs/resume.aspx">Apply Now</a>'
 const detail=parse(reduced)
 assert.equal(detail.description,'Build software.');assert.equal(detail.qualification,'B.E.')
 assert.equal(detail.nativeCriteriaComplete,false);assert.equal(detail.nativeCriteriaModel,null)
})

for(const attribute of ['hidden','style="display:none"'])test('Winman ignores an unrelated '+attribute+' role copy outside the active owner',()=>{
 const ghost='<div '+attribute+' class="job-container"><div class="job-header">Archived role</div><div class="job-body">Archived requirements</div></div>'
 const detail=parse(ghost+html)
 assert.equal(detail.description,firstOracle.criteriaText);assert.deepEqual(detail.nativeCriteriaModel,firstOracle.model)
})

for(const comment of [false,true])test('Winman registered current detail rejects a removed own application link'+(comment?' even with an inert literal decoy':''),async()=>{
 const changed=html.replaceAll('https://winman.in/jobs/resume.aspx','https://www.winmansoftware.com/applications-closed')+(comment?'<!-- https://winman.in/jobs/resume.aspx -->':'')
 await assert.rejects(run({fetchText:async url=>url===first.detailUrl?changed:pages.get(url)}),/Winman current (?:job|role|criteria)/)
})

for(const wrapper of ['template','comment','hidden CSS'])test('Winman rejects inactive legacy summaries from '+wrapper,()=>{
 const reduced='<h1 class="job-title">Product Software Programmer</h1><div>Winman Software India LLP Mangalore</div><ul class="job-summary"><li>Unpublished requirements.</li></ul><p class="qualification">B.E.</p><a href="https://winman.in/jobs/resume.aspx">Apply Now</a>'
 const value=wrapper==='template'?'<template>'+reduced+'</template>':wrapper==='comment'?'<!--'+reduced+'-->':'<style>.job-summary{display:none}</style>'+reduced
 assert.throws(()=>parse(value),/Winman current (?:job|role|criteria)/)
})
