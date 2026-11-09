import test from 'node:test'
import assert from 'node:assert/strict'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readNativeDocument, decodeNativeEntities } from '../utils/activeNativeHtml.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { haptikCapture, haptikNativeOptions } from './fixtures/haptikNativeOptions.js'
const scraper = () => createCatalogScraper(getScraperCatalog().find(p => p.source === 'haptik'))
const modelMutation = (packet, change) => {
  const document = readNativeDocument(packet.body)
  const node = document.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')[0]
  const model = JSON.parse(node.raw); change(model); packet.body = packet.body.replace(node.raw, JSON.stringify(model))
}
const selected = packet => packet.url.includes('/jobs/8RrzHwmKvc5h/')

test('registered Haptik reads all16 native full details and original dates including the native India remote role', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Live network forbidden') })
  const fixture = haptikCapture(), settings = haptikNativeOptions(fixture), jobs = await scraper().run(settings)
  assert.equal(jobs.length, 16)
  assert.equal(new Set(jobs.map(j => j.jobId)).size, 16)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 16)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  for (const job of jobs) {
    const packet = fixture.packets.find(p => p.url === job.sourceUrl), doc = readNativeDocument(packet.body)
    const model = JSON.parse(doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')[0].raw)
    const content = doc.nodes(n => (n.attrs.class || '').split(/\s+/).includes('job-details-content'))[0]
    const visible = doc.text(content.children.find(n => typeof n !== 'string' && n.tag === 'div'))
    assert.equal(job.country, 'India')
    assert.equal(job.nativeEmployerBrand, 'Jio Haptik')
    assert.equal(job.sourceDescription, visible)
    assert.equal(job.title, decodeNativeEntities(model.title).trim().replace(/\s+/g, ' '))
    assert.equal(job.postingDate, new Date(model.datePosted).toISOString())
    assert.equal(job.nativePublicationDate, model.datePosted)
    assert.equal(job.applyUrl, job.sourceUrl + '#applicant-form')
    assert.doesNotMatch(job.jobDescription, /Submit Your Application|Current CTC|First Name/)
  }
})

for (const [name, change] of [
  ['foreign hiring organization', model => { model.hiringOrganization.name = 'Other Employer' }],
  ['foreign role URL', model => { model.url = model.url.replace('8RrzHwmKvc5h', 'foreign000000') }],
  ['wrong native title', model => { model.title = 'Other Role' }],
  ['impossible date', model => { model.datePosted = '2026-02-30 12:00:00 UTC' }],
]) test(`Haptik rejects ${name}`, async () => {
  await assert.rejects(scraper().run(haptikNativeOptions(haptikCapture(), p => { if (selected(p)) modelMutation(p, change) })))
})

test('Haptik does not label a native foreign-country role as India from its Mumbai listing hint', async () => {
  const jobs = await scraper().run(haptikNativeOptions(haptikCapture(), p => {
    if (selected(p)) modelMutation(p, model => { model.jobLocation.address.addressCountry = 'Canada' })
  }))
  assert.equal(jobs.length, 15)
  assert.ok(!jobs.some(j => j.jobId === '8RrzHwmKvc5h'))
})

test('Haptik rejects explicit visible US geography despite stale native India schema', async () => {
  const jobs = await scraper().run(haptikNativeOptions(haptikCapture(), p => {
    if (selected(p)) p.body = p.body.replace(/(<div class="stick-hide-in-mobile text-color">\s*)Mumbai,\s*Maharashtra/, '$1New York, United States')
  }))
  assert.equal(jobs.length, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Haptik hidden full descriptions cannot be replaced by application-form text or structured data alone', async () => {
  const jobs = await scraper().run(haptikNativeOptions(haptikCapture(), p => {
    if (selected(p)) p.body = p.body.replace(/(<div class="job-details-content content">\s*)<div/, '$1<div hidden')
  }))
  assert.equal(jobs.length, 15)
  assert.ok(jobs.every(j => j.lifecycleCleanupAllowed === false))
})

test('Haptik count gaps preserve verified jobs while retaining partial inventory', async () => {
  const jobs = await scraper().run(haptikNativeOptions(haptikCapture(), p => {
    if (p.url === 'https://haptik.freshteam.com/jobs') p.body = p.body.replaceAll('#16 Jobs', '#17 Jobs')
  }))
  assert.equal(jobs.length, 16)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Haptik hidden corporate handoff cannot bind its native employer board', async () => {
  await assert.rejects(scraper().run(haptikNativeOptions(haptikCapture(), p => {
    if (p.url === 'https://www.haptik.ai/careers') p.body = p.body.replace(/<a([^>]*href="https:\/\/haptik\.freshteam\.com\/jobs[^\"]*"[^>]*)>/g, '<a hidden$1>')
  })))
})

test('Haptik honors limits and cancellation with partial cleanup protection', async () => {
  const jobs = await scraper().run({ ...haptikNativeOptions(), maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  await assert.rejects(scraper().run({ ...haptikNativeOptions(), signal: AbortSignal.abort() }))
})

test('Haptik reconciles visible listing geography with the full native detail', async () => {
  const jobs = await scraper().run(haptikNativeOptions(haptikCapture(), p => {
    if (p.url === 'https://haptik.freshteam.com/jobs') p.body = p.body.replace(/<a[^>]*href="\/jobs\/8RrzHwmKvc5h\/[^"]+"[^>]*>[\s\S]*?<\/a>/g,
      card => card.replaceAll('Mumbai, Maharashtra', 'Toronto, Canada').replaceAll('Mumbai, India', 'Toronto, Canada'))
  }))
  assert.equal(jobs.length, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const surface of ['<a href="https://careers.smartrecruiters.com/Haptik">Explore opportunities</a>',
  '<iframe src="https://haptik.zohorecruit.com/jobs/Careers"></iframe>']) {
  test(`Haptik retains partial scope for an additional native recruiting surface: ${surface}`, async () => {
    const jobs = await scraper().run(haptikNativeOptions(haptikCapture(), p => {
      if (p.url === 'https://www.haptik.ai/careers') p.body += surface
    }))
    assert.equal(jobs.length, 16)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  })
}

test('Haptik cannot publish a stylesheet-hidden full description', async () => {
  const jobs = await scraper().run(haptikNativeOptions(haptikCapture(), p => {
    if (selected(p)) p.body = '<style>#review-hidden-description{display:none}</style>'
      + p.body.replace(/(<div class="job-details-content content">\s*)<div/, '$1<div id="review-hidden-description"')
  }))
  assert.equal(jobs.length, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Haptik preserves additional recruiting scope advertised on the native board', async () => {
  const jobs = await scraper().run(haptikNativeOptions(haptikCapture(), p => {
    if (p.url === 'https://haptik.freshteam.com/jobs') p.body += '<a href="https://careers.smartrecruiters.com/Haptik">Internships</a>'
  }))
  assert.equal(jobs.length, 16)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
