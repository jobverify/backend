import test from 'node:test'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {createRakutenScraper} from './script.js'
import metadata from './catalog.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-public-pair-20261121.json.gz',import.meta.url))))
const sha=b=>createHash('sha256').update(b).digest('hex')
const HOME='https://corp.rakuten.co.in/',PORTAL='https://rakuten.openings.co/',PAGE=PORTAL+'rakuten/',CLIENT=fixture.responses.find(r=>r.requestedUrl.endsWith('.js')).requestedUrl,CONFIG='https://apic2.zwayam.com/data-service/v2/company/15124/careersite-configurations',LIST='https://apic2.zwayam.com/jobs/search',DETAIL='https://apic2.zwayam.com/jobs-service/v1/jobs/careersite',AT=fixture.closingObservedAt??'2026-11-20T22:06:48.543Z',TARGET='5005402'
const decode=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8');let originalBytes=0
for(const row of fixture.responses){const b=Buffer.from(row.bodyBase64,'base64');assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);assert([200,301].includes(row.status));assert.equal(row.redirected,false);originalBytes+=b.length;if(row.requestBodyBase64){const request=Buffer.from(row.requestBodyBase64,'base64');assert.equal(request.length,row.requestBodyBytes);assert.equal(sha(request),row.requestBodySha256)}}
assert.equal(fixture.responses.length,26);assert.equal(originalBytes,5678252)
const originalProgram=decode(fixture.responses.find(r=>r.requestedUrl===CLIENT)),tree=parse(originalProgram,{ecmaVersion:'latest',sourceType:'module'}),nodes=[],parents=new Map()
function visit(n,p){if(!n||typeof n.type!=='string')return;nodes.push(n);if(p)parents.set(n,p);for(const v of Object.values(n))for(const c of Array.isArray(v)?v:[v])if(c&&typeof c.type==='string')visit(c,n)}visit(tree)
const key=n=>n?.name??n?.value,mem=n=>n?.type==='Identifier'?n.name:n?.type==='ThisExpression'?'this':n?.type==='MemberExpression'?mem(n.object)+'.'+key(n.property):null,one=(v,label)=>{assert.equal(v.length,1,label);return v[0]},within=(n,p)=>{for(let a=n;a;a=parents.get(a))if(a===p)return true;return false}
const environment=one(nodes.filter(n=>n.type==='VariableDeclarator'&&n.init?.type==='ObjectExpression'&&['COMPANYID','DOMAIN','APIENDPOINTNEW'].every(k=>n.init.properties.some(p=>key(p.key)===k))),'actual environment'),env=environment.id.name,declaration=parents.get(environment)
assert.equal(declaration.type,'VariableDeclaration')
const method=one(nodes.filter(n=>n.type==='MethodDefinition'&&key(n.key)==='searchJobsv1'),'actual search method');let service=parents.get(method);while(service&&!['ClassDeclaration','ClassExpression'].includes(service.type))service=parents.get(service);assert(service)
const serviceHost=one(nodes.filter(n=>n.type==='AssignmentExpression'&&within(n,service)&&mem(n.left)==='this.SERVER_HOST'&&originalProgram.slice(n.right.start,n.right.end).includes('APIENDPOINTNEW')),'actual service host')
const endpoints=one(nodes.filter(n=>n.type==='AssignmentExpression'&&mem(n.left)==='this.API_LIST'&&n.right.type==='ObjectExpression'&&n.right.properties.some(p=>key(p.key)==='getJobData')),'actual endpoint registry')
const defaults=one(nodes.filter(n=>n.type==='AssignmentExpression'&&mem(n.left)==='this.searchJobsv1Params'&&n.right.type==='ObjectExpression'),'actual search defaults')
const range=(source,node,value)=>source.slice(0,node.start)+value+source.slice(node.end)
const script=change=>(q,u,n)=>{if(u===CLIENT&&n===1){assert.equal(q.text,originalProgram,'Actual unchanged original programme carrier');q.text=change(q.text);parse(q.text,{ecmaVersion:'latest',sourceType:'module'})}}
const afterEnvironment=code=>script(s=>s.slice(0,declaration.end)+';'+code+';'+s.slice(declaration.end))
const config=change=>(q,u,n)=>{if(u===CONFIG&&n===1){const m=JSON.parse(q.text);change(m.reponseObject.company,m);q.text=JSON.stringify(m)}}
const detail=change=>(q,u,_n,params,phase)=>{if(u===DETAIL&&String(params.jobId)===TARGET&&phase===1){const m=JSON.parse(q.text);change(m);q.text=JSON.stringify(m)}}
const listing=change=>(q,u,n)=>{if(u===LIST&&n===1){const m=JSON.parse(q.text),r=m.data.data.find(w=>String(w._id)===TARGET);assert(r);change(r._source,m);q.text=JSON.stringify(m)}}
const cases=[],add=(name,expected,change,check)=>cases.push({name,expected,change,check})
const afterActual=(node,code)=>script(s=>range(s,node,'('+s.slice(node.start,node.end)+','+code+')'))
const serviceConstructor=one(service.body.body.filter(n=>n.type==='MethodDefinition'&&key(n.key)==='constructor'),'actual selected service constructor')
const serviceInit=one(nodes.filter(n=>n.type==='CallExpression'&&within(n,serviceConstructor)&&mem(n.callee)==='this.setApiEndpointsFromSession'),'actual constructor endpoint initialization')
add('Whole-instance host replacement through intrinsic call holds','source-hold',afterActual(serviceInit,'Object.assign.call(null,this,{SERVER_HOST:"https://other.example/"})'))
add('Whole-instance registry replacement through intrinsic apply holds','source-hold',afterActual(endpoints,'Object.assign.apply(null,[this,{API_LIST:{...this.API_LIST,search:{...this.API_LIST.search,v1:"jobs/private-search"}}}])'))
add('Whole-instance host replacement through bound reflector holds','source-hold',afterActual(serviceInit,'Reflect.set.bind(null,this,"SERVER_HOST")("https://other.example/")'))
add('Whole-instance defaults replacement through Reflect.apply holds','source-hold',afterActual(defaults,'Reflect.apply(Object.assign,null,[this,{searchJobsv1Params:{filterCri:{...this.searchJobsv1Params.filterCri,anyOfTheseWords:"unrelated-filter"},domain:this.searchJobsv1Params.domain,companyId:this.searchJobsv1Params.companyId}}])'))
add('Whole-instance readonly copy through intrinsic call is coherent','all',afterActual(serviceInit,'Object.assign.call(null,{},this)'))
add('Whole-instance readonly copy through intrinsic apply is coherent','all',afterActual(serviceInit,'Object.assign.apply(null,[{},this])'))
add('Whole-instance readonly copy through bound intrinsic is coherent','all',afterActual(serviceInit,'Object.assign.bind(null,{})(this)'))
add('Whole-instance readonly copy through Reflect.apply is coherent','all',afterActual(serviceInit,'Reflect.apply(Object.assign,null,[{},this])'))

for(const item of cases)test('Rakuten independent finite invocations: '+item.name,async t=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Independent offline review prohibits unbound network')};t.after(()=>{globalThis.fetch=oldFetch})
 const counts=new Map(),details=new Map(),calls=[];let changed=0,harness,error,jobs
 try{jobs=await createRakutenScraper().run({now:AT,requestIntervalMs:0,fetchImpl:async(input,init)=>{try{const url=String(input?.url??input),n=counts.get(url)??0;counts.set(url,n+1);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');let params,phase,original
  if(url===DETAIL){params=JSON.parse(init.body);phase=details.get(params.jobId)??0;details.set(params.jobId,phase+1);original=fixture.responses.filter(r=>r.requestedUrl===url&&r.requestJSON.jobId===params.jobId)[phase];assert(original);assert.deepEqual(params,original.requestJSON)}else original=fixture.responses.filter(r=>r.requestedUrl===url)[n]
  assert(original,'Only original declared public reads: '+url);assert.equal(init.method,original.method)
  if(url===LIST){const form=await new Response(init.body,{headers:init.headers}).formData(),fields=Object.fromEntries(form);fields.filterCri=JSON.parse(fields.filterCri);const originalForm=await new Response(Buffer.from(original.requestBodyBase64,'base64'),{headers:original.requestHeaders}).formData(),expected=Object.fromEntries(originalForm);expected.filterCri=JSON.parse(expected.filterCri);assert.deepEqual(fields,expected);if(original.requestFormValues)assert.deepEqual(fields,original.requestFormValues)}
  const q={...original,headers:{...original.headers},text:decode(original)},prior=JSON.stringify(q);item.change?.(q,url,n,params,phase);if(JSON.stringify(q)!==prior)changed++;calls.push({url,method:init.method,phase:phase??n});return Object.defineProperties(new Response(Buffer.from(q.text),{status:q.status,headers:q.headers}),{url:{value:q.url},redirected:{value:q.redirected}})
 }catch(e){harness=e;throw e}}})}catch(e){error=e}
 if(item.change&&!changed)harness=Error('Guarded mutation did not reach actual original carrier')
 const ids=jobs?.map(j=>j.jobId),evidence=jobs?readInventoryEvidence(jobs):null,assessment=jobs?assessSoftFailureAcquisition(metadata,jobs):null
 let actual=harness?'harness':error?.nativeContradiction===true?'source-hold':!error&&jobs.length===7?'all':!error&&jobs.length===6&&!ids.includes(TARGET)?'role-hold':error?'other-error':'other-result',checkError
 if(actual===item.expected&&item.check)try{item.check(jobs)}catch(e){checkError=e.message;actual='check-failed'}
 if(jobs){assert.equal(evidence.status,'coverage-gap');assert.equal(assessment.cleanupOptions.replaceExisting,false);assert.equal(assessment.zeroJobEvidence,null);assert(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false&&j.nativeLegalEmployer===null));assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)}
 assert.equal(actual,item.expected,JSON.stringify({name:item.name,expected:item.expected,actual,error:error?.message,harness:harness?.message,checkError}))
})
