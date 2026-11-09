import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createGrouponScraper} from '../../scraper/groupon/script.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/groupon-current-native.json.gz',import.meta.url)))).currentPackets
const sha=b=>createHash('sha256').update(b).digest('hex')
function replay(change){const calls=[];return{calls,fetchResponse:async(url)=>{calls.push(url);const p=packets.find(p=>p.requestedURL===url);assert.ok(p,'No uncaptured route');const html=change?change(p):p.bodyText,bytes=Buffer.from(html);return{...p,bytes,html,bodySHA256:sha(bytes)}}}}
test('Groupon current site uses its own declared native API and preserves whole role models with unknown metadata',async()=>{const r=replay(),jobs=await createGrouponScraper().run(r);assert.equal(jobs.length,27);assert.equal(r.calls.length,70);assert.ok(r.calls.every(u=>!u.startsWith('https://boards-api.greenhouse.io/')));assert.equal(jobs[0].country,'Spain');assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].city,null);assert.equal(jobs[0].nativeCanonicalRoleURL,null);assert.equal(jobs[0].sourceDetailComplete,false);assert.ok(jobs.every(j=>j.nativeSourceRecord.detail.contentHtml===j.sourceDescription&&j.nativeRoleClosingReconciled&&!j.sourceScopeComplete&&!j.lifecycleCleanupAllowed&&!j.applicationVisited))})
test('Groupon a changed first-party identity prevents native and stale API reads',async()=>{const r=replay(p=>p.requestedURL==='https://careers.groupon.com/'?p.bodyText.replace('<title>Groupon Careers</title>','<title>Other Company Careers</title>'):p.bodyText);await assert.rejects(createGrouponScraper().run(r),/first-party careers identity/);assert.equal(r.calls.length,2)})
