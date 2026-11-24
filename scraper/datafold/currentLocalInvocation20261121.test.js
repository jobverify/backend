import test from 'node:test'
import assert from 'node:assert/strict'
import './currentOwnBoundary20261121.test.js'
import {HOME,exact,programme,replay,closing} from './currentConfiguredProjection20261121.test.js'

const change=code=>closing(HOME,html=>programme(html,source=>exact(source,'          return {\n            title: job.title,','          '+code+'\n          return {\n            title: job.title,')))
const held=code=>assert.rejects(replay(change(code)),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')
for(const[label,call]of[
 ['bound helper','var alter=clearJob.bind(null); alter(job);'],
 ['prebound same-role helper','var alter=clearJob.bind(null,job); alter();'],
 ['call helper','clearJob.call(null,job);'],
 ['apply helper','clearJob.apply(null,[job]);'],
 ['Reflect.apply helper','Reflect.apply(clearJob,null,[job]);'],
 ['spread helper','clearJob(...[job]);'],
 ['member-mutated local helper invocation tuple','var inputs=[{}]; inputs[0]=job; clearJob(...inputs);'],
 ['unknown helper argument provider','function getInputs(){return [job];} clearJob(...getInputs());']
])test('Datafold full current collector rejects actual local '+label+' record mutation',()=>held('function clearJob(value){value.id="other";} '+call))

for(const[label,code]of[
 ['bound reader','function readJob(value){return value.id;} var read=readJob.bind(null); void read(job);'],
 ['reflected reader','function readJob(value){return value.id;} void Reflect.apply(readJob,null,[job]);'],
 ['unused mutation helper','function clearUncalled(value){value.id="other";} void clearUncalled;'],
 ['unrelated sparse apply analytics','void Math.max.apply(null,[,1]);']
])test('Datafold full current collector accepts coherent local '+label,async()=>assert.equal((await replay(change(code))).evidence.status,'complete-inventory'))
