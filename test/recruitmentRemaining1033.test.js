import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { remainingRecruitmentBatchProviders } from '../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { classifyProviderImplementation } from '../scripts/reportScriptCatalogTopology.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import {currentCatalogBindingDates,currentModuleBindingDates,assertSpecializedBatchExtraction,assertSpecializedBatchDenial} from './helpers/replaySpecializedRecruitmentBatch.js'

const batch = remainingRecruitmentBatchProviders()
const catalog = getScraperCatalog()
const current = new Map(catalog.map(provider => [provider.source, provider]))
const currentNativeSources=new Set(['lyrahealth','unosecur','kkr','precisely','mannhummel','moodyscorporation','stantec','synchronyfinancial','xerox','ncs','bilt','reuters','adityabirlarealestate','moodys','jabil','bigeye','onsemiconductor','lennoxinternational'])
const currentParserBindings = Object.freeze({ moodys: 'current-corporate-bound-talentbrew-country-inventory', jabil: 'current-declared-first-party-jobs-feed', lennoxinternational: 'custom-script' })
const description = '<p>Build and operate production software services, investigate distributed system failures, review API contracts and collaborate with the engineering team on reliable delivery.</p>'
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

test('the remaining 1033 source routes are unique, implemented and keep static inventory verification unknown', () => {
  assert.equal(batch.length, 1033)
  assert.equal(new Set(batch.map(row => row.source)).size, 1033)
  assert.equal(catalog.length, 4567)
  for (const provider of batch) {
    const selected = current.get(provider.source)
    assert.equal(classifyProviderImplementation(selected).type, 'script', provider.source)
    assert.equal(selected.parser,provider.catalogOverride===true
      ?provider.parser:currentParserBindings[provider.source]??'runtime-verified-recruitment',provider.source)
    // An explicit batch override controls registered binding metadata. The
    // module can retain a historical review date without certifying inventory.
    assert.equal(selected.verifiedOn, provider.catalogOverride===true
      ?provider.verifiedOn:currentCatalogBindingDates[provider.source]??null,provider.source)
    assert.equal(selected.verifiedIndiaJobCount, null)
    assert.equal(selected.verifiedPublicJobCount, null)
    assert.equal(selected.sourceScopeComplete, false)
    assert.equal(selected.lifecycleCleanupAllowed, false)
    assert.equal(selected.zeroResultPolicy, 'evidence-required')
    assert.ok(selected.companyCareerPage.startsWith('https://'))
    assert.ok(selected.identityEvidence.basis)
  }
  const leaked = remainingRecruitmentBatchProviders()
  leaked[0].companyName = 'mutated clone'
  assert.notEqual(remainingRecruitmentBatchProviders()[0].companyName, leaked[0].companyName)
  for (const source of ['gainsightpx', 'onedrive', 'fluentd', 'figjam', 'innovacceranalytics', 'tatamotorsdvr', 'adeptai']) {
    assert.equal(current.get(source).requireNativeEmployerName, true, source)
  }
})

test('all 1033 production modules exercise current source contracts, including explicit discovery holds', async t => {
  let uncontrolled = 0
  t.mock.method(globalThis, 'fetch', () => { uncontrolled++; throw new Error('Uncontrolled HTTP is forbidden') })
  for (const provider of batch) await t.test(provider.source, async sourceTest => {
    const selected = current.get(provider.source)
    const module = await import(pathToFileURL(selected.modulePath).href)
    assert.equal(module.SOURCE, provider.source)
    assert.equal(module.VERIFIED_ON, currentModuleBindingDates[provider.source]??null)
    assert.equal(typeof module.run, 'function')
    if(currentNativeSources.has(provider.source))return assertSpecializedBatchExtraction(sourceTest,selected)
    const root = new URL(/myworkdayjobs|smartrecruiters|ashbyhq|greenhouse|lever\.co|workable\.com|breezy\.hr/i.test(provider.companyCareerPage)
      ? provider.officialHomepageUrl : provider.companyCareerPage)
    root.search = ''; root.hash = ''; root.pathname = root.pathname.replace(/\/$/, '') + '/jobs/controlled-native-role'
    const roleURL = root.href
    const record = { '@type': 'JobPosting', identifier: { value: provider.source + '-native-1' }, title: 'Software Engineer',
      hiringOrganization: { name: provider.companyName }, url: roleURL, description, datePosted: '2026-11-01',
      jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } } }
    const calls = []
    const jobs = await createCatalogScraper(selected).run({ now: () => '2026-11-03T10:00:00Z', maxPages: 4,
      fetchPage: async url => {
        calls.push(url)
        return { status: 200, url, html: url === roleURL ? '<h1>Software Engineer</h1>' + description
          + '<script type="application/ld+json">' + JSON.stringify(record) + '</script>'
          : '<title>' + escape(provider.companyName) + '</title><h1>' + escape(provider.companyName) + '</h1><a href="' + roleURL + '">Open job</a>' }
      },
      fetchJson: async () => assert.fail('No native API was advertised in this controlled first-party fixture'),
    })
    assert.ok(calls.includes(roleURL))
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].company, provider.companyName)
    assert.equal(jobs[0].country, 'India')
    assert.equal(jobs[0].applyUrl, roleURL)
    assert.equal(jobs[0].sourceDescription, description)
    assert.equal(jobs[0].postingDate, record.datePosted)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.ok(jobs[RECRUITMENT_OBSERVATIONS])
  })
  assert.equal(uncontrolled, 0)
})

test('all 1033 denied sources retain the primary failure without certifying empty inventory', async t => {
  t.mock.method(globalThis,'fetch',()=>assert.fail('Denied batch tests forbid uncontrolled HTTP'))
  for (const provider of batch) await t.test(provider.source, async sourceTest => {
    if(currentNativeSources.has(provider.source))return assertSpecializedBatchDenial(sourceTest,current.get(provider.source))
    await assert.rejects(createCatalogScraper(current.get(provider.source)).run({
      fetchPage: async url => ({ status: 403, url, html: '' }),
      fetchJson: () => assert.fail('Blocked pages cannot authorize a guessed native account'),
    }), error => {
      assert.equal(error.failureKind, 'blocked_or_access_denied')
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.status, 403)
      assert.equal(error.abortRetries, true)
      assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
      assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
      assert.ok(error.recruitmentObservations.receipts.length > 0)
      assert.ok(error.recruitmentObservations.receipts.every(row => row.status === 403))
      return true
    })
  })
})

test('the four public source factories also execute current extraction and retain caller transport', async t => {
  for (const [source, factory] of [['rivigo', 'createRivigoScraper'], ['foraysoft', 'createForaySoftScraper'],
    ['freshtime', 'createFreshtimeScraper'], ['zenohealth', 'createZenoHealthScraper']]) await t.test(source, async () => {
    const provider = current.get(source), module = await import(pathToFileURL(provider.modulePath).href)
    const url = new URL(provider.companyCareerPage)
    url.search = ''; url.hash = ''; url.pathname = url.pathname.replace(/\/$/, '') + '/jobs/factory-native-role'
    const roleURL = url.href, record = { '@type': 'JobPosting', title: 'Software Engineer', identifier: { value: 'factory-' + source },
      hiringOrganization: { name: provider.companyName }, url: roleURL, description,
      jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } } }
    const jobs = await module[factory]({
      fetchPage: async requested => ({ status: 200, url: requested, html: requested === roleURL
        ? '<h1>Software Engineer</h1>' + description + '<script type="application/ld+json">' + JSON.stringify(record) + '</script>'
        : '<title>' + provider.companyName + '</title><a href="' + roleURL + '">Open jobs</a>' }),
      fetchJson: () => assert.fail('The public factory fixture did not advertise a native API'),
    }).run()
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].source, source)
    assert.equal(jobs[0].applyUrl, roleURL)
  })
})
