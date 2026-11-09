import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { publicPostingDescription, isExactPublicJobUrl } from '../../rewriting/publicPostingDescription.js'
import { visiblePostingDescription } from '../../rewriting/visiblePostingDescription.js'
import { readNativeDocument } from '../utils/activeNativeHtml.js'
import { extractJobCards } from '../../scraper/tudiptechnologies/script.js'

const rows=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/ats-followup-20261107/tudip.json.gz',import.meta.url))))
for(const row of rows)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
const board=rows[0],details=rows.slice(1),provider=getScraperCatalog().find(row=>row.source==='tudiptechnologies')
const run=async({change=(body)=>body,closing=(body)=>body,additionalDetails=[]}={})=>{
 let snapshots=0;const requests=[]
 const jobs=await createCatalogScraper(provider).run({now:()=> '2026-11-07T06:15:00.000Z',fetchText:async(url,options={})=>{
  requests.push(url)
  const row=[...rows,...additionalDetails].find(row=>row.requestUrl===url)
  if(!row)throw Error('Uncaptured detail; keep this as an explicit coverage gap')
  const body=url===board.requestUrl?(++snapshots===1?row.body:closing(row.body)):change(row.body,url)
  return options.includeResponseMetadata?{status:row.status,url:row.url,html:body}:body
 }})
 return{jobs,requests,snapshots}
}

test('Tudip current board retains 70 distinct explicit India cards including all four changed URL forms',()=>{
 const jobs=extractJobCards(board.body)
 assert.equal(jobs.length,70)
 assert.equal(new Set(jobs.map(job=>job.jobId)).size,70)
 for(const row of details)assert.ok(jobs.some(job=>job.sourceUrl===row.url))
 assert.ok(jobs.every(job=>job.country==='India'))
 assert.equal(jobs.some(job=>job.title==='Salesforce Automation QA Engineer'),false)
})

test('each affected Tudip detail recovers all reviewed criteria headings and exact native role identity',()=>{
 const titles=['Senior DevOps Engineer','.Net Developer','Partner Development Manager','Senior Technical Writer','Senior Data Scientist']
 for(const[index,row]of details.entries()){
  const job={title:titles[index],company:'Tudip Technologies',source:'tudiptechnologies',sourceUrl:row.url}
  const result=visiblePostingDescription(job,readNativeDocument(row.body),row.url,{sameUrl:isExactPublicJobUrl})
  assert.ok(result?.description.length>500,row.url)
  assert.match(result.description,/Responsibilities|Required Skills|Qualifications/)
  if(index===1)assert.match(result.description,/6\+ years|Education/)
  if(index===2)assert.match(result.description,/What We Look For/)
  if(index===4)assert.match(result.description,/Masters|Minimum of 5 years/)
  assert.equal(publicPostingDescription({...job,title:'Another Role'},row.body,row.url),null)
  assert.equal(publicPostingDescription(job,row.body,'https://tudip.com/jobs/'),null)
 }
})

test('registered Tudip preserves five independently verified full roles and marks uncaptured details incomplete',async()=>{
 const{jobs,snapshots}=await run()
 assert.equal(jobs.length,5)
 assert.equal(snapshots,2)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true&&job.jobDescription.length>500))
 assert.equal(jobs.find(job=>job.title==='Partner Development Manager').location,'Pune , Bangalore')
 assert.ok(jobs.every(job=>job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.match(readInventoryEvidence(jobs).reason,/65/)
})

test('one explicit foreign detail country does not discard the four other independently verified India roles',async()=>{
 const{jobs}=await run({change:(body,url)=>url.endsWith('/partner-development-manager/')?body.replace(/(<strong>Country:<\/strong><span class="key-job-meta">\s*)India/,'$1United States'):body})
 assert.equal(jobs.length,4)
 assert.equal(jobs.some(job=>job.title==='Partner Development Manager'),false)
 assert.match(readInventoryEvidence(jobs).reason,/66/)
})

test('a role removed from the closing Tudip board cannot remain a current output',async()=>{
 const{jobs}=await run({closing:body=>body.replace(/<li class="job_listing"[^>]*data-title="senior devops engineer"[\s\S]*?<\/li>/i,'')})
 assert.equal(jobs.length,4)
 assert.equal(jobs.some(job=>job.sourceUrl===details[0].url),false)
 assert.match(readInventoryEvidence(jobs).reason,/changed|closing/)
})

for(const wrapper of [body=>`<template>${body}</template>`,body=>body.replace('<body','<body hidden')]){
 test('Tudip cannot use an inert first-party jobs surface as live country and role evidence',async()=>{
  await assert.rejects(createCatalogScraper(provider).run({fetchText:async()=>wrapper(board.body)}),/trusted first-party surface|verified India job listings/)
 })
}

test('Tudip retains strict role origin and duplicate-title identity checks while projecting verified roles',async()=>{
 const{jobs,requests}=await run({closing:body=>body.replace('https://tudip.com/job/india-senior-devops-engineer/','https://foreign.example/job/india-senior-devops-engineer/')})
 assert.equal(jobs.length,4)
 assert.ok(requests.every(url=>new URL(url).hostname==='tudip.com'))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const [name,mutate]of [
 ['expired schema',record=>{record.validThrough='2020-01-01T00:00:00+00:00'}],
 ['future posting date',record=>{record.datePosted='2030-01-01T00:00:00+00:00'}],
 ['foreign employer',record=>{record.hiringOrganization.name='Another employer'}],
 ['contradictory URL identifier',record=>{record.identifier.value='https://tudip.com/job/another-role/'}],
 ['contradictory workplace',record=>{record.jobLocation.address='California, United States'}],
]){
 test('Tudip excludes one '+name+' while retaining four unrelated verified India roles',async()=>{
  const{jobs}=await run({change:(body,url)=>url===details[0].url?body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(full,start,json,end)=>{
   const record=JSON.parse(json);if(record['@type']!=='JobPosting')return full;mutate(record);return start+JSON.stringify(record)+end
  }):body})
  assert.equal(jobs.length,4)
  assert.equal(jobs.some(job=>job.sourceUrl===details[0].url),false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 })
}


const legalVariants=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/ats-followup-20261107/tudip-legal-variants.json.gz',import.meta.url))))
for(const {employer,packet}of legalVariants){
 test('Tudip retains the literal native legal employer '+employer,async()=>{
  const{jobs}=await run({additionalDetails:[packet]})
  const role=jobs.find(job=>job.sourceUrl===packet.url)
  assert.ok(role,'A period in the same first-party legal name must not discard this current native role')
  assert.equal(role.legalEmployer,employer)
  assert.equal(role.country,'India')
  assert.equal(role.sourceDetailComplete,true)
  assert.equal(jobs.length,6)
 })
}
for(const employer of ['', 'Another employer', 'Tudip Technologies Pvt. Ltd. - Other Employer']){
 test('Tudip withholds an inexact legal employer '+JSON.stringify(employer),async()=>{
  const packet=legalVariants[0].packet
  const{jobs}=await run({additionalDetails:[packet],change:(body,url)=>url===packet.url?body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,start,raw,end)=>{
   const value=JSON.parse(raw);if(value['@type']!=='JobPosting')return all;value.hiringOrganization.name=employer;return start+JSON.stringify(value)+end
  }):body})
  assert.equal(jobs.some(job=>job.sourceUrl===packet.url),false)
  assert.equal(jobs.length,5)
 })
}

for(const heading of ['Position Summary','Roles & Responsibilities']){
 test('Tudip visible criteria stop at a repeated '+heading+' section',()=>{
  const packet=legalVariants.find(row=>row.employer.endsWith('Ltd.')).packet
  const body=packet.body.replace(/(<h3[^>]*>Job Requirements\/Qualifications<\/h3>)/i,`<h3>${heading}</h3>$1`)
  const job={title:'IT Recruiter',company:'Tudip Technologies',source:'tudiptechnologies',sourceUrl:packet.url}
  const result=visiblePostingDescription(job,readNativeDocument(body),packet.url,{sameUrl:isExactPublicJobUrl})
  assert.ok(result)
  assert.doesNotMatch(result.description,/Job Requirements\/Qualifications/)
 })
}
