import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractionRawJobMetrics } from '../../scraper-support/utils/extractionRawJobMetrics.js'
import * as source from './script.js'

const packets = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261031.json.gz', import.meta.url))))
for (const packet of packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.bodySha256)
const byUrl = new Map(packets.map(packet => [packet.url, packet]))
const active = JSON.parse(byUrl.get(source.ACTIVE_JOBS_URL).body)
const domain = {domain:source.KEKA_BOARD_URL}
const optics = active.find(job => job.title === 'Optics Design Intern')
const options = {
  fetchText: async url => byUrl.get(url).body,
  fetchJson: async url => JSON.parse(byUrl.get(url).body),
  now: () => packets.at(-1).capturedAt,
}

test('current native empty workplace arrays retain unknown country; headquarters and another role do not supply it', () => {
  const jobs = source.extractSearchResults(active, domain)
  assert.equal(jobs.length, 29)
  const missing = active.filter(job => !job.jobLocations.length)
  assert.equal(missing.length, 3)
  for (const row of missing) assert.equal(jobs.find(job => job.jobId === String(row.id)).country, null)
  assert.equal(jobs.filter(job => job.country === 'India').length, 26)
  assert.equal(jobs.find(job => job.jobId === '153042').location, null)
})

test('the literal role-owned visible Location field recovers Bangalore without manufacturing a country', () => {
  const [job] = source.extractSearchResults([optics], domain)
  assert.equal(job.location, 'Bangalore')
  assert.equal(job.country, null)
  assert.equal(job.city, null)
})

for (const [name, mutate] of [
  ['hidden field', html => html.replace(/<div>(<strong[^>]*>Location:<\/strong>)/, '<div hidden>$1')],
  ['inline hidden field', html => html.replace(/<div>(<strong[^>]*>Location:<\/strong>)/, '<div style="opacity:0">$1')],
  ['commented field', html => html.replace(/<div><strong[^>]*>Location:<\/strong>[\s\S]*?<\/div>/, field => '<!--'+field+'-->')],
  ['conflicting role fields', html => html+'<p>Location: Pune</p>'],
]) test(name+' does not create a qualified workplace', () => {
  const description = mutate(optics.description)
  assert.notEqual(description, optics.description)
  const [job] = source.extractSearchResults([{...optics,description}], domain)
  assert.equal(job.location, null)
  assert.equal(job.country, null)
})

for (const payload of [null, {message:'upstream error'}, 'not a job array']) {
  test('malformed native feed cannot become a successful empty inventory: '+JSON.stringify(payload), () => {
    assert.throws(() => source.extractSearchResults(payload, domain), error => error.failureKind === 'upstream_inventory_unavailable' && error.abortRetries)
  })
}

test('conflicting native country code/name cannot qualify India', () => {
  const row = structuredClone(active.find(job => job.jobLocations.length))
  row.jobLocations[0].countryCode = 'US'
  assert.throws(() => source.extractSearchResults([row], domain), /country.*conflict/i)
})

for (const representation of ['absent','null','blank']) test('a literal native workplace with '+representation+' country fields remains an observation', () => {
  const row=structuredClone(active.find(job=>job.title==='Senior Product Manager'))
  for(const location of row.jobLocations) for(const field of ['countryCode','countryName']) {
    if(representation==='absent') delete location[field]
    else location[field]=representation==='null'?null:''
  }
  const jobs=source.extractSearchResults([row],domain)
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].location,'Bangalore')
  assert.equal(jobs[0].city,'Bangalore')
  assert.equal(jobs[0].country,null)
})

test('unknown typed country values do not establish a foreign country or drop the role', () => {
  const row=structuredClone(active.find(job=>job.title==='Senior Product Manager'))
  row.jobLocations[0].countryCode='ZZ'
  row.jobLocations[0].countryName='Unspecified'
  const [job]=source.extractSearchResults([row],domain)
  assert.ok(job)
  assert.equal(job.location,'Bangalore')
  assert.equal(job.country,null)
})

test('a positively foreign native country remains excluded from this India source', () => {
  const row=structuredClone(active.find(job=>job.title==='Senior Product Manager'))
  row.jobLocations=[{name:'Austin',city:'Austin',state:'TX',countryCode:'US',countryName:'United States'}]
  assert.equal(source.extractSearchResults([row],domain).length,0)
})

for(const [name,mutate] of [
  ['archive path',html=>html.replaceAll(source.OFFICIAL_CAREERS_HANDOFF_URL,source.OFFICIAL_CAREERS_HANDOFF_URL+'-archive')],
  ['comment-only URL',html=>html.replaceAll(source.OFFICIAL_CAREERS_HANDOFF_URL,'https://satsure.keka.com/contact')+'<!-- '+source.OFFICIAL_CAREERS_HANDOFF_URL+' -->'],
  ['hidden anchors',html=>html.replace(/<a\b([^>]*href=["']https:\/\/satsure\.keka\.com\/careers["'][^>]*)>/gi,'<a hidden $1>')],
]) test('official handoff rejects '+name+' before any Keka read',async()=>{
  const original=byUrl.get(source.CAREERS_PAGE_URL).body, html=mutate(original)
  assert.notEqual(html,original)
  let reads=0
  await assert.rejects(source.run({...options,fetchText:async url=>{reads++;return url===source.CAREERS_PAGE_URL?html:options.fetchText(url)}}),/verified SatSure careers page/i)
  assert.equal(reads,1)
})

test('duplicate native vacancy identity cannot silently duplicate outputs', () => {
  assert.throws(() => source.extractSearchResults([active[0],active[0]], domain), /duplicate.*identity/i)
})

test('native full description excludes permanently hidden requirements', () => {
  const marker = 'CONTROLLED_PERMANENTLY_HIDDEN_REQUIREMENT'
  const [job] = source.extractSearchResults([{...optics,description:optics.description+'<p hidden>'+marker+'</p>'}],domain)
  assert.equal(job.jobDescription.includes(marker),false)
  assert.match(job.jobDescription,/Optics|optical/i)
})

test('an excerpt without an authoritative full description remains missing', () => {
  const [job] = source.extractSearchResults([{...optics,description:null,excerpt:'Preview text only'}],domain)
  assert.equal(job.jobDescription,null)
})

test('placeholder description text stays raw and cannot claim complete native details',async()=>{
  for(const description of ['TBD','Job Description']){
    const rows=[{...optics,description}]
    const jobs=await source.run({...options,fetchJson:async url=>url===source.ACTIVE_JOBS_URL?rows:options.fetchJson(url)})
    assert.equal(jobs[0].jobDescription,description)
    assert.equal(jobs[0].sourceDetailComplete,false)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  }
})

test('the actual default HTTP transport receives the caller abort through its composed signal', async t => {
  const controller=new AbortController(), reason=Object.freeze(Error('cancel actual default IO'))
  let reads=0
  t.mock.method(globalThis,'fetch',async (url,init) => {
    reads++
    controller.abort(reason)
    assert.equal(init.signal.aborted,true)
    assert.equal(init.signal.reason,reason)
    throw Object.assign(Error('native replacement AbortError'),{name:'AbortError'})
  })
  await assert.rejects(source.run({signal:controller.signal}),error=>error===reason)
  assert.equal(reads,1)
})

test('registered default transport replays exact current packets and retains partial inventory and observed row counts', async t => {
  const reads = []
  t.mock.method(globalThis,'fetch',async (url,init={}) => {
    assert.ok(init.signal)
    const packet = byUrl.get(String(url))
    assert.ok(packet, 'No uncaptured requests allowed: '+url)
    reads.push(String(url))
    return new Response(packet.body,{status:packet.status,headers:{'content-type':packet.contentType}})
  })
  const provider = getScraperCatalog().find(item=>item.source==='satsure')
  const jobs = await createCatalogScraper(provider).run({signal:new AbortController().signal,now:options.now})
  assert.deepEqual(reads,packets.map(packet=>packet.url))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status,'coverage-gap')
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.equal(evidence.verifiedAt,options.now())
  assert.equal(jobs.length,29)
  assert.equal(jobs.filter(job=>!job.location).length,2)
  assert.equal(jobs.filter(job=>!job.country).length,3)
  assert.equal(jobs.filter(job=>job.sourceDetailComplete).length,29)
  assert.deepEqual(extractionRawJobMetrics(provider,jobs,evidence),{rawJobs:29,rawJobsBasis:'observed-native-listing-rows'})
})

test('a checked empty active feed remains partial with unknown company and India totals', async () => {
  const jobs = await source.run({...options,fetchJson:async url=>url===source.ACTIVE_JOBS_URL?[]:options.fetchJson(url)})
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete,false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,null)
})

test('pre-aborted callers perform no reads', async () => {
  const controller = new AbortController(), reason = Object.freeze(Error('pre-aborted source'))
  controller.abort(reason)
  let reads=0
  await assert.rejects(source.run({...options,signal:controller.signal,fetchText:async()=>{reads++;return ''}}), error=>error===reason)
  assert.equal(reads,0)
})

for (const boundary of packets.map(packet=>packet.url)) test('caller cancellation at native boundary '+boundary, async () => {
  const controller = new AbortController(), reason = Object.freeze(Error('cancelled native boundary'))
  let reads=0
  const read = async (url,init={}) => {
    assert.equal(init.signal,controller.signal)
    reads++
    if (url===boundary) controller.abort(reason)
    return byUrl.get(url).body
  }
  await assert.rejects(source.run({...options,signal:controller.signal,fetchText:read,fetchJson:async(url,init)=>JSON.parse(await read(url,init))}), error=>error===reason)
  assert.equal(reads,packets.findIndex(packet=>packet.url===boundary)+1)
})
