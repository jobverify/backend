import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as cognus from '../scraper/cognustechnology/script.js'
import * as dspace from '../scraper/dspaceindia/script.js'
import * as apexon from '../scraper/apexon/script.js'
import {readNativeRole} from '../scraper/apexon/nativeInventory.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {recruitmentEmployerMatches} from '../scraper-support/utils/verifiedRecruitment.js'
import {filterIndiaJobs} from '../scraper-support/utils/indiaLocationFilter.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/native-quality.json.gz',import.meta.url))))
const captures=source=>fixture.sources.find(row=>row.source===source).requests
const replay=(source,change=(_url,text)=>text)=>async url=>{
  const row=captures(source).find(row=>row.requestedURL===url)
  assert.ok(row,'Unrecorded native request: '+url)
  return change(url,row.text)
}
const nativeApexon=captures('apexon').filter(row=>row.requestedURL.includes('/career-job-detail/'))
const dspacePage=captures('dspaceindia').find(row=>row.requestedURL.includes('jid=38197')).text
const dspaceBase=dspace.extractIndiaJobsFromListingHtml(captures('dspaceindia')[1].text).find(job=>job.jobId==='38197')

test('quality fixtures retain all 21 unmodified native responses and their hashes',()=>{
  assert.equal(fixture.sources.reduce((n,row)=>n+row.requests.length,0),21)
  for(const source of fixture.sources)for(const row of source.requests){
    assert.equal(row.status,200)
    assert.equal(row.replayed,false)
    assert.equal(createHash('sha256').update(row.text).digest('hex'),row.bodySHA256)
  }
})

test('Cognus preserves native brand-like Country values as evidence and leaves normalized country and publication date unknown',async()=>{
  const jobs=await cognus.run({
    fetchText:replay('cognustechnology'),
    fetchDetail:async url=>({status:200,url,html:await replay('cognustechnology')(url)}),
  })
  assert.equal(jobs.length,3)
  for(const job of jobs){
    assert.equal(job.country,null)
    assert.ok(['Cognus','Gradding'].includes(job.nativeLocationEvidence.Country))
    assert.equal(job.location,null)
    assert.equal(job.city,null)
    assert.ok(job.nativeLocation.includes(job.nativeLocationEvidence.Country))
    assert.equal(job.postingDate,null)
    assert.match(job.nativeDateOpened,/^\d{4}-\d{2}-\d{2}$/)
    assert.equal(job.sourceDetailContentComplete,true)
    assert.equal(job.sourceDetailComplete,false)
    assert.equal(job.sourceDetailFailureKind,'malformed-native-country')
    assert.equal(job.sourceScopeComplete,false)
    assert.equal(job.lifecycleCleanupAllowed,false)
  }
})

test('Cognus never exposes malformed country values when its native details are unavailable',async()=>{
  const jobs=await cognus.run({fetchText:replay('cognustechnology'),fetchDetail:async url=>({status:403,url,html:''})})
  assert.equal(jobs.length,3)
  assert.ok(jobs.every(job=>job.country===null&&job.postingDate===null&&job.sourceDetailComplete===false))
})

test('all eight current dSPACE roles retain their explicit listing/native country conflict',async()=>{
  const jobs=await dspace.run({fetchText:replay('dspaceindia')})
  assert.equal(jobs.length,8)
  for(const job of jobs){
    assert.equal(job.country,null)
    assert.equal(job.location,null)
    assert.equal(job.city,null)
    assert.equal(job.nativeLocation,'Trivandrum')
    assert.equal(job.sourceDetailComplete,false)
    assert.equal(job.sourceDetailContentComplete,true)
    assert.equal(job.nativeSourceRecord.jobLocation.address.addressCountry,'DE')
    assert.equal(job.sourceDetailFailureKind,'native-country-conflict')
    assert.equal(job.sourceScopeComplete,false)
    assert.equal(job.lifecycleCleanupAllowed,false)
    assert.ok(job.sourceDescription.length>500)
  }
})

test('unknown native countries cannot regain India eligibility through city inference or the provider default',async()=>{
  const cg=await cognus.run({fetchText:replay('cognustechnology'),
    fetchDetail:async url=>({status:200,url,html:await replay('cognustechnology')(url)})})
  const ds=await dspace.run({fetchText:replay('dspaceindia')})
  for(const [source,jobs]of [['cognustechnology',cg],['dspaceindia',ds]]){
    const provider=getScraperCatalog().find(p=>p.source===source)
    assert.equal(filterIndiaJobs(jobs).length,0)
    const normalized=jobs.map(job=>normalizeScrapedJob(job,provider))
    assert.equal(filterIndiaJobs(normalized).length,0)
    assert.ok(normalized.every(job=>job.country===null&&job.city===null&&job.location===null))
  }
})

test('dSPACE requires a recognized own native country and ignores inert or duplicate structured job data',()=>{
  for(const value of ['', 'Udaipur', 'Cognus', 'ZZ']){
    const changed=dspacePage.replace(/"addressCountry"\s*:\s*"DE"/,JSON.stringify('addressCountry')+':'+JSON.stringify(value))
    assert.notEqual(changed,dspacePage)
    const job=dspace.extractJobDetail(changed,dspaceBase)
    assert.equal(job.country,null)
    assert.equal(job.sourceDetailFailureKind,'missing-native-country')
  }
  const script=[...dspacePage.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi)]
    .map(match=>match[0]).find(text=>text.includes('"JobPosting"'))
  assert.ok(script)
  const without=dspacePage.replace(script,'')
  assert.throws(()=>dspace.extractJobPostingJsonLd(without+'<template>'+script+'</template>'),/JobPosting/)
  assert.throws(()=>dspace.extractJobPostingJsonLd(dspacePage+script),/JobPosting/)
})

test('Apexon reads the old and new own employer paragraphs without executing page scripts',()=>{
  assert.equal(nativeApexon.length,3)
  for(const row of nativeApexon){
    const role=readNativeRole(row.text+'<script>throw new Error("never execute")</script>')
    assert.ok(role.description.length>500)
    assert.match(role.employerStatement,/^Apexon is /)
    assert.match(role.location,/\bIndia\b/)
    assert.equal(role.requisitionId,new URL(row.requestedURL).searchParams.get('jobid'))
    assert.ok(role.applyUrl.startsWith('https://apexon.talentrecruit.com/career-page/apply/'))
  }
})

test('Apexon excludes inert duplicate content and ignores scripts, hidden criteria and quoted employer statements',()=>{
  const html=nativeApexon[0].text
  const role=readNativeRole(html)
  const injected=html.replace('<div class="jobcontent">','<div class="jobcontent"><p hidden>Hidden invented duties</p><script>Invented script criteria</script>')
  assert.deepEqual(readNativeRole(injected),role)
  assert.throws(()=>readNativeRole(html.replace(/<p>Apexon is ([\s\S]*?)<\/p>/,'<blockquote><p>Apexon is $1</p></blockquote>')),/employer/)
  assert.throws(()=>readNativeRole(html.replace('<div class="jobcontent">','<div class="jobcontent" hidden>')),/active identity/)
  assert.throws(()=>readNativeRole(html.replace('https://apexon.talentrecruit.com/career-page/apply/','https://foreign.example/career-page/apply/')),/application/)
})

test('Apexon retains prior verified roles and stops at a later detail denial without requesting the application link',async()=>{
  const calls=[]
  const jobs=await apexon.run({fetchText:async url=>{
    calls.push(url)
    if(url===nativeApexon[1].requestedURL)throw Object.assign(Error('HTTP 403 native role'),{status:403})
    return replay('apexon')(url)
  }})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].requisitionId,'7506')
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].nativeBoardListingComplete,false)
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.match(jobs[0].nativeCollectionFailures[0].reason,/403/)
  assert.ok(!calls.some(url=>url.includes('talentrecruit.com')))
  assert.equal(calls.at(-1),nativeApexon[1].requestedURL)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})

test('reviewed employer labels are exact and preserve separate bank and acquired-brand boundaries',()=>{
  const providers=getScraperCatalog()
  const siemens=providers.find(p=>p.source==='siemenshealthineers')
  const td=providers.find(p=>p.source==='torontodominionbank')
  const usBank=providers.find(p=>p.source==='tdbank')
  assert.equal(recruitmentEmployerMatches(siemens,'461s Siemens Healthcare Private Limited'),true)
  assert.equal(recruitmentEmployerMatches(siemens,'440y Varian Medical Systems International (India) Private Limited'),false)
  assert.equal(recruitmentEmployerMatches(siemens,'Siemens Limited'),false)
  assert.equal(recruitmentEmployerMatches(td,'TD Global Finance Unlimited Company'),true)
  assert.equal(recruitmentEmployerMatches(td,'Some unrelated financial company'),false)
  assert.equal(recruitmentEmployerMatches(usBank,'TD Global Finance Unlimited Company'),false)
})
