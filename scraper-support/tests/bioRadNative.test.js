import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as bioRad from '../../scraper/biorad.workday/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/biorad/native-excerpts.json', import.meta.url)))
const search = 'https://careers.bio-rad.com/jobs/search?country_codes%5B%5D=IN'
const listing = () => bioRad.parseBioRadListing(fixture.listing, search)
const chennai = () => listing().jobs.find(job => job.requisitionId === '2026-38980')
test('actual native India table reconciles five entries and terminal controls', () => {
  const parsed = listing()
  assert.equal(parsed.total, 5)
  assert.equal(parsed.jobs.length, 5)
  assert.equal(parsed.nextUrl, null)
  assert.equal(parsed.jobs[0].location, 'Remote, India')
})
test('actual Chennai full JD agrees with native title, UID, requisition, company and location', () => {
  const job = bioRad.parseBioRadDetail(fixture.detail, chennai())
  assert.equal(job.nativeJobUid, '275fb691cf68c95f9e58b2a827e56447')
  assert.equal(job.sourceDetailComplete, true)
  assert.ok(job.jobDescription.length > 4000)
  assert.equal(job.sourceClosingDateIsExact, true)
})
test('rejects future native publication against the supplied check time while allowing future closing', () => {
  const future = fixture.detail.replace('2026-08-19T05:03:28Z','2099-08-19T05:03:28Z').replace('2027-01-18T18:11:45Z','2100-01-18T18:11:45Z')
  assert.throws(() => bioRad.parseBioRadDetail(future,chennai(),{now:'2026-10-20T22:00:00Z'}), /publication.*future/i)
  const valid = bioRad.parseBioRadDetail(fixture.detail,chennai(),{now:'2026-10-20T22:00:00Z'})
  assert.equal(valid.sourceDetailComplete,true)
  assert.equal(valid.closingDate,'2027-01-18T18:11:45.000Z')
})
test('related-job table titles cannot replace or conflict with the actual job heading', () => {
  const job = bioRad.parseBioRadDetail(fixture.detail + '<table><tr><td class="job-title">Other related job</td></tr></table>', chennai())
  assert.equal(job.sourceDetailComplete, true)
})
for (const [name, mutate] of [
  ['wrong company', h => h.replaceAll('Bio-Rad Laboratories, Inc.', 'Different Employer')],
  ['wrong native UID', h => h.replace('"value":"275fb691cf68c95f9e58b2a827e56447"', '"value":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"')],
  ['foreign country', h => h.replaceAll('"addressCountry":"IN"', '"addressCountry":"US"')],
  ['wrong title', h => h.replace('"title":"Trade Compliance Spec III"', '"title":"Other role"')],
  ['wrong canonical', h => h.replace('href="https://careers.bio-rad.com/jobs/trade-compliance-spec-iii-chennai-india"', 'href="https://careers.bio-rad.com/jobs/other"')],
  ['data-href only', h => h.replaceAll(' href=', ' data-href=')],
  ['inert-only detail', h => `<template>${h}</template>`],
  ['wrong apply UID', h => h.replace('job_uid=275fb691cf68c95f9e58b2a827e56447', 'job_uid=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')],
  ['impossible date', h => h.replace('2026-08-19T05:03:28Z', '2026-02-30T05:03:28Z')],
]) test(`rejects ${name}`, () => assert.throws(() => bioRad.parseBioRadDetail(mutate(fixture.detail), chennai())))
for (const [name, mutate] of [
  ['count mismatch', h => h.replace('all&nbsp;5', 'all&nbsp;6')],
  ['missing count', h => h.replace('table-counts', 'other-counts')],
  ['unchecked India filter', h => h.replace(' checked>', '>')],
  ['foreign location', h => h.replaceAll('Remote, India', 'Remote, United States')],
]) test(`rejects listing ${name}`, () => assert.throws(() => bioRad.parseBioRadListing(mutate(fixture.listing), search)))
test('HTTP 202 detail is retained as unavailable, never teaser content or healthy inherited data', async () => {
  const jobs = await bioRad.run({fetchText: async url => {
    if (url === bioRad.CAREERS_URL) return '<a href="/jobs/search">Search All Jobs</a>'
    if (url === search) return fixture.listing
    if (url === chennai().sourceUrl) return fixture.detail
    throw new Error('HTTP 202')
  }})
  assert.equal(jobs.length, 5)
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 1)
  assert.ok(jobs.filter(job => !job.sourceDetailComplete).every(job => job.jobDescription === null))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
test('explicit cap is partial and caller abort rejects without zero evidence', async () => {
  const jobs = await bioRad.run({maxJobs: 0, fetchText: async url => url === bioRad.CAREERS_URL ? '<a href="/jobs/search">Search All Jobs</a>' : fixture.listing})
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  await assert.rejects(bioRad.run({signal: AbortSignal.abort()}))
})
const nativeRows = [...fixture.listing.matchAll(/<tr role="link"[\s\S]*?<\/tr>/g)].map(m => m[0])
const page = (rows, start, end, total, next = null) => fixture.listing
  .replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${rows.join('')}</tbody>`)
  .replace('Displaying <b>all&nbsp;5</b> entries', total <= rows.length ? `Displaying <b>all&nbsp;${total}</b> entries` : `Displaying <b>${start}&nbsp;-&nbsp;${end}</b> of <b>${total}</b> in total`)
  .replace('</form>', `${next ? `<a rel="next" href="${next}">Next</a>` : ''}</form>`)
const next = `${search}&page=2`
test('reconciles a synthetic two-page inventory using actual table-row shapes', async () => {
  const jobs = await bioRad.run({fetchText: async url => {
    if (url === bioRad.CAREERS_URL) return '<a href="/jobs/search">Search All Jobs</a>'
    if (url === search) return page(nativeRows.slice(0,3),1,3,5,next)
    if (url === next) return page(nativeRows.slice(3),4,5,5)
    throw Error('HTTP 202')
  }})
  assert.equal(jobs.length,5)
  assert.equal(readInventoryEvidence(jobs).pagesFetched,2)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.ok(jobs.every(j => !j.sourceDetailComplete))
})
test('page cap retains positive rows with explicitly incomplete inventory', async () => {
  const jobs = await bioRad.run({maxPages:1,fetchText: async url => {
    if (url === bioRad.CAREERS_URL) return '<a href="/jobs/search">Search All Jobs</a>'
    if (url === search) return page(nativeRows.slice(0,3),1,3,5,next)
    throw Error('Unavailable detail')
  }})
  assert.equal(jobs.length,3)
  assert.ok(jobs.every(j => j.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for (const [label, second] of [
  ['duplicate identity', () => page([nativeRows[0],nativeRows[4]],4,5,5)],
  ['total drift', () => page(nativeRows.slice(3),4,5,6,`${search}&page=3`)],
  ['range gap', () => page(nativeRows.slice(3),3,4,5,`${search}&page=3`)],
]) test(`rejects paginated ${label}`, async () => {
  await assert.rejects(bioRad.run({fetchText: async url => url === bioRad.CAREERS_URL ? '<a href="/jobs/search">Search All Jobs</a>' : url === search ? page(nativeRows.slice(0,3),1,3,5,next) : second()}))
})
test('rejects changed country/search scope and missing terminal continuation', () => {
  assert.throws(() => bioRad.parseBioRadListing(page(nativeRows.slice(0,3),1,3,5,`${next}&query=other`),search))
  assert.throws(() => bioRad.parseBioRadListing(page(nativeRows.slice(0,3),1,3,5),search))
})
test('only explicit current zero rows and zero count can certify an empty India inventory', async () => {
  const jobs = await bioRad.run({fetchText: async url => url === bioRad.CAREERS_URL ? '<a href="/jobs/search">Search All Jobs</a>' : page([],0,0,0)})
  assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
  await assert.rejects(bioRad.run({fetchText: async url => url === bioRad.CAREERS_URL ? '<a href="/jobs/search">Search All Jobs</a>' : '<h1>Service unavailable</h1>'}))
})
const withDescription = description => {
  let h = fixture.detail.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(_,a,b,c) => {const m=JSON.parse(b);m.description=description;return a+JSON.stringify(m).replaceAll('<','\\u003c')+c})
  const start = h.indexOf('<div id="job_description_'), end = h.indexOf('\n<turbo-frame',start)
  assert.ok(start > 0 && end > start)
  return h.slice(0,start)+`<div class="job-description">${description}</div>`+h.slice(end)
}
test('empty or inactive native descriptions remain incomplete without a teaser fallback', () => {
  for (const description of ['', '<script>fake content</script>', '<template><p>fake description</p></template>', '<xmp>fake description</xmp>']) {
    const job = bioRad.parseBioRadDetail(withDescription(description),chennai())
    assert.equal(job.jobDescription,null)
    assert.equal(job.sourceDetailComplete,false)
  }
})
test('inactive company token cannot mask a conflicting active tenant', () => {
  const wrong=fixture.detail.replaceAll('8d672184bb3335c103499c3f4bd5a671','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  assert.throws(() => bioRad.parseBioRadDetail(`<template><script>js_vars.company={"uid":"8d672184bb3335c103499c3f4bd5a671"};</script></template>${wrong}`,chennai()))
})
