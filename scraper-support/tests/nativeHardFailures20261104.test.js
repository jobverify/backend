import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {activeScripts} from '../utils/activeNativeHtml.js'
import {readEightfoldLocationScope} from '../apiPortal/eightfoldLocations.js'
import {inspectEmptyPage} from '../../scraper/buffer.workday/native.js'
import {parseNativeListing} from '../../scraper/skan/native.js'
import {getScraperCatalog} from '../providers/index.js'
import {runApiPortalScraper} from '../apiPortal/engine.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const responses=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-hard-failures-20261104.json.gz',import.meta.url)))).responses
const response=source=>responses.find(r=>r.source===source)
const pair=(raw,standardized)=>readEightfoldLocationScope({locations:[raw],standardizedLocations:[standardized]})
const transformFlight=(html,marker,change)=>{
 const script=activeScripts(html).find(s=>s.includes(marker))
 assert.ok(script,marker)
 const args=JSON.parse(script.slice(script.indexOf('(')+1,-1))
 args[1]=change(args[1])
 return html.replace(script,'self.__next_f.push('+JSON.stringify(args)+')')
}

test('current public hard-failure captures retain exact request bodies and fingerprints',()=>{
 assert.equal(responses.length,43)
 for(const r of responses){
  assert.equal(r.status,200)
  assert.equal(createHash('sha256').update(r.text).digest('hex'),r.bodySHA256)
  assert.equal(Buffer.byteLength(r.text),r.bodyBytes)
 }
})

test('current Infineon and Lam role-owned geography supports demonstrated campus, country and site formats',()=>{
 for(const raw of ['Bangalore BTP','Bangalore MG','Bangalore (India)','Bangalore BTP (India)','Bangalore MG (India)','IN-Bangalore (3811)']){
  const scope=pair(raw,'Bengaluru, KA, IN')
  assert.deepEqual(scope.indiaLocations,[raw]);assert.equal(scope.unresolved,false)
 }
 assert.deepEqual(pair('Ahmedabad (India)','Ahmedabad, GJ, IN').indiaLocations,['Ahmedabad (India)'])
 assert.deepEqual(pair('Delhi','DL,IN').indiaLocations,['Delhi'])
 assert.equal(pair('Melaka','Malacca, Malacca, MY').country,'MY')
 assert.equal(pair('Porto (Maia) (Portugal)','Porto, Porto District, PT').country,'PT')
 assert.equal(pair('Bengaluru, KA, In','Bengaluru, KA, IN').country,'India')
 assert.equal(pair('India - Chennai','Chennai, TN, IN').country,'India')
 assert.equal(pair('Andra Pradesh, India','Hyderabad, Telangana, India').country,'India')
})

test('all captured pages preserve native geography while unresolved remote or alternative workplaces prevent completeness',()=>{
 const totals={}
 for(const r of responses.filter(r=>r.requestedURL.includes('/search?')&&r.requestedURL.includes('limit=10'))){
  const rows=JSON.parse(r.text).data.positions
  for(const row of rows){
   const scope=readEightfoldLocationScope(row)
   assert.deepEqual(scope.nativeLocations,row.locations)
   assert.deepEqual(scope.standardizedLocations,row.standardizedLocations)
   totals[r.source]=(totals[r.source]||0)+1
  }
 }
 assert.deepEqual(totals,{eightfoldai:19,infineon:187,lamresearch:114})
 const alternate=pair('Bangalore / Noida','Bengaluru, KA, IN')
 assert.deepEqual(alternate.indiaLocations,['Bangalore'])
 assert.equal(alternate.location,'Bangalore');assert.equal(alternate.unresolved,true)
 const remote=pair('Remote','Remote')
 assert.equal(remote.country,null);assert.deepEqual(remote.indiaLocations,[]);assert.equal(remote.unresolved,true)
})

test('new formats cannot donate country, accept arbitrary campuses or hide contradictions',()=>{
 for(const raw of ['Bangalore BTP','IN-Bangalore (3811)','Bangalore / Noida']){
  const scope=readEightfoldLocationScope({locations:[raw]})
  assert.deepEqual(scope.indiaLocations,[]);assert.equal(scope.unresolved,true)
 }
 for(const [raw,std]of [
  ['US-Bangalore (3811)','Bengaluru, KA, IN'],['IN-Bangalore (3811)','Bengaluru, KA, US'],
  ['Bangalore (India)','Bengaluru, KA, US'],['Bangalore unknown campus','Bengaluru, KA, IN'],
  ['Indianapolis, IN','Indianapolis, IN, US'],['Remote','IN'],
  ['Ahmedabad','GJ,IN'],['Delhi','DL,US'],['Bangalore / Noida','Mumbai, MH, IN'],
  ['Bangalore / Bengaluru','Bengaluru, KA, IN'],
  ['Hyderabad / Remote worldwide','Hyderabad, TS, IN'],
 ]){
  if(raw==='Indianapolis, IN'){assert.deepEqual(pair(raw,std).indiaLocations,[]);continue}
  assert.throws(()=>pair(raw,std),/native location scope/)
 }
})

test('all access-recovery Eightfold providers map native country and filter on proven India rather than search scope',()=>{
 const providers=getScraperCatalog().filter(p=>p.atsPlatform==='eightfold'&&p.publicAccessPolicy==='preserve-verified-stop-denied-origin')
 assert.equal(providers.length,13)
 assert.equal(getScraperCatalog().find(p=>p.source==='slb').nativeCurrentCareerSurface,'slb-current-public-coveo')
 for(const provider of providers){
  assert.equal(provider.config.mapping.location?.strategy,'eightfold-location',provider.source)
  assert.equal(provider.config.mapping.country?.strategy,'eightfold-country',provider.source)
  assert.ok(provider.config.resultFilter.include.some(rule=>rule.field==='country'&&rule.pattern==='^India$'),provider.source)
 }
})

test('production Eightfold mapping keeps only the corroborated workplace and never promotes a remote listing to India',async()=>{
 const provider=structuredClone(getScraperCatalog().find(p=>p.source==='eightfoldai'))
 provider.config.rateLimit={minimumIntervalMs:0,maxRetries:0}
 delete provider.publicAccessPolicy
 provider.config.detail.enabled=false
 const rows=[
  {id:1,name:'Native India role',locations:['Bangalore / Noida'],standardizedLocations:['Bengaluru, KA, IN'],data:{publicUrl:'https://app.eightfold.ai/careers/job/1'},jobDescription:'Employer-owned full role description. '.repeat(8)},
  {id:2,name:'Remote unspecified',locations:['Remote'],standardizedLocations:['Remote'],data:{publicUrl:'https://app.eightfold.ai/careers/job/2'},jobDescription:'Employer-owned full role description. '.repeat(8)},
 ]
 const jobs=await runApiPortalScraper({provider,fetchJson:async()=>({data:{positions:rows,count:2}})})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India');assert.equal(jobs[0].location,'Bangalore')
 assert.deepEqual(jobs[0].sourceNativeLocations,['Bangalore / Noida'])
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('Buffer current literal chunk references still bind its explicit empty inventory to the employer careers route',()=>{
 const proof=inspectEmptyPage(response('buffer').text)
 assert.equal(proof.nativeRoles.qualified,true);assert.equal(proof.nativeRoles.count,0);assert.equal(proof.scopeQualified,true)
 assert.ok(proof.nativeRoles.moduleChunks.some(s=>s.includes('/journey/page-')))
})

test('Buffer refuses foreign, conflicting, nonliteral or recursive chunk references',()=>{
 const html=response('buffer').text
 const edits=[
  data=>data.replace('journey/page-','foreign/page-'),
  data=>data+'28:"static/chunks/app/%5Blocale%5D/journey/page-000.js"\n',
  data=>data.replace(/28:"[^"\n]+"/, '28:"$28"'),
  data=>data.replace(/28:"[^"\n]+"/, '28:{"path":"static/chunks/app/%5Blocale%5D/journey/page-000.js"}'),
  data=>data.replace(/28:"[^"\n]+"\n/,'')
 ]
 for(const edit of edits)assert.throws(()=>inspectEmptyPage(transformFlight(html,'jobPostingList',edit)),/Buffer native/)
})

test('Skan reads the complete current nested open-roles component and reconciles every visible department',()=>{
 const rows=parseNativeListing(response('skan').text)
 assert.equal(rows.length,66)
 assert.equal(rows.find(r=>r.id==='93522').location,'Bangalore, India')
 assert.ok(rows.some(r=>r.id==='56420'))
})

test('Skan refuses duplicate carriers, a foreign section and job objects hidden in arbitrary props',()=>{
 const html=response('skan').text
 const changes=[
  data=>data+'fe:'+data.split('\n').find(l=>l.includes('"jobs":')).replace(/^[\da-f]+:/i,'')+'\n',
  data=>data.replace('"id":"open-roles"','"id":"unrelated"'),
  data=>data.replace('"children":["$","$L81",null,{"intro":','"unrelated":["$","$L81",null,{"intro":')
 ]
 for(const change of changes)assert.throws(()=>parseNativeListing(transformFlight(html,'\\"jobs\\"',change)),/Skan native inventory/)
})
