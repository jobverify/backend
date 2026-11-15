import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { darwinboxRecruitmentBoard, readDarwinboxRecruitment } from '../scraper-support/utils/recruitmentDarwinbox.js'

const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/darwinbox/fixtures/current-public-contract-20261115.json.gz', import.meta.url))))
const origin = 'https://fisdom.darwinbox.in'
const officialURL = 'https://www.fisdom.com/careers/'
const legacyURL = origin + '/ms/candidate/careers'
const board = () => ({ ...darwinboxRecruitmentBoard(legacyURL), bindingEvidence: {
  verified: true, officialURL, matchedLinks: [legacyURL], bindingMethod: 'runtime-current-careers-link',
} })
function harness(change = () => {}) {
  const data = fixture(), jobs = [], unresolved = [], inventory = [], records = [], calls = [], grants = new Set()
  const read = async (url, init = {}) => {
    assert.ok(grants.has(url), 'reader must permit each current declared native request')
    calls.push({ url, init })
    let value
    if (url === officialURL) value = { url, status: 200, html: data.corporate }
    else if (url === legacyURL) value = { url, status: 200, html: data.legacyShell }
    else if (url === origin + '/ms/candidate/main.38495915aab0be25d160.js') value = { url, status: 200, html: data.legacyClient }
    else if (url === origin + '/ms/candidatev2/main') value = { url, status: 200, html: data.v2Shell }
    else if (url === origin + '/ms/candidatev2/main.819c4120b20f8091.js') value = { url, status: 200, html: data.v2Client }
    else if (url.endsWith('/companyinfo')) value = structuredClone(data.legacyCompany)
    else if (url.includes('/getCompanyConfig?')) value = structuredClone(data.company)
    else if (url.includes('/groupcompanycareersetting?')) value = { status: 'success', message: { code: 0 } }
    else if (url.includes('/job/alljobs?')) {
      assert.equal(init.method, 'POST')
      assert.deepEqual(JSON.parse(init.body), { companyId: 'main', sort_option: 'new', limit: 10, page: 1 })
      value = structuredClone(data.listing)
    } else if (url.endsWith('/job/a64197589077ab?companyId=main')) value = structuredClone(data.detail1)
    else if (url.endsWith('/job/a64118f91e68cf?companyId=main')) value = structuredClone(data.detail2)
    else assert.fail('Undeclared Darwinbox request: ' + url)
    change(value, url, calls)
    return value
  }
  return { jobs, unresolved, inventory, records, calls, data,
    io: { readPage: read, readRenderer: read, readJson: read, permit: url => grants.add(url),
      matchingEmployer: name => name === 'Fisdom', addJob: job => jobs.push(job),
      inventoryRead: value => inventory.push(value), recordRead: value => records.push(value),
      unresolved: reason => unresolved.push(reason), canRead: () => true, maxPages: 12, maxDetails: 32,
      config: { source: 'fisdom', companyName: 'Fisdom', companyDomain: 'fisdom.com', requireNativeEmployerName: false } } }
}

test('only a current declared HTTPS Darwinbox candidate URL establishes a board', () => {
  assert.deepEqual(darwinboxRecruitmentBoard(legacyURL), { kind: 'darwinbox', origin, url: legacyURL, mode: 'legacy' })
  assert.equal(darwinboxRecruitmentBoard(origin + '/ms/candidatev2/main/careers/allJobs').companyId, 'main')
  for (const value of [origin + '/login', origin + '/ms/candidateapi/companyinfo', legacyURL + '?companyId=other',
    'http://fisdom.darwinbox.in/ms/candidate/careers', legacyURL.replace('fisdom.', 'fisdom.darwinbox.in@other.'), legacyURL + '#other']) {
    assert.equal(darwinboxRecruitmentBoard(value), null, value)
  }
})

test('current declared clients yield both full India roles with their original account and corporate employer proof', async () => {
  const h = harness(); await readDarwinboxRecruitment(board(), h.io)
  assert.deepEqual(h.jobs.map(job => job.id), ['a64197589077ab', 'a64118f91e68cf'])
  assert.deepEqual(h.records.map(row => row.id), ['a64197589077ab', 'a64118f91e68cf'])
  for (const job of h.jobs) {
    assert.equal(job.location, 'Mumbai, Maharashtra, India')
    assert.equal(job.employer.name, 'Finwizard Technology Pvt Ltd')
    assert.ok(job.description.length > 1000)
    assert.equal(job.record.nativeAccount.tenant_id, '119')
    assert.equal(job.record.nativeListingRecord.country, 'India')
    assert.match(job.employerBinding.corporateStatement, /U74900KA2015PTC080747/)
    assert.equal(job.record.nativeClosingContext.eachFullRoleRechecked, true)
  }
  assert.equal(h.jobs[0].posted, '2023-03-20T18:30:00.000Z')
  assert.equal(h.inventory.at(-1).sourceScopeComplete, false)
  assert.equal(h.inventory.at(-1).listingComplete, false)
  assert.equal(h.inventory.at(-1).reportedTotal, 2)
  assert.equal(h.inventory.at(-1).nativePaginationComplete, true)
  assert.equal(h.calls.filter(row => row.url.endsWith('/job/alljobs?companyId=main')).length, 2)
  assert.ok(h.calls.find(row => row.url === legacyURL).init.headers['User-Agent'].includes('Chrome/'))
  assert.ok(h.calls.filter(row => row.url === legacyURL).every(row => row.init.cache === 'no-store'))
})

for (const [name, change, reason] of [
  ['an unreviewed active client', (v, url) => { if (url.endsWith('819c4120b20f8091.js')) v.html += '\nunknownClientChange()' }, /client|renderer/i],
  ['a cross-tenant app base', (v, url) => { if (url === legacyURL) v.html = v.html.replace('/ms/candidate/', 'https://other.darwinbox.in/ms/candidate/') }, /base/i],
  ['a conflicting account tenant', (v, url) => { if (url.includes('/getCompanyConfig?')) v.message.company.subdomain = 'other' }, /account|tenant/i],
  ['a short listing before its native total', (v, url) => { if (url.includes('/job/alljobs?')) v.data.pop() }, /pagination|listing|total/i],
  ['duplicate native role IDs', (v, url) => { if (url.includes('/job/alljobs?')) v.data[1].id = v.data[0].id }, /duplicate|repeated/i],
  ['an unmatched corporate legal statement', (v, url) => { if (url === officialURL) v.html = v.html.replaceAll('U74900KA2015PTC080747', 'OTHER') }, /employer|corporate/i],
]) test('reader rejects ' + name + ' before publishing any role', async () => {
  const h = harness(change); await assert.rejects(readDarwinboxRecruitment(board(), h.io), reason); assert.equal(h.jobs.length, 0)
})

test('native API access denial stays a failure and cannot establish verified zero', async () => {
  const h = harness(() => {})
  h.io.readJson = async () => { const error = Error('HTTP 403'); error.status = 403; throw error }
  await assert.rejects(readDarwinboxRecruitment(board(), h.io), /403/)
  assert.equal(h.jobs.length, 0); assert.equal(h.inventory.length, 0)
})

test('native country conflict excludes the affected role while retaining the other fully checked role', async () => {
  const h = harness((v, url) => { if (url.endsWith('/job/a64197589077ab?companyId=main')) v.message.job[0].country = 'United States' })
  await readDarwinboxRecruitment(board(), h.io)
  assert.deepEqual(h.jobs.map(job => job.id), ['a64118f91e68cf'])
  assert.ok(h.unresolved.some(reason => /country|location/.test(reason)))
})

for (const [kind, jd] of [['blank', ''], ['whitespace', '   '], ['markup-only', '&lt;p&gt;&lt;br&gt;&lt;/p&gt;'],
  ['null', null], ['object', { text: 'A description cannot be supplied as an object.' }], ['array', ['A'.repeat(200)]],
  ['editor prompt', 'Please enter the job description.']]) test(kind + ' native detail cannot inherit a full description from the listing', async () => {
  const h = harness((v, url) => { if (url.endsWith('/job/a64197589077ab?companyId=main')) v.message.job[0].jd = jd })
  await readDarwinboxRecruitment(board(), h.io)
  assert.deepEqual(h.jobs.map(job => job.id), ['a64118f91e68cf'])
  assert.ok(h.unresolved.includes('native-full-description-unavailable'))
})

test('changed closing role criteria cannot publish the changed role', async () => {
  let reads = 0
  const h = harness((v, url) => { if (url.endsWith('/job/a64197589077ab?companyId=main') && ++reads === 2) v.message.job[0].jd += ' Changed mandatory license.' })
  await assert.rejects(readDarwinboxRecruitment(board(), h.io), /closing.*(?:detail|role)|criteria/i)
  assert.equal(h.jobs.length, 0)
})

test('a bounded reader records unread details without claiming company-wide inventory completeness', async () => {
  const h = harness(); h.io.maxDetails = 1
  await readDarwinboxRecruitment(board(), h.io)
  assert.deepEqual(h.jobs.map(job => job.id), ['a64197589077ab'])
  assert.ok(h.unresolved.includes('native-detail-budget-reached'))
  assert.equal(h.inventory.at(-1).sourceScopeComplete, false)
})

test('an empty native listing never supplies unsupported verified-empty source scope', async () => {
  const h = harness((v, url) => { if (url.includes('/getCompanyConfig?')) v.message.company.allJobsCount = 0
    if (url.includes('/job/alljobs?')) { v.data = []; v.job_counts = 0 } })
  await readDarwinboxRecruitment(board(), h.io)
  assert.equal(h.jobs.length, 0)
  assert.ok(h.unresolved.includes('native-empty-inventory-scope-unverified'))
  assert.equal(h.inventory.at(-1).listingComplete, false)
})

test('a non-string native detail country is unresolved rather than ignored', async () => {
  const h = harness((v, url) => { if (url.endsWith('/job/a64197589077ab?companyId=main')) v.message.job[0].country = { name: 'United States' } })
  await readDarwinboxRecruitment(board(), h.io)
  assert.deepEqual(h.jobs.map(job => job.id), ['a64118f91e68cf'])
  assert.ok(h.unresolved.some(reason => /country|location/.test(reason)))
})

test('a malformed description object cannot prevent the other full native role', async () => {
  const h = harness((v, url) => { if (url.endsWith('/job/a64197589077ab?companyId=main')) v.message.job[0].jd = { toString: 'Invalid native description type' } })
  await readDarwinboxRecruitment(board(), h.io)
  assert.deepEqual(h.jobs.map(job => job.id), ['a64118f91e68cf'])
  assert.ok(h.unresolved.includes('native-full-description-unavailable'))
})
