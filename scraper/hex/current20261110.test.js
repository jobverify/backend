import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createHexScraper,hasCompleteUsOnlyInventory,hasVerifiedCareersLandingSignal} from './script.js'
import {inspectCurrentHexRole,readCurrentHexInventory} from './currentNative.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current20261110.json.gz',import.meta.url))))
const landing=capture.opening.responses[0]
const inventory=()=>readCurrentHexInventory(landing.body)
const packetFor=row=>capture.responses.find(packet=>packet.url===row.url)
const changeModel=(body,change)=>{
 const doc=readNativeDocument(body)
 const node=doc.nodes(value=>value.tag==='script'&&value.attrs.type==='application/ld+json')
  .find(value=>JSON.parse(value.raw)['@type']==='JobPosting')
 const model=JSON.parse(node.raw)
 change(model)
 return body.replace(node.raw,JSON.stringify(model))
}

test('Hex current public response retains publisher identity after brand copy changed',()=>{
 assert.equal(landing.status,200)
 assert.equal(landing.url,'https://hex.tech/careers/')
 assert.equal(hasVerifiedCareersLandingSignal(landing.body),true)
 assert.equal(hasCompleteUsOnlyInventory(landing.body),true)
})

test('Hex verifies every captured native role identity, criteria and worksite country',()=>{
 const native=inventory()
 assert.equal(native.total,37)
 for(const row of native.cards){
  const proof=inspectCurrentHexRole(packetFor(row).body,row)
  assert.equal(proof.country,'United States')
  assert.equal(proof.nativeJobPosting.url,row.url)
 }
})

for(const [name,edit]of [
 ['foreign publisher',html=>html.replace('property="og:site_name" content="Hex"','property="og:site_name" content="Other"')],
 ['inert inventory',html=>html.replace('<body','<body hidden')],
 ['unbound publisher URL',html=>html.replace('property="og:url" content="https://hex.tech/careers/"','property="og:url" content="https://other.example/careers/"')],
 ['changed count',html=>html.replace('[<!-- -->37<!-- -->]','[<!-- -->38<!-- -->]')],
 ['unknown card country',html=>html.replace('New York or San Francisco','Bengaluru, India')],
 ['unexpected base',html=>html.replace('</head>','<base href="https://other.example/"></head>')],
])test('Hex rejects '+name,()=>{
 const body=edit(landing.body)
 assert.notEqual(body,landing.body,'negative control must mutate genuine current input')
 assert.throws(()=>readCurrentHexInventory(body),/Hex|hex/)
})

for(const [name,edit]of [
 ['foreign employer',model=>{model.hiringOrganization.name='Other'}],
 ['unbound native role',model=>{model.url='https://hex.tech/careers/unbound/'}],
 ['missing country',model=>{delete model.jobLocation[0].address.addressCountry}],
 ['India worksite',model=>{model.jobLocation[0].address.addressCountry='IN'}],
 ['unknown worksite',model=>{model.jobLocation[0].address.addressCountry='Unknown'}],
 ['conflicting India locality',model=>{Object.assign(model.jobLocation[0].address,{addressLocality:'Bengaluru, India',addressRegion:'Karnataka'})}],
 ['conflicting address region',model=>{Object.assign(model.jobLocation[0].address,{addressLocality:'New York',addressRegion:'Karnataka',postalCode:'10177'})}],
 ['unreviewed postal location',model=>{Object.assign(model.jobLocation[0].address,{addressLocality:'San Francisco',addressRegion:'California',postalCode:'560001'})}],
 ['additional applicant country',model=>{model.applicantLocationRequirements={'@type':'Country',name:'India'}}],
 ['missing full criteria',model=>{model.description='<p>Apply now</p>'}],
 ['hidden full criteria',model=>{model.description='<div hidden>'+model.description+'</div>'}],
 ['criteria absent from own page',model=>{model.description='<p>'+('Unrelated native criteria. '.repeat(30))+'</p>'}],
 ['unhandled native criteria',model=>{model.additionalProperty={country:'India'}}],
 ['future native publication',model=>{model.datePosted='2099-01-01T00:00:00.000+00:00'}],
 ['impossible native calendar date',model=>{model.datePosted='2026-02-30T00:00:00.000+00:00'}],
])test('Hex cannot certify zero India roles with '+name,()=>{
 const row=inventory().cards[0]
 assert.throws(()=>inspectCurrentHexRole(changeModel(packetFor(row).body,edit),row),/Hex|hex/)
})

test('Hex current registered path checks all details and closing inventory, retaining source scope hold',async()=>{
 const visited=[]
 const jobs=await createHexScraper().run({fetchPage:async url=>{
  visited.push(url)
  // These are genuine captured responses replayed twice. The fixture does not
  // claim separately captured closing responses; live verification reads fresh.
  const packet=url===landing.url?landing:capture.responses.find(value=>value.url===url)
  assert.ok(packet,'only declared current first-party URLs may be requested')
  return{status:packet.status,body:packet.body,headers:packet.headers,finalUrl:packet.url}
 }})
 assert.equal(jobs.length,0)
 assert.equal(visited.length,76)
 assert.equal(visited.filter(url=>url===landing.url).length,2)
 const proof=readInventoryEvidence(jobs)
 assert.equal(proof.status,'complete-inventory')
 assert.equal(proof.reportedTotal,37)
 assert.equal(proof.indiaFacetCount,0)
 assert.equal(proof.lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.roleProofs.length,37)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(readSourceObservationEvidence(jobs,'hex').observedVacancyCount,37)
})

test('Hex preserves cancellation and rejects blocked original responses',async()=>{
 const controller=new AbortController(),reason=Error('caller stopped Hex')
 controller.abort(reason)
 await assert.rejects(createHexScraper().run({signal:controller.signal}),error=>error===reason)
 await assert.rejects(createHexScraper().run({fetchPage:async()=>({status:403,body:'Forbidden',headers:{'content-type':'text/html'}})}),
  error=>error.status===403&&error.softFailure===true&&error.lifecycleCleanupAllowed===false)
})

test('Hex dated original response bodies retain their captured SHA256',()=>{
 assert.equal(capture.responses.length,37)
 for(const packet of [landing,...capture.responses]){
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(bytes.toString('utf8'),packet.body)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
 }
})
