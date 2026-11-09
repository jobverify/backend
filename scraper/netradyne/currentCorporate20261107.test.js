import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_URL,buildGreenhouseJobsApiUrl} from './script.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const corporate=capture.packets.find(row=>row.requestUrl===CAREERS_URL).body
const payload=JSON.parse(capture.packets.find(row=>row.requestUrl===buildGreenhouseJobsApiUrl()).body)
const options=(html=corporate)=>({fetchText:async url=>{assert.equal(url,CAREERS_URL);return html},fetchJson:async url=>{assert.equal(url,buildGreenhouseJobsApiUrl());return structuredClone(payload)}})

test('Netradyne follows its current canonical careers redesign to the unchanged employer Greenhouse board',async()=>{
 const jobs=await run(options())
 assert.equal(jobs.length,29)
 assert.ok(jobs.every(job=>job.country==='India'&&job.jobDescription.length>1000))
 assert.equal(jobs.find(job=>job.jobId===4728633005).title,'Assistant Manager - Financial Reporting, Inventory and Intercompany Accounting')
})
test('Netradyne rejects another canonical employer page or changed embedded board',async()=>{
 for(const html of [corporate.replace('href="'+CAREERS_URL+'" rel="canonical"','href="https://other.example/careers" rel="canonical"'),corporate.replace('js?for=netradyne','js?for=other')]){
  assert.notEqual(html,corporate)
  await assert.rejects(run(options(html)),/careers|handoff|Greenhouse/i)
 }
})
