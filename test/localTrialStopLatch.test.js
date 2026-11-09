import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { classifyTrialSnapshots } from '../scripts/classifyTrialSnapshots.js'

function stoppedFixture(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'trial-stop-latch-'))
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}))
  fs.writeFileSync(path.join(directory,'resource-stop.json'),'{"status":"stopped_resource_limit"}')
  fs.writeFileSync(path.join(directory,'trial-pipeline.json'),'{"stage":"stopped_resource_limit","pid":123}')
  return directory
}

test('stopped trial refuses to start inference before reading or changing the capture', async t => {
  const directory=stoppedFixture(t)
  await assert.rejects(classifyTrialSnapshots(directory),/resource limit.*resume approval/i)
  assert.deepEqual(fs.readdirSync(directory).sort(),['resource-stop.json','trial-pipeline.json'])
})

test('launcher preserves the stopped state instead of restarting scrapers', t => {
  const directory=stoppedFixture(t)
  const prior=fs.readFileSync(path.join(directory,'trial-pipeline.json'),'utf8')
  const result=spawnSync(process.execPath,['scripts/runPostScrapeTrial.js',directory,'all','10'],{encoding:'utf8',timeout:10000})
  assert.equal(result.status,1)
  assert.match(result.stderr,/resource limit.*resume approval/i)
  assert.equal(fs.readFileSync(path.join(directory,'trial-pipeline.json'),'utf8'),prior)
  assert.deepEqual(fs.readdirSync(directory).sort(),['resource-stop.json','trial-pipeline.json'])
})

test('classification-only retry refuses an incomplete capture without starting scrapers or a model', t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'trial-incomplete-retry-'))
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}))
  const capture={status:'running',completedCount:1,totalSources:2,catalogSources:['one','two']}
  fs.writeFileSync(path.join(directory,'run-state.json'),JSON.stringify(capture))
  const result=spawnSync(process.execPath,['scripts/runPostScrapeTrial.js',directory,'all','10','--classify-only'],{encoding:'utf8',timeout:10000})
  assert.equal(result.status,1)
  assert.match(result.stderr,/Scraping is incomplete; classification has not started/)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'run-state.json'),'utf8')),capture)
  assert.deepEqual(fs.readdirSync(directory).sort(),['run-state.json','trial-pipeline.json'])
  const pipeline=JSON.parse(fs.readFileSync(path.join(directory,'trial-pipeline.json'),'utf8'))
  assert.equal(pipeline.stage,'failed')
  assert.doesNotMatch(result.stdout,/"stage":"(?:scraping|classification)"/)
})

test('a stop journal arriving during inference prevents the next job and closes the worker', async t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'trial-live-stop-'))
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}))
  fs.mkdirSync(path.join(directory,'snapshots'))
  fs.writeFileSync(path.join(directory,'run-state.json'),JSON.stringify({status:'complete',completedCount:1,totalSources:1,catalogSources:['fixture']}))
  fs.writeFileSync(path.join(directory,'snapshots','fixture.json'),JSON.stringify(['one','two'].map(jobId=>({jobId,title:'Engineer',sourceDescription:'Minimum 3 years of professional experience required.'}))))
  let inferred=0,closed=false
  const summary=await classifyTrialSnapshots(directory,{workerFactory:async()=>({
    async classify(){
      inferred++
      fs.writeFileSync(path.join(directory,'resource-stop.json'),'{"status":"stopped_resource_limit"}')
      return {modelLabel:'Full-time Experienced',scores:{'Full-time Experienced':.95,'Full-time Fresher':.01,Intern:.02,Contract:.02},
        fullDescriptionCovered:true,windows:1,seconds:1,cpuSeconds:.9,peakRssBytes:1024}
    },
    async stop(){closed=true},
  })})
  assert.equal(summary.total,2)
  assert.equal(summary.completed,1)
  assert.equal(summary.stoppedForResourceLimit,true)
  assert.equal(inferred,1)
  assert.equal(closed,true)
  assert.equal(fs.readdirSync(path.join(directory,'classifications')).filter(name=>name.endsWith('.json')).length,1)
})
