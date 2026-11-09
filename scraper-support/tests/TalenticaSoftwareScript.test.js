import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from '../../scraper/talenticasoftware/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/talentica-native-quality.json.gz',import.meta.url))))
test('Talentica helpers bind the current active first-party grid and original native identities',()=>{
 assert.equal(source.SOURCE,'talenticasoftware');assert.equal(source.COMPANY,'Talentica Software')
 assert.equal(source.CAREERS_URL,'https://www.talentica.com/job-openings/')
 assert.equal(source.hasOfficialCareersSignal(fixture.packets[0].bodyText),true)
 assert.equal(source.hasOfficialCareersSignal('<title>Talentica</title>'),false)
 const cards=source.extractJobCards(fixture.packets[0].bodyText)
 assert.equal(cards.length,13);assert.equal(cards[0].sourceUrl,fixture.packets[1].requestedURL)
 assert.equal(cards[0].experience,'1+ year');assert.equal(cards[0].location,null)
})
test('Talentica legacy body injection reads paired own criteria while leaving HTTP metadata unverified',async()=>{
 const calls=[],jobs=await source.run({minIntervalMs:0,fetchText:async url=>{calls.push(url);const q=fixture.packets.find(q=>q.requestedURL===url);assert.ok(q);return q.bodyText}})
 assert.equal(calls.length,28);assert.equal(jobs.length,13);assert.ok(jobs.every(j=>j.country===null&&j.jobDescription.length>1000))
 assert.ok(jobs[0].sourceNativeCollectionAudit.responses.every(q=>q.httpMetadataVerified===false))
})
test('Talentica changed first-party page stops without detail probes or empty success',async()=>{
 let calls=0
 await assert.rejects(source.run({fetchText:async()=>{calls++;return '<html><body><h1>Unexpected</h1></body></html>'},minIntervalMs:0}),/Talentica native/)
 assert.equal(calls,1)
})
test('Talentica injected deadline failure propagates after one read',async()=>{
 let calls=0;const reason=Error('Talentica timeout')
 await assert.rejects(source.run({fetchText:async()=>{calls++;throw reason},minIntervalMs:0}),error=>error===reason)
 assert.equal(calls,1)
})
