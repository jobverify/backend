import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as unstop from '../../scraper/unstop/script.js'

const html = () => gunzipSync(readFileSync(new URL('./fixtures/unstop/native-amp-20261029.html.gz', import.meta.url))).toString()
const link = 'https://unstop.com/jobs/business-operations-specialist-unstop-1780828'
const job = () => ({ title: 'Business Operations Specialist', company: 'Unstop', source: 'unstop', location: 'India', link, applyUrl: link })
const response = () => ({ status: 200, url: link + '/amp', html: html() })
const now = new Date('2026-10-29T16:00:00Z')
const mutatePosting = change => html().replace(/(<script[^>]+type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/i,
  (_, start, json, end) => { const posting = JSON.parse(json); change(posting); return start + JSON.stringify(posting) + end })

test('captured Unstop AMP supplies the actual employer role body and earliest published deadline', () => {
  assert.equal(typeof unstop.recoverUnstopRoleDescription, 'function')
  const detail = unstop.recoverUnstopRoleDescription(job(), response(), { now })
  assert.ok(detail)
  assert.match(detail.sourceDescription, /Support day-to-day business operations/)
  assert.match(detail.sourceDescription, /0 to 2 years of experience/)
  assert.doesNotMatch(detail.sourceDescription, /please notify us|Read articles|Featured Opportunities|<script/)
  assert.equal(detail.closingDate, '2026-11-10T18:29:00.000Z')
  assert.equal(detail.postingDate, '2026-10-26T18:30:00.000Z')
})

for (const [label, change] of [
  ['title', p => { p.title = 'Different role' }],
  ['employer', p => { p.hiringOrganization.name = 'Different employer' }],
  ['native role URL', p => { p.url = 'https://unstop.com/jobs/other-unstop-999999' }],
  ['country', p => { p.jobLocation.address.addressCountry = 'United States' }],
  ['malformed posting date', p => { p.datePosted = 'unknown' }],
  ['malformed native deadline', p => { p.validThrough = 'unknown' }],
]) test('Unstop rejects a conflicting ' + label, () => {
  assert.equal(unstop.recoverUnstopRoleDescription(job(), { ...response(), html: mutatePosting(change) }, { now }), null)
})

test('Unstop rejects HTTP redirects, duplicate role metadata and contentless native details', () => {
  assert.equal(unstop.recoverUnstopRoleDescription(job(), { ...response(), status: 403 }, { now }), null)
  assert.equal(unstop.recoverUnstopRoleDescription(job(), { ...response(), url: 'https://unstop.com/' }, { now }), null)
  const posting = html().match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i)[0]
  assert.equal(unstop.recoverUnstopRoleDescription(job(), { ...response(), html: html() + posting }, { now }), null)
  const empty = html().replace(/(<div class="default-editor">)[\s\S]*?(<\/div>)/, '$1<p>&nbsp;</p>$2')
  assert.equal(unstop.recoverUnstopRoleDescription(job(), { ...response(), html: empty }, { now }), null)
})

test('Unstop retains verified content and facts for older native dates without declaring publication eligibility', () => {
  for (const change of [p => { p.datePosted = '2026-08-01T00:00:00Z' },
    p => { p.datePosted = '2027-01-01T00:00:00Z' }, p => { p.validThrough = '2026-10-01T00:00:00Z' }]) {
    const detail = unstop.recoverUnstopRoleDescription(job(), { ...response(), html: mutatePosting(change) }, { now })
    assert.ok(detail)
    assert.match(detail.sourceDescription, /Support day-to-day/)
    assert.equal(detail.sourceDateEvidence, 'unstop-canonical-amp-jobposting-and-visible-deadline-v1')
  }
})

test('Unstop run hydrates only verified role details while preserving its listing identity', async () => {
  const careers = '<link rel="canonical" href="https://unstop.com/about/unstop-careers"><h2>Opportunities at Unstop</h2>'
    + '<a href="' + link + '">Business Operations Specialist</a>'
  const jobs = await unstop.run({ now: () => now.toISOString(), fetchPage: async url => url === unstop.CAREERS_PAGE_URL
    ? { status: 200, url, html: careers } : response() })
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].sourceDescription, /Support day-to-day/)
  assert.equal(jobs[0].sourceUrl, link)
  assert.equal(jobs[0].link, link)
  assert.equal(jobs[0].closingDate, '2026-11-10T18:29:00.000Z')
})
