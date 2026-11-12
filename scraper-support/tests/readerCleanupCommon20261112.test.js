// Ordinary package-glob test. Application code runs only in exact, guarded children.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'

const here=path.dirname(fileURLToPath(import.meta.url))
const backend=path.resolve(here,'../..'),root=path.dirname(backend)
const stage=path.join(here,'readerCleanupCommon20261112')
const sha=raw=>createHash('sha256').update(raw).digest('hex')
const expectedClosure='fa466e348cf84c4d6304329e48f0cbde1ffee478445e6757f0be525f039d8205'
const childFiles=[{"path":"backend/scraper-support/tests/readerCleanupCommon20261112/closure.json","sha256":"fa466e348cf84c4d6304329e48f0cbde1ffee478445e6757f0be525f039d8205","bytes":100557},{"path":"backend/scraper-support/tests/readerCleanupCommon20261112/guard.mjs","sha256":"554729117cb998da75ecfac2e02ddcaacff99ac1b80a781cf3fdd9dd08611283","bytes":6074},{"path":"backend/scraper-support/tests/readerCleanupCommon20261112/native-observers.mjs","sha256":"03e7e692d5413b525ee0196f2dd196b03e81c4d00520059eabda1c46b6fcd00b","bytes":2238},{"path":"backend/scraper-support/tests/readerCleanupCommon20261112/proof.mjs","sha256":"fc0b97abedba18dfb539d4f1249385bdeadd3a916d7fd602ab7d75bf36702960","bytes":16421}]
const expectedFlowIds=['claroty-current','firebolt-current','slb-current-reader','cohere-current','coinbase-current','comeet-export-direct-contract']
const expectedCaseCounts=[9,10,12,10,10,9]
const flowWatchdogMs=400000
const marker='READER_CLEANUP_RECEIPT '
const counterNames=['network','database','browser','child','worker','addon','fsWrite','unexpectedModule','unexpectedRead','unexpectedRequest']
const deniedPermissions={addons:false,worker:false,child:false,'fs.write':false}
const pinCheck=pin=>{const raw=fs.readFileSync(path.join(root,pin.path));assert.equal(sha(raw),pin.sha256,pin.path);assert.equal(raw.length,pin.bytes,pin.path);return raw}
const save=(folder,name,value)=>fs.writeFileSync(path.join(folder,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const isWithin=(parent,filename)=>{const rel=path.relative(parent,filename);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))}

async function captureChild(flow,manifest,manifestSHA,folder){
 const grants=[...new Set([...flow.modules,...flow.additional_reads,...manifest.childProofFiles].map(pin=>path.join(root,pin.path)))].sort()
 grants.push(path.join(stage,'preparation-manifest.json'))
 const args=['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict',...grants.map(filename=>'--allow-fs-read='+filename),'--test-reporter=tap',path.join(stage,'proof.mjs')]
 const env={...process.env}
 for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_V8_COVERAGE','NODE_TEST_CONTEXT','READER_CLEANUP_FLOW','READER_CLEANUP_ROOT','READER_CLEANUP_GO_SHA256'])delete env[key]
 Object.assign(env,{READER_CLEANUP_FLOW:flow.id,READER_CLEANUP_ROOT:root,READER_CLEANUP_GO_SHA256:manifestSHA})
 const startedAt=new Date().toISOString()
 save(folder,flow.id+'-command.json',{node:process.execPath,args,cwd:backend,startedAt,manifestSHA256:manifestSHA,flowWatchdogMs,physicalNetworkAuthorized:false})
 const child=spawn(process.execPath,args,{cwd:backend,env,stdio:['ignore','pipe','pipe'],windowsHide:true})
 const out=[],err=[]
 let outBytes=0,errBytes=0,timedOut=false,captureLimitExceeded=false,spawnError=null
 child.stdout.on('data',raw=>{out.push(raw);outBytes+=raw.length;if(outBytes+errBytes>64*1024*1024){captureLimitExceeded=true;child.kill()}})
 child.stderr.on('data',raw=>{err.push(raw);errBytes+=raw.length;if(outBytes+errBytes>64*1024*1024){captureLimitExceeded=true;child.kill()}})
 child.on('error',error=>{spawnError={name:error.name,message:error.message,code:error.code}})
 save(folder,flow.id+'-pid.json',{pid:child.pid??null,startedAt})
 const watchdog=setTimeout(()=>{timedOut=true;child.kill()},flowWatchdogMs)
 const closed=await new Promise(resolve=>child.once('close',(exitCode,signal)=>resolve({exitCode,signal})))
 clearTimeout(watchdog)
 const stdout=Buffer.concat(out),stderr=Buffer.concat(err)
 // Preserve the actual close result and all raw bytes before any decoding/parsing.
 fs.writeFileSync(path.join(folder,flow.id+'.stdout.bin'),stdout,{flag:'wx'})
 fs.writeFileSync(path.join(folder,flow.id+'.stderr.bin'),stderr,{flag:'wx'})
 const receipt={flow:flow.id,pid:child.pid??null,startedAt,completedAt:new Date().toISOString(),...closed,timedOut,captureLimitExceeded,spawnError,
  stdoutSHA256:sha(stdout),stderrSHA256:sha(stderr),stdoutBytes:stdout.length,stderrBytes:stderr.length,rawRetainedBeforeDecode:true,actualCloseObserved:true}
 save(folder,flow.id+'-exit.json',receipt)
 return {receipt,stdout,stderr}
}

test('reader cleanup: retained60 cases in six guarded source children',{concurrency:false,timeout:6*flowWatchdogMs+10000},async t=>{
 assert.match(process.versions.node,/^24\./,'The retained strict guard requires supported Node24')
 const manifestRaw=fs.readFileSync(path.join(stage,'preparation-manifest.json'))
 const manifest=JSON.parse(manifestRaw),manifestSHA=sha(manifestRaw)
 assert.equal(manifest.schemaVersion,1)
 assert.deepEqual(manifest.childProofFiles,childFiles,'No extra child harness read grants')
 assert.equal(manifest.plannedDistinctChildCases,60)
 const closure=JSON.parse(pinCheck(childFiles.find(row=>row.path.endsWith('/closure.json'))))
 assert.equal(sha(fs.readFileSync(path.join(stage,'closure.json'))),expectedClosure)
 assert.deepEqual(closure.flows.map(flow=>flow.id),expectedFlowIds)
 assert.deepEqual(closure.flows.map(flow=>flow.cases.length),expectedCaseCounts)
 assert.equal(manifest.files.length,childFiles.length+1)
 assert.deepEqual(manifest.files.map(row=>row.path).sort(),[...childFiles.map(row=>row.path),'backend/scraper-support/tests/readerCleanupCommon20261112.test.js'].sort())
 const pins=new Map()
 for(const pin of [...manifest.files,...closure.flows.flatMap(flow=>[...flow.modules,...flow.additional_reads])]){
  assert.equal(pin.path.startsWith('backend/'),true,'Retained runtime has no report file dependency')
  const old=pins.get(pin.path);if(old)assert.deepEqual(old,pin,'Conflicting source pin')
  pins.set(pin.path,pin)
 }
 for(const pin of pins.values())pinCheck(pin)
 const requested=process.env.READER_CLEANUP_COMMON_OUTPUT
 const output=requested?path.resolve(requested):fs.mkdtempSync(path.join(os.tmpdir(),'reader-cleanup-common-'))
 assert.equal(isWithin(backend,output),false,'Runtime evidence must stay outside backend')
 if(requested)fs.mkdirSync(output,{recursive:false})
 t.diagnostic('Raw child evidence: '+output)
 const rows=[]
 for(const flow of closure.flows){
  let capture
  try{
   for(const pin of [...flow.modules,...flow.additional_reads,...manifest.files])pinCheck(pin)
   capture=await captureChild(flow,manifest,manifestSHA,output)
   const {receipt,stdout,stderr}=capture
   assert.equal(receipt.spawnError,null)
   assert.equal(receipt.timedOut,false,'Parent watchdog is setup failure, not source causality')
   assert.equal(receipt.captureLimitExceeded,false,'Capture limit is setup failure, not source causality')
   const text=new TextDecoder('utf-8',{fatal:true}).decode(stdout)
   const lines=text.split('\n').map(line=>line.endsWith('\r')?line.slice(0,-1):line)
   const hits=lines.filter(line=>line.includes(marker))
   assert.equal(hits.length,1,'One terminal guarded receipt is required')
   const ledger=JSON.parse(hits[0].slice(hits[0].indexOf(marker)+marker.length))
   save(output,flow.id+'-ledger.json',ledger)
   const counts={}
   for(const key of ['tests','pass','fail','cancelled','skipped','todo']){
    const match=text.match(new RegExp('^# '+key+' (\\d+)\\s*$','m'));assert.ok(match,'Missing TAP count '+key);counts[key]=Number(match[1])
   }
   assert.equal(counts.tests,flow.cases.length)
   assert.equal(counts.pass,flow.cases.length)
   assert.equal(counts.fail,0);assert.equal(counts.cancelled,0);assert.equal(counts.skipped,0);assert.equal(counts.todo,0)
   assert.equal(receipt.exitCode,0);assert.equal(receipt.signal,null);assert.equal(stderr.length,0)
   assert.deepEqual(ledger.counters,Object.fromEntries(counterNames.map(key=>[key,0])))
   assert.deepEqual(ledger.permissions,deniedPermissions)
   assert.equal(ledger.sourceClocksUnchanged,true)
   assert.equal(ledger.flow,flow.id)
   assert.deepEqual(ledger.sourcePins,flow.modules)
   assert.deepEqual(ledger.imported.map(row=>row.path).sort(),flow.modules.map(row=>row.path).sort())
   for(const pin of ledger.imported){const expected=flow.modules.find(row=>row.path===pin.path);assert.deepEqual(pin,expected)}
   assert.equal(ledger.registeredCurrentImpact,flow.registeredCurrentImpact)
   assert.equal(ledger.livePublisherClaim,false)
   assert.deepEqual(ledger.observations.filter(row=>row.case==='genuine-capture-compatibility'),flow.expectedHistoricalCompatibility,
    'Historical fixture comparisons must match the four prior canonical comparison objects')
   for(const pin of [...flow.modules,...flow.additional_reads,...manifest.files])pinCheck(pin)
   const summary={flow:flow.id,counts,exitCode:receipt.exitCode,allForbiddenCountersZero:true,capabilitiesDenied:true,sourceClocksUnchanged:true,
    historicalCompatibility:flow.expectedHistoricalCompatibility,legacyPhysicalRequestsMeaning:'intercepted fetch calls; actual physical network counter is0',actualPhysicalNetworkAttempts:ledger.counters.network}
   save(output,flow.id+'-summary.json',summary);rows.push(summary)
  }catch(error){
   const failure={flow:flow.id,counts:null,failure:{name:error.name,message:error.message,stack:error.stack},rawCapturedBeforeDecode:!!capture,
    terminalReceipt:capture?.receipt??null,classification:'inspect raw child and guard; no watchdog or setup failure is source causality'}
   save(output,flow.id+'-failure.json',failure);rows.push(failure)
  }
 }
 for(const pin of pins.values())pinCheck(pin)
 const aggregate={flows:rows,plannedDistinctChildCases:60,ordinaryWrapperTests:1,extraDistinctCasesFromRepeatRun:0,
  passed:rows.every(row=>!row.failure),legacyPhysicalRequestsMeaning:'intercepted fetch calls; actual physical network counter is0',physicalNetworkAuthorized:false,
  nativeClocksOrSignalsReplaced:false,livePublisherClaim:false,fullSuiteClaim:false,allOriginalFailuresFixed:false}
 save(output,'aggregate.json',aggregate)
 assert.equal(aggregate.passed,true,'Read the retained raw flow receipts at '+output)
})
