import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { makeZohoFixture, zohoFixtureOptions } from './fixtures/zohoNativeOptions.js'

const registered = source => createCatalogScraper(getScraperCatalog().find(p => p.source === source))
const forbidLive = t => t.mock.method(globalThis, 'fetch', async () => { throw Error('Live HTTP is forbidden in regression tests') })

for (const source of ['yellowmessenger', 'centilytics']) test(`${source} registered execution reads full native records and returns new India roles`, async t => {
  forbidLive(t)
  const data = makeZohoFixture(source), jobs = await registered(source).run(zohoFixtureOptions(data))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, data.spec.company)
  assert.match(jobs[0].sourceDescription, /payment infrastructure.*Requirements.*distributed systems/)
  assert.equal(jobs[0].postingDate, '2026-10-24')
  assert.equal(jobs[0].applyUrl, data.details[data.rows[0].id].$appy_url)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(data.requests.filter(url => url === data.spec.board).length, 2)
})

for (const [label, mutate] of [
  ['hidden widget', d => { d.homepage = d.homepage.replace('<div id=', '<div hidden id=') }],
  ['inert script', d => { d.homepage = `<template>${d.homepage}</template>` }],
  ['quoted loader example', d => { d.homepage = d.homepage.replace("rec_embed_js.load({", "const example = 'rec_embed_js.load({").replace("});</script>", "});';</script>") }],
  ['dormant loader', d => { d.homepage = d.homepage.replace('rec_embed_js.load(', 'function unused(){rec_embed_js.load(').replace('});</script>', '});}</script>') }],
  ['foreign embed tenant', d => { d.homepage = d.homepage.replaceAll('https://careers.yellow.ai', 'https://other.yellow.ai') }],
  ['shadowed no-op loader', d => { d.homepage = d.homepage.replace('rec_embed_js.load(', 'const rec_embed_js={load(){}};rec_embed_js.load(') }],
  ['overridden global loader', d => { d.homepage = '<script>window["rec_embed_js"]={load(){}};</script>' + d.homepage }],
  ['unreachable loader', d => { d.homepage = d.homepage.replace('rec_embed_js.load(', "throw new Error('disabled');rec_embed_js.load(") }],
  ['stylesheet-hidden widget', d => { d.homepage += '<style>#rec_job_listing_div{display:none}</style>' }],
  ['transparent widget', d => { d.homepage = d.homepage.replace('<div id=', '<div style="opacity:0" id=') }],
  ['foreign reciprocal website', d => { d.meta.org_info.website = 'https://other.example/' }],
  ['wrong native organization', d => { d.meta.org_info.id = '157454000000312599' }],
]) test(`Yellow rejects ${label}`, async t => {
  forbidLive(t)
  const data = makeZohoFixture('yellowmessenger'); mutate(data)
  await assert.rejects(registered(data.spec.source).run(zohoFixtureOptions(data)))
})

test('a second active Zoho recruiting page retains incomplete employer scope', async t => {
  forbidLive(t)
  const data = makeZohoFixture('yellowmessenger')
  data.homepage += `<div id="internships"></div><script>rec_embed_js.load({widget_id:'internships',page_name:'Internships',source:'CareerSite',site:'https://careers.yellow.ai'});</script>`
  const jobs = await registered(data.spec.source).run(zohoFixtureOptions(data))
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const value of [undefined, { id: '592387000000320471', name: 'Other Employer' }, 'Centilytics']) {
  test(`Centilytics keeps an unproven staffing client outside the exact employer: ${JSON.stringify(value)}`, async t => {
    forbidLive(t)
    const data = makeZohoFixture('centilytics'); data.details[data.rows[0].id].Client_Name = value
    const jobs = await registered(data.spec.source).run(zohoFixtureOptions(data))
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  })
}

for (const source of ['yellowmessenger', 'centilytics']) test(`${source} captured native inventory is reconciled without live requests`, async t => {
  forbidLive(t)
  const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL(`./fixtures/next-native-20261026/${source}.json.gz`, import.meta.url))))
  const counts = new Map()
  const load = async url => {
    const index = counts.get(url) || 0; counts.set(url, index + 1)
    const packet = fixture.packets.filter(p => p.url === url)[index]
    assert.ok(packet, `Unexpected native request: ${url}`)
    assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
    return packet
  }
  const jobs = await registered(source).run({
    fetchPage: async url => { const p = await load(url); return { status: p.status, url: p.finalUrl, html: p.body } },
    fetchJson: async url => JSON.parse((await load(url)).body),
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, source === 'centilytics' ? 0 : 1)
})

test('shared Zoho runtime excludes a role whose closing country changes to Canada', async () => {
  const data = makeZohoFixture('agilisium'), settings = zohoFixtureOptions(data)
  let count = 0, boards = 0
  const jobs = await registered('agilisium').run({ ...settings, fetchPage: async (url, init) => {
    const page = await settings.fetchPage(url, init)
    if (url === data.spec.board && ++boards === 2) page.html = page.html.replaceAll('&quot;Country&quot;:&quot;India&quot;', '&quot;Country&quot;:&quot;Canada&quot;')
    return page
  }, fetchJson: async (url, init) => {
    const payload = structuredClone(await settings.fetchJson(url, init))
    if (url.endsWith('/Job_Openings?source=CareerSite&pagename=Careers') && ++count === 2) payload.data[0].Country = 'Canada'
    return payload
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
