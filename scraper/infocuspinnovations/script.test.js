import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {extractServerRenderedJobs,hasVerifiedCareersPageSignal} from './script.js'
const html=fs.readFileSync(new URL('./fixtures/current-openings.html',import.meta.url),'utf8')
test('InfoCusp extracts all current first-party cards with role-specific verified Zoho applications',()=>{
 assert.equal(hasVerifiedCareersPageSignal(html),true)
 const jobs=extractServerRenderedJobs(html)
 assert.deepEqual(jobs.map(j=>j.jobId),['218338000000871005','218338000000920021','218338000000989044','218338000000871020','218338000001027012'])
 assert.equal(jobs[1].title,'Senior Backend Engineer')
 assert.equal(jobs[1].country,'India')
 assert.match(jobs[1].applyUrl,/^https:\/\/infocusp\.zohorecruit\.in\/jobs\/Careers\/218338000000920021\//)
 assert.match(jobs[1].jobDescription,/Requirements/)
 assert.ok(jobs.every(j=>j.jobDescription.length>100))
})
test('InfoCusp rejects foreign employer links and unmatched job identities',()=>{
 assert.throws(()=>extractServerRenderedJobs(html.replaceAll('infocusp.zohorecruit.in','example.com')),/verified|identity|application/i)
 assert.throws(()=>extractServerRenderedJobs(html.replace('job-details-218338000000871005','job-details-999999')),/verified|identity|application/i)
})
