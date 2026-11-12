import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'

// Ordinary *.test.js discovery parent; source code runs only in its strict
// permission child. All 28 source cases and seven real deadline probes stand.
const directory=path.dirname(fileURLToPath(import.meta.url))
const backend=path.resolve(directory,'../..')
const support=path.join(directory,'readerCleanupFirstCitizensRmk20261112')
const self=fileURLToPath(import.meta.url)
const proofFile=path.join(support,'proof.mjs'),closureFile=path.join(support,'closure.json')
const proofSHA256='0a55633acb6c76e50293bf559c4e7637bf99218c9be59fa04a4b819b6ce6af30'
const closureSHA256='6fe56aead208e7b6fd92738cf05eb4b877f5d1a808838e4de9386afbf6c08ec3'
const sha=raw=>createHash('sha256').update(raw).digest('hex')
const exactCounts={tests:28,pass:28,fail:0,cancelled:0,skipped:0,todo:0}
const exactAttempts={network:0,database:0,browser:0,child:0,worker:0,addon:0,fsWrite:0,unexpectedModule:0,unexpectedRead:0,unexpectedRequest:0}
const withinBackend=relative=>{
 const filename=path.resolve(backend,relative)
 assert.ok(filename.startsWith(backend+path.sep),'Retained path must remain inside backend: '+relative)
 return filename
}

function captureChild(args,environment){
 return new Promise(resolve=>{
  const stdout=[],stderr=[];let failure=null,parentTimeout=false,child
  try{child=spawn(process.execPath,args,{cwd:backend,env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']})}
  catch(error){resolve({stdout:Buffer.alloc(0),stderr:Buffer.alloc(0),exitCode:null,signal:null,error,parentTimeout:false});return}
  const watchdog=setTimeout(()=>{parentTimeout=true;if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL')},300000)
  child.stdout.on('data',chunk=>stdout.push(chunk))
  child.stderr.on('data',chunk=>stderr.push(chunk))
  child.on('error',error=>{failure=error})
  child.on('close',(exitCode,signal)=>{clearTimeout(watchdog);resolve({stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr),exitCode,signal,error:failure,parentTimeout})})
 })
}

test('First Citizens and RMK reader cleanup retains28 guarded native cases',{timeout:310000},async context=>{
 const wrapperSHA256=sha(fs.readFileSync(self))
 const checkPins=()=>{
  const rawProof=fs.readFileSync(proofFile),rawClosure=fs.readFileSync(closureFile)
  assert.equal(sha(rawProof),proofSHA256,'Retained proof changed');assert.equal(rawProof.length,32375)
  assert.equal(sha(rawClosure),closureSHA256,'Retained closure changed');assert.equal(rawClosure.length,3494)
  const closure=JSON.parse(rawClosure.toString('utf8'))
  assert.equal(closure.modules.length,17);assert.equal(closure.additional_reads.length,1)
  assert.equal(closure.additional_reads[0].path,'package.json')
  assert.deepEqual(closure.absent_allowed_read_paths,[]);assert.equal(closure.expected_cases,28)
  assert.deepEqual(closure.source_builtins,['node:async_hooks','node:crypto','node:path','node:url'])
  const reads=[...closure.modules,...closure.additional_reads]
  assert.equal(new Set(reads.map(row=>row.path)).size,18)
  for(const row of reads){const raw=fs.readFileSync(withinBackend(row.path));assert.equal(sha(raw),row.sha256,row.path);assert.equal(raw.length,row.bytes,row.path)}
  return closure
 }
 const closure=checkPins()
 const grants=[...closure.modules,...closure.additional_reads].map(row=>withinBackend(row.path))
 grants.push(proofFile,closureFile);assert.equal(new Set(grants).size,20)
 const args=['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict','--test-reporter=tap',
  ...grants.map(filename=>'--allow-fs-read='+filename),proofFile]
 const environment={...process.env,NODE_OPTIONS:'',HTTP_DISPOSAL_BACKEND:backend,HTTP_DISPOSAL_CLOSURE:closureFile}
 for(const name of ['NODE_TEST_CONTEXT','NODE_COMPILE_CACHE','NODE_PATH'])delete environment[name]
 const result=await captureChild(args,environment)
 // Preserve all exact child bytes and observed terminal status before decoding.
 // The ordinary test creates no output files; its caller retains the TAP stream.
 context.diagnostic(JSON.stringify({event:'reader-cleanup-rmk-child-raw',arguments:args,childCwd:backend,
  childExitCode:result.exitCode,childSignal:result.signal,parentTimeout:result.parentTimeout,parentTimeoutSeconds:300,
  wrapperFailureStatus:result.parentTimeout?124:null,error:result.error?{name:result.error.name,message:result.error.message,code:result.error.code}:null,
  stdoutBase64:result.stdout.toString('base64'),stderrBase64:result.stderr.toString('base64'),
  stdoutSHA256:sha(result.stdout),stderrSHA256:sha(result.stderr),proofSHA256,closureSHA256,wrapperSHA256,savedBeforeDecoding:true}))
 checkPins();assert.equal(sha(fs.readFileSync(self)),wrapperSHA256,'Parent wrapper changed during execution')
 assert.ifError(result.error);assert.equal(result.parentTimeout,false,'Parent watchdog expired; actual child terminal status is preserved above')
 assert.equal(result.signal,null);assert.equal(result.exitCode,0,'Strict child failed; exact raw bytes precede this assertion')
 const text=new TextDecoder('utf-8',{fatal:true}).decode(result.stdout)
 const counts=Object.fromEntries(Object.keys(exactCounts).map(name=>{
  const match=text.match(new RegExp('^# '+name+' (\\d+)\\s*$','m'));assert.ok(match,'Missing child TAP count: '+name);return[name,Number(match[1])]
 }))
 assert.deepEqual(counts,exactCounts)
 // Split actual LF only; Unicode line separators inside native JSON stand.
 const prefix='READER_CLEANUP_NEXT_RMK '
 const markers=text.split('\n').filter(line=>line.startsWith(prefix)||line.startsWith('# '+prefix))
 assert.equal(markers.length,1,'Exactly one guarded receipt is required')
 const guard=JSON.parse(markers[0].slice(markers[0].indexOf(prefix)+prefix.length))
 assert.equal(guard.testSHA256,proofSHA256);assert.equal(guard.manifestSHA256,closureSHA256)
 assert.deepEqual(guard.permissions,{addons:false,worker:false,child:false,'fs.write':false})
 assert.deepEqual(guard.attempts,exactAttempts)
 const wanted=new Map(closure.modules.map(row=>[row.path,row]))
 assert.equal(guard.files.length,17);assert.deepEqual(new Set(guard.files.map(row=>row.path)),new Set(wanted.keys()))
 for(const row of guard.files){assert.equal(row.unchangedAtExit,true);assert.equal(row.sha256,wanted.get(row.path)?.sha256);assert.equal(row.bytes,wanted.get(row.path)?.bytes)}
 assert.equal(guard.sourceClockParametersChanged,false);assert.equal(guard.timeoutFactorySubstituted,false)
 assert.equal(guard.monotonicClockSubstituted,false);assert.equal(guard.nativeRequestExpiryObserved,true)
 const nativePhaseControls=[]
 for(const observation of guard.observations){
  if(!Object.hasOwn(observation,'phase'))continue
  const phase=observation.phase,events=phase.events
  const abort=events.find(row=>row.event==='native-request-abort')
  const cleanup=events.find(row=>['byte-budget-cleanup-admitted','known-HTTP403-cleanup-admitted','valid-redirect-cleanup-admitted'].includes(row.event))
  assert.ok(abort,'Native abort event required: '+observation.name)
  assert.equal(phase.nativeFactoryUnchanged,true);assert.equal(phase.monotonicClockUnchanged,true)
  const duration=phase.sourceRequestTimeoutMs,delta=cleanup?abort.elapsedMs-cleanup.elapsedMs:null
  const valid=duration-1000<=abort.requestElapsedMs&&abort.requestElapsedMs<duration+5000&&(delta===null||0<=delta&&delta<1000)
  nativePhaseControls.push({name:observation.name,sourceRequestTimeoutMs:duration,nativeAbortRequestElapsedMs:abort.requestElapsedMs,cleanupToAbortMs:delta,controlWindowValid:valid})
 }
 assert.equal(nativePhaseControls.length,7)
 assert.equal(nativePhaseControls.filter(row=>row.sourceRequestTimeoutMs===20000).length,3)
 assert.equal(nativePhaseControls.filter(row=>row.sourceRequestTimeoutMs===30000).length,4)
 assert.ok(nativePhaseControls.every(row=>row.controlWindowValid),'Native phase window miss is a control hold')
 context.diagnostic(JSON.stringify({event:'reader-cleanup-rmk-verified',counts,uniqueSourceCases:28,
  integrationWrapperIsNotAdditionalSourceCoverage:true,repeatsAreNotNewCases:true,attempts:guard.attempts,
  files:guard.files,nativePhaseControls,sourceClockParametersChanged:false,timeoutFactorySubstituted:false,
  monotonicClockSubstituted:false,fixtureReplayed:false,distinctRmkBodyReadAbortErrorUntested:true,
  sourceEditedByThisWrapper:false,backendFilesWrittenByThisWrapper:false}))
})
