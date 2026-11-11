import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createVerifiedRecruitmentScraper } from '../scraper-support/utils/verifiedRecruitment.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-navigation-qapita-20261111.json.gz', import.meta.url))))
const pages = new Map(fixture.responses.map(row => {
  assert.equal(createHash('sha256').update(row.html).digest('hex'), row.bodySHA256)
  return [row.requestedURL, { status: row.status, url: row.finalURL, html: row.html }]
}))
const providers = JSON.parse(readFileSync(new URL('../scraper-support/providers/providerExtensions/zz-297-remaining-recruitment-1033.json', import.meta.url)))

test('current Qapita video and review embeds do not consume recruitment navigation requests', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured tests forbid live HTTP'))
  const calls = []
  await assert.rejects(createVerifiedRecruitmentScraper(providers.find(row => row.source === 'qapita')).run({
    fetchPage: async url => {
      calls.push(url)
      return pages.get(url) || { status: 200, url, html: '<h1>Decorative widget</h1>' }
    },
  }), error => error.failureKind === 'coverage_gap')
  assert.deepEqual(new Set(calls), new Set(pages.keys()))
})

const provider = { source: 'example', companyName: 'Example Corporation', companyDomain: 'employer.test',
  companyCareerPage: 'https://employer.test/careers', officialHomepageUrl: 'https://employer.test/careers',
  requireCorporateIdentityMatch: true, allowDeclaredExternalCareersPages: true, discoverRecruitmentLinks: true }
const description = '<p>Design and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const posting = { '@type': 'JobPosting', identifier: { value: 'role-1' }, title: 'Software Engineer',
  hiringOrganization: { name: provider.companyName }, description,
  jobLocation: { address: { addressLocality: 'Bengaluru', addressCountry: 'IN' } } }

for (const [label, url, attributes] of [
  ['an explicitly titled native widget', 'https://hiring-widget.test/embed/example', 'title="Current vacancies"'],
  ['a currently declared careers path', 'https://app.pyjamahr.com/careers?company=Example', ''],
]) test('retains ' + label + ' as recruitment navigation', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Controlled tests forbid live HTTP'))
  const calls = []
  const jobs = await createVerifiedRecruitmentScraper(provider).run({ fetchPage: async requested => {
    calls.push(requested)
    return { status: 200, url: requested, html: requested === provider.companyCareerPage
      ? `<h1>Example Corporation</h1><iframe ${attributes} src="${url.replaceAll('&', '&amp;')}"></iframe>`
      : `<h1>Software Engineer</h1>${description}<script type="application/ld+json">${JSON.stringify({ ...posting, url })}</script>` }
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceUrl, url)
  assert.deepEqual(calls, [provider.companyCareerPage, url])
})

for (const attributes of ['hidden title="Current vacancies"', 'srcdoc="<h1>Careers</h1>" title="Current vacancies"']) {
  test('an inert or srcdoc frame cannot delegate its src through a recruitment label: ' + attributes, async () => {
    const calls = []
    await assert.rejects(createVerifiedRecruitmentScraper(provider).run({ fetchPage: async url => {
      calls.push(url)
      return { status: 200, url, html: `<h1>Example Corporation</h1><iframe ${attributes} src="https://hiring-widget.test/jobs"></iframe>` }
    } }), error => error.failureKind === 'coverage_gap')
    assert.deepEqual(calls, [provider.companyCareerPage])
  })
}
