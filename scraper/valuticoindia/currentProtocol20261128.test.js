import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readProtocol} from './nativeProtocol20261121.js'
import {runCurrentValutico} from './currentNative20261121.js'
import {API_ACCOUNT} from './nativeData20261121.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-client-20261128.json.gz',import.meta.url))))
const client=fixture.responses.find(row=>row.kind==='client')
const source=Buffer.from(client.bodyBase64,'base64').toString('utf8')
const ast=parse(source,{ecmaVersion:'latest'}),outer=ast.body[0].expression.callee
const modules=new Map(outer.body.body[0].declarations.find(d=>d.id.name==='l').init.properties.map(p=>[p.key.value,p.value]))
function bindings(fn){return new Map(fn.body.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations.map(d=>[d.id.name,d.init]):n.type==='FunctionDeclaration'?[[n.id.name,n]]:[]))}
function replaceInModule(id,before,after){const node=modules.get(id),original=source.slice(node.start,node.end);assert.equal(original.split(before).length,2,'Must mutate one actual current module consumer');return source.slice(0,node.start)+original.replace(before,after)+source.slice(node.end)}
function insertBody(node,statement){assert.equal(node.body.type,'BlockStatement');return source.slice(0,node.body.start+1)+statement+source.slice(node.body.start+1)}

test('genuine registered Valutico current-client prefix retains every original HTTP body and the first failing guard',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.originalCapture,'captures/valuticoindia/after-numeric-redirect');assert.equal(fixture.responses.length,7)
 assert.match(fixture.capturedOutcome.message,/Native generator is not advanced by the active Promise/)
 assert.equal(fixture.responses.reduce((n,row)=>n+row.bytes,0),2307839)
 for(const row of fixture.responses){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(row.method,'GET');assert.equal(row.requestBody,null);assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256)}
 assert.equal(client.sha256,'b8230a454d8af60b967e2d0b260b156143f7a08d064ace6d4655c0c3c46da30a')
})

test('current active configuration/startup/providers bind the same finite public account and native job GET contracts',()=>{
 assert.deepEqual(readProtocol(source),{account:'valutico-2',baseURL:'https://apply.workable.com',accountPath:'/api/v1/accounts/{account}',accountFull:true,jobPath:'/api/v2/accounts/{account}/jobs/{shortcode}',method:'GET',nativeWithCredentials:true,internalBearerConditional:true,scriptExecuted:false})
})

test('current genuine registered prefix reaches only the still-uncaptured exact own account GET and cannot manufacture inventory',async()=>{
 const requests=[],unobserved=Error('CURRENT_ACCOUNT_NOT_CAPTURED')
 const rows=new Map(fixture.responses.map(row=>[row.requestedUrl,row]))
 await assert.rejects(runCurrentValutico({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  requests.push(String(url));assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const row=rows.get(String(url));if(!row){assert.equal(url,API_ACCOUNT);throw unobserved}
  const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
 }}),error=>error===unobserved)
 assert.equal(requests.length,8);assert.equal(requests.at(-1),API_ACCOUNT)
 assert.equal(unobserved.nativeCollectionEvidence.sourceScopeComplete,false);assert.equal(unobserved.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(unobserved.nativeCollectionEvidence.wholeNativeRoleModelsClosingReconciled,false)
 assert.equal(unobserved.nativeCollectionEvidence.nativeRoleObservations.every(row=>row.nativeJob===null),true)
})

for(const[name,id,before,after]of[
 ['public native role route',82762,'d(c)("/api/v2/accounts/".concat(e,"/jobs/").concat(t),{withCredentials:!0})','d(c)("/api/v8/accounts/".concat(e,"/jobs/").concat(t),{withCredentials:!0})'],
 ['GET-only service factory',82762,'return e.get(t,r&&a({},r)||{})','return e.post(t,r&&a({},r)||{})'],
 ['careers service selector',82762,'d(c)("/api/v2/accounts/".concat(e,"/jobs/").concat(t),{withCredentials:!0})','d(l)("/api/v2/accounts/".concat(e,"/jobs/").concat(t),{withCredentials:!0})'],
 ['explicit full native account query',82762,'d(c)("/api/v1/accounts/".concat(e),{params:a({full:!0},t?{lng:t}:{})})','d(c)("/api/v1/accounts/".concat(e),{params:a({full:!1},t?{lng:t}:{})})'],
 ['current transport export',26946,'r.d(t,{Ay:()=>k})','r.d(t,{Ay:()=>O})'],
 ['current role route export',84784,'cs:()=>y','cs:()=>v'],
 ['careers HTTP base selector',26946,'i.careers=o.A.create({baseURL:n,withCredentials:!0})','i.careers=o.A.create({baseURL:"https://foreign.invalid",withCredentials:!0})'],
 ['production careers configuration',5636,'careers:{url:"https://apply.workable.com"}','careers:{url:"https://foreign.invalid"}'],
 ['conditional internal bearer policy',26946,'return n&&(e.careers.interceptors.request.use(w),e.form.interceptors.request.use(w)),e','return(e.careers.interceptors.request.use(w),e.form.interceptors.request.use(w)),e'],
 ['active route-derived account consumer',67728,'u.A.account(c).job(r)','u.A.account("foreign").job(r)'],
 ['active role effect with dormant original decoy',67728,'u.A.account(c).job(r)','({then:function(){function dormantRole(){return u.A.account(c).job(r)}return{catch:function(){}}}})'],
 ['returned provider composition',67728,'n.createElement(W,null,n.createElement(eS.A,null,t))','n.createElement(n.Fragment,null,n.createElement(eS.A,null,t))'],
 ['current Promise next step',96819,'function a(e){tv(i,n,o,a,s,"next",e)}','function a(e){tv(i,n,o,a,s,"throw",e)}'],
 ['current Promise initial advance',96819,'a(void 0)','void a'],
])test('current protocol holds changed '+name+' despite original endpoint decoys',()=>{
 assert.equal(readProtocol(source).method,'GET')
 assert.throws(()=>readProtocol(replaceInModule(id,before,after)+';void "/api/v2/accounts/";void "https://apply.workable.com";'))
})

const entry=bindings(modules.get(96819)),provider=bindings(modules.get(67728))
const service=bindings(modules.get(82762)).get('h').properties.find(p=>p.key.name==='account').value
const methods=service.body.body.find(n=>n.type==='ReturnStatement').argument
for(const[name,node]of[
 ['main',entry.get('tm')],['provider',provider.get('eR')],['composition',provider.get('eC')],['native role effect owner',provider.get('W')],
 ['public job getter',methods.properties.find(p=>p.key.name==='job').value],['native account getter',methods.properties.find(p=>p.key.name==='details').value],
 ['service module',modules.get(82762)],['actual require runtime',outer.body.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='u')],
])test('current '+name+' rejects a new early return retaining dormant original declarations',()=>{
 assert.equal(readProtocol(source).method,'GET');assert.throws(()=>readProtocol(insertBody(node,'if(true)return null;')))
})

test('current known module projection rejects reassignment of the actual exported provider',()=>{
 assert.equal(readProtocol(source).method,'GET')
 const candidates=modules.get(67728).body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.left.type==='MemberExpression'&&n.expression.left.object.name==='eR')
 assert.equal(candidates.length,1);assert.equal(candidates[0].expression.left.property.name,'propTypes')
 const node=candidates[0];assert.throws(()=>readProtocol(source.slice(0,node.start)+'eR=function(){return null};'+source.slice(node.end)))
})

test('new current profile remains finite: an unseen but consistent async binding name is held',()=>{
 assert.equal(readProtocol(source).method,'GET')
 const node=modules.get(96819),body=source.slice(node.start,node.end);assert.equal(body.match(/\btv\b/g).length,3)
 assert.throws(()=>readProtocol(source.slice(0,node.start)+body.replace(/\btv\b/g,'unreviewedStep')+source.slice(node.end)))
})

test('current semantic profile accepts comments in the actual main and outside the client without a whole-body hash gate',()=>{
 const changed=insertBody(entry.get('tm'),'/* same consumed public main */')+';/* unrelated publisher telemetry comment */'
 assert.deepEqual(readProtocol(changed),readProtocol(source))
})
