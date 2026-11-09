import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { run as runTruecaller } from '../../scraper/truecallerindia/script.js'
import { run as runVakilsearch } from '../../scraper/vakilsearch/script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = path.join(import.meta.dirname, 'fixtures/declared-native-20261107/additional-captures')
const load = file => JSON.parse(gunzipSync(fs.readFileSync(file)))
const recorded = new Map(fs.readdirSync(directory).filter(file => file.endsWith('.json.gz')).map(file => {
  const packet = load(path.join(directory, file))
  return [packet.requestUrl, packet]
}))
for (const source of ['truecallerindia', 'vakilsearch']) for (const packet of load(path.join(import.meta.dirname, 'fixtures/declared-native-20261107/native-root/current', source, 'packets.json.gz'))) recorded.set(packet.requestUrl, packet)
const jobsPage = load(path.join(import.meta.dirname, 'fixtures/declared-native-20261107/native-root/discovery/truecaller-jobs.json.gz'))
recorded.set(jobsPage.requestUrl, jobsPage)
globalThis.fetch = async () => { throw Error('Regression replay prohibits live network') }

const replay = (change = (url, packet) => packet) => {
  const requests = [], counts = new Map()
  const fetchImpl = async (url, init = {}) => {
    assert.equal(init.method ?? 'GET', 'GET')
    assert.equal(init.redirect, 'manual')
    assert.ok(recorded.has(String(url)), 'Only an original declared native URL may be requested: ' + url)
    requests.push(String(url)); counts.set(String(url), (counts.get(String(url)) || 0) + 1)
    const packet = change(String(url), structuredClone(recorded.get(String(url))), counts.get(String(url)))
    const response = new Response(packet.body, { status: packet.status, headers: packet.headers || { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: packet.url })
    return response
  }
  // fetchHtml is the old JSON-LD reader's injection, allowing the regression to
  // fail as a missing-current-inventory assertion without making live requests.
  return { requests, options: { fetchImpl, fetchHtml: async url => recorded.get(url).body, requestIntervalMs: 0, now: () => '2026-11-07T13:20:00.000Z' } }
}


test('Truecaller holds conditional Sweden transfer worksite records', async () => {
  const r=replay(),jobs=await runTruecaller(r.options)
  assert.equal(jobs.some(j=>['8336111','8275890'].includes(j.jobId)),false)
  assert.ok(jobs.length>=15)
  assert.ok(jobs.some(j=>j.jobId==='7540751'),'Transferable AWS skills are not a foreign worksite transfer')
})
test('Vakilsearch holds native Country mismatch while retaining other qualified roles', async () => {
  const r=replay((url,packet)=>{
    if(url.endsWith('/accounting-and-taxation-expert')){
      const prior=packet.body
      packet.body=packet.body.replace('Location:</strong> Chennai','Location:</strong> Chennai</li><li><strong>Country:</strong> Singapore')
      assert.notEqual(packet.body,prior,'Recorded native country-carrier mutation must apply')
    }
    return packet
  }),jobs=await runVakilsearch(r.options)
  assert.ok(jobs.length>0)
  assert.equal(jobs.some(j=>j.sourceUrl.endsWith('/accounting-and-taxation-expert')),false)
})
test('changed Truecaller current client contract is held before native inventory reads', async () => {
  const r=replay((url,packet)=>{if(url.endsWith('/DBRC6CPw.js'))packet.body+='\n// changed native client';return packet})
  await assert.rejects(runTruecaller(r.options),/reviewed native route\/client contract changed/)
  assert.equal(r.requests.some(url=>url.includes('greenhouse.io')),false)
})
test('current declared native source stops on the first public access denial', async () => {
  const r=replay((url,packet)=>({...packet,status:403}))
  await assert.rejects(runTruecaller(r.options),/HTTP 403/)
  assert.equal(r.requests.length,1)
})
test('Vakilsearch holds a new remote or foreign own worksite without using the registered office as its country', async () => {
  const r=replay((url,packet)=>{if(url.endsWith('/accounting-and-taxation-expert'))packet.body=packet.body.replace('Location:</strong> Chennai','Location:</strong> Singapore / Remote');return packet})
  const jobs=await runVakilsearch(r.options)
  assert.ok(jobs.length>0)
  assert.equal(jobs.some(j=>j.sourceUrl.endsWith('/accounting-and-taxation-expert')),false)
})

test('Truecaller does not return a current source when a closing own native description conflicts with the listing', async () => {
  const r=replay((url,packet,visit)=>{
    if(url.endsWith('/truecaller/jobs/8280698')&&visit===2){const data=JSON.parse(packet.body);data.content+='&lt;p&gt;Changed closing criteria&lt;/p&gt;';packet.body=JSON.stringify(data)}
    return packet
  })
  await assert.rejects(runTruecaller(r.options),/native list\/own criteria or geography disagree/)
})

test('Vakilsearch holds an active paragraph country contradiction in own job specifications', async () => {
  let changed = 0
  const r = replay((url, packet) => {
    if (url.endsWith('/accounting-and-taxation-expert')) {
      const prior = packet.body
      packet.body = packet.body.replace('Job Specifications</h3>', 'Job Specifications</h3><p><strong>Country:</strong> Singapore</p>')
      assert.notEqual(packet.body, prior)
      changed++
    }
    return packet
  }), jobs = await runVakilsearch(r.options)
  assert.ok(changed > 0)
  assert.ok(jobs.length > 0)
  assert.equal(jobs.some(job => job.sourceUrl.endsWith('/accounting-and-taxation-expert')), false)
})

for (const punctuation of ['.', '']) test(`Truecaller holds mandatory foreign relocation ${punctuation ? 'with' : 'without'} terminal punctuation`, async () => {
  let changed = 0
  const r = replay((url, packet) => {
    if (url.endsWith('/jobs?content=true') || url.endsWith('/jobs/8280698')) {
      const data = JSON.parse(packet.body)
      const job = Array.isArray(data.jobs) ? data.jobs.find(job => job.id === 8280698) : data
      assert.equal(job.id, 8280698)
      job.content += '&lt;p&gt;This role requires relocation to Stockholm, Sweden' + punctuation + '&lt;/p&gt;'
      packet.body = JSON.stringify(data)
      changed++
    }
    return packet
  }), jobs = await runTruecaller(r.options)
  assert.ok(changed >= 2)
  assert.ok(jobs.length > 0)
  assert.equal(jobs.some(job => job.jobId === '8280698'), false)
  assert.ok(jobs.some(job => job.jobId === '7540751'))
})
