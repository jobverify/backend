import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, transport, specs, description } from './native.fixtures.js'

globalThis.fetch = async () => { throw new Error('NETWORK_TRIPWIRE_BEFORE_SOURCE_IMPORT') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const catalog = getScraperCatalog()
const run = (source, io, options = {}) => createCatalogScraper(catalog.find(p => p.source === source)).run({ ...io, now: () => '2026-10-27T09:00:00.000Z', ...options })

for (const source of ['checkoutcom', 'vanta']) {
  test(`${source}: registered native extraction retains full public role identity, criteria, precision and deadline`, async () => {
    const io = transport(source); let audit
    const jobs = await run(source, io, { onNativeAudit: a => { audit = a } })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, '10000000-0000-4000-8000-000000000001')
    assert.equal(jobs[0].requisitionId, null)
    assert.equal(jobs[0].company, specs[source].company)
    assert.equal(jobs[0].country, 'India')
    assert.equal(jobs[0].descriptionHtml, description)
    assert.equal(jobs[0].jobDescription, 'Requirements 5+ years building C++ & identity systems. Read the specification, carefully. Preferred qualifications A relevant degree. Published compensation policy.')
    assert.equal(jobs[0].minimumQualification, '5+ years building C++ & identity systems. Read the specification, carefully.')
    assert.equal(jobs[0].preferredQualification, 'A relevant degree.')
    assert.equal(jobs[0].postingDate, '2026-10-20T12:34:56.789+00:00')
    assert.equal(jobs[0].closingDate, '2026-11-30T23:59:00.000Z')
    assert.equal(jobs[0].sourceListingComplete, true)
    assert.equal(jobs[0].lifecycleCleanupAllowed, true)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
    assert.equal(audit.fullyHealthyCount, 1)
    assert.equal(audit.fullDetailCount, 1)
    assert.equal(io.calls.filter(u => u === fixture(source).feed.jobUrl).length, 1)
    assert.equal(io.calls.some(u => /\/application|\/form\//.test(u)), false)
  })
  test(`${source}: explicit foreign complete inventory proves zero India; city names alone do not`, async () => {
    const record = fixture(source, {country:'United States',location:'Delhi, New York, US'})
    const jobs = await run(source, transport(source, [record]))
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  })
  test(`${source}: unknown secondary country retains confirmed India while suppressing whole-source totals`, async () => {
    const record=fixture(source,{secondary:[{location:'Remote APAC',address:{postalAddress:{addressCountry:'APAC'}}}]}); let audit
    const jobs=await run(source,transport(source,[record]),{onNativeAudit:a=>{audit=a}})
    assert.equal(jobs.length,1)
    assert.equal(jobs[0].country,'India')
    assert.equal(audit.fullDetailCount,1)
    assert.equal(audit.fullyHealthyCount,0)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
  })
  test(`${source}: every published secondary schema address must match a native worksite`, async () => {
    const r=fixture(source,{secondary:[{location:'London, UK',address:{postalAddress:{addressCountry:'UK',addressLocality:'London'}}}]})
    r.schema.jobLocation=[r.schema.jobLocation,{address:{addressCountry:'UK',addressLocality:'Contradictory locality'}}]
    const jobs=await run(source,transport(source,[r,fixture(source,{index:2})]))
    assert.equal(jobs.length,1)
    assert.equal(jobs[0].jobId,'10000000-0000-4000-8000-000000000002')
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  })
  test(`${source}: schema may omit secondary worksites when all native countries are explicit`, async () => {
    const r=fixture(source,{secondary:[{location:'London, UK',address:{postalAddress:{addressCountry:'UK',addressLocality:'London'}}}]})
    const jobs=await run(source,transport(source,[r]))
    assert.equal(jobs.length,1)
    assert.equal(jobs[0].nativeLocations.length,2)
    assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  })
  test(`${source}: matching unresolved primary country does not discard a confirmed India secondary worksite`, async () => {
    const record=fixture(source,{country:'APAC',location:'Remote APAC',secondary:[{location:'Bengaluru, India',address:{postalAddress:{addressCountry:'India',addressLocality:'Bengaluru'}}}]})
    const jobs=await run(source,transport(source,[record]))
    assert.equal(jobs.length,1)
    assert.equal(jobs[0].country,'India')
    assert.equal(jobs[0].location,'Bengaluru, India')
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  })
  test(`${source}: extra non-null country or office fields cannot silently certify full geography`, async () => {
    for(const fields of [{officeCountry:'APAC'},{country:{name:'India'}},{offices:[{country:'United States',address:'Unsupported'}]}]) {
      const r=fixture(source);Object.assign(r.feed,fields)
      const jobs=await run(source,transport(source,[r]))
      assert.equal(readInventoryEvidence(jobs).listingComplete,false)
      assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
    }
  })
  test(`${source}: closing inventory and changed criteria invalidate completion before output caps`, async () => {
    const a=fixture(source),b=fixture(source,{index:2})
    const jobs=await run(source,transport(source,[a,b],{closingRecords:[a]}),{maxJobs:1})
    assert.equal(jobs.length,1)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
    const changed=structuredClone(a);changed.feed.descriptionHtml='<p>Changed criteria.</p>'
    const criteria=await run(source,transport(source,[a],{closingRecords:[changed]}))
    assert.equal(readInventoryEvidence(criteria).listingComplete,false)
  })
  test(`${source}: output caps occur after all native details and closing inventory have been read`, async () => {
    const a=fixture(source),b=fixture(source,{index:2}),io=transport(source,[a,b]);let audit
    const jobs=await run(source,io,{maxJobs:1,onNativeAudit:value=>{audit=value}})
    assert.equal(jobs.length,1)
    assert.equal(audit.fullDetailCount,2)
    assert.equal(audit.indiaCount,2)
    assert.equal(io.calls.includes(b.feed.jobUrl),true)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  })
  test(`${source}: pagination, explicit truncation and duplicate native IDs cannot certify an empty or complete inventory`, async () => {
    for(const feedExtras of [{hasMore:true},{truncated:true},{total:2}])await assert.rejects(()=>run(source,transport(source,undefined,{feedExtras})),/invalid-or-truncated|total-mismatch/)
    const row=fixture(source)
    await assert.rejects(()=>run(source,transport(source,[row,row])),/duplicate/)
  })
  test(`${source}: a role-page denial stops before the next role and closing inventory`, async () => {
    const first=fixture(source),second=fixture(source,{index:2}),io=transport(source,[first,second],{denyUrl:first.feed.jobUrl})
    await assert.rejects(()=>run(source,io),/403/)
    assert.equal(io.calls.at(-1),first.feed.jobUrl)
    assert.equal(io.calls.includes(second.feed.jobUrl),false)
  })
  test(`${source}: exact employer, full body and original date contradictions reject only affected details`, async () => {
    for(const mutateDetail of [r=>{r.schema.hiringOrganization.name='Other Employer';return r},r=>{r.posting.descriptionHtml='<p>Truncated preview.</p>';return r},r=>{r.schema.datePosted='2026-10-21';return r}]) {
      const jobs=await run(source,transport(source,[fixture(source)],{mutateDetail}))
      assert.equal(jobs.length,0)
      assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    }
  })
  test(`${source}: first public denial stops immediately without alternate requests`, async () => {
    const io=transport(source,undefined,{denyUrl:specs[source].careersUrl})
    await assert.rejects(()=>run(source,io),/403/)
    assert.deepEqual(io.calls,[specs[source].careersUrl])
  })
  test(`${source}: a missing board brief still reads the advertised safe native role and preserves healthy India`, async () => {
    const io=transport(source,undefined,{boardRecords:[]})
    const jobs=await run(source,io)
    assert.equal(jobs.length,1)
    assert.equal(io.calls.includes(fixture(source).feed.jobUrl),true)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  })
  test(`${source}: newly advertised hiring channel keeps complete native candidates but invalidates company scope`, async () => {
    const url='https://recruitment.example.test/openings'
    const jobs=await run(source,transport(source,undefined,{extra:`<a href="${url}">View open positions</a>`,additional:{[url]:'<html>Unresolved public hiring channel</html>'}}))
    assert.equal(jobs.length,1)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  })
}
test('checkoutcom: stale corporate proxy inventory cannot certify complete native source scope', async () => {
  const a=fixture('checkoutcom'),b=fixture('checkoutcom',{index:2});let audit
  const jobs=await run('checkoutcom',transport('checkoutcom',[a,b],{proxyRecords:[a]}),{onNativeAudit:a=>{audit=a}})
  assert.equal(jobs.length,2)
  assert.equal(audit.fullDetailCount,2)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
