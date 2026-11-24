import test from 'node:test'
import assert from 'node:assert/strict'
import './currentSourceContract20261121.test.js'
import {HOME,BOARD,ROLE,element,attribute,exact,programme,replay,closing} from './currentConfiguredProjection20261121.test.js'
const held=change=>assert.rejects(replay(change),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')
for(const[label,url,predicate,attrs]of[
 ['board head employer',BOARD,node=>node.tag==='title','data-employer="Other Employer"'],
 ['role head publication',ROLE,node=>node.tag==='title','data-posting-status="withdrawn"'],
 ['board state owner employer',BOARD,node=>node.tag==='body','data-employer="Other Employer"'],
 ['role state owner country',ROLE,node=>node.tag==='body','data-country="India"'],
 ['board mount application alias',BOARD,node=>node.attrs.id==='root','data-application-url="https://other.example/apply"'],
 ['role mount application alias',ROLE,node=>node.attrs.id==='root','data-application-url="https://other.example/apply"']
])test('Datafold actual native carrier constrains '+label,()=>held(closing(url,html=>element(html,predicate,(source,node)=>attribute(source,node,attrs)))))

test('Datafold native carrier keeps coherent same-role application metadata',async()=>assert.equal((await replay(closing(ROLE,html=>element(html,node=>node.attrs.id==='root',(source,node)=>attribute(source,node,'data-application-url="'+ROLE+'/application"'))))).evidence.status,'complete-inventory'))

for(const[label,code]of[['Object identity','void Object.is(job,job);'],['Array identity','void Array.isArray(job);']])test('Datafold current state accepts coherent read-only '+label,async()=>assert.equal((await replay(closing(HOME,html=>programme(html,source=>exact(source,'          return {\n            title: job.title,','          '+code+'\n          return {\n            title: job.title,'))))).evidence.status,'complete-inventory'))
