import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readProvidenceAuthorityHTML,parseProvidenceRoleHTML,createProvidenceScraper,PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL} from './currentIndia20261108.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const captured=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-corporate.json.gz',import.meta.url))))
const packet=captured.responses[0],body=packet.body
const privacyCapture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/unreviewed-corporate-privacy.json.gz',import.meta.url))))
const privacyPacket=privacyCapture.responses[0],privacyBody=privacyPacket.body
const CSS='https://www.providence.in/wp-content/litespeed/css/ace48e898fc947c74d6098cc005a6fb2.css?ver=07e5c'

// This genuine complete vector differs from the already reviewed typed frame
// only in one previously reviewed CSS declaration, with every program fixed.
test('Providence accepts its current exact corporate carrier vector and unchanged owned board handoff',()=>{
 assert.equal(createHash('sha256').update(body).digest('hex'),packet.sha256)
 const result=readProvidenceAuthorityHTML(body,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(result.nextURL,PROVIDENCE_INDIA_BOARD_URL);assert.equal(result.bodySHA256,packet.sha256)
})
for(const[name,html]of[['root privacy',body],['experienced-professionals privacy',privacyBody]])test('Providence registered factory reaches only the bound board after '+name,async()=>{
 const reason=Object.freeze({controlledBoardBoundary:'unacquired'}),calls=[]
 const scraper=createCatalogScraper(getScraperCatalog().find(row=>row.source==='providence'))
 await assert.rejects(scraper.run({fetchImpl:async url=>{
  calls.push(url);if(url===PROVIDENCE_INDIA_BOARD_URL)throw reason
  assert.equal(url,PROVIDENCE_INDIA_CAREERS_URL)
  const response=new Response(html,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }}),error=>error===reason)
 assert.deepEqual(calls,[PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL])
})
for(const[name,mutate]of[
 ['an unknown stylesheet',html=>html.replaceAll(CSS,CSS.replace('ace48e','000000'))],
 ['an extra stylesheet',html=>html.replace('</head>','<style>a{display:none}</style></head>')],
 ['changed inline program bytes',html=>html.replace(/(var\s+complianz\s*=)/,'$1/*unreviewed*/')],
 ['a hidden program carrier',html=>html.replace('id="cmplz-cookiebanner-js-extra"','hidden id="cmplz-cookiebanner-js-extra"')],
 ['changed carrier ancestry',html=>html.replace('<body ','<body data-unreviewed="1" ')],
 ['foreign board authority',html=>html.replaceAll('https://careers.providence.in/','https://foreign.invalid/jobs/')],
])test('Providence current corporate admission still refuses '+name,()=>{
 const changed=mutate(body);assert.notEqual(changed,body)
 assert.throws(()=>readProvidenceAuthorityHTML(changed,PROVIDENCE_INDIA_CAREERS_URL),/Providence India/)
})
test('Providence binds the genuine experienced-professionals privacy literal to its complete corporate profile',()=>{
 assert.equal(createHash('sha256').update(privacyBody).digest('hex'),privacyPacket.sha256)
 const authority=readProvidenceAuthorityHTML(privacyBody,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(authority.nextURL,PROVIDENCE_INDIA_BOARD_URL);assert.equal(authority.bodySHA256,privacyPacket.sha256)
})
test('Providence passive fallback data also accepts its independently reviewed corporate cache vector',()=>{
 const changed=privacyBody.replaceAll('https://www.providence.in/wp-content/litespeed/css/3fabd0e978c031ea11ad044dda73f32e.css?ver=07e5c',CSS)
 assert.notEqual(changed,privacyBody)
 assert.equal(readProvidenceAuthorityHTML(changed,PROVIDENCE_INDIA_CAREERS_URL).nextURL,PROVIDENCE_INDIA_BOARD_URL)
})
const privacyProgram=readNativeDocument(privacyBody).nodes(node=>node.tag==='script'&&node.attrs.id==='cmplz-cookiebanner-js-extra')[0].raw
const privacyPath=['body',0,'declarations',0,'init','properties',26,'value','properties',1,'value','properties',2,'value','properties',1,'value']
function withPrivacy(value,raw=JSON.stringify(value)){
 const literal=privacyPath.reduce((node,key)=>node[key],parse(privacyProgram,{ecmaVersion:'latest'}))
 assert.equal(literal.value,PROVIDENCE_INDIA_CAREERS_URL)
 return privacyBody.replace(privacyProgram,privacyProgram.slice(0,literal.start)+raw+privacyProgram.slice(literal.end))
}
for(const value of ['https://www.providence.in/','https://www.providence.in/cache-904/','https://www.providence.in/482fa9ad4bf2/'])test('Providence passive fallback type preserves exact owned hiring authority for '+value,()=>{
 assert.equal(readProvidenceAuthorityHTML(withPrivacy(value),PROVIDENCE_INDIA_CAREERS_URL).nextURL,PROVIDENCE_INDIA_BOARD_URL)
})
for(const value of ['https://foreign.invalid/experienced-professionals/','/experienced-professionals/','https://www.providence.in:443/cache/','https://user@www.providence.in/cache/','http://www.providence.in/cache/','https://www.providence.in/cache/?q=1','https://www.providence.in/cache/#child','https://www.providence.in/cache/child/','https://www.providence.in/CACHE/','https://www.providence.in/%63ache/','https://www.providence.in/'+ 'a'.repeat(257)+'/',null,123,{}])test('Providence passive fallback type refuses '+JSON.stringify(value),()=>{
 assert.throws(()=>readProvidenceAuthorityHTML(withPrivacy(value),PROVIDENCE_INDIA_CAREERS_URL),value&&typeof value==='object'?/Unreviewed typed passive literal/:/Unreviewed corporate passive privacy URL/)
})
test('Providence passive fallback type refuses escaped raw URL spelling',()=>{
 assert.throws(()=>readProvidenceAuthorityHTML(withPrivacy('https://www.providence.in/cache/','"https://www.providence.in/\\u0063ache/"'),PROVIDENCE_INDIA_CAREERS_URL),/Unreviewed corporate passive privacy URL/)
})
test('Providence passive fallback value never supplies a native request target',async()=>{
 const calls=[],reason=Object.freeze({boundBoard:'unacquired'}),value='https://www.providence.in/cache-904/'
 const scraper=createCatalogScraper(getScraperCatalog().find(row=>row.source==='providence'))
 await assert.rejects(scraper.run({fetchImpl:async url=>{
  calls.push(url);if(url===PROVIDENCE_INDIA_BOARD_URL)throw reason
  assert.equal(url,PROVIDENCE_INDIA_CAREERS_URL)
  const response=new Response(withPrivacy(value),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }}),error=>error===reason)
 assert.deepEqual(calls,[PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL]);assert.ok(!calls.includes(value))
})
for(const[name,mutate]of[
 ['a moved fallback property',html=>html.replace('"privacy-statement-children"','"moved-privacy-statement-children"')],
 ['changed actual privacy authority',html=>html.replaceAll('https://www.providence.in/privacy-policy/','https://www.providence.in/cache-904/')],
 ['an extra program',html=>html.replace('</head>','<script>var unreviewed=1;</script></head>')],
])test('Providence passive fallback admission still refuses '+name,()=>{
 const changed=mutate(withPrivacy('https://www.providence.in/cache-904/'));assert.notEqual(changed,withPrivacy('https://www.providence.in/cache-904/'))
 assert.throws(()=>readProvidenceAuthorityHTML(changed,PROVIDENCE_INDIA_CAREERS_URL),/Providence India/)
})
const boardCapture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-board.json.gz',import.meta.url))))
const boardPacket=boardCapture.responses.find(row=>row.url===PROVIDENCE_INDIA_BOARD_URL)
test('Providence current complete board cache declaration preserves the owned tenant and search handoff',()=>{
 assert.equal(createHash('sha256').update(boardPacket.body).digest('hex'),boardPacket.sha256)
 const authority=readProvidenceAuthorityHTML(boardPacket.body,PROVIDENCE_INDIA_BOARD_URL)
 assert.equal(authority.nextURL,'https://careers.providence.in/search/')
 assert.equal(authority.bodySHA256,boardPacket.sha256)
})
const syntheticBoard565=boardPacket.body.replace('/js/override.js?locale=en_US&amp;i=1008964815','/js/override.js?locale=en_US&amp;i=565448483')
test('Providence synthetic reviewed board layout plus exact already-bound565 URI preserves authority',()=>{
 assert.equal(createHash('sha256').update(boardPacket.body).digest('hex'),boardPacket.sha256)
 assert.notEqual(syntheticBoard565,boardPacket.body)
 const authority=readProvidenceAuthorityHTML(syntheticBoard565,PROVIDENCE_INDIA_BOARD_URL)
 assert.equal(authority.nextURL,'https://careers.providence.in/search/')
 assert.equal(authority.bodySHA256,createHash('sha256').update(syntheticBoard565).digest('hex'))
})
for(const[name,mutate]of[
 ['a neighboring cache URI',html=>html.replace('i=565448483','i=565448484')],
 ['a foreign search handoff',html=>html.replaceAll('https://careers.providence.in/search/','https://foreign.invalid/search/')],
 ['foreign reciprocal employer authority',html=>html.replaceAll('https://www.providence.in','https://foreign.invalid')],
 ['an extra program carrier',html=>html.replace('</head>','<script>var unreviewed=1;</script></head>')],
])test('Providence synthetic565 profile still refuses '+name,()=>{
 const changed=mutate(syntheticBoard565);assert.notEqual(changed,syntheticBoard565)
 assert.throws(()=>readProvidenceAuthorityHTML(changed,PROVIDENCE_INDIA_BOARD_URL),/Providence India/)
})
test('Providence registered current publisher chain reaches only its declared native search',async()=>{
 const reason=Object.freeze({controlledSearchBoundary:'unacquired'}),calls=[]
 const scraper=createCatalogScraper(getScraperCatalog().find(row=>row.source==='providence'))
 await assert.rejects(scraper.run({fetchImpl:async url=>{
  calls.push(url);if(url==='https://careers.providence.in/search/')throw reason
  const packet=boardCapture.responses.find(row=>row.url===url);assert.ok(packet)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }}),error=>error===reason)
 assert.deepEqual(calls,[PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL,'https://careers.providence.in/search/'])
})
for(const[name,mutate]of[
 ['an unseen board cache declaration',html=>html.replaceAll('i=1008964815','i=123456789')],
 ['changed inline board program bytes',html=>html.replace('</script>',';</script>')],
 ['a hidden board program carrier',html=>html.replace('<script','<script hidden')],
 ['foreign reciprocal employer links',html=>html.replaceAll('https://www.providence.in','https://foreign.invalid')],
])test('Providence current board admission rejects '+name,()=>{
 const changed=mutate(boardPacket.body);assert.notEqual(changed,boardPacket.body)
 assert.throws(()=>readProvidenceAuthorityHTML(changed,PROVIDENCE_INDIA_BOARD_URL),/Providence India/)
})
const listingCapture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-listing-pages.json.gz',import.meta.url))))
const secondURL='https://careers.providence.in/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=15'
const thirdURL='https://careers.providence.in/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=30'
async function listingReplay(change=(packet=>packet)){
 const calls=[],reason=Object.freeze({controlledThirdNativePage:'unacquired'})
 const scraper=createCatalogScraper(getScraperCatalog().find(row=>row.source==='providence'))
 let caught
 try{await scraper.run({fetchImpl:async url=>{
  calls.push(url);if(url===thirdURL)throw reason
  const original=listingCapture.responses.find(row=>row.url===url);assert.ok(original,'Unexpected current native request: '+url)
  const packet=change({...original},url),response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }})}catch(error){caught=error}
 return{calls,reason,caught}
}
test('Providence current two listing pages retain their native76-record inventory and declared pagination',async()=>{
 const{calls,reason,caught}=await listingReplay();assert.equal(caught,reason)
 assert.deepEqual(calls,[PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL,'https://careers.providence.in/search/',secondURL,thirdURL])
})
for(const[name,mutate]of[
 ['an unknown listing cache URI',html=>html.replaceAll('i=565448483','i=565448484')],
 ['an accessibility/native-total conflict',html=>html.replace('Page 2 of 6, Results 16 to 30 of 76','Page 2 of 6, Results 16 to 30 of 77')],
])test('Providence current listing refuses '+name,async()=>{
 const{calls,caught}=await listingReplay((packet,url)=>{
  if(url!==secondURL)return packet
  const body=mutate(packet.body);assert.notEqual(body,packet.body);return{...packet,body}
 })
 assert.match(caught?.message||'',/Providence India/);assert.equal(calls.at(-1),secondURL)
})
const blogCapture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-corporate-blog-privacy.json.gz',import.meta.url))))
const blogPacket=blogCapture.responses[0]
test('Providence current exact cached blog privacy literal preserves every corporate authority guard',()=>{
 assert.equal(createHash('sha256').update(blogPacket.body).digest('hex'),blogPacket.sha256)
 const authority=readProvidenceAuthorityHTML(blogPacket.body,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(authority.nextURL,PROVIDENCE_INDIA_BOARD_URL);assert.equal(authority.bodySHA256,blogPacket.sha256)
})
test('Providence cached blog privacy literal cannot enter an unknown corporate carrier vector',()=>{
 const changed=blogPacket.body.replaceAll('https://www.providence.in/wp-content/litespeed/css/3fabd0e978c031ea11ad044dda73f32e.css?ver=07e5c',CSS.replace('ace48e','000000'))
 assert.notEqual(changed,blogPacket.body)
 assert.throws(()=>readProvidenceAuthorityHTML(changed,PROVIDENCE_INDIA_CAREERS_URL),/Providence India/)
})
const blogCacheCapture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-corporate-blog-cache-pair.json.gz',import.meta.url))))
test('Providence admits the newly observed exact blog privacy and corporate cache pairing',()=>{
 const packet=blogCacheCapture.responses[0]
 assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
 const authority=readProvidenceAuthorityHTML(packet.body,PROVIDENCE_INDIA_CAREERS_URL)
 assert.equal(authority.nextURL,PROVIDENCE_INDIA_BOARD_URL);assert.equal(authority.bodySHA256,packet.sha256)
})
const rotatingPrivacy=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-corporate-opaque-privacy.json.gz',import.meta.url))))
test('Providence genuine rotating opaque fallback is passive under unchanged full program and43 carriers',()=>{
 const packet=rotatingPrivacy.responses[0]
 assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
 assert.equal(readProvidenceAuthorityHTML(packet.body,PROVIDENCE_INDIA_CAREERS_URL).nextURL,PROVIDENCE_INDIA_BOARD_URL)
})
const thirdPageCapture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-listing-third-page.json.gz',import.meta.url))))
async function thirdPageReplay(change=packet=>packet){
 const fourthURL='https://careers.providence.in/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=45'
 const calls=[],reason=Object.freeze({controlledFourthNativePage:'unacquired'})
 let caught
 try{await createCatalogScraper(getScraperCatalog().find(row=>row.source==='providence')).run({fetchImpl:async url=>{
  calls.push(url);if(url===fourthURL)throw reason
  const original=thirdPageCapture.responses.find(row=>row.url===url);assert.ok(original,'Unexpected native request '+url)
  const packet=change({...original},url),response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }})}catch(error){caught=error}
 return{calls,reason,caught,fourthURL}
}
test('Providence current third listing cache declaration preserves all50carriers and independent native pagination',async()=>{
 const{calls,reason,caught,fourthURL}=await thirdPageReplay();assert.equal(caught,reason)
 assert.deepEqual(calls,[PROVIDENCE_INDIA_CAREERS_URL,PROVIDENCE_INDIA_BOARD_URL,'https://careers.providence.in/search/',secondURL,thirdURL,fourthURL])
})
test('Providence third listing admission still refuses a changed cache URI',async()=>{
 const{calls,caught}=await thirdPageReplay((packet,url)=>url===thirdURL?{...packet,body:packet.body.replaceAll('i=1008964815','i=1008964816')}:packet)
 assert.match(caught?.message||'',/Providence India/);assert.equal(calls.at(-1),thirdURL)
})
const marginPair=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-authored-margin-pair.json.gz',import.meta.url))))
const margin='margin:0.0cm 0.0cm 0.0cm 32.0px'
test('Providence genuine exact authored margin preserves both full native criteria snapshots',()=>{
 const results=marginPair.responses.map(packet=>{
  assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
  const result=parseProvidenceRoleHTML(packet.body,marginPair.row,{now:marginPair.capturedAt})
  assert.equal(result.model.publicId,'56770644');assert.equal(result.model.title,'Service Engineer 2')
  assert.equal(result.model.address.addressCountry,'IN');assert.equal(result.model.employer,'Providence')
  assert.ok(result.model.descriptionHTML.includes(margin));assert.ok(result.model.descriptionText.length>1700)
  return result
 })
 assert.deepEqual(results[0],results[1])
})
for(const style of ['margin:0.0cm 0.0cm 0.0cm 32.0001px','margin:32.0px 0.0cm 0.0cm 0.0cm','margin:0.0cm 0.0cm 0.0cm -32.0px',margin+'!important',margin+';display:none'])test('Providence exact margin tuple does not generalize to '+style,()=>{
 const body=marginPair.responses[0].body,changed=body.replace(margin,style);assert.notEqual(changed,body)
 assert.throws(()=>parseProvidenceRoleHTML(changed,marginPair.row,{now:marginPair.capturedAt}),/Providence India/)
})
const zeroIndentPair=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-authored-zero-indent-pair.json.gz',import.meta.url))))
const zeroIndent='text-indent:0.0in'
test('Providence genuine exact zero-inch indentation preserves both full native criteria snapshots',()=>{
 const results=zeroIndentPair.responses.map(packet=>{
  assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
  const result=parseProvidenceRoleHTML(packet.body,zeroIndentPair.row,{now:zeroIndentPair.capturedAt})
  assert.equal(result.model.publicId,'59482144');assert.equal(result.model.title,'Manager - Security Operations')
  assert.equal(result.model.address.addressCountry,'IN');assert.equal(result.model.employer,'Providence')
  assert.ok(result.model.descriptionHTML.includes(zeroIndent));assert.ok(result.model.descriptionText.length>1000)
  return result
 })
 assert.deepEqual(results[0],results[1])
})
for(const style of ['text-indent:0.0001in','text-indent:-0.0in','text-indent:0.0px',zeroIndent+'!important',zeroIndent+';display:none'])test('Providence exact zero-inch indentation does not generalize to '+style,()=>{
 const body=zeroIndentPair.responses[0].body,changed=body.replace(zeroIndent,style);assert.notEqual(changed,body)
 assert.throws(()=>parseProvidenceRoleHTML(changed,zeroIndentPair.row,{now:zeroIndentPair.capturedAt}),/Providence India/)
})
const fullCurrent=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-full-closing-run.json.gz',import.meta.url))))
test('Providence genuine complete current run reconciles all76roles and returns only63qualified India roles',async()=>{
 const calls=[]
 for(const packet of fullCurrent.responses)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
 const jobs=await createProvidenceScraper().run({now:()=>fullCurrent.startedAt,fetchImpl:async url=>{
  calls.push(url)
  const packet=fullCurrent.responses.filter(packet=>packet.url===url)[calls.filter(value=>value===url).length-1]
  assert.ok(packet,'Unexpected current native request '+url)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }})
 assert.deepEqual(calls,fullCurrent.responses.map(packet=>packet.url));assert.equal(calls.length,168)
 assert.equal(jobs.length,63);assert.ok(jobs.every(job=>job.country==='India'&&job.sourceNativeCountryEvidence.rawCountry==='IN'))
 assert.ok(jobs.every(job=>job.sourceDescription===job.sourceNativeCriteriaEvidence.fullText&&job.sourceDescription===job.jobDescription))
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
 const audit=jobs.sourceAudit
 assert.equal(audit.configuredBoardReconciled,true);assert.equal(audit.nativeReportedChannelTotal,76);assert.equal(audit.nativeObservedRows,76)
 assert.equal(audit.openingListings.length,6);assert.equal(audit.closingListings.length,6)
 assert.equal(audit.openingRoles.length,76);assert.equal(audit.closingRoles.length,76);assert.equal(audit.held.length,13)
 assert.deepEqual([...new Set(audit.held.flatMap(row=>row.reasons))].sort(),['native-explicit-foreign-country-PK','native-full-role-criteria-markers-unproven'])
})
