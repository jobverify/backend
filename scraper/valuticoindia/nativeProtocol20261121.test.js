import test from 'node:test'
import {parse} from 'acorn'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {readProtocol} from './nativeProtocol20261121.js'
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-prefix-20261121.json.gz',import.meta.url))))
const source=Buffer.from(fixture.responses.find(r=>r.kind==='client').bodyBase64,'base64').toString('utf8')
const change=(before,after)=>{assert.equal(source.split(before).length,2,'Mutation must target one current native consumer');return source.replace(before,after)}
test('actual current consumed client binds public account/job GET and conditional internal auth',()=>{
 const p=readProtocol(source)
 assert.equal(p.baseURL,'https://apply.workable.com');assert.equal(p.account,'valutico-2')
 assert.equal(p.nativeWithCredentials,true);assert.equal(p.internalBearerConditional,true)
})
for(const[name,before,after]of[
 ['changed actual job route','d(c)("/api/v2/accounts/".concat(e,"/jobs/").concat(t),{withCredentials:!0})','d(c)("/api/v8/accounts/".concat(e,"/jobs/").concat(t),{withCredentials:!0})'],
 ['wrong client selector','d(c)("/api/v2/accounts/".concat(e,"/jobs/").concat(t),{withCredentials:!0})','d(l)("/api/v2/accounts/".concat(e,"/jobs/").concat(t),{withCredentials:!0})'],
 ['dormant nested role consumer','u.A.account(c).job(r)','({then:function(){function dormantRole(){return u.A.account(c).job(r)}return{catch:function(){}}}})'],
 ['disconnected returned role provider','n.createElement(W,null,n.createElement(eS.A,null,t))','n.createElement(n.Fragment,null,n.createElement(eS.A,null,t))'],
 ['foreign native production careers base','careers:{url:"https://apply.workable.com"}','careers:{url:"https://foreign.invalid"}'],
 ['foreign consumed careers instance','i.careers=o.A.create({baseURL:n,withCredentials:!0})','i.careers=o.A.create({baseURL:"https://foreign.invalid",withCredentials:!0})']
])test(name+' held even with unconsumed original route/base decoys',()=>{
 readProtocol(source)
 assert.throws(()=>readProtocol(change(before,after)+';void "/api/v2/accounts/";void "https://apply.workable.com";'))
})
test('unrelated comment/telemetry changes are not a whole-program byte gate',()=>{
 assert.deepEqual(readProtocol(source+';/* unrelated publisher telemetry */'),readProtocol(source))
})

test('uninvoked native bootstrap is not an active protocol consumer',()=>{
 readProtocol(source)
 assert.throws(()=>readProtocol(change('u(96819)','(()=>{function dormantBootstrap(){return u(96819)}return{}})()')))
})

test('uninvoked native startup renderer is not an active provider consumer',()=>{
 readProtocol(source)
 const ast=parse(source,{ecmaVersion:'latest'}),map=ast.body[0].expression.callee.body.body[0].declarations.find(d=>d.id.name==='l').init
 const module=map.properties.find(p=>p.key.value===96819).value,candidates=[]
 function visit(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='i'&&n.arguments[0]&&source.slice(n.arguments[0].start,n.arguments[0].end).includes('n.createElement(tm'))candidates.push(n);for(const v of Object.values(n)){if(Array.isArray(v)){for(const child of v)if(child?.type)visit(child)}else if(v?.type)visit(v)}}
 visit(module);assert.equal(candidates.length,1)
 const node=candidates[0],call=source.slice(node.start,node.end)
 const dormant=source.slice(0,node.start)+'(()=>{function dormantNativeRender(){return '+call+'}return{}})()'+source.slice(node.end)
 assert.throws(()=>readProtocol(dormant))
})

function originalControlScopes(){
 const ast=parse(source,{ecmaVersion:'latest'}),map=ast.body[0].expression.callee.body.body[0].declarations.find(d=>d.id.name==='l').init
 const modules=new Map(map.properties.map(p=>[p.key.value,p.value]))
 const bindings=fn=>new Map(fn.body.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations.map(d=>[d.id.name,d.init]):n.type==='FunctionDeclaration'?[[n.id.name,n]]:[]))
 const entry=bindings(modules.get(96819)),provider=bindings(modules.get(67728)),account=bindings(modules.get(82762)).get('h').properties.find(p=>p.key.name==='account').value
 const methods=account.body.body.find(n=>n.type==='ReturnStatement').argument
 return{main:entry.get('tm'),job:methods.properties.find(p=>p.key.name==='job').value,details:methods.properties.find(p=>p.key.name==='details').value,composition:provider.get('eC'),loader:provider.get('W'),serviceModule:modules.get(82762)}
}
for(const[name,scope,statement]of[
 ['actual rendered main','main','if(true)return null;'],
 ['actual public job GET','job','if(true)return Promise.resolve({});'],
 ['returned provider composition','composition','throw Error("disconnected provider");'],
 ['active role loading component','loader','while(true){return null;}'],
 ['account details getter','details','if(true)return Promise.resolve({});'],
 ['active service module execution','serviceModule','if(true)return null;']
])test(name+' cannot retain dormant original declarations after inserted control flow',()=>{
 readProtocol(source);const node=originalControlScopes()[scope]
 assert.equal(node.body?.type,'BlockStatement','Mutation must target actual native execution body')
 const changed=source.slice(0,node.body.start+1)+statement+source.slice(node.body.start+1)
 assert.throws(()=>readProtocol(changed))
})
test('reviewed critical body projection allows an unrelated source comment in its actual function',()=>{
 const node=originalControlScopes().main
 const changed=source.slice(0,node.body.start+1)+'/* native semantic body unchanged */'+source.slice(node.body.start+1)
 assert.deepEqual(readProtocol(changed),readProtocol(source))
})

test('conditional false around actual runtime entry cannot donate dormant module declarations',()=>{
 readProtocol(source);assert.throws(()=>readProtocol(change('u(96819)','(false&&u(96819))')))
})
test('require runtime cannot bypass actual reviewed module-map invocation',()=>{
 readProtocol(source);const ast=parse(source,{ecmaVersion:'latest'}),outer=ast.body[0].expression.callee,runtime=outer.body.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='u')
 assert.equal(runtime.body.type,'BlockStatement')
 const changed=source.slice(0,runtime.body.start+1)+'if(true)return null;'+source.slice(runtime.body.start+1)
 assert.throws(()=>readProtocol(changed))
})
test('actual runtime entry comment does not create a whole-source literal gate',()=>{
 assert.deepEqual(readProtocol(change('u(96819)','u(/* unchanged entry */96819)')),readProtocol(source))
})

function actualProviderPropertyAssignment(){
 const ast=parse(source,{ecmaVersion:'latest'}),map=ast.body[0].expression.callee.body.body[0].declarations.find(d=>d.id.name==='l').init
 const module=map.properties.find(p=>p.key.value===67728).value
 const matches=module.body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.left.type==='MemberExpression'&&n.expression.left.object.name==='eR')
 assert.equal(matches.length,1,'Mutation must target the sole actual provider property assignment')
 assert.equal(matches[0].expression.left.property.name,'propTypes')
 return matches[0]
}

test('consumed module binding rejects an in-place reassignment of its exported provider',()=>{
 readProtocol(source)
 const node=actualProviderPropertyAssignment()
 const changed=source.slice(0,node.start)+'eR=function(){return null};'+source.slice(node.end)
 assert.throws(()=>readProtocol(changed))
})

test('consumed module binding permits a comment beside the actual provider property assignment',()=>{
 const node=actualProviderPropertyAssignment()
 const changed=source.slice(0,node.start)+'/* unchanged consumed module binding */'+source.slice(node.start)
 assert.deepEqual(readProtocol(changed),readProtocol(source))
})
