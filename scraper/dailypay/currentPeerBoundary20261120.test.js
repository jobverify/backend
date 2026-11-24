import './currentBoundary20261120.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {replay,feed,native,element,HOME,BOARD} from './currentConfiguredBoard20261120.test.js'
const exact=(s,a,b)=>{assert.equal(s.split(a).length,2,'Unique genuine original target');assert.notEqual(a,b);return s.replace(a,()=>b)},close=(url,op)=>(q,u,n)=>{if(u===url&&n===1)q.text=op(q.text)},append=code=>close(BOARD,h=>exact(h,'</body>','<script>'+code+'</script></body>'))
const attribute=(s,n,value)=>s.slice(0,n.openEnd-n.start-1)+' '+value+'>'+s.slice(n.openEnd-n.start)
async function held(change){let changed=false,error;try{await replay((q,u,n)=>{const old=JSON.stringify(q);change(q,u,n);changed ||= old!==JSON.stringify(q)})}catch(e){error=e}assert(changed,'Boundary mutation actually changed original native bytes');assert(error,'Contradiction cannot supply configured empty evidence');assert.equal(error.nativeContradiction,true);assert.equal(error.failureKind,'parser_or_contract_error')}
for(const[label,op]of[
 ['root publication',m=>m.isPublished=false],
 ['board nested employer',m=>m.jobBoard.employer={name:'Other Employer'}],
 ['organization nested employer',m=>m.organization.hiringOrganization={name:'Other Employer'}]
])test('Independent peer '+label+' constrains configured zero',()=>held(native(op)))
test('Independent peer actual own publisher schema carrier constrains configured zero',()=>held(close(HOME,h=>element(h,n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&(n.raw??'').includes('"@type":"Article"'),(s,n)=>attribute(s,n,'data-is-published="false"')))))
test('Independent peer actual Article withdrawal constrains configured zero',()=>held(close(HOME,h=>element(h,n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&(n.raw??'').includes('"@type":"Article"'),(s,n)=>{const model=JSON.parse(n.raw);assert.equal(model['@type'],'Article');model.isPublished=false;return exact(s,n.raw,JSON.stringify(model))}))))
for(const[label,op]of[
 ['country',r=>r.address.country='India'],
 ['nested employer',r=>r.address.employer={name:'Other Employer'}],
 ['publication',r=>r.address.isPublished=false],
 ['application',r=>r.address.applicationUrl='https://other.invalid/apply'],
 ['schema context',r=>r.address['@context']='https://other.invalid/schema']
])test('Independent peer native address wrapper '+label+' cannot be dropped',()=>held(feed(op)))
for(const field of['workLocations','jobLocations'])test('Independent peer plural '+field+' India cannot be dropped',()=>held(feed(r=>r[field]=[{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India',addressLocality:'Bengaluru'}}])))
for(const[label,code]of[
 ['self','self.__appData={};'],
 ['classic this','this.__appData={};'],
 ['Object method alias','const replaceNativeState=Object.assign;replaceNativeState(window,{__appData:{}});'],
 ['Object namespace alias','const nativeObjectTools=Object;nativeObjectTools.assign(window,{__appData:{}});'],
 ['Reflect.apply invocation','Reflect.apply(Object.assign,null,[window,{__appData:{}}]);']
])test('Independent peer global '+label+' replacement cannot borrow original literal',()=>held(append(code)))
for(const[label,code]of[
 ['function','function independentAnalytics(window){window.__appData={ordinary:true};}'],
 ['block','{const window={};window.__appData={ordinary:true};}']
])test('Independent peer unrelated '+label+' local window remains compatible',async()=>{const r=await replay(append(code));assert.equal(r.evidence.status,'complete-inventory');assert.equal(r.audit.companyIndiaTotal,null)})
