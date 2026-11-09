import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as easy from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const html = fixture('careers.html')
const denyNetwork = () => { throw new Error('Hermetic test attempted live fetch') }
test.before(() => { globalThis.fetch = denyNetwork })

const options = (overrides = {}) => ({
  fetchText: denyNetwork,
  fetchPage: async url => ({ status: 200, url, text: url.endsWith('/careers') ? html
    : fixture(url.includes('/app/careers/') ? 'careers-client.js' : url.endsWith('/assets/js/company-careers.js') ? 'company-careers.js' : 'site-chrome.js') }),
  now: '2026-10-26T20:40:00Z', ...overrides,
})

test('current native inventory parses every role without manufacturing job identities, country or descriptions', () => {
  assert.equal(typeof easy.extractNativeInventory, 'function')
  const inventory = easy.extractNativeInventory(html)
  assert.equal(inventory.candidates.length, 11)
  assert.deepEqual(inventory.candidates.map(row => row.title), [
    'Senior Backend Engineer', 'Frontend Engineer (React)', 'Product Manager · Warehousing',
    'Solutions Engineer', 'Manager · Solution Sales', 'Account Executive · North America',
    'Business Development Manager · Middle East', 'Customer Success Manager',
    'Implementation Specialist', 'Content Marketing Manager', 'Warehouse Solutions Consultant',
  ])
  for (const row of inventory.candidates) {
    assert.equal(row.company, 'EasyEcom')
    assert.equal(row.jobId, null)
    assert.equal(row.requisitionId, null)
    assert.equal(row.postingDate, null)
    assert.equal(row.closingDate, null)
    assert.equal(row.jobDescription, null)
    assert.equal(row.applicationMethod, 'shared-open-application-email')
    assert.equal(row.applicationScope, 'general-interest')
    assert.equal(row.applyUrl, 'mailto:careers@easyecom.io?subject=Open%20application%20%E2%80%94%20EasyEcom')
    assert.equal(row.roleApplicationTarget, 'https://www.easyecom.io/careers#apply')
    assert.equal(row.employmentType, 'Full-time')
  }
  assert.equal(inventory.candidates[1].location, 'Bengaluru / Remote')
  assert.equal(inventory.candidates[1].country, null)
  assert.equal(inventory.candidates[1].city, null)
  assert.equal(inventory.candidates[0].country, 'India')
  assert.equal(inventory.candidates[0].city, 'Bengaluru')
  assert.equal(inventory.candidates[0].countryEvidence.kind, 'explicit-native-hiring-hub-mapping')
  assert.match(inventory.candidates[0].countryEvidence.answer, /Delhi in India/)
  assert.equal(inventory.candidates[5].country, 'United States')
  assert.equal(inventory.candidates[5].city, 'Atlanta')
  assert.equal(inventory.candidates[6].country, 'United Arab Emirates')
  assert.equal(inventory.candidates[1].remoteStatus, 'Remote')
  assert.equal(inventory.candidates[5].location, 'Atlanta')
  assert.equal(inventory.candidates[6].location, 'Dubai')
  assert.deepEqual(inventory.candidates[0].requiredSkills, [])
  assert.equal(inventory.candidates[0].minimumQualification, null)
})

test('native runtime preserves unknown India scope as partial and reconciles the complete inventory before caps', async () => {
  const observed = []
  const jobs = await easy.createEasyEcomScraper({ maxJobs: 1 }).run(options({ onNativeInventory: row => observed.push(row) }))
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.listingComplete, false)
  assert.equal(evidence?.reportedTotal, 11)
  assert.equal(evidence?.indiaFacetCount, null)
  assert.equal(observed[0].candidates.length, 11)
  assert.equal(observed[0].closingSnapshotMatched, true)
  assert.equal(observed[0].counts.countryUnknown, 2)
  assert.equal(observed[0].counts.confirmedIndia, 7)
  assert.equal(observed[0].counts.confirmedForeign, 2)
  assert.equal(observed[0].counts.fullHealthy, 0)
  assert.equal(observed[0].counts.eligible, 0)
})

test('old Webflow markup cannot become a current healthy India inventory', async () => {
  const old = '<div role="listitem" class="career-item w-dyn-item"><h3 class="heading-h3-size mg-bottom-10px">Analyst</h3><div class="text-200 medium color-neutral-800">Bengaluru</div><a href="/career/analyst" class="btn-primary width-100---mbl w-button">Apply now</a></div>'
  const jobs = await easy.createEasyEcomScraper().run(options({ fetchText: async () => old, fetchPage: async url => ({ status: 200, url, text: old }) }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('country mapping fails closed when the native FAQ changes or a typed role country conflicts', () => {
  const revised = html.replaceAll('Delhi in India', 'Delhi and elsewhere')
  assert.ok(easy.extractNativeInventory(revised).candidates.every(row => row.country === null))
  const conflict = html.replace('class="role rv" data-dept="engineering"', 'class="role rv" data-country="US" data-dept="engineering"')
  const role = easy.extractNativeInventory(conflict).candidates[0]
  assert.equal(role.country, null)
  assert.ok(role.healthGaps.includes('conflicting-native-role-country'))
})

test('inert or hidden markup never supplies a current role and Hybrid stays a work mode', () => {
  const changed = html.replace('class="role rv" data-dept="engineering"', 'class="role rv" hidden data-dept="engineering"')
    .replace('Full-time', 'Hybrid')
  assert.equal(easy.extractNativeInventory(changed).candidates.length, 10)
  const hybrid = easy.extractNativeInventory(html.replace('Full-time', 'Hybrid')).candidates[0]
  assert.equal(hybrid.employmentType, null)
  assert.equal(hybrid.remoteStatus, 'Hybrid')
})

test('a changed closing role snapshot cannot authorize absence cleanup', async () => {
  let listings = 0, inventory
  const base = options()
  const jobs = await easy.run({ ...base, onNativeInventory: value => { inventory = value }, fetchPage: async url => {
    if (url.endsWith('/careers') && ++listings === 2) return { status: 200, url, text: html.replace('Senior Backend Engineer', 'Backend Engineer') }
    return base.fetchPage(url)
  } })
  assert.equal(jobs.length, 0)
  assert.equal(inventory.closingSnapshotMatched, false)
  assert.equal(inventory.reason, 'native-closing-snapshot-changed')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('an access denial stops native exploration immediately', async () => {
  let calls = 0
  const jobs = await easy.run(options({ fetchPage: async url => { calls++; return { status: 403, url, text: 'Denied' } } }))
  assert.equal(calls, 1)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).firstParty, false)
})

test('registered source uses the current native inventory contract and preserves incomplete evidence', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'easyecom')
  assert.equal(provider.paginationStrategy, 'complete-native-role-list+client-scripts+closing-reconciliation')
  assert.equal(provider.companyCareerPage, 'https://www.easyecom.io/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  let inventory
  const jobs = await createCatalogScraper(provider).run(options({ onNativeInventory: value => { inventory = value } }))
  assert.equal(inventory.counts.native, 11)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('stylesheet-hidden role cards and hidden FAQ country evidence are excluded', () => {
  const rolesHidden = easy.extractNativeInventory(`${html}<style>.role{display:none!important}</style>`)
  assert.equal(rolesHidden.candidates.length, 0)
  const faqHidden = easy.extractNativeInventory(`${html}<style>.faqs .faq{display:none!important}</style>`)
  assert.equal(faqHidden.candidates.length, 11)
  assert.equal(faqHidden.hubMappingVerified, false)
  assert.equal(faqHidden.counts.confirmedIndia, 0)
  assert.equal(faqHidden.counts.countryUnknown, 11)
  assert.ok(faqHidden.candidates.every(row => row.countryEvidence === null))
  const answerHidden = easy.extractNativeInventory(`${html}<style>.faq-a{visibility:hidden}</style>`)
  assert.equal(answerHidden.hubMappingVerified, false)
})

test('unrelated and inert styles preserve the published native roles and FAQ mapping', () => {
  const control = easy.extractNativeInventory(`${html}<style>.missing-parent .role,.role.missing-class{display:none!important}</style><template><style>.role,.faq{display:none!important}</style></template>`)
  assert.equal(control.candidates.length, 11)
  assert.equal(control.counts.confirmedIndia, 7)
  assert.equal(control.hubMappingVerified, true)
})

test('a native Remote or Hybrid work mode cannot inherit an exact hub country', () => {
  for (const type of ['Remote', 'Hybrid']) {
    const inventory = easy.extractNativeInventory(html.replace('Full-time', type))
    const candidate = inventory.candidates[0]
    assert.equal(candidate.location, 'Bengaluru')
    assert.equal(candidate.remoteStatus, type)
    assert.equal(candidate.country, null)
    assert.equal(candidate.countryEvidence, null)
    assert.equal(candidate.city, null)
    assert.equal(inventory.counts.confirmedIndia, 6)
    assert.equal(inventory.counts.countryUnknown, 3)
  }
})

test('closing stylesheet hiding country evidence changes the reconciled snapshot', async () => {
  let listings = 0, inventory
  const base = options()
  const jobs = await easy.run({ ...base, onNativeInventory: value => { inventory = value }, fetchPage: async url => {
    if (url.endsWith('/careers') && ++listings === 2) return { status: 200, url, text: `${html}<style>.faq{display:none}</style>` }
    return base.fetchPage(url)
  } })
  assert.equal(jobs.length, 0)
  assert.equal(inventory.closingSnapshotMatched, false)
  assert.equal(inventory.reason, 'native-closing-snapshot-changed')
})

test('a preaborted run rejects before any injected request or inventory callback', async () => {
  const controller = new AbortController(), reason = new Error('stop before EasyEcom')
  controller.abort(reason)
  let calls = 0, callbacks = 0
  await assert.rejects(easy.run(options({ signal: controller.signal,
    fetchPage: async url => { calls++; return { status: 200, url, text: html } },
    onNativeInventory: () => { callbacks++ },
  })), error => error === reason)
  assert.equal(calls, 0)
  assert.equal(callbacks, 0)
})

test('inflight abort rejects after the current response and stops remaining requests', async () => {
  const controller = new AbortController(), reason = new Error('stop during EasyEcom')
  let calls = 0, callbacks = 0
  const base = options()
  await assert.rejects(easy.run(options({ signal: controller.signal,
    fetchPage: async (url, requestOptions) => {
      assert.equal(requestOptions.signal, controller.signal)
      calls++
      const response = await base.fetchPage(url)
      controller.abort(reason)
      return response
    }, onNativeInventory: () => { callbacks++ },
  })), error => error === reason)
  assert.equal(calls, 1)
  assert.equal(callbacks, 0)
})

test('the legacy text injection receives cancellation and cannot swallow it as partial success', async () => {
  const controller = new AbortController(), reason = new Error('stop legacy EasyEcom')
  let calls = 0
  await assert.rejects(easy.run(options({ fetchPage: undefined, signal: controller.signal,
    fetchText: async (url, requestOptions) => {
      calls++
      assert.equal(requestOptions.signal, controller.signal)
      controller.abort(reason)
      return html
    },
  })), error => error === reason)
  assert.equal(calls, 1)
})

test('abort promptly rejects an inflight injected fetch even if the fetch ignores its signal', async () => {
  const controller = new AbortController(), reason = new Error('stop pending EasyEcom request')
  const deferred = Promise.withResolvers()
  let calls = 0
  const pending = easy.run(options({ signal: controller.signal, fetchPage: () => { calls++; return deferred.promise } }))
  const outcome = pending.then(() => 'resolved', error => error)
  controller.abort(reason)
  const actual = await Promise.race([outcome, new Promise(resolve => setTimeout(() => resolve('still pending'), 50))])
  deferred.resolve({ status: 200, url: 'https://www.easyecom.io/careers', text: html })
  assert.equal(actual, reason)
  assert.equal(calls, 1)
})

test('functional CSS selector lists cannot hide published cards or FAQ evidence from visibility checks', () => {
  const inventory = easy.extractNativeInventory(`${html}<style>:is(.role, .faq){display:none!important}</style>`)
  assert.equal(inventory.candidates.length, 0)
  assert.equal(inventory.hubMappingVerified, false)
})

test('abort takes precedence over an inflight transport rejection without leaking the rejected promise', async () => {
  const controller = new AbortController(), reason = new Error('cancel rejected EasyEcom request')
  await assert.rejects(easy.run(options({ signal: controller.signal, fetchPage: async () => {
    controller.abort(reason)
    throw new Error('transport rejected after cancellation')
  } })), error => error === reason)
  await new Promise(resolve => setImmediate(resolve))
})
