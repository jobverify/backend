import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseDetailPage,run } from './script.js'
import {readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-open-notices.json.gz', import.meta.url))))
const current = packets.find(row => row.requestUrl.endsWith('/SDSCRecruitment26.html'))

test('current native formatted table retains its open status and exact advertisement identity', () => {
  const detail = parseDetailPage(current.body, current.url)
  assert.equal(detail.status, 'Open')
  assert.equal(detail.isOpen, true)
  assert.equal(detail.advertisementNumber, 'SDSC SHAR/RMT/03/2026')
  assert.equal(detail.location, 'श्रीहरिकोटा / Sriharikota')
})

test('a native negated open status is never treated as open', () => {
  const detail = parseDetailPage('<table><tr><td><b>Status:</b></td><td>Not open</td></tr></table>')
  assert.equal(detail.isOpen, false)
})

test('inert status and advertisement rows cannot supply native identity', () => {
  const html = '<template><table><tr><td><b>Status:</b></td><td>Open</td></tr></table></template>'
  assert.equal(parseDetailPage(html).isOpen, false)
})

test('conflicting active native statuses fail closed', () => {
  const html = '<table><tr><td><b>Status:</b></td><td>Open</td></tr><tr><td><b>Status:</b></td><td>Closed</td></tr></table>'
  assert.equal(parseDetailPage(html).isOpen, false)
})

const navigation=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-navigation.json.gz',import.meta.url))))
test('ISRO caller cancellation before collection performs no public read',async()=>{
 const controller=new AbortController(),reason={cancel:'before'};controller.abort(reason);const calls=[]
 await assert.rejects(run({signal:controller.signal,fetchText:async url=>{calls.push(url);return navigation[0].body}}),error=>error===reason)
 assert.equal(calls.length,0)
})
test('ISRO cancellation inside an injected reader preserves the opaque reason and stops after that read',async()=>{
 const controller=new AbortController(),reason={cancel:'inside-read'},calls=[]
 await assert.rejects(run({signal:controller.signal,asOfDate:'2026-11-07',fetchText:async(url,options)=>{
  calls.push({url,signal:options?.signal});const packet=navigation.find(row=>row.requestUrl===url);assert.ok(packet,'unexpected native URL '+url)
  controller.abort(reason);return packet.body
 }}),error=>error===reason)
 assert.equal(calls.length,1)
 assert.equal(calls[0].signal,controller.signal)
})
test('ISRO current navigation returns three notices without certifying their missing full role criteria',async()=>{
 const jobs=await run({asOfDate:'2026-11-07',fetchText:async url=>{const packet=navigation.find(row=>row.requestUrl===url);assert.ok(packet,'unexpected native URL '+url);return packet.body}})
 assert.equal(jobs.length,3)
 assert.ok(jobs.every(job=>job.sourceDetailComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).status,'discovery-only')
})
