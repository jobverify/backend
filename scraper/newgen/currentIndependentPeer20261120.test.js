import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {spawnSync} from 'node:child_process'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {runCurrentPublications,HOME,INDEX} from './currentPublished20261120.js'

const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const FIRST='FY26-27-716',all=n=>[n,...n.children.filter(child=>typeof child!=='string').flatMap(all)]
const cls=(n,c)=>(n.attrs.class??'').split(/\s+/).includes(c)
const exact=(text,from,to)=>{assert.equal(text.split(from).length,2,'Unique actual native byte target');assert.notEqual(from,to);return text.replace(from,()=>to)}
function element(html,predicate,edit,{first=false}={}){
 const d=document(html),nodes=all(d.root).filter(n=>predicate(n,d));assert(first?nodes.length>0:nodes.length===1,'Actual native carrier count '+nodes.length)
 const node=nodes[0],original=d.outer(node),changed=edit(original,node,d);assert.notEqual(original,changed)
 return html.slice(0,node.start)+changed+html.slice(node.end)
}
const attribute=(html,node,value)=>html.slice(0,node.openEnd-node.start-1)+' '+value+'>'+html.slice(node.openEnd-node.start)
const card=(html,edit)=>element(html,(n,d)=>n.tag==='div'&&cls(n,'omnirecruit-panelbody')&&d.outer(n).includes(FIRST),edit)
const closing=(url,edit)=>(packet,current,n)=>{if(current===url&&n===1)packet.text=edit(packet.text)}
const role=edit=>closing(INDEX,html=>card(html,edit))
const roleNode=(predicate,value)=>role(raw=>element(raw,predicate,(html,n)=>attribute(html,n,value)))
const schema=extra=>role(raw=>raw.replace('</div>','<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'JobPosting',title:'Senior Lead Design Engineer',hiringOrganization:{'@type':'Organization',name:'Newgen'},jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India',addressLocality:'Noida'}},...extra})+'</script></div>'))
const later=code=>closing(INDEX,html=>html+'<script>'+code+'</script>')
async function replay(change){
 const counts=new Map();let changed=false,harness
 try{const jobs=await runCurrentPublications({now:fixture.observedAt,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  try{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const n=counts.get(url)??0;counts.set(url,n+1);const packet=fixture.responses.filter(p=>p.requestedUrl===url)[n];assert(packet,'Only chronological genuine native originals');const next={...packet,text:Buffer.from(packet.bodyBase64,'base64').toString()},before=next.text;change(next,url,n);changed ||= before!==next.text;return Object.defineProperties(new Response(next.text,{status:packet.status,headers:packet.headers}),{url:{value:packet.url},redirected:{value:packet.redirected}})}catch(error){harness=error;throw error}
 }});if(harness)throw harness;assert(changed,'Guarded native mutation actually applied');return jobs}catch(error){if(harness)throw Object.assign(harness,{nativeTestHarnessError:true});assert(changed,'An unchanged baseline failure cannot satisfy a control');throw error}
}
async function hold(change,{fatal=false,allRoles=false}={}){
 let jobs,error;try{jobs=await replay(change)}catch(cause){if(cause.nativeTestHarnessError)throw cause;error=cause}
 if(fatal){assert(error,'Current publisher contradiction must hold source');return}
 assert(!error,'Affected role must preserve unrelated publications: '+error?.message);assert.equal(jobs.length,allRoles?0:9);assert(!jobs.some(job=>job.jobId===FIRST))
}
for(const[name,change]of[
 ['canonical publication',closing(HOME,h=>element(h,n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase()==='canonical',(s,n)=>attribute(s,n,'data-is-published="false"'),{first:true}))],
 ['HEAD-owned title application URI',closing(HOME,h=>element(h,(n,d)=>n.tag==='title'&&all(d.root).some(parent=>parent.tag==='head'&&parent.start<n.start&&parent.end>=n.end),(s,n)=>attribute(s,n,'data-application-uri="https://other.invalid/apply"')))],
 ['actual heading application URI',closing(HOME,h=>element(h,n=>n.tag==='h1',(s,n)=>attribute(s,n,'data-application-uri="https://other.invalid/apply"')))],
 ['actual handoff application URI',closing(HOME,h=>element(h,n=>n.tag==='a'&&n.attrs.href===INDEX,(s,n)=>attribute(s,n,'data-application-uri="https://other.invalid/apply"'),{first:true}))],
 ['native head application URI',closing(INDEX,h=>element(h,n=>n.tag==='head',(s,n)=>attribute(s,n,'data-application-uri="https://other.invalid/apply"')))]
])test('Independent peer '+name+' qualifies source authority',()=>hold(change,{fatal:true}))
for(const value of['data-application-uri="https://other.invalid/apply"','inert','hidden','style="display:none"'])test('Independent peer actual role title '+value+' withholds only that role',()=>hold(roleNode(n=>n.tag==='div'&&cls(n,'headcount'),value)))
test('Independent peer actual Apply application URI withholds only that role',()=>hold(roleNode(n=>n.tag==='a'&&n.attrs.onclick?.includes(FIRST),'data-application-uri="https://other.invalid/apply"')))
test('Independent peer semantic criteria application URI is binding',()=>hold(role(raw=>exact(raw,'Work Location\tNoida','Work Location\tNoida\n<div data-application-uri="https://other.invalid/apply">Known current criterion.</div>'))))
test('Independent peer multiword itemprop application URI is binding',()=>hold(role(raw=>exact(raw,'Work Location\tNoida','Work Location\tNoida\n<span itemprop="applicationURI sameAs" content="https://other.invalid/apply"></span>'))))
test('Independent peer role-scoped WebPage country contradicts only that role',()=>hold(schema({'@type':'WebPage',country:'Canada'})))
test('Independent peer role-scoped WebPage typed workplace contradicts only that role',()=>hold(schema({'@type':'WebPage',workLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'Canada',addressLocality:'Toronto'}}})))
test('Independent peer malformed scoped structured data withholds only that role',()=>hold(role(raw=>raw.replace('</div>','<script type="application/ld+json">{"@type":"JobPosting",</script></div>'))))
for(const[name,code]of[
 ['unknown computed global dependency','window[currentNativeDependency]=()=>"OTHER-ROLE";'],
 ['unknown Object.assign source','Object.assign(window,currentNativeOverrides);'],
 ['unknown Object.assign spread','Object.assign(window,{...currentNativeOverrides});'],
 ['Reflect.defineProperty dependency','Reflect.defineProperty(window,"encodeURIComponent",{value:()=>"OTHER-ROLE"});'],
 ['Reflect.deleteProperty callback','Reflect.deleteProperty(window,"fRedirect");']
])test('Independent peer '+name+' cannot borrow an earlier callback',()=>hold(later(code),{allRoles:true}))
test('Independent peer coherent typed India workLocation remains a valid partial',async()=>{const jobs=await replay(schema({workLocation:{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India',addressLocality:'Noida'}}}));assert.equal(jobs.length,10)})
test('Current factory and native declaration reader import when development-only direct dependencies are unavailable',async()=>{
 const packageJSON=JSON.parse(await fs.readFile(new URL('../../package.json',import.meta.url))),allowed=Object.keys(packageJSON.dependencies),moduleURL=new URL('./script.js',import.meta.url).href,protocolURL=new URL('./currentProtocol20261120.js',import.meta.url).href,fixtureURL=new URL('./fixtures/current-native-20261120.json.gz',import.meta.url).href
 const source=`import {registerHooks,isBuiltin} from 'node:module';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';const allowed=new Set(${JSON.stringify(allowed)});registerHooks({resolve(specifier,context,next){const direct=context.parentURL?.includes('/scraper/newgen/');const name=specifier.startsWith('@')?specifier.split('/').slice(0,2).join('/'):specifier.split('/')[0];if(direct&&!isBuiltin(specifier)&&!specifier.startsWith('.')&&!specifier.startsWith('/')&&!specifier.startsWith('file:')&&!allowed.has(name))throw Object.assign(Error('Unavailable direct production dependency: '+name),{code:'ERR_MODULE_NOT_FOUND'});return next(specifier,context)}});await import(${JSON.stringify(moduleURL)});const {readApplicationContract}=await import(${JSON.stringify(protocolURL)});const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL(${JSON.stringify(fixtureURL)}))));const packet=fixture.responses.find(p=>p.requestedUrl.includes('CareerPortal'));const model=readApplicationContract(Buffer.from(packet.bodyBase64,'base64').toString()).applicationFor("return fRedirect(encodeURIComponent('FY26-27-716'));");if(!model.url.endsWith('JobExternalUsers=FY26-27-716'))throw Error('Native declaration disconnected');`
 const child=spawnSync(process.execPath,['--input-type=module','--eval',source],{encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(child.status,0,child.stderr)
})
for(const code of['function unrelatedScope(window,encodeURIComponent,$){window[currentNativeDependency]={ordinary:true};}','{const window={};window[currentNativeDependency]={ordinary:true};}'])test('Acorn lexical analysis preserves an unrelated local owner '+code.split('{')[0],async()=>{assert.equal((await replay(later(code))).length,10)})

for(const[name,code]of[
 ['Object.assign bound receiver','const currentNativeReplacement=Object.assign.bind(Object);currentNativeReplacement(window,{fRedirect:function(){}});'],
 ['Reflect.set bound receiver','const currentNativeReplacement=Reflect.set.bind(Reflect);currentNativeReplacement(window,"fRedirect",function(){});'],
 ['Object.assign bound target','const currentNativeReplacement=Object.assign.bind(Object,window);currentNativeReplacement({fRedirect:function(){}});'],
 ['Object.assign bound call','const currentNativeReplacement=Object.assign.bind(Object,window);currentNativeReplacement.call(null,{fRedirect:function(){}});'],
 ['Object.assign bound apply','const currentNativeReplacement=Object.assign.bind(Object,window);currentNativeReplacement.apply(null,[{fRedirect:function(){}}]);']
])test('Bound native method '+name+' replacement cannot borrow an earlier connected callback',()=>hold(later(code),{allRoles:true}))

test('An unrelated bound native method mutation preserves every connected current publication',async()=>{const jobs=await replay(later('const currentNativeReplacement=Object.assign.bind(Object,window);currentNativeReplacement({independentNewgenAnalytics:{version:3}});'));assert.equal(jobs.length,10);assert(jobs.every(job=>job.sourceNativeApplication.nativeProgramsExecuted===false&&job.sourceNativeApplication.activationVerified===false))})

for(const[label,value]of[
 ['Country','Canada'],
 ['Employer','Other Employer'],
 ['Posting status','withdrawn'],
 ['Application URL','https://other.example/apply'],
 ['Location','Toronto, Canada']
])test('Shared review semantic '+label+' constrains only its actual Newgen role',()=>hold(role(raw=>exact(raw,'Work Location\tNoida','Work Location\tNoida\n<section><label>'+label+'</label><span>'+value+'</span></section>'))))

test('A coherent semantic Newgen application label preserves all original current partials',async()=>{const jobs=await replay(role(raw=>exact(raw,'Work Location\tNoida','Work Location\tNoida\n<section><label>Application URL</label><span>https://omnirecruit.newgen.co.in/CandidateRegistration/CandidateRegistration.aspx?JobExternalUsers=FY26-27-716</span></section>')));assert.equal(jobs.length,10);assert.equal(jobs[0].nativeLegalEmployer,null)})
