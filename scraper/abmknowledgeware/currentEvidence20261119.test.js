import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import manifest from './test-data/manifest-current-20261119.js'
import {run,hasOfficialHomepageSignal,hasOfficialCareersSignal} from './script.js'

const hash=value=>createHash('sha256').update(value).digest('hex')
const zipped=fs.readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))
assert.equal(hash(zipped),manifest.fixtureSha256)
const rows=JSON.parse(gunzipSync(zipped))
for(const row of rows)assert.equal(hash(row.html),row.sha256)
const home='https://www.abmindia.com/',careers='https://abmindia.com/home/abm_career'
const page=url=>{const row=rows.findLast(row=>row.requestedUrl===url);assert.ok(row,'Unexpected read '+url);return row}

test('ABM current identical Vite shells cannot certify a hiring inventory',async()=>{
 assert.equal(page(home).html,page(careers).html)
 assert.equal(hasOfficialHomepageSignal(page(home).html),false)
 assert.equal(hasOfficialCareersSignal(page(careers).html),false)
 const reads=[]
 await assert.rejects(run({fetchPage:async url=>{reads.push(url);const row=page(url);return {status:row.status,url:row.finalUrl,html:row.html}}}),/official homepage recruiting authority changed/)
 assert.deepEqual(reads,[home])
})

test('ABM current sole declared client provides a general candidate profile rather than role criteria',()=>{
 const shell=page(home).html,client=page(home+'assets/index-778ed5e4.js').html
 assert.match(shell,/<script[^>]+src="\.\/assets\/index-778ed5e4\.js"/)
 assert.ok(client.includes('Submit Your Career Profile'))
 assert.ok(client.includes('Fill in your candidate details and attach your resume below'))
 assert.ok(client.includes('append("job_title","Candidate Application")'))
 // The application endpoint is retained as evidence, and is never called.
 assert.ok(client.includes('index.php/admin_api/submit_job_application'))
 assert.deepEqual(new Set(rows.map(row=>row.method)),new Set(['GET']))
})
