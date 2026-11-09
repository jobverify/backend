import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/safrandatasystems/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const directory = new URL('./fixtures/safrandatasystems/', import.meta.url)
const detail = readFileSync(new URL('failed-detail.html', directory), 'utf8')
const card = JSON.parse(readFileSync(new URL('failed-card.json', directory), 'utf8'))

test('Safran Data Systems accepts the newly published On Board & Testing division only with exact SDS identity', () => {
  assert.equal(source.hasVerifiedDetailSignal(detail, card), true)
  assert.equal(source.extractJobDetail(detail, card).country, 'France')
  assert.match(source.extractJobDetail(detail, card).jobDescription, /Safran Data Systems/)
})

test('Safran Data Systems rejects a mismatched SDS requisition, title, or company description', () => {
  for (const body of [
    detail.replace(/SDS\/AIM\/27-189513/g, 'SDS/AIM/27-189514'),
    detail.replace(/id="fldjobdescription_jobtitle">[\s\S]*?<\/p>/, 'id="fldjobdescription_jobtitle">Wrong title</p>'),
    detail.replace(/Safran Data Systems/g, 'Another employer'),
    detail.replace(/On Board &amp; Testing/g, 'Unverified Division'),
  ]) assert.equal(source.hasVerifiedDetailSignal(body, card), false)
})

test('Safran Data Systems extracts all42 keyword cards across the published three-page inventory', () => {
  const pages = ['current-search','current-search-page2','current-search-page3'].map((name) => readFileSync(new URL(name + '.html', directory), 'utf8'))
  assert.ok(pages.every(source.hasVerifiedSearchPageSignal))
  assert.equal(source.extractTotalPages(pages[0]), 3)
  const cards = pages.flatMap(source.extractJobCards)
  assert.equal(cards.length, 42)
  assert.equal(new Set(cards.map((item) => item.jobId)).size, 42)
})

const pages = ['current-search','current-search-page2','current-search-page3'].map((name) => readFileSync(new URL(name + '.html', directory), 'utf8'))
const details = JSON.parse(readFileSync(new URL('keyword-detail-pages.json', directory), 'utf8'))
const execute = (mutate = (body) => body) => source.createSafranDataSystemsScraper().run({ fetchText: async (url) => {
  const id = /_(\d+)\.aspx/.exec(url)?.[1]
  const page = Number(new URL(url).searchParams.get('page') || 1)
  const body = id ? details[id] : pages[page - 1]
  return mutate(body, url)
} })

test('Safran Data Systems returns all42 verified France roles with globally incomplete inventory evidence', async () => {
  const jobs = await execute()
  assert.equal(jobs.length, 42)
  assert.equal(new Set(jobs.map((job) => job.jobId)).size, 42)
  assert.ok(jobs.every((job) => job.country === 'France' && job.jobDescription && job.sourceListingComplete === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.reportedTotal, 42)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /France.*global.*India/i)
})

test('Safran Data Systems rejects duplicate, truncated, or inconsistent listing totals', async () => {
  for (const mutate of [
    (body, url) => url.includes('page=3') ? body.replace(/<li class="ts-offer-list-item offerlist-item [\s\S]*?<ul class="ts-offer-list-item__description [\s\S]*?<\/ul>/, '') : body,
    (body, url) => url.includes('page=2') ? pages[0] : body,
    (body, url) => url.includes('liste-toutes-offres') ? body.replace(/42 offres/g, '43 offres') : body,
  ]) await assert.rejects(execute(mutate), /Safran Data Systems.*(?:inventory|listing|count|duplicate|pagination)/i)
})

test('Safran Data Systems requires explicit France detail geography instead of assigning France to every result', () => {
  assert.equal(source.hasVerifiedDetailSignal(detail.replace('Europe, France, Ile de France', 'Asie, Inde, Karnataka'), card), false)
})

test('Safran Data Systems preserves partial evidence even for an explicitly empty France keyword surface', async () => {
  const body = '<html><head><title>Safran - Résultat de votre recherche (0 offres, page 1) / Mots clés : Safran Data Systems</title></head><body>Safran Data Systems<a href="../handlers/offerRss.ashx?lcid=1036&amp;Keywords=Safran%20Data%20Systems">Flux RSS</a></body></html>'
  const jobs = await source.createSafranDataSystemsScraper().run({ fetchText: async () => body })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
