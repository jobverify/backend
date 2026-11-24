import './currentIndependentBoundary20261120.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import catalog from './catalog.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {replay,element,BOARD} from './currentConfiguredBoard20261120.test.js'
const exact=(source,old,next)=>{assert.equal(source.split(old).length,2,'Unique original classic-state target');assert.notEqual(old,next);return source.replace(old,()=>next)}
const append=(code,type)=>html=>exact(html,'</body>','<script'+(type?' type="'+type+'"':'')+'>'+code+'</script></body>')
async function qualifies(change,expected){let changes=0,error,result;try{result=await replay(change?(q,u,n)=>{if(u===BOARD&&n===1){const before=q.text;q.text=change(before);assert.notEqual(q.text,before);changes++}}:undefined)}catch(e){error=e}if(change)assert.equal(changes,1,'Guarded current native closing change applied exactly once');if(expected==='hold'){assert(error,'Known current state overwrite must refuse configured zero');assert.equal(error.nativeContradiction,true);assert.equal(error.failureKind,'parser_or_contract_error');return}if(error)throw error;const assessment=assessSoftFailureAcquisition(catalog,result.jobs);assert.equal(result.jobs.length,0);assert.equal(result.evidence.status,'complete-inventory');assert.equal(assessment.zeroJobEvidence,'fetched-zero');assert.equal(assessment.runnerOutcome.success,true);assert.equal(assessment.cleanupOptions.replaceExisting,false);assert.equal(result.audit.companyIndiaTotal,null);assert.equal(result.audit.nativeProgramsExecuted,false)}
for(const[label,code,type]of[
 ['unchanged current original',null],
 ['unrelated sparse spread','Math.max(...[,1]);'],
 ['unrelated sparse apply','Math.max.apply(null,[,1]);'],
 ['unrelated classic var','var classicUnrelatedRelease={version:2};'],
 ['function-local native name','function classicLocal(){var __appData={ordinary:true};return __appData;}'],
 ['module-local native name','var __appData={ordinary:true};','module'],
 ['class static-block native name','class ClassicLocal{static{var __appData={ordinary:true};this.value=__appData;}}'],
 ['unused bound mutator','const classicUnusedBound=Object.assign.bind(Object,window);'],
 ['unused spread arguments','const classicUnusedArguments=[window,{__appData:{ordinary:true}}];'],
 ['unrelated invoked spread analytics','Object.assign(...[window,{classicReleaseAnalytics:{version:2}}]);']
])test('Common classic state compatibility: '+label,()=>qualifies(code?append(code,type):null,'configured-empty'))
test('Common classic state compatibility: uppercase actual executable MIME',()=>qualifies(html=>element(html,n=>n.tag==='script'&&!n.attrs.src&&(n.raw??'').includes('window.__appData ='),(source,n)=>{assert.equal(n.attrs.type,undefined);const offset=n.openEnd-n.start-1;return source.slice(0,offset)+' type="Text/JavaScript"'+source.slice(offset)}),'configured-empty'))
for(const[label,code,type]of[
 ['unqualified global assignment','__appData={};'],
 ['classic var initializer','var __appData={};'],
 ['classic function declaration','function __appData(){}'],
 ['object destructuring identifier','({current:__appData}={current:{}});'],
 ['array destructuring identifier','[__appData]=[{}];'],
 ['for-of identifier','for(__appData of[{}]){}'],
 ['delete identifier','delete __appData;'],
 ['literal argument spread','Object.assign(...[window,{__appData:{}}]);'],
 ['immutable argument-array spread','const classicArguments=[window,{__appData:{}}];Object.assign(...classicArguments);'],
 ['bound partial-argument spread','const classicBound=Object.assign.bind(Object,...[window]);classicBound({__appData:{}});'],
 ['apply nested argument spread','Object.assign.apply(null,[...[window],{__appData:{}}]);'],
 ['known object source spread','Object.assign(window,{...{__appData:{}}});'],
 ['sparse critical argument spread','Object.assign(...[window,,{__appData:{}}]);'],
 ['known member destructuring','({current:window.__appData}={current:{}});'],
 ['mixed-case active MIME','window.__appData={};','Text/JavaScript']
])test('Common classic state overwrite: '+label,()=>qualifies(append(code,type),'hold'))
