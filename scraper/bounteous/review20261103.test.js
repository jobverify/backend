import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{runCurrentBounteous,TURBOHIRE_ENDPOINT}from'./currentNative.js'
import{runCurrentBikayi}from'../bikayi/currentKeka.js'
import{runCurrentAix}from'../airasiaindia/currentAix.js'
import{runCurrentAccoliteDelegation}from'../accolitedigital/currentDelegation.js'
import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{readInventoryDelegationEvidence}from'../../scraper-support/utils/inventoryDelegationEvidence.js'
import{parseBoundedProgram}from'../../scraper-support/utils/remoteScriptData.js'
const fixtures=Object.fromEntries(['bounteous','accolitedigital','bikayi','airasiaindia'].map(source=>[source,JSON.parse(gunzipSync(readFileSync(new URL('../'+source+'/test-data/native-20261103.json.gz',import.meta.url))))]))
const comment=body=>'/*'+body.replace(/\*\//g,'* /')+'*/'
async function exercise(run,sources,mutate=()=>{},options={}){
 const pages=new Map(sources.flatMap(source=>structuredClone(fixtures[source])).map(row=>[row.requestedUrl,row])),visits=new Map(),calls=[];let audit
 const jobs=await run({...options,fetchPage:async url=>{const page=structuredClone(pages.get(url));assert.ok(page,'fixture '+url);const visit=(visits.get(url)||0)+1;visits.set(url,visit);calls.push(url)
  // Explicit simulated current response observation for these unit controls.
  // Immutable originals retain their real archived clocks; no live claim uses this seam.
  page.capturedAt=new Date().toISOString();await mutate(page,{url,visit,pages,calls});return page},onAudit:value=>{audit=value}})
 return{jobs,audit,calls}
}
const first=JSON.parse(fixtures.bounteous.find(row=>row.requestedUrl===TURBOHIRE_ENDPOINT).body).response[0].id
const active='https://comida.keka.com/careers/api/embedjobs/default/active/a4f89fc2-d9b6-49a1-b6c7-66522d4c7956'
test('review: unchanged public contracts preserve canonical69,BIK4,AIX0 and current-cohort delegation',async()=>{
 const canonical=await exercise(runCurrentBounteous,['bounteous']),bik=await exercise(runCurrentBikayi,['bikayi']),aix=await exercise(runCurrentAix,['airasiaindia']),delegated=await exercise(runCurrentAccoliteDelegation,['bounteous','accolitedigital'])
 assert.equal(canonical.jobs.length,69);assert.equal(bik.jobs.length,4);assert.equal(readInventoryEvidence(aix.jobs).status,'verified-empty')
 assert.deepEqual(delegated.jobs.map(job=>[job.source,job.company,job.jobId]),canonical.jobs.map(job=>[job.source,job.company,job.jobId]));assert.ok(readInventoryDelegationEvidence(delegated.jobs))
})
for(const[source,run,mutate]of[
 ['Bounteous',runCurrentBounteous,(page,{url})=>{if(url.includes('/components-CareersHero-'))page.body=comment(page.body)}],
 ['BIK',runCurrentBikayi,(page,{url})=>{if(url.endsWith('/2974e331711d86bc.js'))page.body=comment(page.body)}],
 ['AIX',runCurrentAix,page=>{page.body=page.body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(all,open,body,close)=>body.includes('j2w.init(')?open+comment(body)+close:all)}],
])test('review: '+source+' commented client/init code cannot qualify public inventory',async()=>{
 await assert.rejects(exercise(run,[source==='Bounteous'?'bounteous':source==='BIK'?'bikayi':'airasiaindia'],mutate),/AST|client|native|executable|program/i)
})
test('review: a quoted Bounteous client is data rather than executable endpoint proof',async()=>{
 await assert.rejects(exercise(runCurrentBounteous,['bounteous'],(page,{url})=>{if(url.includes('/components-CareersHero-'))page.body=JSON.stringify(page.body)}),/AST|client|executable|program/i)
})
test('review: Bounteous registration in a false branch cannot qualify a component',async()=>{
 await assert.rejects(exercise(runCurrentBounteous,['bounteous'],(page,{url})=>{if(url.includes('/components-CareersHero-'))page.body='if(false){'+page.body+'}'}),/registration|unconditional|AST/)
})
test('review: Bounteous React import shadowing cannot retain a syntactically unchanged public component',async()=>{
 await assert.rejects(exercise(runCurrentBounteous,['bounteous'],(page,{url})=>{if(url.includes('/components-CareersHero-'))page.body=page.body.replace('n=r("q1tI")','n={useEffect:()=>{}}')}),/binding|dataflow|AST/)
})
test('review: BIK duplicate public component bindings are rejected',async()=>{
 await assert.rejects(exercise(runCurrentBikayi,['bikayi'],(page,{url})=>{if(url.endsWith('/2974e331711d86bc.js'))page.body=page.body.replace('e.s(["default"','var tR=()=>null;e.s(["default"')}),/binding|AST/)
})
test('review: replacing the BIK public transport namespace cannot qualify unchanged jobs code',async()=>{
 await assert.rejects(exercise(runCurrentBikayi,['bikayi'],(page,{url})=>{if(url.endsWith('/2974e331711d86bc.js')){
  const factory=parseBoundedProgram(page.body).body[0].expression.arguments[0].elements[2],at=factory.body.end-1
  page.body=page.body.slice(0,at)+';tw={get:function(){throw Error("unreviewed transport")}};'+page.body.slice(at)
 }}),/reassigned|namespace|AST/)
})

test('review: an unrelated unreferenced Bounteous module export does not gate the public component',async()=>{
 const{jobs}=await exercise(runCurrentBounteous,['bounteous'],(page,{url})=>{if(url.includes('/components-CareersHero-')){
  const modules=parseBoundedProgram(page.body).body[0].expression.arguments[0].elements[1],at=modules.end-1
  page.body=page.body.slice(0,at)+',privateContactUnreferenced:function(e,t,r){t.default=function(){return null}}'+page.body.slice(at)
 }})
 assert.equal(jobs.length,69)
})

test('review: unrelated BIK private contact-form subject does not gate public inventory',async()=>{
 const{jobs}=await exercise(runCurrentBikayi,['bikayi'],(page,{url})=>{if(url.endsWith('/2974e331711d86bc.js')){assert.ok(page.body.includes('Job Application'));page.body=page.body.replace('Job Application','Private application subject changed')}})
 assert.equal(jobs.length,4)
})
test('review: AIX company init must be directly executable rather than a false-branch descendant',async()=>{
 await assert.rejects(exercise(runCurrentAix,['airasiaindia'],page=>{page.body=page.body.replace(/j2w\.init\(\{([\s\S]*?)\}\);/g,(all)=>'if(false){'+all+'}')}),/unconditional|AST/)
})
test('review: executable AIX namespace shadowing is rejected even if its core literal survives',async()=>{
 await assert.rejects(exercise(runCurrentAix,['airasiaindia'],page=>{page.body=page.body.replace('j2w.init({','var j2w={};j2w.init({')}),/shadowed|AST/)
})
test('review: AIX private login URL changes do not become a public-JD or empty-inventory gate',async()=>{
 const{jobs}=await exercise(runCurrentAix,['airasiaindia'],page=>{page.body=page.body.replace('https://career44.sapsf.com','https://private-application.example.invalid/login')})
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('review: a structured native US alternative is retained and cannot publish a conflicting India role',async()=>{
 const{jobs,audit}=await exercise(runCurrentBounteous,['bounteous'],(page,{url})=>{if(url===TURBOHIRE_ENDPOINT||url.endsWith('?id='+first)){const value=JSON.parse(page.body),row=url===TURBOHIRE_ENDPOINT?value.response.find(row=>row.id===first):value.response;row.countries.push({countryCode:'US',countryName:'United States'});page.body=JSON.stringify(value)}})
 assert.equal(jobs.length,68);assert.ok(!jobs.some(job=>job.jobId===first));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.deepEqual(audit.unknownCountries.find(row=>row.id===first).fields.countries.at(-1),{countryCode:'US',countryName:'United States'})
})
test('review: unsupported country-array shapes remain unknown rather than silently disappearing',async()=>{
 const{jobs,audit}=await exercise(runCurrentBounteous,['bounteous'],(page,{url})=>{if(url===TURBOHIRE_ENDPOINT){const value=JSON.parse(page.body);value.response[0].countries={countryCode:'US',countryName:'United States'};page.body=JSON.stringify(value)}})
 assert.equal(jobs.length,68);assert.ok(audit.unknownCountries.some(row=>row.id===first));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('review: structured all-foreign alternatives preserve exact ambiguity while still excluding India',async()=>{
 const{jobs,audit}=await exercise(runCurrentBounteous,['bounteous'],(page,{url})=>{if(url===TURBOHIRE_ENDPOINT){const value=JSON.parse(page.body),row=value.response.find(row=>row.country==='us'&&row.countries.length===2);assert.ok(row);row.countries.push({countryCode:'GB',countryName:'United Kingdom'});page.body=JSON.stringify(value)}})
 assert.equal(jobs.length,69);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 const exclusion=audit.exclusions.find(row=>row.countries.includes('United Kingdom')&&row.countries.includes('Canada'));assert.ok(exclusion);assert.equal(exclusion.country,null);assert.ok(exclusion.fields.countries.some(value=>value.countryCode==='GB'))
})
test('review: BIK final native active membership follows every closing full detail and drops a removed role',async()=>{
 const{jobs,audit,calls}=await exercise(runCurrentBikayi,['bikayi'],(_page,{url,visit,pages})=>{if(url.endsWith('/63647')&&visit===2){const current=pages.get(active);current.body=JSON.stringify(JSON.parse(current.body).filter(row=>row.id!==63647))}})
 assert.equal(jobs.length,3);assert.ok(!jobs.some(job=>job.jobId==='63647'));assert.equal(audit.closingInventoryMatches,false)
 assert.ok(calls.findLastIndex(url=>url===active)>calls.findLastIndex(url=>url.includes('/careers/jobdetails/')))
})
test('review: stale2020 observation clocks do not certify current Accolite delegation',async()=>{
 const{jobs}=await exercise(runCurrentAccoliteDelegation,['bounteous','accolitedigital'],page=>{page.capturedAt='2020-01-01T00:00:00.000Z'})
 assert.equal(jobs.length,69);assert.equal(readInventoryDelegationEvidence(jobs),null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('review: a mixed old/current observation cohort cannot inherit a new invocation clock',async()=>{
 const{jobs}=await exercise(runCurrentAccoliteDelegation,['bounteous','accolitedigital'],(page,{url})=>{if(url.includes('/about/company-news'))page.capturedAt=new Date(Date.now()-3600000).toISOString()})
 assert.equal(jobs.length,69);assert.equal(readInventoryDelegationEvidence(jobs),null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
