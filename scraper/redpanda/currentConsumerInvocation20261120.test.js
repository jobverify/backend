import test from 'node:test'
import assert from 'node:assert/strict'
import {currentAuthority} from './currentPublisher20261120.js'
import {fixture,html,program,exact,element,attribute} from './currentSourceCore20261120.test.js'
import './currentCompositeWorkplace20261120.test.js'

const cases=[
 ['Object.assign spread','Object.assign(...[ALL_JOBS,{length:0}]);',false],
 ['Object.assign sparse spread','Object.assign(...[ALL_JOBS,,{length:0}]);',false],
 ['Object.assign call','Object.assign.call(null,ALL_JOBS,{length:0});',false],
 ['Object.assign apply','Object.assign.apply(null,[ALL_JOBS,{length:0}]);',false],
 ['bound Object.assign','var mutate=Object.assign.bind(Object); mutate(ALL_JOBS,{length:0});',false],
 ['prebound Object.assign','var mutate=Object.assign.bind(Object,ALL_JOBS); mutate({length:0});',false],
 ['bound Reflect.set','var mutate=Reflect.set.bind(Reflect); mutate(ALL_JOBS,"length",0);',false],
 ['Reflect.set call','Reflect.set.call(null,ALL_JOBS,"length",0);',false],
 ['Reflect.set apply','Reflect.set.apply(null,[ALL_JOBS,"length",0]);',false],
 ['Array.prototype.pop call','Array.prototype.pop.call(ALL_JOBS);',false],
 ['Array.prototype.splice apply','Array.prototype.splice.apply(ALL_JOBS,[0]);',false],
 ['bound Array.prototype.pop','var mutate=Array.prototype.pop.bind(ALL_JOBS); mutate();',false],
 ['bound Object.defineProperty','var mutate=Object.defineProperty.bind(Object); mutate(ALL_JOBS,"length",{value:0});',false],
 ['unused bound Object.assign','var unused=Object.assign.bind(Object,ALL_JOBS); void unused;',true],
 ['readonly Object.assign copy','Object.assign({},ALL_JOBS);',true],
 ['readonly alias copy','var copy=Object.assign; copy({},ALL_JOBS);',true],
 ['unrelated sparse spread','Math.max(...[,1]);',true],
 ['unrelated sparse apply','Math.max.apply(null,[,1]);',true],
 ['unused local collection shadow','function unused(ALL_JOBS){ALL_JOBS.pop();} void unused;',true]
]
for(const[label,code,qualified]of cases)test('Redpanda consumer invocation: '+label,()=>{const changed=program(html,source=>exact(source,'  init();','  '+code+'\n  init();'));if(qualified)assert.equal(currentAuthority(changed,fixture.observedAt).consumerProof.connected,true);else assert.throws(()=>currentAuthority(changed,fixture.observedAt),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')})
test('Redpanda consumer module: actual module carrier preserves its original DOM identity',()=>{const changed=element(html,node=>node.tag==='script'&&(node.raw??'').includes("var ASHBY_BOARD = 'redpanda-data';"),(source,node)=>attribute(source,node,'type="module"'));assert.equal(currentAuthority(changed,fixture.observedAt).consumerProof.connected,true)})
