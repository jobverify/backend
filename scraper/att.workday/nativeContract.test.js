import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'

const fixture = name => gunzipSync(fs.readFileSync(new URL(`./fixtures/native-20261025/${name}.html.gz`, import.meta.url))).toString('utf8')
const india = fixture('att-india5')
const global = fixture('att-search4')
const details = ['101071794848', '101071794960'].map(id => fixture(`att-detail-${id}`))
const now = '2026-10-25T17:23:00.000Z'
const indiaUrl = 'https://www.att.jobs/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D'
const contract = async () => {
  assert.ok(fs.existsSync(new URL('./nativeContract.js', import.meta.url)), 'AT&T has no parser for its current first-party India inventory and native role details')
  return import('./nativeContract.js')
}
const replace = (body, before, after) => {
  assert.ok(body.includes(before), `Mutation anchor missing: ${before}`)
  return body.replaceAll(before, after)
}
function mutatePosting(body, change) {
  let count = 0
  const result = body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi, (all, start, json, end) => {
    const value = JSON.parse(json)
    if (value['@type'] !== 'JobPosting') return all
    count++
    change(value)
    return start + JSON.stringify(value) + end
  })
  assert.equal(count, 1)
  return result
}

test('current native AT&T country search returns 36 India roles over three pages, separate from the global 40', async () => {
  const {inspectAttSearch} = await contract()
  const result = inspectAttSearch(india, {url: indiaUrl, page: 1})
  assert.equal(result.total, 36)
  assert.equal(result.pages, 3)
  assert.equal(result.page, 1)
  assert.equal(result.rows.length, 12)
  assert.equal(result.rows.every(row => row.country === 'India'), true)
  assert.equal(new Set(result.rows.map(row => row.id)).size, 12)
  assert.deepEqual(result.rows[6], {
    id: '101071794848',
    title: 'Sr Specialist Applications Development - Workday HCM Development',
    url: 'https://www.att.jobs/job/hyderabad/sr-specialist-applications-development-workday-hcm-development/117/101071794848',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
  })
  assert.throws(() => inspectAttSearch(global, {url: indiaUrl, page: 1}), /AT&T native/i)
})

test('native AT&T details preserve full JDs, original dates and exact role application URLs', async () => {
  const {inspectAttSearch, parseAttDetail} = await contract()
  const rows = inspectAttSearch(india, {url: indiaUrl, page: 1}).rows
  const first = parseAttDetail(details[0], rows[6], {now})
  const second = parseAttDetail(details[1], rows[7], {now})
  assert.deepEqual([first.jobId, second.jobId], ['R-122803', 'R-122802'])
  assert.deepEqual([first.nativeJobId, second.nativeJobId], ['101071794848', '101071794960'])
  for (const job of [first, second]) {
    assert.equal(job.company, 'AT&T')
    assert.equal(job.source, 'att')
    assert.equal(job.nativeEmployer, 'AT&T')
    assert.equal(job.nativeLegalEmployer, null)
    assert.equal(job.country, 'India')
    assert.equal(job.location, 'Hyderabad, India')
    assert.equal(job.postedAt, '2026-10-22T00:00:00.000Z')
    assert.equal(job.nativePublicationDate, '2026-10-22')
    assert.equal(job.sourcePostingDateIsExact, false)
    assert.equal(job.postingDatePrecision, 'day')
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.ok(job.sourceDescription.length > 5000)
    assert.match(job.sourceDescription, /Workday Studio/)
    assert.match(job.sourceDescription, /Key Roles and Responsibilities/)
    assert.equal(job.jobDescription, job.sourceDescription)
    assert.equal(job.nativeAddresses[0].addressRegion, 'Andhra Pradesh')
    assert.equal(job.nativeLocationMetadata, 'Hyderabad~Telangana~India')
    assert.equal(job.nativeValidThrough, '2026-10-31-07:00')
    assert.equal(job.closingDate, null)
    assert.equal(job.sourceClosingDateIsExact, false)
    assert.equal(job.sourceLifecycleComplete, false)
    assert.equal(job.sourceLifecycleFailureReason, 'native-valid-through-malformed')
  }
  assert.equal(first.applyUrl, 'https://att.wd1.myworkdayjobs.com/ATTGeneral/job/INDAPHyderabad--Argus-Bldg-4f--5f-Sattva-Knowledge-City--Adm-Argus-Building-Sattva-Knowledge-City/Sr-Specialist-Applications-Development---Workday-HCM-Development_R-122803-1/apply')
  assert.equal(second.applyUrl, 'https://att.wd1.myworkdayjobs.com/ATTGeneral/job/INDAPHyderabad--Argus-Bldg-4f--5f-Sattva-Knowledge-City--Adm-Argus-Building-Sattva-Knowledge-City/Lead-Applications-Development---Lead---Workday-HCM-Development_R-122802/apply')
  assert.notEqual(first.applyUrl, second.applyUrl)
})

for (const [name, change] of [
  ['unselected country', body => replace(body, 'data-display="India" data-field-name="" checked="checked"', 'data-display="India" data-field-name=""')],
  ['wrong country facet type', body => replace(body, 'data-facet-type="2" data-id="1269750"', 'data-facet-type="1" data-id="1269750"')],
  ['country total drift', body => replace(body, 'data-total-job-results="36"', 'data-total-job-results="35"')],
  ['premature terminal page', body => replace(body, 'data-total-pages="3"', 'data-total-pages="1"')],
  ['repeated page', body => replace(body, 'data-current-page="1"', 'data-current-page="2"')],
  ['wrong native organization', body => replace(body, '/117/101071794848', '/118/101071794848')],
  ['row query injection', body => replace(body, '/117/101071794848"', '/117/101071794848?country=US"')],
  ['foreign office in India results', body => replace(body, 'Hyderabad, India', 'Hyderabad, United States')],
  ['hidden search', body => replace(body, '<body', '<body hidden')],
  ['inert search', body => replace(body, '<body', '<body inert')],
  ['missing body', () => ''],
]) {
  test(`AT&T country parser rejects ${name}`, async () => {
    const {inspectAttSearch} = await contract()
    assert.throws(() => inspectAttSearch(change(india), {url: indiaUrl, page: 1}), /AT&T native/i)
  })
}

for (const [name, change] of [
  ['foreign employer', body => mutatePosting(body, value => { value.hiringOrganization.name = 'Other Telecom' })],
  ['different requisition', body => mutatePosting(body, value => { value.identifier.value = 'R-999999' })],
  ['foreign structured country', body => mutatePosting(body, value => { value.jobLocation[0].address.addressCountry = 'United States' })],
  ['conflicting title', body => mutatePosting(body, value => { value.title = 'Another Role' })],
  ['future original date', body => mutatePosting(body, value => { value.datePosted = '2027-10-22' })],
  ['invalid original date', body => mutatePosting(body, value => { value.datePosted = '2026-02-30' })],
  ['wrong canonical', body => replace(body, '<link rel="canonical" href="https://www.att.jobs/job/', '<link rel="canonical" href="https://other.example/job/')],
  ['conflicting canonical', body => replace(body, '</head>', '<link rel="canonical" href="https://other.example/"> </head>')],
  ['wrong application brand', body => replace(body, 'att.wd1.myworkdayjobs.com/ATTGeneral/', 'other.wd1.myworkdayjobs.com/ATTGeneral/')],
  ['private invite application', body => replace(body, 'myworkdayjobs.com/ATTGeneral/', 'myworkdayjobs.com/ATTSpecialInvite/')],
  ['different application requisition', body => replace(body, '_R-122803-1/apply', '_R-999999-1/apply')],
  ['application query injection', body => replace(body, '_R-122803-1/apply', '_R-122803-1/apply?job=R-999999')],
  ['wrong application route', body => replace(body, 'ATTGeneral/job/', 'ATTGeneral/positions/')],
  ['application fragment', body => replace(body, '_R-122803-1/apply', '_R-122803-1/apply#R-999999')],
  ['disabled application control', body => replace(body, 'class="button job-apply', 'aria-disabled="true" class="button job-apply')],
  ['inert role', body => replace(body, '<body', '<body inert')],
  ['hidden role', body => replace(body, '<body', '<body hidden')],
  ['missing body', () => ''],
]) {
  test(`AT&T role parser rejects ${name}`, async () => {
    const {inspectAttSearch, parseAttDetail} = await contract()
    const row = inspectAttSearch(india, {url: indiaUrl, page: 1}).rows[6]
    assert.throws(() => parseAttDetail(change(details[0]), row, {now}), /AT&T native/i)
  })
}

test('structured JD cannot substitute for an inactive visible full role description', async () => {
  const {inspectAttSearch, parseAttDetail} = await contract()
  const row = inspectAttSearch(india, {url: indiaUrl, page: 1}).rows[6]
  const body = replace(details[0], '<div class="ats-description">', '<div hidden class="ats-description">')
  assert.throws(() => parseAttDetail(body, row, {now}), error =>
    error.code === 'ATT_NATIVE_ROLE_UNAVAILABLE' && error.nativeJobId === row.id)
})

test('the captured second native page retains the exact India scope and its distinct continuation route', async () => {
  const {inspectAttSearch, parseAttPage, attListingUrl} = await contract()
  const first = inspectAttSearch(india, {url: indiaUrl, page: 1})
  const body = gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261025/att-india-page2-64k.body.gz', import.meta.url))).toString('utf8')
  const receipt = JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261025/att-india-page2-64k.receipt.json', import.meta.url)))
  const second = parseAttPage(body, {page: 2, total: 36})
  assert.equal(second.page, 2)
  assert.equal(second.pages, 3)
  assert.equal(second.total, 36)
  assert.equal(second.rows.length, 12)
  assert.equal(second.rows.every(row => row.country === 'India'), true)
  assert.equal(second.rows[0].id, '97172068832')
  assert.equal(second.rows[11].id, '99526860896')
  assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, 24)
  assert.equal(attListingUrl(2, 36), receipt.url)
})

test('all three captured India pages reconcile to 36 unique roles and a terminal native third page', async () => {
  const {inspectAttSearch, parseAttPage} = await contract()
  const rows = inspectAttSearch(india, {url: indiaUrl, page: 1}).rows
  for (const page of [2, 3]) {
    const body = gunzipSync(fs.readFileSync(new URL(`./fixtures/native-20261025/att-india-page${page}-64k.body.gz`, import.meta.url))).toString('utf8')
    rows.push(...parseAttPage(body, {page, total: 36}).rows)
  }
  assert.equal(rows.length, 36)
  assert.equal(new Set(rows.map(row => row.id)).size, 36)
  assert.equal(rows.every(row => row.country === 'India'), true)
})
