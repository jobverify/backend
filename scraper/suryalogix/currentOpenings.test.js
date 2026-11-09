import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import * as surya from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const homepage = await fs.readFile(new URL('./fixtures/current-identity.html', import.meta.url), 'utf8')
const current = await fs.readFile(new URL('./fixtures/current-hidden-openings.html', import.meta.url), 'utf8')
const run = (html = current, observedAt = '2026-10-09T00:00:00Z') => surya.run({
  now: () => observedAt,
  fetchPage: async url => ({ status: 200, url, html: url === surya.HOMEPAGE_URL ? homepage : html }),
})

test('hidden archived cards and the verified current popup establish incomplete discovery, before and after the archived event', async () => {
  for (const observedAt of ['2026-09-11T00:00:00Z', '2026-10-09T00:00:00Z']) {
    const jobs = await run(current, observedAt)
    assert.deepEqual(jobs, [])
    assert.deepEqual(readInventoryEvidence(jobs), {
      status: 'discovery-only', surface: surya.CAREERS_URL, firstParty: true, listingComplete: false,
      pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date(observedAt).toISOString(),
      reason: 'hidden-archived-openings-and-current-position-selector-do-not-prove-active-vacancy-inventory',
    })
  }
})

test('current archived card parsing retains the publisher popup URL and all three associated position titles', () => {
  const jobs = surya.extractPublicOpenings(current)
  assert.deepEqual(jobs.map(job => job.title), [
    'Embedded Hardware Engineer', 'Embedded Software Engineer', 'PCB Testing Engineer - Service',
  ])
  assert.ok(jobs.every(job => job.country === 'India' && job.city === 'Pune'))
  assert.ok(jobs.every(job => job.applyUrl === surya.CAREERS_URL + '#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjYzNzYxIiwidG9nZ2xlIjpmYWxzZX0%3D'))
})

test('popup discovery requires the linked popup, same-origin form63770, required fields, and exact selector/card association', async () => {
  for (const html of [
    current.replace('data-elementor-id="63761"', 'data-elementor-id="63762"'),
    current.replace('value="63770"', 'value="63771"'),
    current.replace('action="/career-opportunities/#wpcf7-f63770-o2"', 'action="https://example.com/apply"'),
    current.replaceAll('name="your-resume"', 'name="unverified-upload"'),
    current.replace('<option value="Embedded Hardware Engineer">Embedded Hardware Engineer</option>', '<option value="Unknown Engineer">Unknown Engineer</option>'),
    current.replaceAll('name="job-position"', 'name="generic-position"'),
  ]) {
    assert.notEqual(html, current)
    await assert.rejects(run(html), /popup|application|incomplete|association/i)
  }
})

test('hidden event dates cannot close visible jobs or partially hidden cards', async () => {
  const hidden = 'elementor-hidden-desktop elementor-hidden-laptop elementor-hidden-tablet elementor-hidden-mobile'
  const visibleCards = current.replace('elementor-element-027213b elementor-section-stretched ' + hidden, 'elementor-element-027213b elementor-section-stretched')
    .replace('elementor-element-db45657 ' + hidden, 'elementor-element-db45657')
  await assert.rejects(run(visibleCards), /hidden|date|association|inventory/i)
  await assert.rejects(run(current.replace('elementor-element-a70e025 elementor-section-stretched ' + hidden, 'elementor-element-a70e025 elementor-section-stretched')), /hidden|date|association|inventory/i)
})

test('verified popup discovery still rejects new external hiring handoffs and malformed archived cards', async () => {
  await assert.rejects(run(current + '<a href="https://jobs.lever.co/suryalogix/new-role">Apply</a>'), /handoff|incomplete/i)
  await assert.rejects(run(current.replace('Openings: 2', 'Openings: unknown')), /incomplete|malformed/i)
})

test('current Surya metadata preserves unknown active counts and an incomplete popup discovery contract', async () => {
  const { default: local } = await import('./catalog.js')
  const { getScraperCatalog } = await import('../../scraper-support/providers/index.js')
  const shared = getScraperCatalog().find(provider => provider.source === 'suryalogix')
  assert.equal(local.atsPlatform, 'first-party-careers-application-popup')
  assert.equal(local.verifiedOn, '2026-10-09')
  assert.equal(local.verifiedPublicJobCount, null)
  assert.equal(local.verifiedIndiaJobCount, null)
  assert.equal(local.zeroResultPolicy, 'discovery-only')
  assert.match(local.verifiedSurfaceSummary, /three position-selector choices/i)
  assert.match(local.verifiedSurfaceSummary, /unknown/i)
  for (const key of ['atsPlatform', 'verifiedOn', 'verifiedSurfaceSummary', 'paginationStrategy', 'extractionStrategy', 'verifiedPublicJobCount', 'verifiedIndiaJobCount', 'zeroResultPolicy']) {
    assert.deepEqual(shared[key], local[key], key)
  }
})
