import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import { parseCompany, parseListing, parseRole } from './native.js'
const raw = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/listing-response-body.json.gz', import.meta.url))))
const filters = JSON.parse(fs.readFileSync(new URL('./fixtures/filters-response-body.json', import.meta.url))).message
const configs = JSON.parse(fs.readFileSync(new URL('./fixtures/native-config-responses.json', import.meta.url)))

test('actual native Tata Unistore config identifies tenant and first page has ten unique jobs of25',()=>{
 assert.equal(parseCompany(JSON.parse(configs[0].body)).total,25)
 const page=parseListing(raw,25);assert.equal(page.length,10);assert.equal(page[0].id,'a6ad9a97842998')
 assert.throws(()=>parseCompany({message:{company:{company_name:'Tata Digital',subdomain:'cliqonnect',tenant_id:'310',allJobsCount:25}},status:'success'}))
 assert.throws(()=>parseListing({...raw,job_counts:26},25))
})
test('native list JD produces active source content and explicit India without turning current republishing into original date',()=>{
 const job=parseRole(raw.data[0],filters.location)
 assert.equal(job.title,'Category Intern - Lifestyle');assert.equal(job.country,'India');assert.equal(job.city,'Mumbai')
 assert.ok(job.jobDescription.includes('Vendor coordination'));assert.ok(job.jobDescription.length>600)
 assert.equal(job.postingDate,'2026-10-21T18:30:00.000Z');assert.equal(job.originalPublicationDate,null);assert.equal(job.requisitionId,'Job-549')
 assert.equal(job.applyUrl,'https://cliqonnect.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6ad9a97842998')
})
test('city-only unknown or foreign and contradictory secondary locations never acquire India eligibility',()=>{
 for(const patch of [{country:'',officelocations_without_area:['Mumbai'],officelocation_arr:[],officelocations_area:['Mumbai'],locations:'Mumbai',tool_tip_locations:['Mumbai']},{country:'Canada'},{nativeCountryHints:['Canada']},{officelocations_without_area:['Toronto, Ontario, Canada']},{officelocations_without_area:['Mumbai, California, India']},{officelocations_without_area:['Mumbai, Pennsylvania, India']}])assert.equal(parseRole({...raw.data[0],...patch},filters.location).country,null)
})
test('hidden inert scripts headings and title-only descriptions retain eligible India role with missing detail',()=>{
 for(const jd of ['', '<div hidden>Real long responsibilities for engineering and managing successful business operations in India across several internal teams.</div>','<div inert>Real long responsibilities for engineering and managing successful business operations in India across several internal teams.</div>','<div style="content-visibility:hidden">Real long responsibilities for engineering and managing successful business operations in India across several internal teams.</div>','<script>Real long responsibilities for engineering and managing successful business operations in India across several internal teams.</script>','<h2>Job Description</h2>',raw.data[0].title]){
 const job=parseRole({...raw.data[0],jd},filters.location);assert.equal(job.country,'India');assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailComplete,false)
 }
})

test('all location representations reject foreign tokens abbreviations unreviewed fields and unmapped city-only secondary labels',()=>{
 for(const patch of [{secondary_country:'Canada'},{secondaryCountry:'Canada'},{secondaryLocations:[{country:'Canada'}]},{officelocations_area:['Toronto']},{officelocations_area:['Toronto, Canada, India']},{officelocations_area:['Bengaluru, CA, India']},{country:'Canada, India'}]){
 const job=parseRole({...raw.data[0],...patch},filters.location);assert.equal(job.country,null,JSON.stringify(patch));assert.equal(job.nativeLocationScopeComplete,false)
 }
})

test('long heading and bold labels alone never impersonate substantive active role prose',()=>{
 for(const jd of ['<h2>Responsibilities and required qualifications for '+raw.data[0].title+'</h2><strong>Responsibilities Qualifications Experience Skills Education Location Compensation Benefits Application Information</strong>', '<strong>Responsibilities</strong><h2>Qualifications Experience and Required Skills</h2><b>Education Location Compensation Benefits Application Information</b>']){
 const job=parseRole({...raw.data[0],jd},filters.location);assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailComplete,false)
 }
})

test('native current publication windows reject contradictions and suppress scheduled or closed roles without replacing publication age',()=>{
 const now='2026-10-23T00:00:00.000Z'
 assert.throws(()=>parseRole({...raw.data[0],job_posting:{careers:{from:1792607400,to:1792607399}}},filters.location,{now}),/window/i)
 for(const careers of [{from:1792607400,to:1792713600},{from:1792800000,to:1795372199}])assert.equal(parseRole({...raw.data[0],job_posting:{careers}},filters.location,{now}).nativeWindowEligible,false)
 const current=parseRole(raw.data[0],filters.location,{now});assert.equal(current.nativeWindowEligible,true);assert.equal(current.postingDate,'2026-10-21T18:30:00.000Z')
})


