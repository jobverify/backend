import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const read=url=>{const row=packet.requests.find(row=>row.url===url);assert.ok(row,'Unrecorded '+url);return row.body}
import {JOBS_API_URL,mapNativeUhpJob} from './script.js'
const payload=JSON.parse(read(JOBS_API_URL)),base={...payload.data.find(j=>j.title==='Technical Recruiter'),locations:null},statement='<p>Candidate must stay at customer location anywhere in India.</p>'
test('controlled unqualified paragraph/heading context cannot become unconditional worksite country',()=>{for(const prefix of ['<p>If necessary:</p>','<h3>When required:</h3>','<p>Depending on project requirements:</p>','<p>Optional worksite assignment:</p>','<h3>Conditional residence:</h3>','<p>Travel:</p>']){const job=mapNativeUhpJob({...base,description:prefix+statement},null);assert.equal(job.location,null,prefix);assert.equal(job.country,null,prefix)}})
test('hidden or commented conditional labels do not change the active mandatory statement',()=>{for(const prefix of ['<p hidden>If necessary:</p>','<!--<p>If necessary:</p>-->']){const job=mapNativeUhpJob({...base,description:prefix+statement},null);assert.equal(job.location,'India');assert.equal(job.country,'India');assert.equal(job.city,null)}})
test('an unproved heading reset cannot erase an earlier conditional residence qualifier',()=>{const job=mapNativeUhpJob({...base,description:'<p>If necessary:</p>'+statement+'<h3>Job Description</h3>'+statement},null);assert.equal(job.location,null);assert.equal(job.country,null)})
