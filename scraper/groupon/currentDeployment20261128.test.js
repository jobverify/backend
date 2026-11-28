import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import * as native from './nativeModels.js'
import {run} from './script.js'
import {GROUPON_CATALOG} from './catalog.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261128/current-graph.json.gz',import.meta.url))))
const graph=new Map(fixture.responses.map(row=>[row.url,row]))
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const expected={main:'index-DMEepMtj.js',origins:'src-Ki0Cnzhk.js',roles:'page-Cco3wRb4.js',detail:'useJob-B43A6q3w.js',locations:'locations-C3ZnT-yL.js'}
const current=()=>{
 const modules=native.profileForPublisher(native.publisher(text(graph.get(native.PRIMARY)))),programs={}
 for(const key of Object.keys(expected))programs[key]=native.program(text(graph.get(native.profileModuleURL(key,modules))),key,modules)
 return{modules,programs,contract:native.loadingContract(programs)}
}
const packet=row=>({bytes:Buffer.from(row.bodyBase64,'base64'),requestedURL:row.url,finalURL:row.url,method:'GET',body:null,status:row.status,headers:{...row.headers},bodySHA256:row.bodySHA256})
const replay=change=>{
 const reads=[]
 return{reads,fetchResponse:async(url,init)=>{reads.push(url);assert.equal(init.method,'GET');assert.equal(init.body,null);if(url===native.API)throw Error('Reached exact current declared careers inventory GET');const row=graph.get(url);assert.ok(row,'Only the seven real current native declarations');const result=packet(row);change?.(result,url);return result}}
}

test('seven genuine current originals and the paired previous role program retain their complete body hashes',()=>{
 assert.equal(fixture.responses.length,7);assert.equal(graph.size,7);assert.equal(fixture.validCurrentCheck,false)
 for(const row of [...fixture.responses,fixture.priorRoleRenderer])assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64,'base64')).digest('hex'),row.bodySHA256)
 assert.equal(graph.get(native.ENTRY).status,301);assert.equal(graph.get(native.ENTRY).headers.location,native.PRIMARY)
 assert.match(text(graph.get(native.PRIMARY)),/src="\/assets\/index-DMEepMtj\.js"/)
})

test('the current declared entry selects its one complete reviewed five-program graph',()=>{
 const {modules,contract}=current()
 for(const [key,path] of Object.entries(expected))assert.equal(native.profileModuleURL(key,modules),native.PRIMARY+'assets/'+path)
 assert.equal(contract.inventoryURL,native.API);assert.equal(contract.method,'GET');assert.equal(contract.publisherProgramsExecuted,false)
 assert.equal(contract.officeCountryModels.length,11)
})

test('the exact current graph reaches only the literal inventory GET after all seven originals',async()=>{
 const input=replay()
 await assert.rejects(()=>run(input),/Reached exact current declared careers inventory GET/)
 assert.equal(input.reads.length,8);assert.equal(input.reads.at(-1),native.API)
})

test('current role route, production client, imported consumer and whole criteria remain explicitly bound',()=>{
 const {programs}=current(),main=programs.main.wholeProgram,roles=programs.roles.wholeProgram,detail=programs.detail.wholeProgram
 assert.ok(main.includes('nS=q(()=>$(()=>import(`./page-Cco3wRb4.js`)'))
 assert.ok(main.includes('path:`roles`,element:(0,P.jsx)(nS,{})'))
 assert.ok(main.includes('function nv(){return c(`production`,!0)}function rv(){return s(`core`,nv())}function iv(){return tv({baseUrl:rv()})}'))
 assert.ok(main.includes('async function Px(){return(await iv().careers.jobsList()).jobs}'))
 assert.ok(main.includes('Fx as r,iv as s'))
 assert.ok(roles.includes('import{a as r,l as i,o as a,r as o}from"./index-DMEepMtj.js"'))
 assert.ok(roles.includes('import{t as s}from"./useJob-B43A6q3w.js"'))
 assert.ok(roles.includes('dangerouslySetInnerHTML:{__html:t.contentHtml}'))
 assert.ok(detail.includes('async function Q([,e]){return(await t().careers.jobGetById(e)).job}'))
})

test('the whole current roles AST changes only finite declared dependency filenames and its two leading telemetry IDs',()=>{
 const pairs=[['./rolldown-runtime-DbeQfyAn.js','./rolldown-runtime-DwERCugW.js'],['./react-vendor-taqmcB4h.js','./react-vendor-hAkWLcl9.js'],['./index-BDMW3WUv.js','./index-DMEepMtj.js'],['./useJob-jN_iMHzv.js','./useJob-B43A6q3w.js'],['./greenhouseText-Blarrrx6.js','./greenhouseText-Blarrrx6.js'],['./SubPageHero-DmUJ-y0d.js','./SubPageHero-0f6tPN81.js'],['./BreadcrumbJsonLd-BD9tkix4.js','./BreadcrumbJsonLd-CJCbww2N.js'],['./RolesUnavailable-INp-d9iL.js','./RolesUnavailable-hMuuP1GO.js']]
 const normalize=(code,version)=>{
  const ast=parse(code,{ecmaVersion:'latest',sourceType:'module'}),imports=ast.body.filter(node=>node.type==='ImportDeclaration')
  assert.deepEqual(imports.map(node=>node.source.value),pairs.map(pair=>pair[version]))
  imports.forEach((node,index)=>{node.source.value='<finite-dependency-'+index+'>'})
  let telemetry=0
  const walk=(node,ancestors=[])=>{if(!node||typeof node.type!=='string')return
   if(node.type==='TemplateLiteral'&&!node.expressions.length&&/(?:sentry-dbid-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(node.quasis[0].value.cooked)){assert.ok(ancestors.includes(ast.body[0]));node.quasis[0].value.cooked=node.quasis[0].value.cooked.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<leading-telemetry-id>');telemetry++}
   for(const value of Object.values(node))for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object'&&typeof child.type==='string')walk(child,[...ancestors,node])}
  walk(ast);assert.equal(telemetry,2)
  return JSON.stringify(ast,(key,value)=>['start','end','loc','range','raw'].includes(key)?undefined:value)
 }
 assert.equal(normalize(text(fixture.priorRoleRenderer),0),normalize(text(graph.get(native.PRIMARY+'assets/'+expected.roles)),1))
})

for(const key of Object.keys(expected))test('the whole current '+key+' body remains pinned before any API read',async()=>{
 const input=replay((result,url)=>{if(url===native.PRIMARY+'assets/'+expected[key]){result.bytes=Buffer.concat([result.bytes,Buffer.from('\nvoid 0;')]);result.bodySHA256=native.sha(result.bytes)}})
 await assert.rejects(()=>run(input),new RegExp('declared '+key+' program changed'))
 assert.equal(input.reads.includes(native.API),false)
})

for(const [name,key,before,after,message] of [
 ['route binding','main','path:`roles`,element:(0,P.jsx)(nS,{})','path:`roles`,element:(0,P.jsx)(eS,{})','roles route binding'],
 ['production factory','main','function nv(){return c(`production`,!0)}','function nv(){return c(`staging`,!0)}','production inventory client'],
 ['native core origin','origins','production:`api-core.livingsocial.com`','production:`foreign.example`','production core origin'],
 ['inventory method','detail','callTypedAPI(`GET`,`/careers/jobs`)','callTypedAPI(`POST`,`/careers/jobs`)','GET declarations'],
 ['detail method','detail','callTypedAPI(`GET`,`/careers/jobs/${encodeURIComponent(e)}`)','callTypedAPI(`POST`,`/careers/jobs/${encodeURIComponent(e)}`)','GET declarations'],
 ['full role renderer','roles','dangerouslySetInnerHTML:{__html:t.contentHtml}','children:t.title','role rendering contract'],
])test('the current-only explicit consumer plan rejects changed '+name,()=>{
 const {programs}=current();assert.ok(programs[key].wholeProgram.includes(before))
 const changed={...programs,[key]:{...programs[key],wholeProgram:programs[key].wholeProgram.replace(before,after)}}
 assert.throws(()=>native.loadingContract(changed),new RegExp(message))
})

test('new and old program profiles cannot be mixed',()=>{
 const {programs}=current()
 const changed={...programs,roles:{...programs.roles,url:native.profileModuleURL('roles',native.CURRENT_20261125_MODULES)}}
 assert.throws(()=>native.loadingContract(changed),/mixed reviewed native program graphs/)
})

for(const [name,before,after] of [
 ['unknown','/assets/index-DMEepMtj.js','/assets/index-unreviewed.js'],
 ['foreign','/assets/index-DMEepMtj.js','https://foreign.example/assets/index-DMEepMtj.js'],
])test('a '+name+' current main declaration cannot authorize the program graph',()=>{
 const html=text(graph.get(native.PRIMARY));assert.ok(html.includes(before))
 assert.throws(()=>native.publisher(html.replace(before,after)),/main module changed/)
})

const full=async(t,change)=>{
 const originals=fixture.currentRegistered.packets;let reads=0
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  const original=originals[reads];assert.ok(original,'Only actual current registered GETs may be replayed')
  assert.equal(String(url),original.requestedUrl);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  assert.equal(createHash('sha256').update(original.body).digest('hex'),original.sha256)
  const row=structuredClone(original),index=reads++
  change?.(row,String(url),index)
  return Object.defineProperty(new Response(row.body,{status:row.status,headers:row.headers}),'url',{value:row.url})
 })
 const jobs=await run();assert.equal(reads,originals.length);return jobs
}

test('the genuine70-response current replay retains27 whole paired roles without inferring a company India zero',async t=>{
 const registered=fixture.currentRegistered
 assert.equal(registered.packets.length,70);assert.equal(registered.outcome.sourceCodeHashes['nativeModels.js'],'e8b889a00a73d33278deff819ea23b9c688d5598f81a691e7d9462cb79a8ac60')
 assert.equal(registered.outcome.captureFinalization.drained,true);assert.equal(registered.outcome.captureFinalization.pendingAtFreeze,0)
 const jobs=await full(t),audit=jobs.nativeCollectionEvidence,assessment=assessSoftFailureAcquisition(GROUPON_CATALOG,jobs)
 assert.equal(jobs.length,27);assert.equal(jobs.filter(job=>job.sourceCountryScopeUnresolved).length,26)
 assert.equal(jobs.filter(job=>job.sourceDetailComplete).length,1)
 assert.ok(jobs.every(job=>job.city===null&&job.activeApplyVerified===false&&job.lifecycleCleanupAllowed===false&&job.sourceScopeComplete===false))
 assert.ok(jobs.filter(job=>job.sourceCountryScopeUnresolved).every(job=>job.country===null&&job.sourceDetailComplete===false))
 assert.equal(audit.openingRows,27);assert.equal(audit.closingRows,27);assert.equal(audit.wholeNativeModelsClosingReconciled,true);assert.equal(audit.publisherProgramsExecuted,false);assert.equal(audit.companyInventoryComplete,false)
 assert.equal(audit.observations.length,27);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true);assert.equal(assessment.indiaJobs,0);assert.equal(assessment.zeroJobEvidence,'coverage-gap');assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('current whole closing criteria drift cannot commit an opening positive model',async t=>{
 let changed=false
 await assert.rejects(()=>full(t,(row,url,index)=>{if(!changed&&index>=35&&url.startsWith(native.API+'/')){const value=JSON.parse(row.body);value.job.contentHtml+='<p>Changed closing native criterion.</p>';row.body=JSON.stringify(value);changed=true}}),/closing whole role model changed/)
 assert.equal(changed,true)
})

test('current untyped Prague cannot gain a country from a newly conflicting criteria declaration',async t=>{
 const target=fixture.currentRegistered.summary.find(job=>job.sourceCountryScopeUnresolved&&job.location==='Prague');assert.ok(target)
 let changed=0
 const jobs=await full(t,(row,url)=>{if(url===native.API+'/'+target.jobId){const value=JSON.parse(row.body);value.job.contentHtml+='<p>Country: India</p>';row.body=JSON.stringify(value);changed++}})
 assert.equal(changed,2)
 const job=jobs.find(job=>job.jobId===target.jobId)
 assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.sourceDetailComplete,false)
 assert.equal(assessSoftFailureAcquisition(GROUPON_CATALOG,jobs).indiaJobs,0)
})

test('a current native employer conflict holds even the one otherwise qualified foreign-country role',async t=>{
 const target=fixture.currentRegistered.summary.find(job=>job.sourceDetailComplete);assert.ok(target)
 let changed=0
 const jobs=await full(t,(row,url)=>{if(url===native.API+'/'+target.jobId){const value=JSON.parse(row.body);value.job.contentHtml='<p>Employer: Another Company</p>'+value.job.contentHtml;row.body=JSON.stringify(value);changed++}})
 assert.equal(changed,2)
 const job=jobs.find(job=>job.jobId===target.jobId)
 assert.equal(job.nativeEmployerReconciled,false);assert.equal(job.country,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
})
