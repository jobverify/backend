import test from 'node:test'
import assert from 'node:assert/strict'
import './currentIndependentGuardNeighbors20261121.test.js'
import {run,script,append,insert,exact} from './currentIndependentBoundary20261121.test.js'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url)))),FEED='https://api.ashbyhq.com/posting-api/job-board/redpanda-data'
const first=JSON.parse(Buffer.from(fixture.responses.find(row=>row.requestedUrl===FEED).bodyBase64,'base64').toString()).jobs[0]
const prepend=code=>script(source=>code+'\n'+source),feed=change=>(response,url,phase)=>{if(url!==FEED||phase!==1)return;const model=JSON.parse(response.text),row=model.jobs.find(row=>row.id===first.id);assert(row);change(row,model);response.text=JSON.stringify(model)}
const cases=[]
const add=(name,expected,change,options={})=>cases.push({name,expected,change,options})
const replace=(old,value)=>script(source=>exact(source,old,value))
const afterListing=code=>replace('        buildFilterOptions(ALL_JOBS);','        '+code+'\n        buildFilterOptions(ALL_JOBS);')
add('Genuine original four-response registered factory remains qualified','configured-empty')
for(const[name,code]of[
 ['Object.keys native dependency replaced','Object.keys=function(){return [];};'],
 ['Browser Object namespace replaced','window.Object={keys:function(){return [];}};'],
 ['Reflected Object namespace replaced','Reflect.set(window,"Object",{keys:function(){return [];}});'],
 ['Array filter native dependency replaced','Array.prototype.filter=function(){return [];};'],
 ['Array forEach native dependency replaced','Array.prototype.forEach=function(){};'],
 ['Array.isArray native guard replaced','Array.isArray=function(){return false;};'],
 ['Element querySelector native dependency replaced','Element.prototype.querySelector=function(){return null;};'],
 ['Element appendChild native dependency replaced','Element.prototype.appendChild=function(){};'],
 ['Node cloneNode native dependency replaced','Node.prototype.cloneNode=function(){return document.createElement("div");};']
])add('Adjacent connected browser primitive: '+name,'hold',prepend(code))
for(const[name,old,value]of[
 ['Matched-role helper returns false','  function matches(job, active, q) {','  function matches(job, active, q) {\n    return false;'],
 ['Checked-values helper supplies unavailable selection','  function checkedValues(listName) {','  function checkedValues(listName) {\n    return ["independent-no-current-choice"];'],
 ['Actual query default filters out current roles',"    var q = ((els.search && els.search.value) || '').trim().toLowerCase();",'    var q = "independent-no-current-title-or-description-667331";'],
 ['Actual active selection excludes current values','active[cfg.list] = checkedValues(cfg.list);','active[cfg.list] = ["independent-no-current-choice"];']
])add('Adjacent current filter flow: '+name,'hold',replace(old,value))
for(const[name,code]of[
 ['Reflect.apply Object.assign clears assigned native rows','Reflect.apply(Object.assign,Object,[ALL_JOBS,{length:0}]);'],
 ['Reflect.apply Reflect.set clears assigned native rows','Reflect.apply(Reflect.set,Reflect,[ALL_JOBS,"length",0]);'],
 ['Reflect.apply native splice clears assigned native rows','Reflect.apply(Array.prototype.splice,ALL_JOBS,[0]);'],
 ['Reflect.apply nested Function.call clears assigned native rows','Reflect.apply(Function.prototype.call,Object.assign,[null,ALL_JOBS,{length:0}]);'],
 ['Aliased Reflect.apply clears assigned native rows','var invokedApply=Reflect.apply;invokedApply(Object.assign,Object,[ALL_JOBS,{length:0}]);'],
 ['Reflect.apply mutates critical invocation tuple','var tuple=[{},{length:0}];Reflect.apply(Reflect.set,Reflect,[tuple,0,ALL_JOBS]);Object.assign(...tuple);']
])add('Adjacent reflected native flow: '+name,'hold',afterListing(code))
add('Adjacent reflected browser flow: Reflect.apply replaces deferred fetch','hold',prepend('Reflect.apply(Reflect.set,Reflect,[window,"fetch",function(){return Promise.resolve({jobs:[]});}]);'))
for(const[name,code]of[
 ['Function-local browser primitive shadows remain local','function separate(Object,Array,Element){Object.keys=function(){return [];};Array.prototype.filter=function(){return [];};Element.prototype.appendChild=function(){};}'],
 ['Unrelated Math primitive remains separate','Math.max=function(){return 7;};'],
 ['Unused Reflect.apply bound mutation remains uninvoked','var uninvoked=Reflect.apply.bind(Reflect,Object.assign,Object,[ALL_JOBS,{length:0}]);void uninvoked;'],
 ['Readonly reflected Object.keys preserves original rows','Reflect.apply(Object.keys,Object,[ALL_JOBS]);'],
 ['Unrelated reflected global analytics remains separate','Reflect.apply(Reflect.set,Reflect,[window,"independentReviewAnalytics",{version:3}]);']
])add('Adjacent coherent primitive control: '+name,'configured-empty',insert(code))
add('Adjacent coherent filter helper rename preserves lexical identity','configured-empty',script(source=>source.replace(/\bmatches\b/g,'independentMatches')))
for(const[name,html]of[
 ['Explicit role India location prose','<p>This position is based in India.</p>'],
 ['Explicit role India applicant prose','<p>Candidates based in India may apply.</p>'],
 ['Explicit role worldwide applicant prose','<p>This role is open to applicants worldwide.</p>'],
 ['Hidden actual criteria country contradiction','<section hidden><p>Country</p><p>India</p></section>']
])add('Adjacent full native criteria: '+name,'hold',feed(row=>{row.descriptionHtml+=html}))
add('Adjacent coherent About paragraph is not role scope','configured-empty',feed(row=>{row.descriptionHtml+='<h2>About Redpanda</h2><p>Our customers have teams in India and around the world.</p>'}))
add('Adjacent same-role workLocationCountry India cannot be ignored','hold',feed(row=>{row.workLocationCountry='India'}))
add('Adjacent same-role coherent workLocationCountry remains qualified','configured-empty',feed(row=>{row.workLocationCountry='Poland'}))

for(const control of cases)test('Redpanda native followup: '+control.name,async()=>{const result=await run(control.change,control.options);if(control.expected==='hold'){assert.equal(result.error?.nativeContradiction,true,JSON.stringify({error:result.error?.message,status:result.evidence?.status,zero:result.assessment?.zeroJobEvidence}));assert.equal(result.error?.failureKind,'parser_or_contract_error');return}assert.equal(result.error,undefined,result.error?.message);assert.equal(result.calls.length,4);assert.equal(result.jobs.length,0);assert.equal(result.audits.length,1);assert.deepEqual(result.audits[0].observations.map(row=>row.rows.length),[12,12]);assert.equal(result.audits[0].companyIndiaTotal,null);assert.equal(result.audits[0].sourceScopeComplete,false);assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.evidence.reportedTotal,null);assert.equal(result.evidence.indiaFacetCount,null);assert.equal(result.assessment.runnerOutcome.success,true);assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.cleanupOptions.replaceExisting,false)})
