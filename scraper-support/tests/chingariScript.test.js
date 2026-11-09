import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as chingari from '../../scraper/chingari/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261107/chingari-original-packets.json.gz',import.meta.url))))
const posts=JSON.parse(packets[2].body),categories=JSON.parse(packets[1].body),first=posts[0]
test('Chingari exposes the expected WordPress API endpoints and validates the native careers surface',()=>{
 assert.equal(chingari.CAREERS_PAGE_URL,packets[0].url)
 assert.equal(chingari.CAREERS_CATEGORY_API_URL,packets[1].url)
 assert.equal(chingari.CAREERS_POSTS_API_URL,packets[2].url)
 assert.equal(chingari.hasOfficialCareersSignal(packets[0].body),true)
 assert.equal(chingari.hasOfficialCareersSignal('<script>https://careers.chingari.io/career/ wp-json</script>'),false)
})
test('extractCareerPosts maps native WordPress role fields without inventing country, requisition or vacancy date',()=>{
 const jobs=chingari.extractCareerPosts([first],{categoryMap:new Map(categories.map(c=>[c.id,c.name])),detailPages:new Map([[first.link,packets[3].body]])})
 assert.equal(jobs.length,1);const job=jobs[0]
 assert.equal(job.title,'Senior Software Engineer – Android');assert.equal(job.company,'Chingari');assert.equal(job.department,'Engineering')
 assert.equal(job.location,'Bangalore');assert.equal(job.city,'Bangalore');assert.equal(job.country,null);assert.equal(job.jobId,'838');assert.equal(job.requisitionId,null);assert.equal(job.postingDate,null)
 assert.equal(job.sourceUrl,first.link);assert.equal(job.applyUrl,first.link+'#wpcf7-f593-p838-o1');assert.match(job.jobDescription,/Your Experience Across The Years/)
 assert.deepEqual(job.nativeSourceRecord,first);assert.equal(job.sourceDetailComplete,false)
})
test('run hydrates the first native role and returns retained partial evidence at its unknown country',async()=>{
 const requests=[];const jobs=await chingari.createChingariScraper().run({fetchText:async url=>{requests.push(url);return packets.find(p=>p.url===url).body},fetchJson:async url=>{requests.push(url);return JSON.parse(packets.find(p=>p.url===url).body)}})
 assert.deepEqual(requests,packets.slice(0,4).map(p=>p.url));assert.equal(jobs.length,1);assert.equal(jobs[0].source,'chingari');assert.equal(jobs[0].link,jobs[0].applyUrl);assert.ok(Number.isFinite(Date.parse(jobs[0].scrapedAt)))
 assert.equal(readInventoryEvidence(jobs).status,'discovery-only');assert.equal(jobs.nativeCollectionEvidence.reason,'native-role-country-unverified');assert.equal(jobs.nativeCollectionEvidence.retainedNativeResponses.length,4)
})
