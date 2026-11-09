import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as mmc from '../../scraper/mmcinfotechservices/script.js'
const q=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/mmc-native-quality.json.gz',import.meta.url)))).packet
test('MMC public script observes current native panels with true source and unknown posting/work-country fields',async()=>{
 assert.equal(mmc.hasOfficialCareersSignal(q.bodyText),true)
 const calls=[],jobs=await mmc.run({now:()=> '2026-11-05T19:30:00.000Z',fetchImpl:async url=>{
  calls.push(url);const r=new Response(q.bodyText,{headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r
 }})
 assert.deepEqual(jobs.map(j=>j.title),['Voice Operations','Customer Support','Data Entry','Backend Process'])
 assert.deepEqual(calls,[mmc.CAREERS_URL])
 for(const j of jobs){assert.equal(j.sourceUrl,mmc.CAREERS_URL);assert.equal(j.country,null);assert.equal(j.jobId,null);assert.equal(j.requisitionId,null)
  assert.equal(j.sourceDetailComplete,false);assert.equal(j.scrapedAt,'2026-11-05T19:30:00.000Z');assert.ok(j.nativeSourceRecord.panel)}
})
test('MMC public script fails when current publisher/inline roles are absent',async()=>{
 const html='<html><head><title>Unrelated company</title></head><body>Careers</body></html>'
 assert.equal(mmc.hasOfficialCareersSignal(html),false)
 await assert.rejects(mmc.run({fetchImpl:async()=>{const r=new Response(html,{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:mmc.CAREERS_URL});return r}}),/publisher|native|identity/i)
})
