import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {HOME,CAREERS,parseListing,parseRoleHTML,parseMarkdown,sha} from './parser.js'
import {collect,runNative} from './native.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-board-20261105.json.gz',import.meta.url))))
const body=url=>Buffer.from(capture.responses[url].bodyBase64,'base64').toString('utf8')
const listing=parseListing(body(HOME),body(CAREERS))
const cases=[
 {shortcode:'BA09DED552',numeric:'6224829',title:'Working Student (m/w/d) - Pre Sales Support',listingDepartment:'Sales and Marketing',nativeDepartment:'PreSales',country:'Germany',city:'Bensheim',markdownSHA256:'7bfe71549500e42c8e28b8593d99b688822247a85902c13d758b1f2ac80cd539'},
 {shortcode:'2B95A2C31A',numeric:'4063708',title:'Project Manager (f/m/d)',listingDepartment:'Professional Services',nativeDepartment:'Global Delivery',country:'Switzerland',city:'Z\u00fcrich',markdownSHA256:'a8cc5b388620f58399ebcfc0d081732ddcec81554168a9cbf3993434d6e1697e'},
]
const role=shortcode=>{
 const candidate=listing.candidates.find(row=>row.shortcode===shortcode),html=body(candidate.url),identity=parseRoleHTML(html,candidate)
 return {candidate,html,identity,markdown:body(identity.markdownURL)}
}
const transport=(changes={},calls=[])=>async url=>{
 calls.push(url)
 const packet=capture.responses[url]
 if(!packet)throw Object.assign(Error('Unretained original public response packet'),{code:'FIXTURE_UNRETAINED'})
 return {...packet,body:Buffer.from(changes[url]??packet.bodyBase64,changes[url]===undefined?'base64':'utf8')}
}

for(const want of cases)test('unmodified '+want.shortcode+' retains the native role and both unresolved literal department labels',()=>{
 const {candidate,identity,markdown}=role(want.shortcode)
 assert.equal(sha(markdown),want.markdownSHA256)
 const fact=parseMarkdown(markdown,candidate,identity)
 assert.equal(fact.title,want.title)
 assert.equal(fact.nativeRoleTitle,want.title)
 assert.equal(fact.nativeNumericJobId,want.numeric)
 assert.equal(fact.nativeAccountId,'071d270e-7d0d-4d5e-8d48-1187c51ab6f6')
 assert.equal(fact.nativePublicURLShortcode,want.shortcode)
 assert.equal(fact.departmentRaw,want.nativeDepartment)
 assert.equal(fact.listingDepartmentRaw,want.listingDepartment)
 assert.equal(fact.listing.departmentRaw,want.listingDepartment)
 assert.deepEqual(fact.departmentAlignmentGap,{field:'department',status:'unresolved',listingRaw:want.listingDepartment,nativeRaw:want.nativeDepartment})
 assert.equal(fact.country,want.country)
 assert.equal(fact.nativeCityRaw,want.city)
 assert.equal(fact.nativeFullMarkdown,markdown)
 assert.equal(fact.nativeFullMarkdownSHA256,want.markdownSHA256)
 assert.deepEqual(Object.keys(fact.nativeDescriptionSections),['Description','Requirements','Benefits'])
 assert.equal(fact.applicationVisited,false)
})

test('reviewed department gaps require the exact observed role identity, literal pair and native HTML title corroboration',()=>{
 const {candidate,identity,markdown}=role('BA09DED552')
 for(const changed of[
  {...identity,nativeNumericJobId:'4063708'},
  {...identity,nativeAccountId:'071d270e-7d0d-4d5e-8d48-1187c51ab6f0'},
  {...identity,nativePublicURLShortcode:'2B95A2C31A'},
  {...identity,canonicalURL:'https://apply.workable.com/imtf/j/2B95A2C31A'},
  {...identity,markdownURL:'https://apply.workable.com/imtf/jobs/view/2B95A2C31A.md'},
  {...identity,nativeRoleTitle:null},
 ])assert.throws(()=>parseMarkdown(markdown,{...candidate,title:'Working Student (m/w/d) - Pre Sales Support'},changed))
 assert.throws(()=>parseMarkdown(markdown,{...candidate,departmentRaw:'Other'},identity),/workplace or department mismatch/)
 assert.throws(()=>parseMarkdown(markdown.replace('**Department:** PreSales','**Department:** Other'),candidate,identity),/workplace or department mismatch/)
})

test('reviewed department gap does not excuse country, employment, workplace or incomplete criteria',()=>{
 const {candidate,identity,markdown}=role('BA09DED552')
 assert.throws(()=>parseMarkdown(markdown.replace('Bensheim, Germany','Bensheim, India'),candidate,identity),/Conflicting listing\/detail placement/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,employmentRaw:'Temporary'},identity),/title\/employment\/header mismatch/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,workplaceRaw:'Hybrid'},identity),/workplace or department mismatch/)
 assert.throws(()=>parseMarkdown(markdown.replace(/## Requirements[\s\S]*?## Benefits/,'## Requirements\n\nShort.\n\n## Benefits'),candidate,identity),/Missing full employer section/)
})

test('Project Manager suffix handling never strips substantive parentheses or accepts a conflicting native title',()=>{
 const {candidate,identity,markdown}=role('2B95A2C31A')
 for(const title of ['Project Manager (Senior)','Project Manager (f/m/d, Senior)','Project Manager (f/m/d) - Different Role']){
  const changed=markdown.replace('# Project Manager (f/m/d)\n','# '+title+'\n')
  assert.throws(()=>parseMarkdown(changed,candidate,{...identity,nativeRoleTitle:title}),/title\/employment\/header mismatch/)
 }
 assert.throws(()=>parseMarkdown(markdown,candidate,{...identity,nativeRoleTitle:'Other'}),/title\/employment\/header mismatch/)
})

test('archived collection retains six primary facts and four native observations before its missing native-only HTML proof',async()=>{
 const calls=[],result=await collect({transport:transport({},calls)})
 assert.deepEqual(result.primaryFacts.map(f=>f.nativePublicURLShortcode),['6A5764CB0F','6F87AB9489','BA09DED552','40AEB306B4','7752672F96','2B95A2C31A'])
 assert.deepEqual(result.nativeObservations.map(f=>f.nativePublicURLShortcode),['40AEB306B4','F92BA9812C','2B95A2C31A','BA09DED552'])
 assert.deepEqual(result.alignmentGaps.filter(gap=>gap.code==='IMTF_DEPARTMENT_ALIGNMENT_GAP').map(gap=>({shortcode:gap.nativePublicURLShortcode,listingRaw:gap.listingRaw,nativeRaw:gap.nativeRaw,status:gap.status})),[
  {shortcode:'BA09DED552',listingRaw:'Sales and Marketing',nativeRaw:'PreSales',status:'unresolved'},
  {shortcode:'2B95A2C31A',listingRaw:'Professional Services',nativeRaw:'Global Delivery',status:'unresolved'},
 ])
 assert.equal(result.failures.length,1)
 assert.equal(result.failures[0].stage,'native-observations')
 assert.equal(result.failures[0].code,'FIXTURE_UNRETAINED')
 assert.equal(result.recoveryTrigger.candidate.shortcode,'F92BA9812C')
 assert.equal(result.recoveryTrigger.originalCorporateGuard.message,'Markdown title/employment/header mismatch')
 assert.ok(result.alignmentGaps.some(gap=>gap.nativePublicURLShortcode==='F92BA9812C'&&gap.field==='employment'))
 assert.equal(result.jobs.length,0)
 assert.equal(result.status,'partial')
 assert.equal(result.sourceScopeComplete,false)
 assert.equal(result.cleanupAllowed,false)
 assert.equal(result.verifiedZeroInventory,false)
 assert.equal(result.requestCount,24)
 assert.equal(calls.at(-1),'https://apply.workable.com/imtf/j/A2C3F4DE30')
 assert.equal(calls.includes('https://apply.workable.com/imtf/j/E90526054F/'),false)
})

test('DERIVED valid-foreign gap-only cohort returns coverage-gap with null totals and retains native facts and unresolved labels',async()=>{
 const {candidate}=role('BA09DED552')
 const careers=listing.candidates.reduce((html,row)=>row===candidate?html:html.replace(row.rawHTML,''),body(CAREERS))
 const read=transport({[CAREERS]:careers})
 const result=await collect({transport:read})
 assert.equal(result.facts.length,1)
 assert.equal(result.alignmentGaps.length,1)
 assert.equal(result.failures.length,0)
 assert.equal(result.admissionStopped,false)
 assert.equal(result.status,'partial')
 const jobs=await runNative({transport:read}),evidence=readInventoryEvidence(jobs),native=jobs[Symbol.for('jobverify.imtf-native-evidence')]
 assert.equal(jobs.length,0)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(native.facts.length,1)
 assert.equal(native.facts[0].nativeFullMarkdown,body('https://apply.workable.com/imtf/jobs/view/BA09DED552.md'))
 assert.equal(native.alignmentGaps.length,1)
 assert.equal(native.jobs.length,0)
 assert.equal(native.sourceScopeComplete,false)
 assert.equal(native.verifiedZeroInventory,false)
 assert.equal(native.cleanupAllowed,false)
})

test('registered valid-foreign gap-only result preserves the source-owned full native audit and explicit cleanup hold',async()=>{
 const {candidate}=role('BA09DED552')
 const careers=listing.candidates.reduce((html,row)=>row===candidate?html:html.replace(row.rawHTML,''),body(CAREERS))
 const provider=getScraperCatalog().find(row=>row.source==='imtf')
 const jobs=await createCatalogScraper(provider).run({transport:transport({[CAREERS]:careers})})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.ok(jobs.nativeCollectionEvidence,'The catalog must retain the source-owned full audit on an empty array')
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.facts.length,1)
 assert.equal(jobs.nativeCollectionEvidence.facts[0].departmentRaw,'PreSales')
 assert.equal(jobs.nativeCollectionEvidence.facts[0].listingDepartmentRaw,'Sales and Marketing')
 assert.equal(jobs.nativeCollectionEvidence.alignmentGaps.length,1)
 assert.equal(jobs.nativeCollectionEvidence.verifiedZeroInventory,false)
 assert.equal(jobs.nativeCollectionEvidence.cleanupAllowed,false)
})

test('opaque cancellation after a reviewed department gap still stops source admission with the exact caller reason',async()=>{
 const controller=new AbortController(),reason={opaque:'after-department-gap'},read=transport(),next='https://apply.workable.com/imtf/j/40AEB306B4'
 await assert.rejects(runNative({signal:controller.signal,transport:async(url,init)=>{if(url===next)controller.abort(reason);return read(url,init)}}),error=>error===reason)
})

test('valid-native department gaps preserve an audit sink failure as the original thrown reason',async()=>{
 const {candidate}=role('BA09DED552'),reason=Error('Original audit sink failure')
 const careers=listing.candidates.reduce((html,row)=>row===candidate?html:html.replace(row.rawHTML,''),body(CAREERS))
 await assert.rejects(runNative({transport:transport({[CAREERS]:careers}),onAudit:()=>{throw reason}}),error=>error===reason)
})
