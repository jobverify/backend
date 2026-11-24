import test from 'node:test'
import assert from 'node:assert/strict'
import {replay,BOARD,close,element,attr} from './currentConfiguredBoard20261120.test.js'
const exact=(text,before,after)=>{assert.equal(text.split(before).length,2,'Actual original native mutation target');assert.notEqual(before,after);return text.replace(before,()=>after)},append=(code,type)=>close(BOARD,text=>exact(text,'</body>','<script'+(type?' type="'+type+'"':'')+'>'+code+'</script></body>'))
async function positive(change){const result=await replay(change);assert.equal(result.jobs.length,0);assert.equal(result.calls.length,6);assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.runnerOutcome.success,true);assert.equal(result.audit.nativeOpeningInventory.length,8);assert.equal(result.audit.nativeClosingInventory.length,8);assert.equal(result.audit.companyIndiaTotal,null);assert.equal(result.assessment.cleanupOptions.replaceExisting,false)}
async function negative(change){await assert.rejects(replay(change),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')}
const probes=[
 ['Actual paired native inventory remains qualified','positive'],
 ['Unrelated classic var initialization remains separate','positive',append('var peerUnrelatedStateRelease={version:2};')],
 ['Function-local native name remains local','positive',append('function peerLocalState(){var __appData={ordinary:true};return __appData;}')],
 ['Module-local native name does not write window state','positive',append('var __appData={ordinary:true};','module')],
 ['Class static-block native variable remains local','positive',append('class PeerLocalNativeState{static{var __appData={ordinary:true};this.value=__appData;}}')],
 ['Unused bound global mutator has no native effect','positive',append('const peerUnusedNativeState=Object.assign.bind(Object,window);')],
 ['Unused spread argument data has no invocation effect','positive',append('const peerUnusedStateArguments=[window,{__appData:{ordinary:true}}];')],
 ['Known unrelated spread global analytics remains separate','positive',append('Object.assign(...[window,{peerNativeAnalytics:{version:2}}]);')],
 ['Uppercase original executable JavaScript MIME retains the same model','positive',close(BOARD,text=>element(text,node=>node.tag==='script'&&!node.attrs.src&&(node.raw??'').includes('window.__appData ='),(value,node)=>{assert.equal(node.attrs.type,undefined);return attr(value,node,'type="Text/JavaScript"')}))],
 ...[
  ['Unqualified native global assignment','__appData={};'],
  ['Classic native global var initializer','var __appData={};'],
  ['Classic native global function declaration','function __appData(){}'],
  ['Object destructuring native global target','({current:__appData}={current:{}});'],
  ['Array destructuring native global target','[__appData]=[{}];'],
  ['For-of native global target','for(__appData of[{}]){}'],
  ['Delete unqualified native global','delete __appData;'],
  ['Literal spread native Object.assign','Object.assign(...[window,{__appData:{}}]);'],
  ['Immutable array spread native Object.assign','const peerStateArguments=[window,{__appData:{}}];Object.assign(...peerStateArguments);'],
  ['Bound method partial-argument spread','const peerStateBound=Object.assign.bind(Object,...[window]);peerStateBound({__appData:{}});'],
  ['Apply with nested spread target','Object.assign.apply(null,[...[window],{__appData:{}}]);'],
  ['Known object-source spread still changes native state','Object.assign(window,{...{__appData:{}}});'],
  ['Member target native destructuring is still qualified','({current:window.__appData}={current:{}});']
 ].map(([name,code])=>[name,'negative',append(code)]),
 ['Mixed-case executable own native mutation is still active','negative',append('window.__appData={};','Text/JavaScript')]
]
for(const[name,kind,change]of probes)test('Global state common: '+name,async()=>{await(kind==='positive'?positive(change):negative(change))})
export{positive,negative,append}
