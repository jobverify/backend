import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'

// This ordinary discovery parent imports only Node builtins. The unchanged
// 49 source controls run in ten sequential children with exact closed reads.
const self=fileURLToPath(import.meta.url)
const directory=path.dirname(self),workspace=path.resolve(directory,'../../..')
const support=path.join(directory,'readerCleanupRemainingNative20261112')
const suiteFile=path.join(support,'suite.json')
const suiteSHA256='d35454dffae32bf558ef4cdf69bc4e873615d0e0365b6628b98e583df3a6e8cc'
const sha=raw=>createHash('sha256').update(raw).digest('hex')
const exactCounts={tests:49,pass:49,fail:0,cancelled:0,skipped:0,todo:0}
const exactCounters={network:0,database:0,browser:0,child:0,worker:0,addon:0,fsWrite:0,unexpectedModule:0,unexpectedRead:0,unexpectedRequest:0,opaqueInspection:0}
const exactPermissions={addons:false,worker:false,child:false,'fs.write':false}
const withinWorkspace=relative=>{
 const filename=path.resolve(workspace,relative),inside=path.relative(workspace,filename)
 assert.ok(inside&&!inside.startsWith('..')&&!path.isAbsolute(inside),'Retained path must be inside the workspace: '+relative)
 return filename
}

function captureChild(argv,environment){
 return new Promise(resolve=>{
  const stdout=[],stderr=[];let child,error=null,parentTimeout=false
  try{child=spawn(process.execPath,argv,{cwd:workspace,env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']})}
  catch(failure){resolve({stdout:Buffer.alloc(0),stderr:Buffer.alloc(0),exitCode:null,signal:null,error:failure,parentTimeout:false});return}
  const watchdog=setTimeout(()=>{parentTimeout=true;if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL')},80000)
  child.stdout.on('data',chunk=>stdout.push(chunk));child.stderr.on('data',chunk=>stderr.push(chunk))
  child.on('error',failure=>{error=failure})
  // Actual close, including drained stdout/stderr, owns parent settlement.
  child.on('close',(exitCode,signal)=>{clearTimeout(watchdog);resolve({stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr),exitCode,signal,error,parentTimeout})})
 })
}

test('nine native reader sources retain49 guarded cleanup cases',{timeout:815000},async context=>{
 const wrapperSHA256=sha(fs.readFileSync(self)),suiteRaw=fs.readFileSync(suiteFile)
 assert.equal(sha(suiteRaw),suiteSHA256,'Retained suite changed')
 const suite=JSON.parse(suiteRaw.toString('utf8'))
 assert.equal(suite.workspace,'.');assert.equal(suite.backend,'backend')
 assert.equal(suite.sourceEntries,9);assert.equal(suite.sourceChildren,10);assert.equal(suite.uniqueCases,49)
 assert.equal(suite.sourceHelperStaticDataModuleUnion,90)
 assert.equal(suite.caseWatchdogMilliseconds,35000);assert.equal(suite.perFlowParentWatchdogMilliseconds,80000)
 assert.equal(suite.parentTestTimeoutMilliseconds,815000)
 assert.deepEqual(suite.expectedCounters,exactCounters);assert.deepEqual(suite.expectedPermissions,exactPermissions)
 assert.deepEqual(suite.substitutions,[]);assert.equal(suite.flows.length,10)
 const checkAllPins=()=>{
  assert.equal(sha(fs.readFileSync(self)),wrapperSHA256,'Ordinary parent changed')
  assert.equal(sha(fs.readFileSync(suiteFile)),suiteSHA256,'Retained suite changed')
  const sourcePaths=new Set(),manifests=[]
  for(const flow of suite.flows){
   const manifestFile=withinWorkspace(flow.manifest)
   assert.equal(manifestFile,path.join(support,'flows',flow.key,'manifest.json'))
   assert.equal(withinWorkspace(flow.proof),path.join(support,'flows',flow.key,'proof.mjs'))
   assert.equal(withinWorkspace(flow.guard),path.join(support,'flows',flow.key,'guard.mjs'))
   const raw=fs.readFileSync(manifestFile)
   assert.equal(sha(raw),flow.manifestSHA256,flow.manifest);assert.equal(raw.length,flow.manifestBytes)
   const manifest=JSON.parse(raw.toString('utf8'))
   assert.equal(manifest.workspace,'.');assert.equal(manifest.backend,'backend')
   assert.equal(manifest.flowSpec.key,flow.key);assert.equal(manifest.flowSpec.entry,flow.entry)
   assert.deepEqual(manifest.mutableSources,[]);assert.deepEqual(manifest.substitutions,[])
   assert.equal(manifest.modules.length,flow.moduleCount);assert.equal(manifest.reads.length,flow.readCount)
   assert.equal(manifest.applicationAndStaticImportedDataModules,flow.applicationAndStaticImportedDataModules)
   assert.equal(new Set(manifest.modules.map(row=>row.path)).size,flow.moduleCount)
   assert.equal(new Set(manifest.reads.map(row=>row.path)).size,flow.readCount)
   for(const row of [...manifest.modules,...manifest.reads]){
    const filename=withinWorkspace(row.path)
    assert.equal(fs.existsSync(filename),row.exists,row.path);assert.ok(row.exists&&fs.statSync(filename).isFile(),row.path)
    const value=fs.readFileSync(filename)
    if(row.sha256){assert.equal(sha(value),row.sha256,row.path);assert.equal(value.length,row.bytes,row.path)}
    else{assert.equal(filename,manifestFile);assert.equal(sha(value),flow.manifestSHA256)}
   }
   for(const row of manifest.modules)if(row.path!==flow.proof&&row.path!==flow.guard)sourcePaths.add(row.path)
   assert.equal(sha(fs.readFileSync(withinWorkspace(flow.proof))),suite.proofSHA256)
   assert.equal(fs.statSync(withinWorkspace(flow.proof)).size,suite.proofBytes)
   assert.equal(sha(fs.readFileSync(withinWorkspace(flow.guard))),suite.guardSHA256)
   assert.equal(fs.statSync(withinWorkspace(flow.guard)).size,suite.guardBytes)
   manifests.push({flow,manifest})
  }
  assert.equal(sourcePaths.size,90)
  return manifests
 }
 const manifests=checkAllPins(),totals=Object.fromEntries(Object.keys(exactCounts).map(key=>[key,0]))
 for(const {flow,manifest}of manifests){
  const argv=['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict','--test-reporter=tap',
   ...manifest.reads.map(row=>'--allow-fs-read='+withinWorkspace(row.path)),withinWorkspace(flow.proof),'--phase=current']
  const environment={...process.env}
  for(const name of ['NODE_OPTIONS','NODE_COMPILE_CACHE','NODE_TEST_CONTEXT','NODE_PATH'])delete environment[name]
  const result=await captureChild(argv,environment)
  // Exact raw bytes and actual terminal state precede every decoder/assertion.
  // This wrapper creates no output files; its caller retains the ordinary TAP.
  context.diagnostic('READER_CLEANUP_REMAINING_NATIVE_CHILD '+JSON.stringify({flow:flow.key,argv,cwd:workspace,
   exitCode:result.exitCode,signal:result.signal,parentTimeout:result.parentTimeout,parentTimeoutMilliseconds:80000,
   wrapperFailureStatus:result.parentTimeout?124:null,error:result.error?{name:result.error.name,message:result.error.message,code:result.error.code}:null,
   stdoutBase64:result.stdout.toString('base64'),stderrBase64:result.stderr.toString('base64'),
   stdoutSHA256:sha(result.stdout),stderrSHA256:sha(result.stderr),stdoutBytes:result.stdout.length,stderrBytes:result.stderr.length,savedBeforeDecoding:true}))
  checkAllPins()
  assert.ifError(result.error);assert.equal(result.parentTimeout,false,'Parent watchdog expired; actual terminal state is preserved above')
  assert.equal(result.signal,null);assert.equal(result.exitCode,0,'Strict source child failed; exact raw bytes precede this assertion')
  assert.equal(result.stderr.length,0)
  const text=new TextDecoder('utf-8',{fatal:true}).decode(result.stdout)
  const counts=Object.fromEntries(Object.keys(exactCounts).map(name=>{
   const match=text.match(new RegExp('^# '+name+' (\\d+)\\s*$','m'));assert.ok(match,'Missing explicit TAP count: '+name);return[name,Number(match[1])]
  }))
  assert.deepEqual(counts,{tests:flow.expectedCases,pass:flow.expectedCases,fail:0,cancelled:0,skipped:0,todo:0})
  const marker='READER_CLEANUP_REMAINING_NINE '
  // Split actual LF only; Unicode U+2028/U+2029 in JSON are native data.
  const markers=text.split('\n').filter(line=>line.startsWith(marker)||line.startsWith('# '+marker))
  assert.equal(markers.length,1,'Exactly one guarded source receipt is required')
  const guard=JSON.parse(markers[0].slice(markers[0].indexOf(marker)+marker.length))
  assert.equal(guard.phase,'current');assert.equal(guard.flow,flow.key);assert.equal(guard.plannedCases,flow.expectedCases)
  assert.deepEqual(guard.permissions,exactPermissions);assert.deepEqual(guard.counters,exactCounters)
  assert.equal(guard.externalRequests,0);assert.equal(guard.codeGenerationDeniedByCommand,true);assert.deepEqual(guard.substitutions,[])
  for(const name of ['applicationSubstitutions','clockOrSignalSubstitutions','publisherProgramsExecuted','pdfImplementationImportsGranted'])assert.equal(guard[name],0,name)
  const wanted=new Map(manifest.modules.filter(row=>row.path!==flow.proof&&row.path!==flow.guard).map(row=>[row.relativePath,row]))
  assert.equal(guard.files.length,flow.moduleCount-2);assert.deepEqual(new Set(guard.files.map(row=>row.path)),new Set(wanted.keys()))
  for(const row of guard.files){const expected=wanted.get(row.path);assert.equal(row.unchangedAtExit,true);assert.equal(row.sha256,expected.sha256);assert.equal(row.bytes,expected.bytes)}
  const expected=suite.expectedGenuineSignatures
  for(const observation of guard.observations){
   const readers=[observation,...(observation.readers??[]),...(observation.genuinePrefixReaders??[]),...(observation.extraEOFReaders??[])]
   for(const reader of readers)if(reader.actualReader){
    assert.equal(reader.readerReleaseCalls,1);assert.equal(reader.bodyLocked,false)
    assert.equal(reader.receiversExact,true);assert.equal(reader.nativeUnderlyingReasonForwardedExactly,true)
    assert.ok(reader.readerCancellationArities.every(arity=>arity===0));assert.equal(reader.bodyCancellationCalls,0)
   }
  }
  if(flow.key==='evidation'||flow.key==='licious'){
   const genuine=guard.observations.find(row=>row.retainedFixtureOnly)
   assert.ok(genuine);assert.equal(genuine.signature,expected[flow.key].signature)
   assert.equal(genuine.requests,expected[flow.key].requests);assert.equal(genuine.jobs,expected[flow.key].jobs)
   assert.equal(genuine.readers.length,expected[flow.key].requests)
  }
  if(flow.key==='fullerton-pdf'){
   const genuine=guard.observations.find(row=>row.genuineEOFPacket)
   assert.ok(genuine);assert.equal(genuine.genuineEOFPacket.bodySHA256,expected.fullertonPDF.sha256)
   assert.equal(genuine.genuineEOFPacket.bytes,expected.fullertonPDF.bytes);assert.equal(genuine.afterControlledRelease.ok,true)
  }
  if(flow.key==='fullerton-json'){
   assert.equal(guard.observations.length,2)
   assert.ok(guard.observations.every(row=>row.genuinePrefixPackets===3&&row.genuinePrefixReaders.length===3))
  }
  for(const key of Object.keys(totals))totals[key]+=counts[key]
  context.diagnostic('READER_CLEANUP_REMAINING_NATIVE_VERIFIED '+JSON.stringify({flow:flow.key,counts,guard,
   sourceProofUnchanged:true,guardUnchanged:true,caseRepeatDoesNotAddUniqueCoverage:true}))
 }
 checkAllPins();assert.deepEqual(totals,exactCounts)
 context.diagnostic('READER_CLEANUP_REMAINING_NATIVE_ALL '+JSON.stringify({counts:totals,sourceEntries:9,sourceChildren:10,
  uniqueSourceCases:49,integrationWrapperIsNotAdditionalSourceCoverage:true,repeatsAreNotNewUniqueCases:true,
  counters:exactCounters,suiteSHA256,wrapperSHA256,expectedGenuineSignatures:suite.expectedGenuineSignatures,
  sourceOrBackendFilesWritten:false,nativeExpiryAndHTTPStatusPhasesExercised:false,allFailuresResolvedClaim:false}))
})
