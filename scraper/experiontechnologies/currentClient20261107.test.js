import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runNativeExperion} from './nativeRun.js'
import {HOME,CAREERS,CLIENT,verifyExperionInventory} from './nativeContract.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const page=url=>{const row=capture.packets.find(row=>row.requestUrl===url);assert.ok(row,'Only retained first-party URLs: '+url);return row}
test('Experion current declared pagination client retains all26 native roles, full criteria and closing snapshot',async()=>{
 const jobs=await runNativeExperion({fetchImpl:async url=>{const row=page(url);const response=new Response(row.body,{status:row.status});Object.defineProperty(response,'url',{value:row.url});return response},now:'2026-11-07T23:00:00Z'})
 assert.equal(jobs.length,26)
 const lead=jobs.find(job=>job.jobId==='test-lead')
 assert.equal(lead.country,'India');assert.equal(lead.sourceDetailComplete,true)
 assert.ok(lead.jobDescription.includes('ISMS'))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,26)
})
test('Experion does not accept added executable pagination code in the current native client',()=>{
 assert.throws(()=>verifyExperionInventory(page(HOME).body,page(CAREERS).body,page(CLIENT).body+'\nfetch("/other-jobs")'),/client contract changed/)
})
