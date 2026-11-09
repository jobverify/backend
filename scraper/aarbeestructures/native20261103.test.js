import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import manifest from './test-data/manifest-20261103.js'
import * as scraper from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const source="aarbeestructures",entry="https://aarbeestructures.com/careers/",expectedSignals=1
const zip=fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))
assert.equal(createHash('sha256').update(zip).digest('hex'),manifest.fixtureSha256)
const captures=JSON.parse(gunzipSync(zip))
for(const row of captures)assert.equal(createHash('sha256').update(row.html).digest('hex'),row.sha256)
const page=async(url,options)=>{const row=captures.findLast(row=>row.requestedUrl===url);assert.ok(row,'unexpected public/private request '+url);return {status:row.status,url:row.finalUrl,html:row.html,text:row.html}}
const run=(reader=page,options={})=>scraper.createAarbeeStructuresScraper().run({fetchText:reader,...options})
const edit=(value,fn)=>({...value,html:fn(value.html),text:fn(value.text)})

test(source+' retains the actual native public context with unknown vacancy totals and a closing comparison',async()=>{
 let audit;const requests=[]
 const jobs=await run(async(url,options)=>{requests.push(url);return page(url,options)},{onAudit:value=>{audit=value}})
 const evidence=readInventoryEvidence(jobs),observed=readSourceObservationEvidence(jobs,source)
 assert.equal(jobs.length,0)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.listingComplete,false)
 assert.equal(observed.observedRecordCount,expectedSignals)
 assert.equal(observed.observedVacancyCount,0)
 assert.equal(audit.observations.length,expectedSignals)
 assert.ok(audit.observations.every(row=>row.vacancy===false&&row.country===null&&row.postingDate===null))
 assert.equal(audit.closingMatches,true)
 assert.ok(audit.publicPages.every(row=>row.sha256&&row.html))
 assert.ok(requests.every(url=>!url.includes('docs.google.com')&&!url.includes('contact-us-post.php')))
 if(source==='aadyahaerospace'){assert.deepEqual(audit.nativeContext.careersModel,{acf:[]});assert.equal(audit.nativeContext.careersContentMissing,true)}
 if(source==='aarbeestructures'){assert.ok(audit.observations[0].applicationUrl.startsWith('https://docs.google.com/forms/d/e/'));assert.equal(audit.nativeContext.applicationActionPerformed,false)}
 if(source==='acmesolar'){assert.equal(audit.observations[0].email,'careers@acme.in');assert.equal(scraper.APPLY_EMAIL,'careers@acme.in');assert.equal(audit.nativeContext.applicationActionPerformed,false);assert.ok(audit.nativeContext.formControls.some(row=>row.name==='cv_file'&&row.type==='file'))}
 if(source==='aayushmantech'){assert.ok(audit.nativeContext.commercialServiceCopy.includes('Hire Experienced Developers'));assert.ok(audit.nativeContext.excludedSocialLinks.some(url=>url.includes('wix-com')))}
})

test(source+' ignores unrevealed role markup but retains executable scripts even under CSS-hidden ancestors',async()=>{
 let audit
 const hidden='<!-- <article class="job-card">Commented Engineer</article> --><template><article class="job-card">Template Engineer</article></template><div style="display:none"><article class="job-card">Hidden Engineer</article></div><div style="display:none"><script>window.publicContextMarker=1;</script></div>'
 const jobs=await run(async(url,options)=>edit(await page(url,options),body=>url===entry?body+hidden:body),{onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0)
 assert.equal(audit.observations.length,expectedSignals)
 assert.ok(audit.scriptStructure.some(row=>row.scripts.some(script=>script.body.includes('publicContextMarker')&&script.visuallyInactive)))
 assert.equal(audit.possibleVacancyMarkup.length,0)
})

test(source+' retains and flags an executable public role client under a visually hidden ancestor without publishing hidden roles',async()=>{
 let audit
 const hidden='<div style="display:none"><script>fetch("/api/jobs");</script></div>'
 await assert.rejects(run(async(url,options)=>edit(await page(url,options),body=>url===entry?body+hidden:body),{onAudit:value=>{audit=value}}),/public.*(?:role|vacanc|job).*collector/i)
 assert.ok(audit.possibleVacancyMarkup.some(row=>row.kind==='unreviewed-executable-role-client'))
 assert.equal(audit.inventoryEvidence.reportedTotal,null)
})

test(source+' preserves new native role discovery rather than returning a bare empty array',async()=>{
 let audit
 await assert.rejects(run(async(url,options)=>{
  const value=await page(url,options)
  if(source==='aadyahaerospace'&&url.endsWith('/options/careers'))return edit(value,()=>JSON.stringify({acf:{vacancies:[{title:'New Native Engineer'}]}}))
  if(source==='acmesolar'&&url.includes('/assets/index-'))return edit(value,body=>body.replace('function y_(){','function y_(){fetch("/api/jobs");'))
  return edit(value,body=>url===entry?body+(source==='aayushmantech'?'<a href="/careers">Careers</a>':'<article class="job-card"><h2>Native Engineer</h2><a href="/jobs/native-engineer">View role</a></article>'):body)
 },{onAudit:value=>{audit=value}}),/public.*(?:role|vacanc|job).*collector/i)
 assert.ok(audit.possibleVacancyMarkup.length)
})

test(source+' rejects unrelated branded-copy response URLs',async()=>{
 await assert.rejects(run(async(url,options)=>({...await page(url,options),url:'https://other-employer.invalid/careers'})),/first-party|response identity/i)
})

test(source+' preserves first observations and rejects a changed closing native context',async()=>{
 let reads=0,audit
 await assert.rejects(run(async(url,options)=>{
  const value=await page(url,options)
  const target=source==='aadyahaerospace'?url.endsWith('/options/footer'):source==='acmesolar'?url.includes('/assets/index-'):url===entry
  if(!target||++reads!==2)return value
  return edit(value,body=>{
   if(source==='aadyahaerospace'){const model=JSON.parse(body);model.footer.find(row=>row.acf_fc_layout==='logo_section').button.title='View opening (updated)';return JSON.stringify(model)}
   if(source==='aarbeestructures')return body.replace('1FAIpQLScCYvLIbWkt9L9_aEKZGodzJErWjM4jQR-UsI4YmgxIL2DONw','newPublicApplicationEntry')
   if(source==='acmesolar')return body.replace('Enter Your Full Name*','Enter Your Legal Name*')
   return body.replace('Hire Experienced Developers','Hire Expert Developers')
  })
 },{onAudit:value=>{audit=value}}),/closing.*changed/i)
 assert.equal(audit.observations.length,expectedSignals)
 assert.equal(audit.closingMatches,false)
})

test(source+' caller abort settles an ignoring reader with the exact opaque reason',async()=>{
 const controller=new AbortController(),reason={opaque:source+' cancelled reader'};let timer
 try{const result=await Promise.race([run((_url,options)=>{assert.equal(options.signal,controller.signal);controller.abort(reason);return new Promise(()=>{})},{signal:controller.signal}).then(()=>({}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),350)})]);assert.equal(result.error,reason)}finally{clearTimeout(timer)}
})

test(source+' observer abort and rejection preserve original identity once',async()=>{
 const reason={opaque:source+' observer rejection'};let calls=0
 await assert.rejects(run(page,{onAudit:async()=>{calls++;throw reason}}),error=>error===reason)
 assert.equal(calls,1)
 const controller=new AbortController(),aborted={opaque:source+' observer abort'};let timer
 try{const result=await Promise.race([run(page,{signal:controller.signal,onAudit:()=>{controller.abort(aborted);return new Promise(()=>{})}}).then(()=>({}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),700)})]);assert.equal(result.error,aborted)}finally{clearTimeout(timer)}
})

test(source+' bounds an ignoring observer without a caller signal',async()=>{
 let timer
 try{const result=await Promise.race([run(page,{collectionBudgetMs:30,onAudit:()=>new Promise(()=>{})}).then(()=>({}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),700)})]);assert.equal(result.error?.name,'TimeoutError')}finally{clearTimeout(timer)}
})
