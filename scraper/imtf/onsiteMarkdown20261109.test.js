import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {HOME,CAREERS,parseListing,parseRoleHTML,parseMarkdown,readHTML,sha} from './parser.js'
import {collect} from './native.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/onsite-markdown-20261109.json.gz',import.meta.url))))
const packets=new Map(capture.packets.map(p=>[p.requestedURL,p]))
for(const packet of packets.values())assert.equal(sha(Buffer.from(packet.rawBodyBase64,'base64')),packet.bodySHA256)
const body=url=>Buffer.from(packets.get(url).rawBodyBase64,'base64').toString('utf8')
const home=body(HOME),careers=body(CAREERS),listing=parseListing(home,careers),corporate=listing.candidates.find(c=>c.shortcode==='7752672F96')
const nativeTitle='Working Student (m/w/d) - DevOps Support'
// This explicitly derived exact-title listing isolates the on-site format from
// the separately tested corporate marker omission; raw packets stay original.
const aligned={...corporate,title:nativeTitle},identity=parseRoleHTML(body(corporate.url),aligned),markdown=body(identity.markdownURL)
const header='> IMTF \u00b7 Bensheim, Germany \u00b7 Part-time \u00b7 Posted 2026-08-26'
const derivedCareers=listing.candidates.reduce((html,row)=>html.replace(row.rawHTML,row===corporate?row.rawHTML.replace('<span>'+corporate.title+'</span>','<span>'+nativeTitle+'</span>'):''),careers)
const registered=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='imtf'))
const replay=(changes={},calls=[])=>async url=>{calls.push(url);const p=packets.get(url);if(!p)throw Object.assign(Error('Unretained original public response packet'),{code:'FIXTURE_UNRETAINED'});const raw=Buffer.from(p.rawBodyBase64,'base64');return{url:p.finalURL,status:p.status,headers:p.headers,bodyComplete:true,body:changes[url]===undefined?raw:Buffer.from(changes[url]),provenance:{originalBodySHA256:p.bodySHA256,...(changes[url]===undefined?{}:{derivedForTest:true})}}}

test('actual native on-site Markdown is readable with exact native title and explicit on_site workplace, without a fabricated header suffix',()=>{
 assert.ok(markdown.includes(header));assert.ok(markdown.includes('**Workplace:** on_site'))
 assert.equal(readHTML(body(corporate.url)).nodes.find(n=>n.tag==='meta'&&n.attrs.property==='og:title').attrs.content,nativeTitle+' - IMTF')
 const fact=parseMarkdown(markdown,aligned,identity)
 assert.equal(fact.title,nativeTitle);assert.equal(fact.country,'Germany');assert.equal(fact.nativeCityRaw,'Bensheim');assert.equal(fact.workplaceRaw,'on_site')
 assert.equal(fact.nativeFullMarkdown,markdown);assert.equal(fact.nativeFullMarkdownSHA256,'7cd63828ffa1bf6310313a1ef7ca2289c42807dde1d0d0abc0380374c1efab5f')
 assert.equal(fact.nativeNumericJobId,'6049211');assert.equal(fact.nativeAccountId,'071d270e-7d0d-4d5e-8d48-1187c51ab6f6');assert.equal(fact.applicationVisited,false)
 assert.deepEqual(Object.keys(fact.nativeDescriptionSections),['Description','Requirements','Benefits'])
})

test('DERIVED native-title-aligned on-site source retains the original full foreign fact and keeps unknown totals and cleanup held',async()=>{
 const calls=[],result=await collect({transport:replay({[CAREERS]:derivedCareers},calls),maxRequests:4})
 assert.equal(result.failures.length,0);assert.equal(result.facts.length,1);assert.equal(result.facts[0].nativeFullMarkdown,markdown);assert.equal(result.facts[0].country,'Germany')
 assert.equal(result.jobs.length,0);assert.equal(result.sourceScopeComplete,false);assert.equal(result.cleanupAllowed,false);assert.equal(result.verifiedZeroInventory,false)
 assert.deepEqual(calls,[HOME,CAREERS,corporate.url,identity.markdownURL])
 const jobs=await registered().run({transport:replay({[CAREERS]:derivedCareers}),maxRequests:4})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

for(const [label,change,candidate=aligned]of[
 ['missing explicit workplace',s=>s.replace('**Workplace:** on_site','')],
 ['ambiguous workplace',s=>s.replace('**Workplace:** on_site','**Workplace:** on_site\n**Workplace:** hybrid')],
 ['omitted hybrid suffix',s=>s.replace('**Workplace:** on_site','**Workplace:** hybrid'),{...aligned,workplaceRaw:'Hybrid'}],
 ['omitted remote suffix',s=>s.replace('**Workplace:** on_site','**Workplace:** remote'),{...aligned,workplaceRaw:'Remote'}],
 ['contradictory parenthesized workplace',s=>s.replace(header,header.replace('Bensheim, Germany','Bensheim, Germany (Hybrid)'))],
 ['different listing workplace',s=>s,{...aligned,workplaceRaw:'Hybrid'}],
 ['foreign explicit country',s=>s.replace('Bensheim, Germany','Bensheim, India')],
 ['unknown declared workplace',s=>s.replace('**Workplace:** on_site','**Workplace:** unreviewed'),{...aligned,workplaceRaw:'unreviewed'}],
 ['different employment',s=>s.replace('Part-time','Temporary')],
 ['different department',s=>s.replace('**Department:** Professional Services','**Department:** Other')],
 ['foreign application tenant',s=>s.replace('https://apply.workable.com/imtf/j/7752672F96/apply','https://apply.workable.com/foreign/j/7752672F96/apply')],
])test('on-site format support still holds '+label,()=>{assert.throws(()=>parseMarkdown(change(markdown),candidate,identity))})

test('DERIVED substantive corporate/native title disagreement remains rejected',()=>{
 assert.notEqual(corporate.title,nativeTitle)
 assert.throws(()=>parseMarkdown(markdown,{...corporate,title:corporate.title+' (Senior)'},identity),/title\/employment\/header mismatch/)
})

test('unmodified partial capture retains two valid foreign facts before its unretained next role without claiming foreign-only zero',async()=>{
 const calls=[]
 await assert.rejects(registered().run({transport:replay({},calls)}),e=>{assert.equal(e.code,'IMTF_NATIVE_INCOMPLETE');assert.equal(e.nativeEvidence.facts.length,2);assert.equal(e.nativeEvidence.failures[0].stage,'role-html');assert.equal(e.nativeEvidence.failures[0].code,'FIXTURE_UNRETAINED');assert.equal(e.nativeEvidence.jobs.length,0);assert.equal(e.nativeEvidence.sourceScopeComplete,false);assert.equal(e.nativeEvidence.cleanupAllowed,false);assert.equal(e.nativeEvidence.verifiedZeroInventory,false);return true})
 assert.equal(calls.length,7)
})

test('source bounds and opaque cancellation remain effective for the DERIVED on-site cohort',async()=>{
 const calls=[]
 await assert.rejects(registered().run({transport:replay({[CAREERS]:derivedCareers},calls),maxRequests:3}),e=>e.code==='IMTF_NATIVE_INCOMPLETE')
 assert.equal(calls.length,3)
 const controller=new AbortController(),reason={opaque:'IMTF caller'},read=replay({[CAREERS]:derivedCareers})
 await assert.rejects(registered().run({signal:controller.signal,transport:async(url,init)=>{if(url===corporate.url)controller.abort(reason);return read(url,init)}}),e=>e===reason)
})
