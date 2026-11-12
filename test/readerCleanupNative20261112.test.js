import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'

// This parent reads pinned files as data and imports only Node builtins.
// The unchanged 33 source controls execute in one strictly guarded child.
const directory=path.dirname(fileURLToPath(import.meta.url))
const workspace=path.resolve(directory,'../..')
const support=path.join(directory,'readerCleanupNative20261112')
const manifestFile=path.join(support,'manifest.json')
const expectedManifestSHA256='71b2d90eb6d97acfc1b29381d13c627ffcc8f6baa3e8ceb089e55375ba4e6960'
const sha=value=>createHash('sha256').update(value).digest('hex')
const expectedFixtures={
 calendlyJSONEvidence:'1c6175c6a3efcdaae460d0f234248b8b5d42f5e3243a6582c14c92793980e968',
 dataikuHomeBody:'a680781559bdaf81f5467534009567d27849d501a11cc68d54e5cf0a2add7725',
 dataikuHomeStableTransportTuple:'99d4a6bbdaede690a963025edc7509931782134346f7d78e06f9aaa4ab725452',
}
const exactCounters={network:0,database:0,browser:0,child:0,worker:0,addon:0,fsWrite:0,unexpectedModule:0,unexpectedRead:0,unexpectedRequest:0,opaqueInspection:0}
const withinWorkspace=relative=>{
 const filename=path.resolve(workspace,relative)
 assert.ok(filename.startsWith(workspace+path.sep),'Retained path must remain within the workspace')
 return filename
}

test('guarded native reader cleanup for iProgrammer Calendly and Dataiku',{timeout:125000},context=>{
 const rawManifest=fs.readFileSync(manifestFile)
 assert.equal(sha(rawManifest),expectedManifestSHA256,'Retained closure manifest changed')
 const manifest=JSON.parse(rawManifest.toString('utf8'))
 assert.equal(manifest.workspace,'.');assert.equal(manifest.backend,'backend')
 assert.equal(manifest.modules.length,14);assert.equal(manifest.reads.length,19)
 assert.equal(manifest.applicationModuleCount,12);assert.equal(manifest.trustedHarnessModuleCount,2)
 assert.deepEqual(manifest.mutableSources,[]);assert.deepEqual(manifest.substitutions,[])
 assert.deepEqual(manifest.externalPackagesGranted,[])
 assert.equal(new Set(manifest.modules.map(row=>row.path)).size,14)
 assert.equal(new Set(manifest.reads.map(row=>row.path)).size,19)
 const checkPins=()=>{
  for(const row of [...manifest.modules,...manifest.reads]){
   const filename=withinWorkspace(row.path)
   assert.equal(fs.existsSync(filename),row.exists,row.path)
   assert.ok(row.exists&&fs.statSync(filename).isFile(),'Expected one exact retained file: '+row.path)
   const raw=fs.readFileSync(filename)
   if(row.sha256){assert.equal(sha(raw),row.sha256,'Retained pin changed: '+row.path);assert.equal(raw.length,row.bytes,row.path)}
   else{assert.equal(filename,manifestFile);assert.equal(sha(raw),expectedManifestSHA256)}
  }
 }
 checkPins()
 const argv=['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict','--test-reporter=tap',
  ...manifest.reads.map(row=>'--allow-fs-read='+withinWorkspace(row.path)),path.join(support,'reader-cleanup-controls.mjs'),'--phase=current']
 const environment={...process.env}
 for(const name of ['NODE_OPTIONS','NODE_COMPILE_CACHE','NODE_TEST_CONTEXT','NODE_PATH'])delete environment[name]
 const result=spawnSync(process.execPath,argv,{cwd:workspace,env:environment,timeout:120000,maxBuffer:32*1024*1024,windowsHide:true})
 const stdout=result.stdout??Buffer.alloc(0),stderr=result.stderr??Buffer.alloc(0)
 // Preserve exact raw child bytes and exit information before any decoder or parser.
 // The ordinary test writes no backend output files; its report-owned caller captures TAP.
 context.diagnostic(JSON.stringify({event:'reader-cleanup-native-child-raw',exitCode:result.status,signal:result.signal,
  error:result.error?{name:result.error.name,message:result.error.message,code:result.error.code}:null,
  stdoutBase64:stdout.toString('base64'),stderrBase64:stderr.toString('base64'),stdoutSHA256:sha(stdout),stderrSHA256:sha(stderr)}))
 assert.ifError(result.error)
 assert.equal(result.signal,null)
 assert.equal(result.status,0,'Strict source child failed; exact raw bytes are in the diagnostic above')
 checkPins()
 assert.equal(stderr.length,0,'Strict child stderr must be empty; see preserved raw bytes')
 const decoded=new TextDecoder('utf-8',{fatal:true}).decode(stdout)
 const count=name=>{
  const match=decoded.match(new RegExp('^# '+name+' (\\d+)\\s*$','m'))
  assert.ok(match,'Explicit TAP child count missing: '+name)
  return Number(match[1])
 }
 const counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(name=>[name,count(name)]))
 assert.deepEqual(counts,{tests:33,pass:33,fail:0,cancelled:0,skipped:0,todo:0})
 // Split only actual CR/LF; literal U+2028/U+2029 inside JSON remain intact.
 const marker='READER_CLEANUP_NEXT '
 const lines=decoded.split(/\r?\n/).filter(line=>line.includes(marker))
 assert.equal(lines.length,1,'Exactly one guarded source receipt is required')
 const guard=JSON.parse(lines[0].slice(lines[0].indexOf(marker)+marker.length))
 assert.equal(guard.phase,'current');assert.equal(guard.plannedCases,33)
 assert.deepEqual(guard.permissions,{addons:false,worker:false,child:false,'fs.write':false})
 assert.deepEqual(guard.counters,exactCounters)
 assert.equal(guard.externalRequests,0);assert.equal(guard.codeGenerationDeniedByCommand,true)
 assert.deepEqual(guard.substitutions,[])
 for(const key of ['applicationSubstitutions','clockOrSignalSubstitutions','publisherProgramsExecuted','pdfImplementationImportsGranted'])assert.equal(guard[key],0,key)
 const pins=new Map(manifest.modules.map(row=>[row.relativePath,row]))
 const appPaths=manifest.modules.filter(row=>!withinWorkspace(row.path).startsWith(support+path.sep)).map(row=>row.path)
 assert.equal(guard.files.length,12)
 assert.deepEqual(new Set(guard.files.map(row=>row.path)),new Set(appPaths))
 for(const row of guard.files){assert.equal(row.unchangedAtExit,true);assert.equal(row.sha256,pins.get(row.path)?.sha256);assert.equal(row.bytes,pins.get(row.path)?.bytes)}
 const calendly=guard.observations.find(row=>row.source==='calendly'&&row.retainedFixtureOnly)
 const home=guard.observations.find(row=>row.source==='dataiku-publicRead-transport-only')
 assert.ok(calendly&&home,'Both unchanged genuine fixture observations are required')
 assert.equal(calendly.signature,expectedFixtures.calendlyJSONEvidence)
 assert.equal(calendly.calls,26)
 assert.equal(calendly.ownedReaders.length,26)
 assert.ok(calendly.ownedReaders.every(row=>row.readerReleaseCalls===1&&row.bodyLocked===false&&row.readerCancellationCalls===0))
 assert.equal(home.bodySHA256,expectedFixtures.dataikuHomeBody)
 const homeTuple=Object.fromEntries(['source','calls','bytes','bodySHA256','status','finalUrl'].sort().map(key=>[key,home[key]]))
 assert.equal(sha(JSON.stringify(homeTuple)),expectedFixtures.dataikuHomeStableTransportTuple)
 context.diagnostic(JSON.stringify({event:'reader-cleanup-native-verified',uniqueCases:33,counts,counters:guard.counters,
  applicationFiles:guard.files,fixtureSignatures:expectedFixtures,calendlyReleasedEOFReaders:26,
  signatureScope:'Calendly JSON-serializable jobs plus inventory/nativeCollectionEvidence, excluding five volatile timestamps recursively; Dataiku HOME transport bytes and metadata only.'}))
})
