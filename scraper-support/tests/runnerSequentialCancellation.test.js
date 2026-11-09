import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const fixture=fileURLToPath(new URL('./fixtures/runnerSequentialCancellation.js',import.meta.url))
for(const phase of ['enrichment','scrape'])test('Sequential stop during '+phase+' keeps unfinished source pending and resumes it',()=>{
 const child=spawnSync(process.execPath,[fixture,phase],{encoding:'utf8',timeout:15000})
 assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr)
 const result=JSON.parse(child.stdout)
 assert.equal(result.interrupted.status,'interrupted')
 assert.equal(result.interrupted.completedCount,0)
 assert.equal(result.interrupted.remainingCount,2)
 assert.deepEqual(result.interruptedSummary,{})
 assert.deepEqual(result.started,['first','first','queued'])
 assert.deepEqual(result.snapshots,['first.json','queued.json'])
 assert.equal(result.resumed.status,'complete')
 assert.equal(result.resumed.completedCount,2)
})
