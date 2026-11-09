import assert from 'node:assert/strict'
import test from 'node:test'
import { createPublishingGapAtsScraper } from '../utils/publishingGapAts.js'
import { identifyPublicAtsBoard, hasMatchingPublicAtsBinding } from '../utils/publicAtsIdentity.js'
import { verifyOfficialAtsBinding } from '../utils/officialAtsBinding.js'
import { createCatalogScraper, createPublicAtsCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createPropelScraper } from '../../scraper/propel/script.js'
import { hasEmptyLeverBoardSignal } from '../../scraper/plivo/script.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { fixture as currentFeedFixture, replay as replayCurrentFeed } from '../native-sources/declaredJobFeeds/fixtureReplay.js'

const id = '2c31fc64-dce6-41cc-93cb-1dc97100157b'
const leverRow = (board = 'olx', region = 'eu', location = 'Bengaluru, India', country = 'IN') => ({
  id, text: 'Software Engineer', country, createdAt: 1751592000000,
  categories: { location, allLocations: [location], commitment: 'Full-time', team: 'Engineering' },
  hostedUrl: `https://jobs.${region === 'eu' ? 'eu.' : ''}lever.co/${board}/${id}`,
  applyUrl: `https://jobs.${region === 'eu' ? 'eu.' : ''}lever.co/${board}/${id}/apply`,
  descriptionPlain: 'Build reliable production services.', workplaceType: 'hybrid',
})
const ashbyRow = (location = 'Bengaluru, India', country = 'India') => ({
  id, title: 'Software Engineer', isListed: true, location,
  address: { postalAddress: { addressCountry: country, addressLocality: country === 'India' ? 'Bengaluru' : 'Boston' } },
  jobUrl: `https://jobs.ashbyhq.com/propel/${id}`,
  applyUrl: `https://jobs.ashbyhq.com/propel/${id}/application`,
  descriptionHtml: '<p>Build reliable production services.</p>',
  workplaceType: 'Hybrid', team: 'Core platform',
})
const catalog = getScraperCatalog()
const registered = source => createCatalogScraper(catalog.find(row => row.source === source))
const olxPage = (links = `<a href="https://jobs.eu.lever.co/olx/${id}">Engineer</a>`) =>
  `<title>Jobs - Careers OLX Group</title><h1>Shape Your Future at OLX</h1><p>Search open roles. Showing all open roles. Location type Location Team Work type</p>${links}`
const plivoPage = '<title>Jobs | Plivo</title><h1>Come build the future of Agentic AI with us</h1><h2>Open Positions</h2><p>Loading positions</p><astro-island component-url="/_astro/JobsPage.test.js"></astro-island>'
const missingPlivo = '<title>Not found - 404 error</title><h1>Not found</h1>'
const plivoBoard = '<title>Plivo</title><meta name="description" content="Job openings at Plivo"><p>Location type Team Work type</p>'
const plivoOptions = (payload, missing = false) => ({
  fetchText: async url => url.endsWith('.js') ? 'fetch("https://api.lever.co/v0/postings/plivo?mode=json")' : plivoPage,
  fetchPage: async url => ({ status: missing ? 404 : 200, url, html: missing ? missingPlivo : plivoBoard }),
  fetchJson: async () => payload,
})
const propelPage = '<title>Careers | Propel</title><h1>Careers at Propel</h1><a href="https://jobs.ashbyhq.com/propel">Open roles</a>'
const propelOptions = payload => ({
  fetchPage: async url => ({ status: 200, url, html: propelPage }),
  fetchJson: async () => payload,
})

test('Propel constructor excludes foreign-only roles and retains complete inventory evidence', async () => {
  const jobs = await createPropelScraper().run(propelOptions({ apiVersion: '1', jobs: [ashbyRow('Boston, United States', 'US')] }))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('Lever EU board identities remain distinct from the global instance', () => {
  for (const url of ['https://jobs.eu.lever.co/olx', 'https://api.eu.lever.co/v0/postings/olx']) {
    assert.deepEqual(identifyPublicAtsBoard(url), { atsPlatform: 'lever', boardToken: 'olx', region: 'eu' })
  }
  assert.equal(identifyPublicAtsBoard('https://jobs.eu.lever.co.example.com/olx'), null)
})

test('Lever employer binding rejects the same tenant name in the other hosting region', async () => {
  for (const leverRegion of ['global', 'eu']) {
    const otherBoard = `https://jobs.${leverRegion === 'global' ? 'eu.' : ''}lever.co/example`
    const provider = { source: 'example', companyName: 'Example', atsPlatform: 'lever', boardToken: 'example', leverRegion,
      bindingEvidence: { verified: true, matchedLinks: [otherBoard] },
    }
    assert.equal(hasMatchingPublicAtsBinding(provider), false)
    await assert.rejects(createPublicAtsCatalogScraper(provider).run({ fetchJson: async () => [] }), /binding/i)
    await assert.rejects(verifyOfficialAtsBinding({ source: 'example', officialUrl: 'https://example.com/careers',
      boardUrl: `https://jobs.${leverRegion === 'eu' ? 'eu.' : ''}lever.co/example`,
    }, { fetchPage: async url => ({ status: 200, url, html: `<a href="${otherBoard}">Jobs</a>` }) }), /binding/i)
  }
})

for (const region of ['global', 'eu']) {
  const run = records => createPublishingGapAtsScraper({ source: 'lever-native-test', companyName: 'OLX Group',
    companyCareerPage: 'https://careers.olxgroup.com/jobs/', atsPlatform: 'lever', boardToken: 'olx', leverRegion: region,
  }).run({ fetchJson: async url => {
    assert.equal(url, `https://api.${region === 'eu' ? 'eu.' : ''}lever.co/v0/postings/olx?mode=json`)
    return records
  } })

  test(`Lever ${region} includes a native secondary India location without changing the foreign primary`, async () => {
    const row = leverRow('olx', region, 'Boston, United States', 'US')
    row.categories.allLocations.push('Kochi, India')
    const jobs = await run([row])
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].location, 'Kochi, India')
    assert.equal(jobs[0].country, 'India')
    assert.equal(row.categories.location, 'Boston, United States')
    assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
  })

  test(`Lever ${region} respects native India country for a remote primary`, async () => {
    const jobs = await run([leverRow('olx', region, 'Remote', 'IN')])
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].location, 'Remote')
    assert.equal(jobs[0].country, 'India')
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  })

  test(`Lever ${region} rejects a role from the other hosting region`, async () => {
    await assert.rejects(run([leverRow('olx', region === 'eu' ? 'global' : 'eu')]), /board|identity/i)
  })

  test(`Lever ${region} ambiguous foreign secondary cities cannot become India roles`, async () => {
    for (const location of ['Delhi, NY', 'Delhi, Ontario', 'Hyderabad, Sindh', 'Bengaluru']) {
      const row = leverRow('olx', region, 'Boston, United States', 'US')
      row.categories.allLocations.push(location)
      const jobs = await run([row])
      assert.equal(jobs.length, 0, location)
      assert.equal(readInventoryEvidence(jobs).listingComplete, false, location)
      assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null, location)
    }
  })
}

test('OLX registered execution preserves complete native EU inventory and descriptions', async () => {
  const jobs = await registered('olxgroup').run({
    fetchPage: async url => ({ status: 200, url, html: olxPage() }),
    fetchJson: async () => [leverRow()],
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].remoteStatus, 'Hybrid')
  assert.match(jobs[0].jobDescription, /production services/)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('OLX foreign inventory proves zero India while missing advertised role IDs remain incomplete', async () => {
  for (const mismatch of [false, true]) {
    const jobs = await registered('olxgroup').run({
      fetchPage: async url => ({ status: 200, url, html: olxPage() }),
      fetchJson: async () => mismatch ? [] : [leverRow('olx', 'eu', 'Warsaw, Poland', 'PL')],
    })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, !mismatch)
    if (mismatch) assert.match(readInventoryEvidence(jobs).reason, /role|reconcil/i)
  }
})

test('OLX inert handoff URLs cannot establish employer delegation', async () => {
  await assert.rejects(registered('olxgroup').run({
    fetchPage: async url => ({ status: 200, url, html: olxPage(`<script>const role='https://jobs.eu.lever.co/olx/${id}'</script>`) }),
    fetchJson: async () => [leverRow()],
  }), /handoff|careers|binding/i)
})

// The following generic fixtures are not registered Plivo native inventory proof.
test('current registered Plivo cannot promote the old parsed/text-only empty-board fixture into source authority', async () => {
  let parsedReads = 0
  const jobs = await registered('plivo').run({ ...plivoOptions([], true), fetchJson: async () => { parsedReads++;return [] } })
  assert.equal(jobs.length, 0)
  assert.equal(parsedReads, 0)
  const evidence = readInventoryEvidence(jobs), observed = readSourceObservationEvidence(jobs, 'plivo')
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(observed.sourceScopeComplete, false)
  assert.equal(observed.companyGlobalTotal, null)
  assert.equal(observed.companyIndiaTotal, null)
})

test('generic Lever India fixtures retain full description sections and the complete controlled feed total', async () => {
  const row = leverRow('plivo', 'global')
  row.descriptionPlain = 'Employer introduction.'
  row.lists = [{ text: 'Responsibilities', content: '<li>Maintain production services.</li>' }]
  const jobs = await createPublishingGapAtsScraper({ source: 'generic-lever-contract', companyName: 'Plivo', atsPlatform: 'lever', boardToken: 'plivo', countryFilter: 'India' }).run({ fetchJson: async () => [row,
    { ...leverRow('plivo', 'global', 'Boston, United States', 'US'), id: 'foreign',
      hostedUrl: 'https://jobs.lever.co/plivo/foreign', applyUrl: 'https://jobs.lever.co/plivo/foreign/apply' }] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, id)
  assert.match(jobs[0].jobDescription, /Maintain production services/)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('current original-HTTP Plivo empty replay stays Global and non-authoritative with maxJobs zero', async () => {
  const r = replayCurrentFeed(), jobs = await registered('plivo').run({ ...r.options, maxJobs: 0 })
  assert.equal(catalog.find(row => row.source === 'plivo').countryFilter, 'Global')
  assert.equal(jobs.length, 0)
  assert.deepEqual(r.audits[0].observations, currentFeedFixture.oracle.plivo.records)
  assert.equal(r.audits[0].countryFilter, 'Global')
  assert.equal(r.audits[0].sourceScopeComplete, false)
  assert.equal(r.audits[0].lifecycleCleanupAllowed, false)
  assert.equal(r.audits[0].authoritativeSourceTotal, null)
  assert.equal(r.audits[0].authoritativeIndiaFacetCount, null)
  assert.ok(r.audits[0].rawPages.every(page => typeof page.bodySHA256 === 'string'))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).verifiedAt, r.options.now())
})

test('exported legacy Lever visibility helper distinguishes inert text without certifying registered inventory', () => {
  const empty = 'No job postings currently open. Check back later!'
  for (const html of [`<div hidden>${empty}</div>`, `<div inert>${empty}</div>`,
    `<div aria-hidden="true">${empty}</div>`, `<div style="display:none">${empty}</div>`,
    `<script>const state = '${empty}'</script>`, `<!-- ${empty} -->`]) {
    assert.equal(hasEmptyLeverBoardSignal(plivoBoard + html), false, html)
  }
  assert.equal(hasEmptyLeverBoardSignal(plivoBoard + `<div>${empty}</div>`), true)
})

test('generic Lever foreign-only fixture retains its native total while returning no India rows', async () => {
  const jobs = await createPublishingGapAtsScraper({ source: 'generic-lever-contract', companyName: 'Plivo', atsPlatform: 'lever', boardToken: 'plivo', countryFilter: 'India' }).run({
    fetchJson: async () => [leverRow('plivo', 'global', 'Boston, United States', 'US')],
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Propel registered execution uses India scope and preserves native inventory through decoration', async () => {
  const jobs = await registered('propel').run(propelOptions({ apiVersion: '1', jobs: [ashbyRow()] }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].team, 'Core platform')
  assert.equal(jobs[0].remoteStatus, 'Hybrid')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
  assert.equal(catalog.find(row => row.source === 'propel').countryFilter, 'India')
})

test('Propel foreign-only native feed proves zero India, while unknown scope stays partial', async () => {
  for (const [location, country, complete] of [['Boston, United States', 'US', true], ['Worldwide', '', false]]) {
    const jobs = await registered('propel').run(propelOptions({ apiVersion: '1', jobs: [ashbyRow(location, country)] }))
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, complete)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  }
})

test('Propel validates current active employer delegation before using its pinned board', async () => {
  for (const html of [propelPage.replaceAll('/propel"', '/different-company"'),
    propelPage.replace('<a href=', '<script>const url=').replace('>Open roles</a>', '</script>')]) {
    await assert.rejects(registered('propel').run({
      ...propelOptions({ apiVersion: '1', jobs: [] }),
      fetchPage: async url => ({ status: 200, url, html }),
    }), /binding|delegation|handoff/i)
  }
})

for (const source of ['olxgroup', 'plivo', 'propel']) {
  test(`${source} caller cancellation prevents all fetches`, async () => {
    const reason = new Error('cancel source')
    const fail = async () => assert.fail('transport called after cancellation')
    await assert.rejects(registered(source).run({ fetchPage: fail, fetchText: fail, fetchJson: fail,
      signal: AbortSignal.abort(reason),
    }), error => error === reason)
  })
}
