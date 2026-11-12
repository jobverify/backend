import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createEyScraper, extractJobDetail } from './script.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/fixtures/ey-country-details-20261112.json.gz', import.meta.url))))
const rename = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/fixtures/ey-native-rename-20261112.json.gz', import.meta.url)))).packets[0]
const expectations = [
  { postingId:'1420954633', requisitionId:'1730203', city:'Pune', location:'Pune, IN, 411057', officeCount:68 },
  { postingId:'1141438101', requisitionId:'1558045', city:'Kolkata', location:'Kolkata, IN, 700016', officeCount:3 },
]
const listingPage = listing => `<span class="paginationLabel">1 to 1 of 1</span><span class="srHelp">Page 1 of 1</span>
  <tr class="data-row"><a class="jobTitle-link" href="${listing.sourceUrl}">${listing.title}</a><span class="jobLocation">${listing.location}</span></tr>`

for (const expected of expectations) {
  const packet = fixture.packets.find(packet=>packet.listing.jobId === expected.postingId)
  test(`EY native requisition ${expected.requisitionId} retains its India office behind the foreign primary display`, async () => {
    assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.hash)
    const detail = extractJobDetail(packet.body,packet.listing)
    assert.equal(detail.jobId,expected.postingId)
    assert.equal(detail.requisitionId,expected.requisitionId)
    assert.equal(detail.country,'India')
    assert.equal(detail.city,expected.city)
    assert.equal(detail.location,expected.location)
    assert.equal(detail.nativeLocations.length,expected.officeCount)
    assert.ok(detail.locations.includes(expected.location))
    const jobs = await createEyScraper().run({fetchText:async url=>url.includes('/search/') ? listingPage(packet.listing) : packet.body})
    assert.equal(jobs.length,1)
    assert.equal(jobs[0].requisitionId,expected.requisitionId)
    assert.equal(jobs[0].country,'India')
    assert.equal(jobs[0].nativeLocations.length,expected.officeCount)
    assert.equal(filterIndiaJobs(jobs).length,1)
  })
}

test('a US state IN never substitutes for an explicit native India country or street address', () => {
  const packet = fixture.packets[0]
  const body = packet.body.replace('content="Pune, IN, 411057"','content="Pune, US, 411057"')
  assert.notEqual(body,packet.body)
  const detail = extractJobDetail(body,packet.listing)
  assert.notEqual(detail.country,'India')
  assert.equal(detail.nativeLocations?.some(address=>address.addressRegion==='IN' && address.addressCountry==='US') ?? false,true)
  assert.equal(filterIndiaJobs([detail]).length,0)
})

test('multiple confirmed foreign countries cannot fall back to an India city from the listing',()=>{
  const packet=fixture.packets[0]
  const body=packet.body.replace('content="Pune, IN, 411057"','content="Pune, CH, 411057"')
  const detail=extractJobDetail(body,{...packet.listing,city:'Bengaluru',location:'Bengaluru, India'})
  assert.equal(detail.country,null)
  assert.equal(detail.sourceCountryScopeUnresolved,true)
  assert.equal(filterIndiaJobs([detail]).length,0)
})

test('EY requests the native India country facet with empty free-text geography', async () => {
  const packet = fixture.packets[0]
  await createEyScraper().run({fetchText:async value=>{
    const url = new URL(value)
    if (url.pathname === '/ey/search/') {
      assert.equal(url.searchParams.get('optionsFacetsDD_country'),'IN')
      assert.equal(url.searchParams.get('locationsearch'),'')
      return listingPage(packet.listing)
    }
    assert.equal(value,packet.requestedUrl)
    return packet.body
  }})
})

test('an unresolved detail does not use the posting id as an invented native requisition', () => {
  const packet = fixture.packets[0]
  assert.equal(extractJobDetail('',packet.listing).requisitionId,null)
})

test('an actual EY publisher rename remains bound by canonical posting ID, native requisition and application IDs',()=>{
  assert.equal(createHash('sha256').update(rename.body).digest('hex'),rename.hash)
  const detail=extractJobDetail(rename.body,rename.listing)
  assert.equal(rename.listing.title,'DE-Fullstack-Manager')
  assert.equal(detail.title,'DE-Java Fullstack-Manager')
  assert.equal(detail.jobId,'1447393933')
  assert.equal(detail.requisitionId,'1750259')
  assert.equal(detail.sourceDetailComplete,true)
  assert.equal(detail.nativeDetailEvidence.canonicalAliasVerified,true)
  assert.equal(detail.nativeDetailEvidence.canonicalUrl,'https://careers.ey.com/ey/job/Bengaluru-DE-Java-Fullstack-Manager-KA-560016/1447393933/')
  assert.equal(detail.nativeDetailEvidence.requestedUrl,rename.requestedUrl)
  assert.deepEqual(detail.nativeDetailEvidence.applyPostingIds,['1447393933'])
})

test('EY retains terminal and closing identity evidence after full native query traversal', async () => {
  const packet = fixture.packets[0]
  let openings = 0
  const jobs = await createEyScraper().run({fetchText:async value=>{
    const url = new URL(value)
    if (url.pathname !== '/ey/search/') return packet.body
    if (url.searchParams.has('startrow')) return '<span class="paginationLabel">2 to 1 of 1</span><span class="srHelp">Page 2 of 1</span>'
    openings += 1
    return listingPage(packet.listing)
  }})
  assert.equal(openings,2)
  assert.equal(jobs.nativeCollectionEvidence?.listingPaginationComplete,true)
  assert.equal(jobs.nativeCollectionEvidence?.closingInventoryMatches,true)
  assert.equal(jobs.nativeCollectionEvidence?.publicInventoryProof?.observedPostingIds,1)
  assert.equal(jobs.nativeCollectionEvidence?.sourceScopeComplete,false)
})

test('an empty native terminal page cannot hide a changed closing inventory', async () => {
  const packet = fixture.packets[0]
  let openings = 0
  const jobs = await createEyScraper().run({fetchText:async value=>{
    const url = new URL(value)
    if (url.pathname !== '/ey/search/') return packet.body
    if (url.searchParams.has('startrow')) return '<span class="paginationLabel">2 to 1 of 1</span><span class="srHelp">Page 2 of 1</span>'
    openings += 1
    return listingPage(openings===1 ? packet.listing : {...packet.listing,sourceUrl:packet.listing.sourceUrl.replace('1420954633','9999999999')})
  }})
  assert.equal(jobs.nativeCollectionEvidence?.closingInventoryMatches,false)
  assert.equal(jobs.nativeCollectionEvidence?.listingPaginationComplete,false)
})
