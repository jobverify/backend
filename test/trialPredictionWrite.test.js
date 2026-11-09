import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeTrialPrediction } from '../scripts/writeTrialPrediction.js'

function fixture(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'trial-prediction-write-'))
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}))
  const file=path.join(directory,'prediction.json')
  fs.writeFileSync(file,JSON.stringify({previous:'valid prediction'}))
  return {directory,file,stopFile:path.join(directory,'resource-stop.json')}
}
const diskError=()=>Object.assign(new Error('Simulated temporary allocator failure'),{code:'ENOSPC'})

test('a transient allocator failure preserves the pending prediction and retries its atomic write',async t=>{
  const {file}=fixture(t), original=fs.writeFileSync
  let attempts=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(args[0]===`${file}.tmp` && ++attempts===1)throw diskError()
    return original(...args)
  })
  const record={nativeInputHash:'exact source and model input',prediction:{seconds:7,windows:3}}
  await writeTrialPrediction(file,record,{retryDelays:[0,0]})
  assert.equal(attempts,2)
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),record)
  assert.equal(fs.existsSync(`${file}.tmp`),false)
})

test('persistent write failure is bounded and leaves the previous complete prediction intact',async t=>{
  const {file}=fixture(t), original=fs.writeFileSync
  let attempts=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(args[0]===`${file}.tmp`){attempts++;throw diskError()}
    return original(...args)
  })
  await assert.rejects(writeTrialPrediction(file,{replacement:'pending'},{retryDelays:[0,0]}),/allocator failure/)
  assert.equal(attempts,3)
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{previous:'valid prediction'})
})

test('a new resource stop cancels a write retry without clearing the latch or replacing the prediction',async t=>{
  const {file,stopFile}=fixture(t), original=fs.writeFileSync
  let attempts=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(args[0]===`${file}.tmp`){attempts++;original(stopFile,'{"cpu":91}');throw diskError()}
    return original(...args)
  })
  await assert.rejects(writeTrialPrediction(file,{replacement:'pending'},{stopFile,retryDelays:[0,0]}),/resource limit/)
  assert.equal(attempts,1)
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{previous:'valid prediction'})
  assert.deepEqual(JSON.parse(fs.readFileSync(stopFile)),{cpu:91})
})

test('genuinely exhausted storage does not enter the retry loop',async t=>{
  const {file}=fixture(t),original=fs.writeFileSync
  let attempts=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(args[0]===`${file}.tmp`){attempts++;throw diskError()}
    return original(...args)
  })
  t.mock.method(fs,'statfsSync',()=>({bavail:0,bsize:4096}))
  await assert.rejects(writeTrialPrediction(file,{replacement:'pending'},{retryDelays:[0,0]}),/allocator failure/)
  assert.equal(attempts,1)
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{previous:'valid prediction'})
})

test('an opt-in disk wait preserves the computed record until free space returns',async t=>{
  const {file}=fixture(t), original=fs.writeFileSync
  let attempts=0,polls=0,clock=0,waited=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(args[0]===`${file}.tmp` && ++attempts===1)throw diskError()
    return original(...args)
  })
  t.mock.method(fs,'statfsSync',()=>({bavail:++polls<3?0:1000,bsize:4096}))
  const record={prediction:{seconds:7,windows:3},nativeInputHash:'unchanged native output'}
  const retries=await writeTrialPrediction(file,record,{retryDelays:[0],diskWaitMs:100,diskPollMs:20,
    now:()=>clock,wait:async ms=>{clock+=ms},onDiskWait:ms=>{waited+=ms}})
  assert.equal(attempts,2)
  assert.equal(retries,1)
  assert.equal(waited,40)
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),record)
})

test('an exhausted disk wait times out without replacing the saved prediction',async t=>{
  const {file}=fixture(t), original=fs.writeFileSync
  let attempts=0,clock=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(args[0]===`${file}.tmp`){attempts++;throw diskError()}
    return original(...args)
  })
  t.mock.method(fs,'statfsSync',()=>({bavail:0,bsize:4096}))
  await assert.rejects(writeTrialPrediction(file,{replacement:'pending'},{retryDelays:[0],diskWaitMs:30,diskPollMs:20,
    now:()=>clock,wait:async ms=>{clock+=ms}}),/allocator failure/)
  assert.equal(clock,30)
  assert.equal(attempts,1)
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{previous:'valid prediction'})
})

test('a resource stop during disk wait prevents a second write attempt',async t=>{
  const {file,stopFile}=fixture(t), original=fs.writeFileSync
  let attempts=0,clock=0
  t.mock.method(fs,'writeFileSync',(...args)=>{
    if(args[0]===`${file}.tmp`){attempts++;throw diskError()}
    return original(...args)
  })
  t.mock.method(fs,'statfsSync',()=>({bavail:0,bsize:4096}))
  await assert.rejects(writeTrialPrediction(file,{replacement:'pending'},{stopFile,retryDelays:[0],diskWaitMs:100,diskPollMs:20,
    now:()=>clock,wait:async ms=>{clock+=ms;original(stopFile,'{"cpu":91}')}}),/resource limit/)
  assert.equal(attempts,1)
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{previous:'valid prediction'})
  assert.deepEqual(JSON.parse(fs.readFileSync(stopFile)),{cpu:91})
})
