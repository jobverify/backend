import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {nativePrograms} from './currentLexical20261120.js'
import {run} from './script.js'
import './currentIndependentWorkday20261121.test.js'
import {fixture,replay} from './currentConfiguredBoard20261121.test.js'
const deps=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-framework-dependencies-20261121.json.gz',import.meta.url)))),body=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const frameworkOriginal=deps.responses.find(r=>body(r).includes('react.transitional.element')&&body(r).includes('.useEffect='));assert(frameworkOriginal)
const frameworkURL=frameworkOriginal.requestedUrl
function locate(source,name){const[p]=nativePrograms([{raw:source,attrs:{type:''}}]),a=p.nodes.filter(n=>n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&p.member(n.left)===name&&functions.has(p.resolve(n.right)?.type));assert.equal(a.length,1);const assignment=a[0],value=p.resolve(assignment.right);assert.equal(value.body.type,'BlockStatement');const returns=p.nodes.filter(n=>n.type==='ReturnStatement'&&p.parents.get(n)===value.body);assert.equal(returns.length,1);return{p,assignment,value,result:returns[0]}}
const insert=(s,at,text)=>s.slice(0,at)+text+s.slice(at)
const cases=[],add=(name,expected,mutate)=>cases.push({name,expected,mutate})
add('Unchanged actual full default collector preserves20 genuine requests','configured-empty')
add('Actual JSX component parameter is discarded before its original return','hold',s=>{const{value}=locate(s,'jsx');return insert(s,value.body.start+1,value.params[0].name+'=null;')})
add('Actual JSX input props parameter is replaced before copying','hold',s=>{const{value}=locate(s,'jsx');return insert(s,value.body.start+1,value.params[1].name+'={};')})
add('Actual JSX returned props container is replaced after copying','hold',s=>{const{value,result}=locate(s,'jsx');return insert(s,result.start,value.params[2].name+'={};')})
add('Actual effect callback parameter is replaced with a no-op','hold',s=>{const{value}=locate(s,'useEffect');return insert(s,value.body.start+1,value.params[0].name+'=()=>{};')})
add('Actual exported dispatcher H is replaced by a no-op effect owner','hold',s=>{const{p,value,assignment}=locate(s,'useEffect'),result=p.nodes.find(n=>n.type==='ReturnStatement'&&p.parents.get(n)===value.body),dispatcher=result.argument.callee.object;assert.equal(dispatcher.type,'MemberExpression');assert.equal(p.member(dispatcher),'H');assert.equal(dispatcher.object.type,'Identifier');return s.slice(0,assignment.start)+'('+dispatcher.object.name+'.H={useEffect(){return null}},'+s.slice(assignment.start,assignment.end)+')'+s.slice(assignment.end)})
add('Unrelated literal framework note does not pin the whole original function','configured-empty',s=>{const{value}=locate(s,'jsx');return insert(s,value.body.start+1,'const currentIndependentFrameworkNote=1;')})
add('A separate shadowed parameter write does not replace actual JSX props','configured-empty',s=>{const{value}=locate(s,'jsx');return insert(s,value.body.start+1,'function currentIndependentShadow('+value.params[0].name+'){'+value.params[0].name+'=null;}')})

for(const item of cases)test('Root framework values: '+item.name,async()=>{let changes=0;const change=item.mutate?(q,url,n)=>{if(url===frameworkURL&&n===1){const original=q.text;q.text=item.mutate(q.text);assert.notEqual(q.text,original);parse(q.text,{ecmaVersion:'latest'});changes++}}:null;let result,error;try{result=await replay(change,{},run)}catch(e){error=e}if(item.mutate)assert.equal(changes,1);if(item.expected==='hold'){assert.equal(error?.nativeContradiction,true,error?.message);assert.equal(error?.failureKind,'parser_or_contract_error');return}if(error)throw error;assert.equal(result.jobs.length,0);assert.equal(result.calls.length,20);assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.audit.observations[0].rows.filter(r=>r.primaryCountry===null).length,69)})
