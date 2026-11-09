import assert from 'node:assert/strict'
import test from 'node:test'
import * as anand from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'

// Preserve the original sentinel inputs and case titles as negative history.
// These guessed hosts are data only: no DNS requests or routes are generated.
const CAREERS_PATHS = [
    '/',
    '/careers',
    '/careers/',
    '/jobs',
    '/jobs/',
  ]
const OFFICIAL_SURFACE_CANDIDATES = [
    'https://anandengineeringproducts.com',
    'https://www.anandengineeringproducts.com',
    'https://anandengineeringproducts.in',
    'https://www.anandengineeringproducts.in',
    'https://anandengineeringproducts.co.in',
    'https://www.anandengineeringproducts.co.in',
    'https://anandenggproducts.com',
    'https://www.anandenggproducts.com',
    'https://aeppl.in',
    'https://www.aeppl.in',
  ]
const LEGACY_CASE_NAMES = [
  "exports the verified candidate first-party surfaces for Anand Engineering Products Pvt Ltd",
  "recognizes the DNS failures that matched the verified missing-surface checks",
  "run returns no jobs while each verified candidate first-party root remains unresolved",
  "run fails closed when any candidate first-party surface starts resolving"
]
const CURRENT_CASE_NAMES = [
  "current Anand entrypoint rejects historical guessed surface inputs without restoring discovery constants",
  "historical DNS and HTTP errors propagate exactly from the single current Anand homepage read",
  "unresolved historical candidate roots cannot establish a verified-empty current Anand inventory",
  "resolving historical candidate markup still fails current Anand identity before listing reads"
]
const provider = getScraperCatalog().find(row => row.source === 'anandengineeringproductspvtltd')
const historicalHtml = '<html><title>Anand Engineering Products</title><body>Careers</body></html>'
const unchangedHomepageFixture = "<html><head><title>Anand Engineering | Heavy Steel Fabrication &amp; Manufacturing</title></head><body><a href=\"https://anandengg.in/open-positions/\">Careers</a><p>D56, Developed Plot Estate, Thuvakudi, Trichy</p><a href=\"mailto:admin@anandengg.in\">Email</a></body></html>"

test(CURRENT_CASE_NAMES[0], async () => {
  assert.equal(LEGACY_CASE_NAMES[0], 'exports the verified candidate first-party surfaces for Anand Engineering Products Pvt Ltd')
  assert.equal(typeof anand.run, 'function')
  assert.equal(anand.hasHomepageSignal(unchangedHomepageFixture), true)
  assert.equal(Object.hasOwn(anand, 'CAREERS_PATHS'), false)
  assert.equal(Object.hasOwn(anand, 'OFFICIAL_SURFACE_CANDIDATES'), false)
  assert.equal(Object.hasOwn(anand, 'isExpectedMissingSurfaceError'), false)
  for (const origin of OFFICIAL_SURFACE_CANDIDATES) {
    const calls = []
    const lookalike = historicalHtml.replace('</body>', '<a href="' + origin + CAREERS_PATHS[1] + '">Careers</a></body>')
    await assert.rejects(createCatalogScraper(provider).run({ fetchText: async url => { calls.push(url); return lookalike } }), /verified official homepage changed/)
    assert.deepEqual(calls, [anand.HOMEPAGE_URL])
  }
})

test(CURRENT_CASE_NAMES[1], async () => {
  const failures = [
    new Error('The remote name could not be resolved: anandengineeringproducts.com'),
    new Error('getaddrinfo ENOTFOUND anandengineeringproducts.in'),
    new Error('fetch failed: DNS lookup failed'),
    new Error('[anandengineeringproductspvtltd] All 1 attempts failed. Last error: fetch failed', {
      cause: new TypeError('fetch failed', {
        cause: Object.assign(new Error('getaddrinfo ENOTFOUND anandengineeringproducts.com'), { code: 'ENOTFOUND' }),
      }),
    }),
    new Error('HTTP 404 for https://anandengineeringproducts.com'),
  ]
  for (const error of failures) {
    const calls = []
    await assert.rejects(anand.run({ fetchText: async url => { calls.push(url); throw error } }), actual => actual === error)
    assert.deepEqual(calls, [anand.HOMEPAGE_URL])
  }
})

test(CURRENT_CASE_NAMES[2], async () => {
  for (const origin of OFFICIAL_SURFACE_CANDIDATES) {
    const originalFailure = new Error('The remote name could not be resolved: ' + origin)
    const calls = []
    let returned = false
    await assert.rejects(createCatalogScraper(provider).run({ fetchText: async url => {
      calls.push(url)
      throw originalFailure
    } }).then(jobs => { returned = true; return jobs }), error => error === originalFailure)
    assert.equal(returned, false)
    assert.deepEqual(calls, [anand.HOMEPAGE_URL])
  }
})

test(CURRENT_CASE_NAMES[3], async () => {
  const calls = []
  await assert.rejects(anand.createAnandEngineeringProductsScraper().run({ fetchText: async url => {
    calls.push(url)
    return historicalHtml // Exact original resolving-candidate body.
  } }), /verified official homepage changed/)
  assert.deepEqual(calls, [anand.HOMEPAGE_URL])
  assert.equal(anand.hasHomepageSignal(historicalHtml), false)
})
