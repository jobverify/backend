import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {hasOfficialJobsPageShellSignal,CAREERS_URL,JOBS_API_URL,buildJobDetailsApiUrl} from '../../scraper/makemytrip/script.js'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/ats-followup-20261107/makemytrip.json.gz',import.meta.url))))
const current=packets[0].body

test('MakeMyTrip recognizes equivalent quoted and unquoted attributes in the genuine current first-party shell',()=>{
 assert.equal(hasOfficialJobsPageShellSignal(current),true)
 assert.equal(hasOfficialJobsPageShellSignal(current.replace(/\b(src|href|id|rel)=([^\s\"'=<>]+)/g,'$1="$2"')),true)
})
for(const[name,mutate]of[
 ['inert shell',body=>'<template>'+body+'</template>'],
 ['hidden root',body=>body.replace('id=root','id=root hidden')],
 ['foreign client',body=>body.replace('src=/bundle.js','src=https://foreign.example/bundle.js')],
 ['foreign analytics',body=>body.replace('https://imgak.mmtcdn.com/','https://foreign.example/')],
 ['duplicate bundle',body=>body.replace('</body>','<script src=/bundle.js></script></body>')],
 ['non-executable native bundle',body=>body.replace('defer src=/bundle.js','defer type=application/json src=/bundle.js')],
 ['inert nomodule native bundle',body=>body.replace('defer src=/bundle.js','defer nomodule src=/bundle.js')],
 ['unreviewed inline client',body=>body.replace('</body>','<script>window.otherJobs="/new-jobs"</script></body>')],
 ['hidden additional executable',body=>body.replace('</body>','<div hidden><script src=/unknown.js></script></div></body>')],
 ['duplicate root',body=>body.replace('</body>','<div id=root></div></body>')],
 ['conflicting title',body=>body.replace('</head>','<title>Other Employer</title></head>')],
])test('MakeMyTrip rejects '+name+' instead of advancing to public API',()=>assert.equal(hasOfficialJobsPageShellSignal(mutate(current)),false))

test('registered MakeMyTrip accepts the current shell while retaining country, public-status and full description projection',async()=>{
 // Explicit protocol control using the captured current shell; never a live-vacancy claim.
 const india={job_id:'control-india',job_code:'CONTROL_IN',job_title:'Control Engineer',location_country:'India',location:['Pune, India'],location_city:['Pune'],post_on_careers_page:1,group_company:'MakeMyTrip (India) Limited'}
 const payload={allJobs:[india,{...india,job_id:'control-foreign',location_country:'United States'},{...india,job_id:'control-private',post_on_careers_page:0}]}
 const requests=[]
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='makemytrip')).run({fetchText:async url=>{assert.equal(url,CAREERS_URL);return current},fetchJson:async url=>{requests.push(url);if(url===JOBS_API_URL)return payload;assert.equal(url,buildJobDetailsApiUrl(india.job_id));return{status:1,data:{...india,job_status:'OPEN',job_decription:'<h2>Responsibilities</h2><p>Deliver production systems and investigate technical incidents.</p><h2>Qualifications</h2><p>Computer science degree and 4 years of relevant work experience.</p>'}}}})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'control-india')
 assert.equal(jobs[0].country,'India')
 assert.match(jobs[0].jobDescription,/Computer science degree and 4 years/)
 assert.deepEqual(requests,[JOBS_API_URL,buildJobDetailsApiUrl(india.job_id)])
})
