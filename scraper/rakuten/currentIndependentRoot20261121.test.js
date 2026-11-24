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
const sha=b=>createHash('sha256').update(b).digest('hex')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-public-pair-20261121.json.gz',import.meta.url))))
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
add('Original exact factory retains7 India and4 assessor eligible','all',null,j=>assert.equal(assessSoftFailureAcquisition(metadata,j).eligibleJobs,4))
add('Unused local account shadow is separate','all',afterEnvironment('function independentUnused('+env+'){'+env+'.COMPANYID="OTk5"}'))
add('Readonly environment copy is harmless','all',afterEnvironment('Object.assign({},'+env+')'))
add('Unrelated environment metadata is not an account rewrite','all',afterEnvironment(env+'.independentAnalytics={version:13}'))
add('Original resource comment is not a build pin','all',script(s=>s+'\n// independent release comment\n'))
add('Employer office country does not become vacancy country','all',config(company=>{company.country='Canada'}))
add('Unscoped native choice labels remain raw','all',listing(r=>{r.otherStatusOne='Closed';r.otherStatusTwo='Unknown unscoped native label'}))
add('Closing older creation cannot renew a vacancy','all',detail(r=>{r.createdDate=Date.parse('2026-01-01T00:00:00Z')}),j=>assert.equal(j.find(r=>r.jobId===TARGET).postingDate,'2026-01-01T00:00:00.000Z'))
add('A supplied coherent explicit workplace alias stays India','all',detail(r=>{r.workLocationCountry='India'}))
for(const[field,value]of[['COMPANYID','OTk5'],['DOMAIN','other.openings.co'],['APIENDPOINTNEW','https://other.example/'],['APIENDPOINT','https://other.example/']])add('Actual environment '+field+' cannot be overwritten','source-hold',afterEnvironment(env+'.'+field+'='+JSON.stringify(value)))
add('Environment Object.assign cannot replace current endpoint','source-hold',afterEnvironment('Object.assign('+env+',{APIENDPOINTNEW:"https://other.example/"})'))
add('Environment reflected account cannot replace selected account','source-hold',afterEnvironment('Reflect.set('+env+',"COMPANYID","OTk5")'))
add('Environment descriptor cannot replace current domain','source-hold',afterEnvironment('Object.defineProperty('+env+',"DOMAIN",{value:"other.openings.co"})'))
add('Environment alias cannot replace current account','source-hold',afterEnvironment('const independentAccountAlias='+env+';independentAccountAlias.COMPANYID="OTk5"'))
add('Actual service host must consume current selected endpoint','source-hold',script(s=>range(s,serviceHost.right,'"https://other.example/"')))
add('Actual registry endpoint cannot change after original literal','source-hold',script(s=>range(s,endpoints,'('+s.slice(endpoints.start,endpoints.end)+',this.API_LIST.search.v1="jobs/private-search")')))
add('Actual public defaults cannot change after original literal','source-hold',script(s=>range(s,defaults,'('+s.slice(defaults.start,defaults.end)+',this.searchJobsv1Params.filterCri.anyOfTheseWords="unrelated-filter")')))
for(const[name,change]of[
 ['foreign workLocationCountry alias',r=>{r.workLocationCountry='Canada'}],
 ['foreign nested workLocationCountry alias',r=>{r.jobLocationRecord={workLocationCountry:'Canada'}}],
 ['known jobApplicationURI contradiction',r=>{r.jobApplicationURI='https://other.example/apply'}],
 ['same named employer foreign sameAs identity',r=>{r.hiringOrganization={'@type':'Organization',name:'Rakuten',sameAs:'https://other.example/'}}],
 ['same named employer foreign URL identity',r=>{r.hiringOrganization={'@type':'Organization',name:'Rakuten',url:'https://other.example/'}}],
 ['hidden foreign country criteria',r=>{r.jobConfigurationData.Description+='<section hidden><p>Country: Canada</p></section>'}],
 ['inert foreign country criteria',r=>{r.jobConfigurationData.Description+='<section inert><p>Country: Canada</p></section>'}],
 ['hidden publication closure',r=>{r.jobConfigurationData.Description+='<section hidden><p>This position has been filled.</p></section>'}],
 ['style-hidden foreign country criteria',r=>{r.jobConfigurationData.Description+='<section style="display:none"><p>Country: Canada</p></section>'}],
 ['plain workplace restriction to Canada',r=>{r.jobConfigurationData.Description+='<p>You must be located in Canada.</p>'}],
 ['plain role restricted to another country',r=>{r.jobConfigurationData.Description+='<p>This position can be performed only from Canada.</p>'}],
 ['plain applicants limited to another country',r=>{r.jobConfigurationData.Description+='<p>Candidates must be based in Canada.</p>'}],
 ['known direct role closure',r=>{r.isClosed=true}],
 ['known expiry contradicts publication',r=>{r.validThrough='2001-01-01'}],
 ['Country alias conflicts with primary India',r=>{r.country={'@type':'Country',name:'India',identifier:'CA'}}],
 ['semantic foreign workplace',r=>{r.jobConfigurationData.Description+='<section><label>Country</label><span>Canada</span></section>'}],
 ['semantic foreign application',r=>{r.jobConfigurationData.Description+='<label>Application URL</label><span>https://other.example/apply</span>'}]
])add('Affected role '+name+' must hold while6 survive','role-hold',detail(change))
add('Affected listing foreign workLocationCountry must hold while6 survive','role-hold',listing(r=>{r.workLocationCountry='Canada'}))

// The original independent38 above remain byte-for-byte case/expectation
// copies. These additional ownership and coherent-neighbor cases are separate.
add('Additional boundary: environment proxy cannot mutate selected account','source-hold',afterEnvironment('const independentProxy=new Proxy('+env+',{});independentProxy.DOMAIN="other.openings.co"'))
add('Additional boundary: environment destructuring cannot overwrite domain','source-hold',afterEnvironment('({DOMAIN:'+env+'.DOMAIN}={DOMAIN:"other.openings.co"})'))
add('Additional boundary: environment cannot escape through mutable container','source-hold',afterEnvironment('const independentBox={account:'+env+'};independentBox.account.COMPANYID="OTk5"'))
add('Additional boundary: loop target cannot overwrite selected account','source-hold',afterEnvironment('for('+env+'.COMPANYID of ["OTk5"]){}'))
add('Additional boundary: endpoint destructuring cannot overwrite public path','source-hold',script(s=>range(s,endpoints,'('+s.slice(endpoints.start,endpoints.end)+',({v1:this.API_LIST.search.v1}={v1:"jobs/private-search"}))')))
add('Additional boundary: an independent spread copy cannot change the native environment','all',afterEnvironment('const independentCopy={...'+env+'};independentCopy.DOMAIN="other.openings.co"'))
add('Additional boundary: a shadowed object helper is separate','all',afterEnvironment('function independentUnused('+env+'){Object.assign('+env+',{DOMAIN:"other.openings.co"})}'))
add('Additional boundary: unrelated environment metadata assign is compatible','all',afterEnvironment('Object.assign('+env+',{independentAnalytics:{version:13}})'))
add('Additional boundary: coherent named employer identity remains bound','all',detail(r=>{r.hiringOrganization={'@type':'Organization',name:'Rakuten',sameAs:'https://corp.rakuten.co.in/'}}))
add('Additional boundary: nested company office country remains unscoped','all',config(company=>{company.office={address:{country:'Canada'}}}))
add('Additional boundary: coherent application URI remains same role','all',detail(r=>{r.jobApplicationURI=PAGE+'jobview/'+r.jobUrl+'?id='+r.id}))
add('Additional boundary: explicit India workplace prose remains qualified','all',detail(r=>{r.jobConfigurationData.Description+='<p>This position can be performed only from India.</p>'}))
add('Additional boundary: Canadian customers do not change workplace country','all',detail(r=>{r.jobConfigurationData.Description+='<p>You will work with customers in Canada.</p>'}))
add('Additional boundary: collaboration with Canadian teammates is not a workplace restriction','all',detail(r=>{r.jobConfigurationData.Description+='<p>You will work in collaboration with teammates in Canada.</p>'}))
const results=[]
for(const item of cases)test('independent root actual factory: '+item.name,async()=>{
const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Independent offline review prohibits unbound network')}
try{
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
 results.push({name:item.name,expected:item.expected,actual,pass:actual===item.expected,changed,calls:calls.length,jobs:jobs?.length??null,eligible:assessment?.eligibleJobs??null,targetRetained:ids?.includes(TARGET)??null,error:error?.message??null,harness:harness?.message??null,checkError:checkError??null})

const result=results.at(-1);assert.equal(result.actual,result.expected,JSON.stringify(result))
}finally{globalThis.fetch=oldFetch}
})
