import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
const api=await import('./currentProtocol20261120.js').catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(e)),fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url)))),html=Buffer.from(fixture.responses.find(p=>p.requestedUrl.includes('CareerPortal.aspx')).bodyBase64,'base64').toString(),onclick="return fRedirect(encodeURIComponent('FY26-27-716'));"
function read(body=html,handler=onclick){assert.equal(typeof api.readApplicationContract,'function','Finite current application declaration reader required');return api.readApplicationContract(body).applicationFor(handler)}
const replace=(from,to)=>{assert(html.includes(from),'Actual native programme span required');return html.replace(from,()=>to)}
test('Current actual native handler reaches declared same-role URL without programme execution',()=>{const model=read();assert.equal(model.applicationRoleKey,'FY26-27-716');assert.equal(model.url,'https://omnirecruit.newgen.co.in/CandidateRegistration/CandidateRegistration.aspx?JobExternalUsers=FY26-27-716');assert.equal(model.nativeProgramsExecuted,false);assert.match(model.originalFunction,/fRedirect/)})
test('Harmless lexical parameter/catch renames and unrelated current UI release remain compatible',()=>{const changed=html.replaceAll('sJobID','nativeRole').replace('catch (e)','catch (nativeError)')+'<script>window.currentAnalytics={release:"ordinary"}</script>';assert.equal(read(changed).applicationRoleKey,'FY26-27-716')})
test('Actual connected native callback/function name can change together',()=>{assert.equal(read(html.replaceAll('fRedirect(','goCurrentApply('),onclick.replace('fRedirect','goCurrentApply')).applicationRoleKey,'FY26-27-716')})
for(const[name,from,to]of[
 ['dead declaration','function fRedirect(sJobID) {','if(false){function fRedirect(sJobID) {'],
 ['foreign application','/CandidateRegistration/CandidateRegistration.aspx?JobExternalUsers=','https://other.invalid/apply?JobExternalUsers='],
 ['wrong declared native query','CandidateRegistration.aspx?JobExternalUsers=','CandidateRegistration.aspx?OtherEmployer=']
])test('Relevant current native '+name+' cannot qualify application declaration',()=>{let body=replace(from,to);if(name==='dead declaration')body=body.replace('function fRedirectVendorToCandidateRegistration','} function fRedirectVendorToCandidateRegistration');assert.throws(()=>read(body))})
for(const[name,tail]of[
 ['direct global replacement','fRedirect=function(){};'],
 ['computed owner replacement','const currentKey="fRedirect";const nativeOwner=window;nativeOwner[currentKey]=function(){};'],
 ['Object.assign replacement','Object.assign(window,{fRedirect:function(){}});']
])test('Known later '+name+' is constrained without freezing unrelated programme',()=>{assert.throws(()=>read(html+'<script>'+tail+'</script>'))})
test('Unrelated window owner properties and current function comments remain compatible',()=>{assert.equal(read(html.replace('function fRedirect(sJobID) {','function fRedirect(sJobID) {/* ordinary current release */')+'<script>const unrelatedOwner=window;unrelatedOwner.analytics="current";</script>').applicationRoleKey,'FY26-27-716')})
test('Malformed or disconnected authored handler is not fabricated into a role URL',()=>{for(const handler of['return false;',"return missing(encodeURIComponent('FY26-27-716'));","return fRedirect('FY26-27-716');"]){assert.throws(()=>read(html,handler))}})
