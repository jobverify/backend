import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/scraperRun42395458143AshbyIdentity.json.gz', import.meta.url))))
const cases = [
  { source: 'close', boardToken: 'Close', total: 6, indiaIds: [] },
  { source: 'coalesce', boardToken: 'Coalesce', total: 1, indiaIds: [] },
  { source: 'elevenlabs', boardToken: 'ElevenLabs', total: 139, indiaIds: [
    '1713bfd7-a63b-4dd4-b6e7-b0b8b8560a4a', '258de005-ab84-4cc7-9a59-1df0c74a12b8',
    '356d08ba-6119-4c76-93ad-362ca7283569', '6b5a902d-49ea-4fa9-ab67-d6e88c361695',
    '90873fda-95c3-4d21-bae8-c5a30f5b7ac8', 'a571b8e4-8176-4e31-aab6-2287ee810236',
    'bd230a18-2ff4-493c-8555-8476bf7de0e4', 'ef0a1e14-40ee-43d2-aab9-59fc9f6a4b8c',
  ] },
]

for (const { source, boardToken, total, indiaIds } of cases) {
  const packet = capture.sources.find(row => row.source === source)
  const payload = JSON.parse(packet.api.body)
  const provider = () => getScraperCatalog().find(row => row.source === source)
  const replayPage = async url => {
    const page = [packet.official, packet.board].find(row => row.requestUrl === url)
    assert.ok(page, 'Uncaptured employer or board request: ' + url)
    return { status: page.status, url: page.url, html: page.body }
  }

  test(`registered ${source} accepts its exact native Ashby board and retains inventory limits`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
    const jobs = await createCatalogScraper(provider()).run({ fetchPage: replayPage, fetchJson: async url => {
      assert.equal(url, `https://api.ashbyhq.com/posting-api/job-board/${boardToken}`)
      return structuredClone(payload)
    } })

    assert.deepEqual(jobs.map(job => job.jobId).sort(), indiaIds)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, total)
    assert.equal(readInventoryEvidence(jobs).listingComplete, source !== 'elevenlabs')
    assert.ok(jobs.every(job => job.country === 'India' && job.sourceListingComplete === false
      && job.applyUrl.startsWith(`https://jobs.ashbyhq.com/${boardToken}/`)
      && typeof job.sourceDescription === 'string' && job.sourceDescription.length > 100))
    if (source !== 'elevenlabs') {
      const direct = await import(new URL('../scraper/' + source + '/script.js', import.meta.url))
      const sourceCatalog = (await import(new URL('../scraper/' + source + '/catalog.js', import.meta.url))).default
      const standalone = await direct.run({ fetchPage: replayPage, fetchJson: async () => structuredClone(payload) })
      assert.equal(readInventoryEvidence(standalone).listingComplete, true)
      assert.deepEqual(sourceCatalog.bindingEvidence.matchedLinks, ['https://jobs.ashbyhq.com/' + source])
      assert.equal(jobs.length, 0)
      assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
      assert.ok(packet.official.body.includes(`https://jobs.ashbyhq.com/${source}`))
      assert.ok(packet.board.body.includes(`https://jobs.ashbyhq.com/${boardToken}`))
    }
  })

  for (const [label, mutate] of [
    ['a foreign role board', row => { row.jobUrl = row.jobUrl.replace(`/${boardToken}/`, '/ForeignEmployer/') }],
    ['a foreign application board', row => { row.applyUrl = row.applyUrl.replace(`/${boardToken}/`, '/ForeignEmployer/') }],
    ['another application role', row => { row.applyUrl = row.applyUrl.replace(`/${row.id}/`, '/unrelated-role/') }],
  ]) test(`registered ${source} rejects ${label} after its board correction`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
    const changed = structuredClone(payload)
    mutate(changed.jobs.find(row => row.isListed))
    await assert.rejects(createCatalogScraper(provider()).run({ fetchPage: replayPage, fetchJson: async () => changed }), /foreign board or role identity/)
  })

  if (source !== 'elevenlabs') for (const [label, mutate] of [
    ['foreign declared board', page => { page.html = page.html.replace(`content="https://jobs.ashbyhq.com/${boardToken}"`, 'content="https://jobs.ashbyhq.com/ForeignEmployer"') }],
    ['ambiguous declared board', page => { page.html += `<meta property="og:url" content="https://jobs.ashbyhq.com/${boardToken}">` }],
    ['inactive declared board', page => { page.html = `<template>${page.html}</template>` }],
    ['foreign board redirect', page => { page.url = 'https://jobs.ashbyhq.com/ForeignEmployer' }],
  ]) test(`registered ${source} refuses its case alias with ${label}`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
    let nativeRequests = 0
    await assert.rejects(createCatalogScraper(provider()).run({ fetchPage: async url => {
      const page = await replayPage(url)
      if (url === packet.board.requestUrl) mutate(page)
      return page
    }, fetchJson: async () => { nativeRequests++; return structuredClone(payload) } }), /binding|handoff|canonical/i)
    assert.equal(nativeRequests, 0)
  })
}

for (const source of ['close', 'coalesce']) for (const [label, mutate] of [
  ['absent native canonical proof', p => { delete p.bindingEvidence.nativeBoardCanonicalEvidence }],
  ['a foreign canonical board', p => { p.bindingEvidence.nativeBoardCanonicalEvidence = { ...p.bindingEvidence.nativeBoardCanonicalEvidence, canonicalBoardUrl: 'https://jobs.ashbyhq.com/ForeignEmployer' } }],
  ['an unadvertised case alias', p => { p.bindingEvidence.matchedLinks = ['https://jobs.ashbyhq.com/unrelated'] }],
  ['a different canonical-proof alias', p => { p.bindingEvidence.nativeBoardCanonicalEvidence = { ...p.bindingEvidence.nativeBoardCanonicalEvidence, handoffUrl: 'https://jobs.ashbyhq.com/unrelated' } }],
  ['disabled current case verification', p => { p.runtimeInventoryVerification = false }],
]) test('registered ' + source + ' static binding rejects ' + label, async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const p = structuredClone(getScraperCatalog().find(row => row.source === source))
  mutate(p)
  let requests = 0
  await assert.rejects(createCatalogScraper(p).run({ fetchPage: async () => { requests++; throw new Error('Unexpected employer request') },
    fetchJson: async () => { requests++; throw new Error('Unexpected inventory request') } }), /Missing matching official ATS binding/)
  assert.equal(requests, 0)
})
