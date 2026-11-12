import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'

// The parent imports only Node builtins. Actual application imports occur only
// in children with the exact retained read/module pins and denied capabilities.
const directory=path.dirname(fileURLToPath(import.meta.url))
const workspace=path.resolve(directory,'../..')
const support=path.join(directory,'httpResponseDisposalGroupB20261112')
const sha=value=>createHash('sha256').update(value).digest('hex')
const expectedFixtures={
 deitelRun:'6dbf290b9bf83dc7bda8cc08965e211842875db71c6b997f6492972c4aaa67cd',
 dinesh:'5b88ff6531e1b2a33c527e999e00664f19779e2d4e90508085bd3e30a4719c71',
 fingent:'3faeb86103d6d50d081b167e85aeedc8ecaa1189f9ffd916405a144e32fa68f7',
 m2nxt:'96edbcf53438495c54002901c5b109178812f3c03c5f1ccb6faa144541add44f',
 gati:'922e83c8605dd94a1ff4492f045061c2f00181cb1602d25d3cd311aa3ecbd5c2',
 optum:'73dfa15b02874b8649f31d2a495d541458dafea772e00c815c618eec97c40a49',
 ghx:'4f6f7c4bcbc2362d023db3cdef237f5f20099c4e602449eb8f1ee3cef39c45b1',
}
for(const suite of [
 {folder:'main',entry:'source-controls.mjs',marker:'HTTP_DISPOSAL_GROUP_B ',cases:61},
 {folder:'reader',entry:'reader-lock-controls.mjs',marker:'HTTP_DISPOSAL_OPTUM_READER ',cases:3},
])test('guarded response disposal Group B '+suite.folder,{timeout:95000},context=>{
 const suiteDir=path.join(support,suite.folder),manifest=JSON.parse(fs.readFileSync(path.join(suiteDir,'manifest.json'),'utf8'))
 assert.equal(manifest.modules.length,82);assert.equal(manifest.reads.length,97);assert.deepEqual(manifest.mutableSources,[])
 for(const row of manifest.modules){const raw=fs.readFileSync(path.resolve(workspace,row.path));assert.equal(sha(raw),row.sha256,'Retained source/module pin changed: '+row.path)}
 const arguments_=['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict','--test-reporter=tap',...manifest.reads.map(row=>'--allow-fs-read='+path.resolve(workspace,row.path)),path.join(suiteDir,suite.entry),'--phase=current']
 const environment={...process.env};delete environment.NODE_OPTIONS;delete environment.NODE_COMPILE_CACHE;delete environment.NODE_TEST_CONTEXT
 const result=spawnSync(process.execPath,arguments_,{cwd:workspace,env:environment,encoding:'utf8',timeout:90000,maxBuffer:32*1024*1024,windowsHide:true})
 assert.ifError(result.error)
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr)
 const count=name=>Number(result.stdout.match(new RegExp('^# '+name+' (\\d+)\\s*$','m'))?.[1])
 assert.equal(count('tests'),suite.cases);assert.equal(count('pass'),suite.cases);assert.equal(count('fail'),0)
 const line=result.stdout.split(/\r?\n/).find(line=>line.includes(suite.marker));assert.ok(line,'Strict child guard receipt is required')
 const guard=JSON.parse(line.split(suite.marker,2)[1])
 assert.deepEqual(guard.permissions,{addons:false,worker:false,child:false,'fs.write':false})
 assert.ok(Object.values(guard.counters).every(value=>value===0),'Physical/unexpected counters must remain zero')
 const pins=new Map(manifest.modules.map(row=>[row.relativePath,row]))
 for(const row of guard.files){assert.equal(row.unchangedAtExit,true);assert.equal(row.sha256,pins.get(row.path)?.sha256,'Imported file differs from its exact pin')}
 if(suite.folder==='main'){
  const fixtures=Object.fromEntries(guard.observations.filter(row=>row.retainedFixtureOnly).map(row=>[row.name,row.signature]))
  assert.deepEqual(fixtures,expectedFixtures,'Unchanged full fixture qualification/authority signatures must remain exact')
 }else{
  assert.ok(guard.observations.filter(row=>row.authored).every(row=>row.bodyLocked===false&&row.cancels===1&&row.calls===1))
  assert.equal(guard.observations.find(row=>row.mode==='genuine-fixture-EOF')?.lockedBodies,0)
 }
 context.diagnostic(JSON.stringify({suite:suite.folder,cases:suite.cases,counters:guard.counters,files:guard.files,observations:guard.observations}))
})
