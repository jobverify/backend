// Executable unfinished proof, kept separate from prerequisite guard checks.
// Run explicitly with node --test scraper/baseten/fullSourceProof.pending.js.
// It MUST remain red until actual missing publisher programs/styles are
// retained, semantically reviewed, and a prospective closed live cohort passes.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
test('UNFINISHED: actual retained complete104 native cohort has fully proven current employer hiring scope',async()=>{
 const {responses}=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261030.json.gz',import.meta.url)))),original=globalThis.fetch
 globalThis.fetch=async url=>{const record=responses[String(url)];assert.ok(record,'Actual response absent: '+url);const response=new Response(Buffer.from(record.bodyBase64,'base64'),{status:record.status,headers:{'content-type':record.contentType}});Object.defineProperty(response,'url',{value:record.finalUrl});return response}
 try{const jobs=await run(),evidence=readInventoryEvidence(jobs);assert.equal(jobs.length,0);assert.equal(evidence.reportedTotal,104);assert.equal(evidence.listingComplete,true);assert.equal(evidence.indiaFacetCount,0);assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed,true)}finally{globalThis.fetch=original}
})
