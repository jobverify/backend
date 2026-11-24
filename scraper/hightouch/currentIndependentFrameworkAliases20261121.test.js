import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {nativePrograms} from './currentLexical20261120.js'
import {run} from './script.js'
import './currentIndependentFrameworkValues20261121.test.js'
import {fixture,replay} from './currentConfiguredBoard20261121.test.js'
const deps=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-framework-dependencies-20261121.json.gz',import.meta.url)))),body=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
const functions=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'])
const frameworkOriginal=deps.responses.find(r=>body(r).includes('react.transitional.element')&&body(r).includes('.useEffect='));assert(frameworkOriginal)
const frameworkURL=frameworkOriginal.requestedUrl
function locate(source,name){const[p]=nativePrograms([{raw:source,attrs:{type:''}}]),a=p.nodes.filter(n=>n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&p.member(n.left)===name&&functions.has(p.resolve(n.right)?.type));assert.equal(a.length,1);const assignment=a[0],value=p.resolve(assignment.right);assert.equal(value.body.type,'BlockStatement');const returns=p.nodes.filter(n=>n.type==='ReturnStatement'&&p.parents.get(n)===value.body);assert.equal(returns.length,1);return{p,assignment,value,result:returns[0]}}
const insert=(s,at,text)=>s.slice(0,at)+text+s.slice(at)
const cases=[],add=(name,expected,mutate)=>cases.push({name,expected,mutate})
add('Actual JSX input props assigned alias cannot replace the same-role ID','hold',s=>{const{value}=locate(s,'jsx');return insert(s,value.body.start+1,'let independentAlias;independentAlias='+value.params[1].name+';independentAlias.jobPostingId="other";')})
add('Actual JSX returned props assigned alias cannot replace the same-role ID','hold',s=>{const{value,result}=locate(s,'jsx');return insert(s,result.start,'let independentAlias;independentAlias='+value.params[2].name+';independentAlias.jobPostingId="other";')})
add('Actual effect dispatcher assigned alias cannot discard callback owner','hold',s=>{const{p,value,assignment}=locate(s,'useEffect'),result=p.nodes.find(n=>n.type==='ReturnStatement'&&p.parents.get(n)===value.body),dispatcher=result.argument.callee.object;assert.equal(dispatcher.type,'MemberExpression');assert.equal(p.member(dispatcher),'H');assert.equal(dispatcher.object.type,'Identifier');return s.slice(0,assignment.start)+'(function(){let independentAlias;independentAlias='+dispatcher.object.name+';independentAlias.H={useEffect(){return null}};})(),'+s.slice(assignment.start)})
add('Readonly constant input-props alias remains coherent','configured-empty',s=>{const{value}=locate(s,'jsx');return insert(s,value.body.start+1,'const independentAlias='+value.params[1].name+';void independentAlias.jobPostingId;')})
add('Unrelated assigned object alias remains coherent','configured-empty',s=>{const{value}=locate(s,'jsx');return insert(s,value.body.start+1,'let independentAlias;independentAlias={};independentAlias.jobPostingId="unrelated";')})

for(const item of cases)test('Workday framework aliases: '+item.name,async()=>{let changes=0;const change=item.mutate?(q,url,n)=>{if(url===frameworkURL&&n===1){const original=q.text;q.text=item.mutate(q.text);assert.notEqual(q.text,original);parse(q.text,{ecmaVersion:'latest'});changes++}}:null;let result,error;try{result=await replay(change,{},run)}catch(e){error=e}if(item.mutate)assert.equal(changes,1);if(item.expected==='hold'){assert.equal(error?.nativeContradiction,true,error?.message);assert.equal(error?.failureKind,'parser_or_contract_error');return}if(error)throw error;assert.equal(result.jobs.length,0);assert.equal(result.calls.length,20);assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.audit.observations[0].rows.filter(r=>r.primaryCountry===null).length,69)})
