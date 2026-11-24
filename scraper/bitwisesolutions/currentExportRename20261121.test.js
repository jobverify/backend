import test from 'node:test'
import assert from 'node:assert/strict'
import {createBitwiseSolutionsScraper} from './script.js'
import {networkFences,originalPacket,replay} from './fixtures/currentReviewedReplay20261121.js'
test('coherent actual Flight and module export rename retains the same public consumer contract',async t=>{
 const restore=networkFences();t.after(restore);let edits=0
 const transport=replay(value=>{const changed=value.body.replaceAll('CareerListings','CurrentRoleListings');if(changed!==value.body)edits++;value.body=changed;return value})
 const jobs=await createBitwiseSolutionsScraper().run({fetchImpl:transport.fetchImpl,requestIntervalMs:0,now:()=>originalPacket.completedAt})
 assert.ok(edits>=4);assert.deepEqual(jobs.map(j=>j.jobId).sort(),['6061','6065','6085']);assert.equal(transport.calls.length,24)
})
