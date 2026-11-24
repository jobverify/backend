import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {nativePrograms} from './currentLexical20261120.js'
import {run} from './script.js'
import './currentIndependentRoot20261121.test.js'
import {fixture,replay} from './currentConfiguredBoard20261121.test.js'
const body=record=>Buffer.from(record.bodyBase64,'base64').toString('utf8')
const original=fixture.responses.find(record=>/\/_next\/.+\.js(?:\?|$)/.test(record.requestedUrl)&&body(record).includes('ashby-embed-script'))
assert(original)
const programURL=original.requestedUrl
const functions = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
const unwrap = node => node?.type === 'SequenceExpression' ? unwrap(node.expressions.at(-1)) : node
function ancestor(program, node, predicate) { for (let at = program.parents.get(node); at; at = program.parents.get(at)) if (predicate(at)) return at; assert.fail('Actual connected ancestor absent') }
function locate(source) {
  const [program] = nativePrograms([{ raw: source, attrs: { type: '' } }])
  const assignments = program.nodes.filter(node => node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && program.member(node.left) === '__Ashby')
  assert.equal(assignments.length, 1, 'One genuine settings assignment')
  const setting = assignments[0], statement = program.parents.get(setting)
  assert.equal(statement.type, 'ExpressionStatement', 'Wrap actual settings statement in its existing callback')
  const effect = ancestor(program, setting, node => functions.has(node.type)), hookCall = program.parents.get(effect)
  assert.equal(hookCall.type, 'CallExpression')
  const hookMember = unwrap(hookCall.callee); assert.equal(program.member(hookMember), 'useEffect')
  const marker = program.nodes.filter(node => node.type === 'Literal' && node.value === 'ashby-embed-script')
  assert.equal(marker.length, 1)
  const result = ancestor(program, marker[0], node => node.type === 'ReturnStatement')
  const renderCall = unwrap(result.argument)
  assert.equal(renderCall.type, 'CallExpression', 'Actual whole final returned application call')
  const renderMember = unwrap(renderCall.callee)
  assert.ok(['jsx', 'jsxs'].includes(program.member(renderMember)))
  return { program, setting, statement, hookMember, renderMember }
}
const replace = (source, node, value) => source.slice(0, node.start) + value + source.slice(node.end)
const cases = [], add = (name, expected, mutate) => cases.push({ name, expected, mutate })
add('Genuine actual factory baseline', 'configured-empty')
for (const [name, wrapper] of [
  ['while false', statement => 'while(false){' + statement + '}'],
  ['while zero', statement => 'while(0){' + statement + '}'],
  ['for zero', statement => 'for(;0;){' + statement + '}'],
  ['while null', statement => 'while(null){' + statement + '}'],
  ['while empty string', statement => "while(''){" + statement + '}'],
]) add('Actual settings behind ' + name, 'hold', (source, located) => replace(source, located.statement, wrapper(source.slice(located.statement.start, located.statement.end))))
for (const condition of ['true', '1', '!0']) add('Actual settings remain reachable behind if ' + condition, 'configured-empty', (source, located) => replace(source, located.statement, 'if(' + condition + '){' + source.slice(located.statement.start, located.statement.end) + '}'))
add('Actual whole return JSX namespace is an unresolved global', 'hold', (source, located) => replace(source, located.renderMember.object, 'unqualifiedCurrentJsxOwner'))
add('Actual whole return JSX helper explicitly returns null', 'hold', (source, located) => replace(source, located.renderMember.object, '({jsx:()=>null,jsxs:()=>null})'))
add('Actual useEffect import identity is replaced with an unresolved module', 'hold', (source, located) => {
  const imported = located.program.resolve(located.hookMember.object)
  assert.equal(imported.type, 'CallExpression'); assert.equal(imported.arguments.length, 1)
  assert.equal(imported.arguments[0].type, 'Literal'); assert.equal(typeof imported.arguments[0].value, 'number')
  assert.notEqual(imported.arguments[0].value, 2147483647)
  return replace(source, imported.arguments[0], '2147483647')
})
add('Actual JSX import identity is replaced with an unresolved module', 'hold', (source, located) => {
  const imported = located.program.resolve(located.renderMember.object)
  assert.equal(imported.type, 'CallExpression'); assert.equal(imported.arguments.length, 1)
  assert.equal(imported.arguments[0].type, 'Literal'); assert.equal(typeof imported.arguments[0].value, 'number')
  assert.notEqual(imported.arguments[0].value, 2147483647)
  return replace(source, imported.arguments[0], '2147483647')
})

for(const item of cases)test('Workday pre-ready: '+item.name,async()=>{let changes=0;const change=item.mutate?(q,url,n)=>{if(url===programURL&&n===1){const next=item.mutate(q.text,locate(q.text));assert.notEqual(next,q.text);parse(next,{ecmaVersion:'latest'});q.text=next;changes++}}:null;let result,error;try{result=await replay(change,{},run)}catch(e){error=e}if(item.mutate)assert.equal(changes,1,'Exactly one actual closing carrier mutated');if(item.expected==='hold'){assert.equal(error?.nativeContradiction,true,error?.message);assert.equal(error?.failureKind,'parser_or_contract_error');return}if(error)throw error;assert.equal(result.calls.length,20);assert.equal(result.jobs.length,0);assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.audit.observations[0].rows.length,84);assert.equal(result.audit.observations[0].rows.filter(r=>r.primaryCountry===null).length,69)})

const dependencyPacket=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-framework-dependencies-20261121.json.gz',import.meta.url))))
function framework(source,name){const[p]=nativePrograms([{raw:source,attrs:{type:''}}]),assignments=p.nodes.filter(n=>n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&p.member(n.left)===name&&functions.has(p.resolve(n.right)?.type));assert.equal(assignments.length,1,'Actual current exported framework implementation');const assignment=assignments[0],value=p.resolve(assignment.right);return{p,assignment,value}}
const frameworkOriginal=dependencyPacket.responses.find(r=>{const text=body(r);return text.includes('react.transitional.element')&&text.includes('.useEffect=')})
assert(frameworkOriginal);const frameworkURL=frameworkOriginal.requestedUrl
test('Workday framework: Separate22 real dependency Responses retain distinct opening and closing observations',()=>{assert.equal(dependencyPacket.responses.length,22);for(const r of dependencyPacket.responses){const bytes=Buffer.from(r.bodyBase64,'base64');assert.equal(bytes.length,r.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.equal(r.status,200);assert.equal(r.method,'GET');assert.equal(r.redirected,false)}for(const url of new Set(dependencyPacket.responses.map(r=>r.requestedUrl)))assert.deepEqual(dependencyPacket.responses.filter(r=>r.requestedUrl===url).map(r=>r.phase),['opening','closing'])})
for(const name of ['jsx','useEffect'])test('Workday framework: Actual imported '+name+' implementation returning null cannot supply ownership',async()=>{let mutations=0;await assert.rejects(replay((q,url,n)=>{if(url!==frameworkURL||n!==1)return;const{p,value}=framework(q.text,name),result=p.nodes.filter(node=>node.type==='ReturnStatement'&&p.parents.get(node)===value.body);assert.equal(result.length,1);q.text=replace(q.text,result[0].argument,'null');parse(q.text,{ecmaVersion:'latest'});mutations++},{},run),e=>e.nativeContradiction===true&&e.failureKind==='parser_or_contract_error');assert.equal(mutations,1)})
test('Workday framework: Coherent current import and actual declared module labels can change together',async()=>{const located=locate(body(original)),imports=[located.program.resolve(located.hookMember.object),located.program.resolve(located.renderMember.object)],ids=new Map(imports.map(n=>[located.program.literal(n.arguments[0]),located.program.literal(n.arguments[0])+2000000]));let changes=0;const result=await replay((q,url,n)=>{if(n!==1||!new URL(url).pathname.endsWith('.js'))return;const tree=parse(q.text,{ecmaVersion:'latest'}),replacements=[];function visit(node){if(!node||typeof node!=='object'||!node.type)return;if(node.type==='Literal'&&ids.has(node.value))replacements.push({start:node.start,end:node.end,value:String(ids.get(node.value))});for(const value of Object.values(node))for(const next of Array.isArray(value)?value:[value])if(next&&typeof next==='object'&&next.type)visit(next)}visit(tree);for(const row of replacements.sort((a,b)=>b.start-a.start))q.text=q.text.slice(0,row.start)+row.value+q.text.slice(row.end);if(replacements.length)changes++},{},run);assert(changes>=3);assert.equal(result.calls.length,20);assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.audit.observations[1].rows.filter(r=>r.primaryCountry===null).length,69)})
test('Workday framework: Actual exports namespace local alias can change without affecting shadowed parameters',async()=>{let changes=0;const result=await replay((q,url,n)=>{if(url!==frameworkURL||n!==1)return;const{p,assignment}=framework(q.text,'jsx'),binding=p.binding(assignment.left.object),nodes=p.nodes.filter(node=>node.type==='Identifier'&&p.binding(node)===binding);assert(nodes.length>2);for(const node of nodes.sort((a,b)=>b.start-a.start))q.text=q.text.slice(0,node.start)+'currentFrameworkExportNamespace'+q.text.slice(node.end);parse(q.text,{ecmaVersion:'latest'});changes++},{},run);assert.equal(changes,1);assert.equal(result.calls.length,20);assert.equal(result.evidence.status,'complete-inventory')})
