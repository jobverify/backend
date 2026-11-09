import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./nativeEvidence/location-cohort-20261031.json.gz', import.meta.url))))
for (const packet of fixture.packets) assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const replay = async ({ detail, careers, signal, registered = false } = {}) => {
  const operation = registered ? createCatalogScraper(getScraperCatalog().find(row => row.source === 'farmtoplate')).run : source.run
  const events = []
  const jobs = await operation({ signal, fetchPage: async url => {
    events.push(url)
    const packet = fixture.packets.find(packet => packet.url === url)
    assert.ok(packet, 'No uncaptured native read: ' + url)
    return { status: packet.status, url: packet.finalURL, html: url === source.CAREERS_URL && careers ? careers(packet.body)
      : fixture.packets.slice(3).some(packet => packet.url === url) && detail ? detail(packet.body, url) : packet.body }
  } })
  return { jobs, events }
}

test('registered Farm preserves three genuine vacancy observations, unknown geography, native clean JD and actual title conflicts', async () => {
  const { jobs, events } = await replay({ registered: true })
  assert.equal(jobs.length, 3)
  assert.equal(events.length, 6)
  for (const job of jobs) {
    assert.equal(job.location, null)
    assert.equal(job.country, null)
    assert.equal(job.requisitionId, null)
    assert.doesNotMatch(job.rawNativeRoleEvidence.contentJobDescription, /Customer Care|jQuery|wpcf7|Copyright|function\s*\(/)
    assert.ok(job.rawNativeRoleEvidence.contentJobDescription.length < 7000)
  }
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.match(jobs[0].jobDescription, /Professional certification/)
  for (const job of jobs.slice(1)) {
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.publicExperienceChecked, false)
    assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
    assert.equal(job.rawNativeRoleEvidence.identityQualified, false)
    assert.match(job.rawNativeRoleEvidence.contentJobDescription, /Job Title: DevOps Engineer – Associate/)
  }
  assert.deepEqual(jobs.map(job => job.jobId), ['farmtoplate-data-engineer', 'farmtoplate-devops-engineer', 'farmtoplate-devops-engineer-associate'])
  assert.equal(readSourceObservationEvidence(jobs, 'farmtoplate')?.observedVacancyCount, 3)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.verifiedAt, null)
})

test('Farm does not infer country or workplace from a footer address or provider filter', async () => {
  const { jobs } = await replay({ detail: html => html.replace(/<footer\b/i, '<div>Office Location: Pune, India</div><footer') })
  assert.ok(jobs.every(job => job.location === null && job.country === null))
})

test('every supplied Farm listing header URL can invalidate an otherwise matching detail qualification', async () => {
  const { jobs } = await replay({ careers: html => {
    const changed = html.replace(/(<h2\b[^>]*>)(\s*Position:\s*Data Engineer[\s\S]*?)(<\/h2>)/i,
      '$1<a href="https://other-company.example/another-role/">$2</a>$3')
    assert.ok(changed !== html, 'The first native role heading must acquire the contradictory URL')
    return changed
  } })
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(jobs[0].rawNativeRoleEvidence.identityQualified, false)
})

for (const mutation of ['canonical', 'apply']) test('Farm refuses contradictory native ' + mutation + ' ownership', async () => {
  await assert.rejects(replay({ detail: (html, url) => mutation === 'canonical'
    ? html.replaceAll(url, 'https://other-company.example/job/')
    : html.replaceAll('mailto:sakshi.verma@farmtoplate.io', 'mailto:recruiter@other-company.example') }), /Farm To Plate.*(?:identity|URL|application|ownership)/i)
})

test('a permanently hidden Farm careers body cannot supply active opening cards', async () => {
  await assert.rejects(replay({ careers: html => html.replace(/<head\b[^>]*>/i, '$&<style>main{display:none!important}</style>') }), /Farm To Plate.*(?:active|visible|opening|surface)/i)
})

for (const mutation of ['main-hidden', 'svg-sibling', 'svg-style']) test('Farm SVG normalization preserves ' + mutation + ' native visibility semantics', async () => {
  const { jobs } = await replay({ detail: html => {
    if (mutation === 'main-hidden') return html.replace(/<head\b[^>]*>/i, '$&<style>main{opacity:0}</style>')
    if (mutation === 'svg-style') return html.replace(/<main\b/i, '<svg><style>main{display:none!important}</style><path d="M0 0"/></svg><main')
    return html.replace(/<head\b[^>]*>/i, '$&<style>#preceding-native-graphic+main{display:none!important}</style>')
      .replace(/<main\b/i, '<svg id="preceding-native-graphic"><path d="M0 0"/></svg><main')
  } })
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(jobs[0].jobDescription, null)
  assert.match(jobs[0].rawNativeRoleEvidence.contentJobDescription, /Professional certification/)
})

test('Farm respects exact caller cancellation before its first native request', async () => {
  const controller = new AbortController(), reason = Object.freeze(new Error('Stop Farm'))
  controller.abort(reason)
  await assert.rejects(replay({ signal: controller.signal }), error => error === reason)
})

for (const mode of ['author-css', 'opacity', 'visible']) test('Farm normalized criteria use the actual visible body while raw evidence retains ' + mode + ' native content', async () => {
  const marker = 'Controlled native duty: maintain the role owned data dictionary.'
  const { jobs } = await replay({ detail: (html, url) => {
    if (url !== 'https://www.farmtoplate.io/data-engineer/') return html
    const style = mode === 'author-css' ? '<style>.followup-criteria{display:none!important}</style>' : ''
    const attributes = mode === 'author-css' ? ' class="followup-criteria"' : mode === 'opacity' ? ' style="opacity:0"' : ''
    return html.replace('</head>', style + '</head>').replace(/(<main\b[^>]*>[\s\S]*?<ul\b[^>]*>)/i,
      '$1<li><span' + attributes + '>' + marker + '</span></li>')
  } })
  assert.equal(jobs[0].sourceDetailComplete, true, 'Existing visible native criteria still qualify')
  assert.equal(jobs[0].jobDescription.includes(marker), mode === 'visible')
  assert.equal(jobs[0].rawNativeRoleEvidence.contentJobDescription.includes(marker), true)
  assert.match(jobs[0].jobDescription, /Professional certification/)
})
