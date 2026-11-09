import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { trialCorpus, classifyTrialSnapshots } from '../scripts/classifyTrialSnapshots.js'
import { writeTrialCorpus } from '../scripts/trialCorpusArchive.js'
import { GLICLASS_IDENTITY } from '../src/services/postScrapeClassification.js'

function fixture(t, jobs, complete = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-corpus-'))
  assert.equal(path.dirname(directory), os.tmpdir())
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  fs.mkdirSync(path.join(directory, 'snapshots'))
  fs.writeFileSync(path.join(directory, 'run-state.json'), JSON.stringify({
    status: complete ? 'complete' : 'running', completedCount: complete ? 1 : 0,
    totalSources: 1, catalogSources: ['company'],
  }))
  fs.writeFileSync(path.join(directory, 'snapshots/company.json'), JSON.stringify(jobs))
  return directory
}

test('classification retains different vacancies sharing a careers URL and deduplicates identical listings', t => {
  const common = { sourceUrl: 'https://example.com/careers', company: 'Example', sourceDescription: 'Software development position.' }
  const engineer = { ...common, title: 'Engineer', location: 'Bengaluru, India' }
  const directory = fixture(t, [engineer, engineer,
    { ...common, title: 'Analyst', location: 'Bengaluru, India' },
    { ...common, title: 'Manager', jobId: '17', location: 'Delhi, India' },
    { ...common, title: 'Manager', jobId: '17', location: 'Pune, India' },
  ])
  const corpus = trialCorpus(directory)
  assert.equal(corpus.length, 4)
  assert.equal(new Set(corpus.map(job => job.trialId)).size, 4)
  assert.equal(corpus.filter(job => job.title === 'Manager').length, 2)
})

test('classification cannot read snapshots until every source has finished', t => {
  const directory = fixture(t, [{ title: 'Engineer', sourceDescription: 'Full-time job.' }], false)
  assert.throws(() => trialCorpus(directory), /Scraping must finish/)
})

test('vacancies without employer IDs retain different requirements even when their title and URL match', t => {
  const common = { title: 'Engineer', location: 'Bengaluru, India', sourceUrl: 'https://example.com/careers' }
  const directory = fixture(t, [
    { ...common, sourceDescription: '3 years of professional experience required.' },
    { ...common, sourceDescription: 'No prior experience required. Fresh graduates welcome.' },
  ])
  assert.equal(trialCorpus(directory).length, 2)
})

function frozenFixture(t) {
  const directory=fixture(t,[{title:'Engineer',sourceDescription:'Minimum 3 years of professional experience required.'}])
  const jobs=trialCorpus(directory)
  writeTrialCorpus(directory,jobs,GLICLASS_IDENTITY)
  fs.writeFileSync(path.join(directory,'review-source-packet.json'),JSON.stringify({jobs:[]}))
  return directory
}

const fixturePrediction={modelLabel:'Full-time Experienced',fullDescriptionCovered:true,windows:1,
  scores:{'Full-time Experienced':.97,'Full-time Fresher':.01,Intern:.01,Contract:.01},
  seconds:1,cpuSeconds:.9,peakRssBytes:1024}

test('classification-only retry uses the frozen corpus even when a snapshot was subsequently edited',async t=>{
  const directory=frozenFixture(t)
  const before=fs.readFileSync(path.join(directory,'corpus.jsonl'))
  const manifest=fs.readFileSync(path.join(directory,'corpus-manifest.json'))
  fs.writeFileSync(path.join(directory,'snapshots/company.json'),JSON.stringify([{title:'Intern',sourceDescription:'Join this internship.'}]))
  const inputs=[]
  const result=await classifyTrialSnapshots(directory,{useFrozenCorpus:true,workerFactory:async()=>({
    classify:async input=>{inputs.push(input);return fixturePrediction},stop:async()=>{},
  })})
  assert.equal(result.completed,1)
  assert.equal(inputs[0].title,'Engineer')
  assert.match(inputs[0].body,/Minimum 3 years/)
  assert.deepEqual(fs.readFileSync(path.join(directory,'corpus.jsonl')),before)
  assert.deepEqual(fs.readFileSync(path.join(directory,'corpus-manifest.json')),manifest)
})

test('a modified frozen corpus is rejected before a retry loads a model',async t=>{
  const directory=frozenFixture(t)
  fs.appendFileSync(path.join(directory,'corpus.jsonl'),'\n')
  let loaded=false
  await assert.rejects(classifyTrialSnapshots(directory,{useFrozenCorpus:true,workerFactory:async()=>{
    loaded=true;return {classify:async()=>fixturePrediction,stop:async()=>{}}
  }}),/Frozen corpus checksum changed/)
  assert.equal(loaded,false)
  assert.equal(fs.existsSync(path.join(directory,'classifications')),false)
})

test('a transient prediction-file failure retries persistence without running inference again',async t=>{
  const directory=frozenFixture(t), original=fs.writeFileSync
  let calls=0,writes=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(String(args[0]).startsWith(path.join(directory,'classifications')+path.sep)
      &&String(args[0]).endsWith('.json.tmp')&&++writes===1){
      throw Object.assign(new Error('Temporary write allocation failure'),{code:'ENOSPC'})
    }
    return original(...args)
  })
  const result=await classifyTrialSnapshots(directory,{useFrozenCorpus:true,workerFactory:async()=>({
    classify:async()=>{calls++;return fixturePrediction},stop:async()=>{},
  })})
  assert.equal(calls,1)
  assert.equal(writes,2)
  assert.equal(result.completed,1)
  assert.equal(result.failed,0)
  assert.equal(result.writeRetries,1)
  const files=fs.readdirSync(path.join(directory,'classifications'))
  assert.equal(files.length,1)
  const stored=JSON.parse(fs.readFileSync(path.join(directory,'classifications',files[0])))
  assert.deepEqual(stored.prediction,fixturePrediction)
  assert.equal(stored.classification.complete,true)
})

test('temporary disk exhaustion waits for space without repeating native inference',async t=>{
  const directory=frozenFixture(t), original=fs.writeFileSync
  let calls=0,writes=0,polls=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(String(args[0]).startsWith(path.join(directory,'classifications')+path.sep)
      &&String(args[0]).endsWith('.json.tmp')&&++writes===1){
      throw Object.assign(new Error('Disk temporarily full'),{code:'ENOSPC'})
    }
    return original(...args)
  })
  t.mock.method(fs,'statfsSync',()=>({bavail:++polls===1?0:100000,bsize:4096}))
  const result=await classifyTrialSnapshots(directory,{useFrozenCorpus:true,diskWaitMs:25,workerFactory:async()=>({
    classify:async()=>{calls++;return fixturePrediction},stop:async()=>{},
  })})
  assert.equal(calls,1)
  assert.equal(writes,2)
  assert.equal(result.completed,1)
  assert.equal(result.failed,0)
  assert.equal(result.writeRetries,1)
  assert.ok(result.diskWaitMilliseconds>0)
})

test('summary persistence also waits for temporarily exhausted storage',async t=>{
  const directory=frozenFixture(t), original=fs.writeFileSync
  const summaryFile=path.join(directory,'classification-summary.json')
  let calls=0,writes=0,polls=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if((args[0]===summaryFile||args[0]===`${summaryFile}.tmp`)&&++writes===1){
      throw Object.assign(new Error('Summary disk temporarily full'),{code:'ENOSPC'})
    }
    return original(...args)
  })
  t.mock.method(fs,'statfsSync',()=>({bavail:++polls===1?0:100000,bsize:4096}))
  const result=await classifyTrialSnapshots(directory,{useFrozenCorpus:true,diskWaitMs:25,workerFactory:async()=>({
    classify:async()=>{calls++;return fixturePrediction},stop:async()=>{},
  })})
  assert.equal(calls,1)
  assert.equal(result.completed,1)
  assert.ok(result.diskWaitMilliseconds>0)
  assert.equal(JSON.parse(fs.readFileSync(summaryFile)).completed,1)
  assert.equal(fs.existsSync(`${summaryFile}.tmp`),false)
})
