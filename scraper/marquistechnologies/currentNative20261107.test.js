import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createMarquisTechnologiesScraper,HOMEPAGE_URL,CAREERS_URL} from './script.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const roles=capture.packets.filter(r=>r.requestUrl.includes('/openings/'))
// Three genuine original role responses; the reduced listing is an explicit
// synthetic control, not evidence that the complete live board has three jobs.
const board='<h1>Jobs</h1><a href="https://www.marquistech.com/apply-for-job/">Apply for Job</a>'+roles.map(r=>'<a href="'+r.requestUrl+'">Role</a>').join('')
const options=(change=(_url,body)=>body)=>({fetchText:async url=>url===CAREERS_URL?board:change(url,capture.packets.find(r=>r.requestUrl===url)?.body??assert.fail('Only recorded native URL: '+url))})
test('Marquis preserves full current native criteria including the new About the Role section',async()=>{
 const jobs=await createMarquisTechnologiesScraper().run(options());assert.equal(jobs.length,3)
 const role=jobs.find(j=>j.sourceUrl.includes('business-development-executive-noida'))
 assert.ok(role.jobDescription.includes('EMI/EMC'));assert.ok(role.jobDescription.includes('Key Responsibilities'));assert.ok(role.jobDescription.length>2500)
 assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.country==='India'&&j.lifecycleCleanupAllowed===false))
})
test('Marquis rejects a different structured native employer rather than accepting summary copy',async()=>{
 await assert.rejects(createMarquisTechnologiesScraper().run(options((url,body)=>url===HOMEPAGE_URL?body:body.replaceAll('Marquistech Pvt. Ltd.','Other employer'))),/native|employer|identity/i)
})
