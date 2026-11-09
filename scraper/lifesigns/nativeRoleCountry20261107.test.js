import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { CAREERS_URL, createLifeSignsScraper, extractVerifiedOpenRoles } from './script.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native-publication.json.gz', import.meta.url))))
const items = JSON.parse(Buffer.from(fixture.publicFeed.bodyBase64, 'base64')).dataItems
const clock = '2026-11-07T08:30:00.000Z'
const sha = value => createHash('sha256').update(value).digest('hex')
const pages = new Map(fixture.pages.map(row => [row.receipt.request.url, { ...row.receipt, html: Buffer.from(row.bodyBase64, 'base64').toString('utf8') }]))
const careersHTML = pages.get(CAREERS_URL).html
const careers = { status: 200, url: CAREERS_URL, title: careersHTML.match(/<title[^>]*>([\s\S]*?)<\/title>/i)[1], text: careersHTML.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ') }
const roleURL = item => 'https://www.lifesigns.us/careers/' + item.data.slug + '/'
const roleSnapshot = (item, html = pages.get(roleURL(item)).html) => ({ status: 200, url: roleURL(item), title: item.data.title, html, contentType: 'text/html; charset=utf-8' })
const extract = (item = items[0], snapshot = roleSnapshot(item)) => extractVerifiedOpenRoles(careers, [item], { [new URL(roleURL(item)).pathname]: snapshot })[0]
const changeGraph = (html, fn, index = 1) => {
  let at = 0
  return html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (whole, start, body, end) => {
    if (at++ !== index) return whole
    const value = JSON.parse(body); fn(value)
    return start + JSON.stringify(value) + end
  })
}
const changeRole = fn => changeGraph(pages.get(roleURL(items[0])).html, graph => fn(graph['@graph'][0]))
const held = job => {
  assert.equal(job.country, null); assert.equal(job.location, null); assert.equal(job.city, null); assert.equal(job.state, null)
  assert.equal(job.nativeGeographyQualified, false)
  assert.equal(job.sourceNativeRoleCountryEvidence.status, 'held')
  assert.ok(job.sourceNativeRoleCountryEvidence.issues.length > 0)
  assert.equal(typeof job.sourceNativeRoleCountryEvidence.snapshot.html, 'string')
  assert.equal(job.sourceNativeRoleCountryEvidence.feedItem.id, items[0].id)
  assert.equal(job.sourceScopeComplete, false); assert.equal(job.lifecycleCleanupAllowed, false)
}
const encode = value => {
  if (value === undefined) return { undefined: true }
  if (value === null || typeof value !== 'object') return value
  return { type: Array.isArray(value) ? 'Array' : 'Object', properties: Reflect.ownKeys(value).map(key => {
    const d = Object.getOwnPropertyDescriptor(value, key); assert.ok(Object.hasOwn(d, 'value'))
    return { key: typeof key === 'symbol' ? { symbol: Symbol.keyFor(key) } : key, enumerable: d.enumerable, configurable: d.configurable, writable: d.writable, value: encode(d.value) }
  }) }
}
test.beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(clock) })
  t.mock.method(globalThis, 'fetch', () => assert.fail('No public/guest/application HTTP'))
})
for (const item of items) test('genuine same-role IN country-only/raw/date proof: ' + item.id, () => {
  const before = JSON.stringify(item), page = pages.get(roleURL(item)), job = extract(item)
  assert.equal(job.country, 'India'); assert.equal(job.nativeGeographyQualified, true)
  assert.equal(job.location, null); assert.equal(job.city, null); assert.equal(job.state, null)
  assert.equal(job.rawNativeWorkplaceEvidence.roleLocation, item.data.location)
  assert.equal(job.requisitionId, item.id); assert.equal(job.sourceUrl, roleURL(item)); assert.equal(job.applyUrl, roleURL(item))
  assert.equal(job.postingDate, item.data._publishDate.$date)
  assert.deepEqual(job.sourceNativePublicationEvidence.rawValue, item.data._publishDate)
  const evidence = job.sourceNativeRoleCountryEvidence
  assert.equal(evidence.status, 'country-only-qualified'); assert.deepEqual(evidence.issues, [])
  assert.equal(evidence.snapshot.html, page.html); assert.equal(evidence.snapshot.bodySHA256, sha(page.html)); assert.equal(evidence.snapshot.bodyBytes, Buffer.byteLength(page.html))
  assert.deepEqual(evidence.feedItem, item)
  assert.equal(evidence.jobPosting.url, roleURL(item)); assert.equal(evidence.jobPosting['@id'], roleURL(item) + '#job')
  assert.equal(evidence.jobPosting.jobLocation.address.addressCountry, 'IN')
  assert.equal(evidence.organization.legalName, 'LS Devices Pvt Ltd'); assert.equal(evidence.legalEmployerVerified, false)
  assert.equal(evidence.fullCriteriaAuthority, 'OpenRoles.data.body'); assert.equal(evidence.schemaDescriptionIsTitleOnly, true)
  assert.equal(job.jobDescription, fixture.after.jobs.find(row => row.requisitionId === item.id).jobDescription)
  assert.equal(job.sourceListingComplete, false); assert.equal(job.sourceScopeComplete, false); assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(JSON.stringify(item), before)
})
test('whole genuine sixbody parser output/own symbols reverse only country/evidence/inventory reason', async t => {
  const calls = [], original = JSON.stringify(items)
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const page = pages.get(url); assert.ok(page); calls.push({ url, init })
    return { status: page.status, url: page.finalURL, headers: new Headers({ 'content-type': page.mime }), text: async () => page.html }
  })
  const jobs = await createLifeSignsScraper().run({ fetchRoleItems: async () => items })
  assert.deepEqual(jobs.map(row => row.country), ['India', 'India', 'India', 'India'])
  assert.ok(jobs.every(row => row.nativeGeographyQualified && row.location === null && row.city === null && row.state === null))
  const inventory = readInventoryEvidence(jobs); assert.equal(inventory.reason, 'lifesigns-company-inventory-scope-unqualified')
  const reversedJobs = jobs.map(row => { const job = structuredClone(row); job.country = null; job.nativeGeographyQualified = false; delete job.sourceNativeRoleCountryEvidence; return job })
  const reversedInventory = { ...inventory, reason: fixture.after.inventory.reason }
  const actual = { qualification: fixture.after.qualification, clock, jobs: reversedJobs, inventory: reversedInventory, calls }
  assert.deepEqual(actual, fixture.after); assert.equal(JSON.stringify(actual), JSON.stringify(fixture.after))
  attachInventoryEvidence(reversedJobs, reversedInventory)
  const expected = attachInventoryEvidence(structuredClone(fixture.after.jobs), fixture.after.inventory)
  assert.deepEqual(encode(reversedJobs), encode(expected)); assert.deepEqual(Reflect.ownKeys(jobs), Reflect.ownKeys(expected))
  assert.equal(JSON.stringify(items), original); assert.equal(inventory.listingComplete, false); assert.equal(inventory.reportedTotal, null)
})

for (const [name, value] of [['US', 'US'], ['ZZ', 'ZZ'], ['alias', 'India'], ['empty', ''], ['null', null], ['object', { name: 'India', countryCode: 'US' }], ['array', ['IN']], ['number', 1]]) {
  test('raw hold for unreviewed own country: ' + name, () => held(extract(items[0], roleSnapshot(items[0], changeRole(job => { job.jobLocation.address.addressCountry = value })))))
}
for (const [name, change] of [
  ['org-only country', job => { delete job.jobLocation }],
  ['missing country', job => { delete job.jobLocation.address.addressCountry }],
  ['multiple worksites', job => { job.jobLocation = [job.jobLocation, { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'US' } }] }],
  ['Place countryCode', job => { job.jobLocation.countryCode = 'US' }],
  ['Place addressCountry', job => { job.jobLocation.addressCountry = 'US' }],
  ['address country alias', job => { job.jobLocation.address.country = 'US' }],
  ['address alpha2Code', job => { job.jobLocation.address.alpha2Code = 'US' }],
  ['nested metadata', job => { job.jobLocation.address.metadata = { country: 'US' } }],
  ['job country', job => { job.country = 'US' }],
  ['remote criteria', job => { job.jobLocationType = 'TELECOMMUTE' }],
  ['extra employer name', job => { job.hiringOrganization.name = 'Unrelated' }],
  ['foreign employer ref', job => { job.hiringOrganization['@id'] = 'https://unrelated.invalid/#organization' }],
  ['wrong title', job => { job.title = 'Another role' }],
  ['wrong employment', job => { job.employmentType = 'Part-Time' }],
  ['cross-role url', job => { job.url = roleURL(items[1]) }],
  ['wrong @id', job => { job['@id'] = roleURL(items[0]) + '#jobposting' }],
]) test('raw hold for role carrier/identity: ' + name, () => {
  const html = changeRole(change), job = extract(items[0], roleSnapshot(items[0], html))
  held(job); assert.equal(job.sourceNativeRoleCountryEvidence.snapshot.html, html)
})
for (const [name, mutate] of [
  ['foreign canonical', html => html.replace('rel="canonical" href="' + roleURL(items[0]), 'rel="canonical" href="https://unrelated.invalid/careers/junior-video-editor/')],
  ['hidden canonical duplicate', html => html.replace('</head>', '<link hidden rel="canonical" href="https://unrelated.invalid/"/></head>')],
  ['hidden head country', html => html.replace('</head>', '<meta hidden name="country" content="US"/></head>')],
  ['head employer', html => html.replace('</head>', '<link itemprop="hiringOrganization" href="https://unrelated.invalid/"/></head>')],
  ['hidden own country', html => html.replace('</body>', '<div hidden data-country="US">Other worksite</div></body>')],
  ['base', html => html.replace('</head>', '<base href="https://unrelated.invalid/"/></head>')],
  ['duplicate JSON country', html => html.replace('"addressCountry":"IN"', '"addressCountry":"IN","addressCountry":"US"')],
  ['escaped duplicate country', html => html.replace('"addressCountry":"IN"', '"addressCountry":"IN","address\\u0043ountry":"US"')],
  ['duplicate JSON @id', html => html.replace('"@type":"JobPosting",', '"@type":"JobPosting","@id":"https://unrelated.invalid/",')],
  ['unknown JSONLD attrs', html => html.replace('<script type="application/ld+json">', '<script data-country="US" type="application/ld+json">')],
  ['duplicate script type', html => html.replace('<script type="application/ld+json">', '<script type="application/ld+json" type="application/json">')],
  ['inert schema', html => html.replace('<script type="application/ld+json">', '<script inert type="application/ld+json">')],
  ['malformed JSON', html => html.replace('"@type":"JobPosting",', '"@type":"JobPosting",broken,')],
]) test('raw semantic/inert/decoded-key hold: ' + name, () => {
  const original = pages.get(roleURL(items[0])).html, html = mutate(original)
  assert.notEqual(html, original)
  const job = extract(items[0], roleSnapshot(items[0], html)); held(job)
  assert.equal(job.sourceNativeRoleCountryEvidence.snapshot.html, html)
})
for (const [name, change, index] of [
  ['duplicate JobPosting', graph => { graph['@graph'].push(structuredClone(graph['@graph'][0])) }, 1],
  ['missing org', graph => { graph['@graph'] = graph['@graph'].filter(x => x['@type'] !== 'Organization') }, 0],
  ['foreign org url', graph => { graph['@graph'][1].url = 'https://unrelated.invalid/' }, 0],
  ['wrong org name', graph => { graph['@graph'][1].name = 'Unrelated' }, 0],
  ['duplicate org', graph => { graph['@graph'].push(structuredClone(graph['@graph'][1])) }, 0],
]) test('raw subject/reference ambiguity hold: ' + name, () => {
  const html = changeGraph(pages.get(roleURL(items[0])).html, change, index)
  held(extract(items[0], roleSnapshot(items[0], html)))
})
for (const [name, change] of [
  ['phone', org => { org.telephone = ['+1 000 000 0000'] }],
  ['logo', org => { org.logo = { '@type': 'ImageObject', url: 'https://www.lifesigns.us/other-logo.png' } }],
  ['JSON-looking string data', org => { org.description = 'Context {"country":"US","country":"IN"} is a string' }],
  ['office country', org => { org.address[0].addressCountry = 'US' }],
  ['legal context', org => { org.legalName = 'Unverified changed legal context' }],
]) test('unrelated org leaf context never governs vacancy country: ' + name, () => {
  const html = changeGraph(pages.get(roleURL(items[0])).html, graph => change(graph['@graph'][1]), 0)
  const job = extract(items[0], roleSnapshot(items[0], html))
  assert.equal(job.country, 'India'); assert.equal(job.location, null)
  assert.equal(job.sourceNativeRoleCountryEvidence.legalEmployerVerified, false)
})
for (const [name, change] of [
  ['foreign label', data => { data.location = 'Boston, United States' }],
  ['mixed label', data => { data.location = 'Chennai, India / Boston, United States' }],
  ['new typed carrier', data => { data.country = 'US' }],
  ['new unknown carrier', data => { data.workplace = { addressCountry: 'US' } }],
  ['feed native ID mismatch', data => { data._id = 'OTHER' }],
]) test('feed disagreement/raw carrier hold: ' + name, () => {
  const item = structuredClone(items[0]); change(item.data)
  held(extract(item, roleSnapshot(item)))
})
test('missing rawHTML keeps existing explicit feed country and city-only unknown behavior', () => {
  for (const [location, country] of [['Chennai', null], ['Chennai, India', 'India'], ['Boston, United States', 'US']]) {
    const item = structuredClone(items[0]); item.data.location = location
    const job = extract(item, { status: 200, url: roleURL(item), title: item.data.title })
    assert.equal(job.country, country); assert.equal(Object.hasOwn(job, 'sourceNativeRoleCountryEvidence'), false)
  }
})
for (const url of ['https://unrelated.invalid/careers/junior-video-editor/', 'https://user:secret@www.lifesigns.us/careers/junior-video-editor/', 'https://www.lifesigns.us:8443/careers/junior-video-editor/']) {
  test('existing detail origin rejection remains: ' + url, () => {
    const snapshot = roleSnapshot(items[0]); snapshot.url = url
    assert.throws(() => extract(items[0], snapshot), /role detail page drifted/)
  })
}

for (const location of ['Chennai, United States, India', 'Chennai, India, United States']) test('comma-separated explicit foreign feed country is not silently unknown: ' + location, () => {
  const item = structuredClone(items[0]); item.data.location = location
  held(extract(item, roleSnapshot(item)))
})
for (const [name, extra] of [['direct country attribute', '<div country="US">Another worksite</div>'], ['alternate role link', '<link rel="alternate" href="https://unrelated.invalid/careers/role/"/>']]) test('unreviewed raw semantic authority is held: ' + name, () => {
  const html = pages.get(roleURL(items[0])).html.replace('</head>', extra + '</head>')
  held(extract(items[0], roleSnapshot(items[0], html)))
})
test('unreviewed nested feed country carrier spelling is not silently dropped', () => {
  const item = structuredClone(items[0]); item.data.body.unreviewed = { addressCountryCode: 'US' }
  held(extract(item, roleSnapshot(item)))
})


for (const [name, attribute] of [
  ['proven work-location-country', 'data-work-location-country="US"'],
  ['proven role-workplace-country', 'data-role-workplace-country="US"'],
  ['proven primary-country', 'data-primary-country="US"'],
  ['proven hidden work-location-country', 'hidden data-work-location-country="US"'],
  ['uppercase work-location-country', 'DATA-WORK-LOCATION-COUNTRY="US"'],
  ['office-country', 'data-office-country="US"'],
  ['workplace-country-code', 'data-workplace-country-code="US"'],
  ['qualified worksite-country', 'data-primary-worksite-country="US"'],
  ['qualified location-country', 'data-primary-location-country="US"'],
  ['qualified address-country', 'data-office-address-country="US"'],
  ['compound addressCountry', 'data-primary-addressCountry="US"'],
  ['compound worksiteCountryCode', 'data-primary-worksiteCountryCode="US"'],
  ['compound workLocationCountry', 'data-primary-workLocationCountry="US"'],
]) test('qualified data-attribute country authority remains a raw hold: ' + name, () => {
  const original = pages.get(roleURL(items[0])).html
  const html = original.replace('</body>', '<div ' + attribute + '></div></body>')
  assert.notEqual(html, original)
  const job = extract(items[0], roleSnapshot(items[0], html))
  held(job)
  assert.equal(job.sourceNativeRoleCountryEvidence.snapshot.html, html)
  assert.ok(job.sourceNativeRoleCountryEvidence.issues.includes('unreviewed-html-role-semantic-carrier'))
})
for (const attribute of ['data-primary-color="blue"', 'data-primary-layout="compact"']) test('decorative qualified data-attribute is not country authority: ' + attribute, () => {
  const original = pages.get(roleURL(items[0])).html
  const html = original.replace('</body>', '<div ' + attribute + '></div></body>')
  const job = extract(items[0], roleSnapshot(items[0], html))
  assert.equal(job.country, 'India'); assert.equal(job.nativeGeographyQualified, true)
  assert.equal(job.location, null); assert.equal(job.city, null); assert.equal(job.state, null)
  assert.deepEqual(job.sourceNativeRoleCountryEvidence.issues, [])
})
