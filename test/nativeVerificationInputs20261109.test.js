import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const helper=fileURLToPath(new URL('../reports/native-catalog-recovery-20261109/verification-inputs.py',import.meta.url))
const evidence=['reports/native-catalog-recovery-20261109/run-checks.py','reports/native-catalog-recovery-20261109/reconcile-current.py']
function changed(expected,current,tests=[]){
  const code='import runpy,json,sys\nn=runpy.run_path(sys.argv[1]);v=json.load(sys.stdin)\nprint(json.dumps(n["changed_relevant_inputs"](*v)))'
  const result=spawnSync('python',['-I','-B','-X','utf8','-c',code,helper],{
    input:JSON.stringify([expected,current,tests,evidence]),encoding:'utf8',windowsHide:true,timeout:30000})
  assert.equal(result.status,0,result.stderr)
  return JSON.parse(result.stdout)
}
test('relevant input witness rejects a new provider extension added after execution',()=>{
  const original='scraper-support/providers/providerExtensions/original.json',added='scraper-support/providers/providerExtensions/new.json'
  assert.deepEqual(changed({[original]:'a'},{[original]:'a',[added]:'b'}),[added])
})
for(const source of ['finolexindustrieslimited','goodnotes','dentalkart','dhan']){
  test(`relevant input witness retains imported ${source} catalog additions in both gates`,()=>{
    const name=`scraper/${source}/catalog.js`
    assert.deepEqual(changed({},{[name]:'new'}),[name])
  })
}
test('relevant input witness rejects removal and modification of verified files',()=>{
  const name='test/helpers/attackiqNativeOracle20261109.py'
  assert.deepEqual(changed({[name]:'original'},{}),[name])
  assert.deepEqual(changed({[name]:'original'},{[name]:'changed'}),[name])
})
test('relevant input witness includes newly added selected tests and verifier code',()=>{
  const selected='scraper-support/tests/selected.test.js',verifier=evidence[1]
  assert.deepEqual(changed({},{[selected]:'x'},[selected]),[selected])
  assert.deepEqual(changed({},{[verifier]:'x'}),[verifier])
})
test('relevant input witness records unrelated source work without treating it as this suite input',()=>{
  assert.deepEqual(changed({},{'scraper/aptosindia.workday/nativeInventory.js':'external'}),[])
})
