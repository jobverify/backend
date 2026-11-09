import assert from 'node:assert/strict'
import test from 'node:test'
import { createHappyFoxScraper } from '../../scraper/happyfox/script.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { happyFoxNativeOptions } from './fixtures/happyFoxNativeOptions.js'
const HUB = 'https://www.happyfox.com/jobs/', INDIA = HUB + 'chennai/', USA = HUB + 'us/'
const ROLE = 'https://hiring.happyfox.co/jobs/senior-seo-specialist-chennai/'
const execute = async (mutate = () => {}, settings = {}) => {
  const options = happyFoxNativeOptions(mutate)
  return { jobs: await createHappyFoxScraper().run({ ...options, ...settings }), options }
}
test('HappyFox follows current Astro regional navigation, reconciles all54 native posting URLs and extracts45 India roles', async () => {
  const { jobs, options } = await execute(), evidence = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 45)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 45)
  assert.equal(options.calls.filter(url => url.startsWith('https://hiring.happyfox.co/jobs/')).length, 54)
  assert.equal(options.calls.length, 64)
  assert.ok(options.calls.includes(USA))
  assert.ok(jobs.every(job => job.company === 'HappyFox' && job.country === 'India' && job.sourceDetailComplete))
  assert.ok(jobs.every(job => job.postingDate === null && job.sourcePublicationDateUnavailable && job.requisitionId === null))
  assert.ok(jobs.every(job => job.sourceNativeCountryEvidence.countryEntryUrl === INDIA))
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 54)
  assert.equal(evidence.indiaFacetCount, 45)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === true))
})
test('HappyFox preserves full role-owned responsibilities and qualifications while excluding application controls', async () => {
  const { jobs } = await execute(), first = jobs.find(job => job.sourceUrl === ROLE)
  assert.match(first.sourceDescription, /Technical SEO[\s\S]*Experience with enterprise-level websites[\s\S]*Understanding of user experience/)
  assert.doesNotMatch(first.sourceDescription, /Role-specific questions|Share Link|csrf|Ready to apply/)
  assert.equal(first.applyUrl, ROLE + '#apply-section')
  assert.equal(first.sourceDescription, first.jobDescription)
  assert.equal(first.remoteStatus, 'On-site')
})
test('HappyFox applies output limits after every regional page and all native details, retaining partial evidence', async () => {
  const { jobs, options } = await execute(() => {}, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(options.calls.filter(url => url.startsWith('https://hiring.happyfox.co/jobs/')).length, 54)
  assert.equal(options.calls.length, 64)
  assert.match(readInventoryEvidence(jobs).reason, /source-job-limit/)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
for (const [label, change] of [
  ['native title', packet => { packet.body = packet.body.replace(/(<h1[^>]*class="job-title"[^>]*>)[\s\S]*?(<\/h1>)/, '$1 Other Role $2') }],
  ['native city', packet => { packet.body = packet.body.replace(/(<div[^>]*class="job-meta"[^>]*>[\s\S]*?<span[^>]*>)Chennai/, '$1Bengaluru') }],
  ['reciprocal city route', packet => { packet.body = packet.body.replaceAll('https://www.happyfox.com/jobs/chennai/', 'https://www.happyfox.com/jobs/bengaluru/') }],
  ['native employer', packet => { packet.body = packet.body.replaceAll('Careers at HappyFox', 'Careers at Other Employer') }],
  ['native form target', packet => { packet.body = packet.body.replace('<form ', '<form action="/jobs/other-role/" ') }],
]) test(`HappyFox rejects conflicting ${label}`, async () => {
  await assert.rejects(execute(packet => { if (packet.url === ROLE) change(packet) }), /HappyFox.*(?:identity|title|city|employer|application)/i)
})
test('HappyFox never derives India solely from a city or the configured country filter', async () => {
  await assert.rejects(execute(packet => { if (packet.url === HUB) packet.body = packet.body.replaceAll('Open positions in India', 'Open positions in Europe') }), /HappyFox.*(?:country|India|scope)/i)
})
test('HappyFox rejects a missing native card despite unchanged displayed counts', async () => {
  await assert.rejects(execute(packet => { if (packet.url === INDIA) packet.body = packet.body.replace(/<article\b[^>]*data-job-opening[\s\S]*?<\/article>/, '') }), /HappyFox.*(?:count|inventory)/i)
})
test('HappyFox rejects an unknown local-filter client instead of assuming complete pagination', async () => {
  await assert.rejects(execute(packet => { if (packet.url === INDIA) packet.body = packet.body.replace('o=`all`,s=', 'o=`engineering`,s=') }), /HappyFox.*(?:client|filter)/i)
})
test('HappyFox retains active India roles with missing native descriptions as incomplete records', async () => {
  const { jobs } = await execute(packet => { if (packet.url === ROLE) packet.body = packet.body.replace(/(<div class="prose prose-wrapper">)[\s\S]*?(<\/div>\s*<div class="job-actions)/, '$1$2') })
  const job = jobs.find(job => job.sourceUrl === ROLE)
  assert.ok(job)
  assert.equal(job.jobDescription, null)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('HappyFox retains incomplete evidence for hidden native descriptions without publishing hidden text', async () => {
  const { jobs } = await execute(packet => { if (packet.url === ROLE) packet.body = packet.body.replace('class="prose prose-wrapper"', 'class="prose prose-wrapper" style="display:none"') })
  const job = jobs.find(job => job.sourceUrl === ROLE)
  assert.equal(job.jobDescription, null)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('HappyFox excludes postings removed from the closing current cards', async () => {
  const { jobs } = await execute((packet, index) => { if (packet.url === INDIA && index === 1) packet.body = packet.body
    .replace(/<article\b[^>]*data-job-opening[\s\S]*?<\/article>/, '').replace('22 open positions', '21 open positions') })
  assert.equal(jobs.length, 44)
  assert.ok(!jobs.some(job => job.sourceUrl === ROLE))
  assert.match(readInventoryEvidence(jobs).reason, /closing.*changed/)
})
for (const [page, extra] of [
  [HUB, '<a href="https://jobs.ashbyhq.com/happyfox">Join our team</a>'],
  [INDIA, '<iframe src="https://jobs.ashbyhq.com/happyfox"></iframe>'],
  [INDIA, '<script src="https://jobs.ashbyhq.com/happyfox/embed"></script>'],
]) test(`HappyFox retains partial evidence for additional recruiting scope on ${page}`, async () => {
  const { jobs } = await execute(packet => { if (packet.url === page) packet.body = packet.body.replace('</body>', extra + '</body>') })
  assert.equal(jobs.length, 45)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /additional.*hiring-scope/)
})
test('HappyFox registered catalog extraction preserves native evidence and new hiring-domain jobs', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'happyfox')).run(happyFoxNativeOptions())
  assert.equal(jobs.length, 45)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 45)
})
test('HappyFox propagates cancellation before any request', async () => {
  const options = happyFoxNativeOptions(), controller = new AbortController()
  controller.abort(Error('HappyFox caller cancelled'))
  await assert.rejects(createHappyFoxScraper().run({ ...options, signal: controller.signal }), /caller cancelled/)
  assert.equal(options.calls.length, 0)
})
test('HappyFox retains partial scope for an unassigned additional first-party regional page', async () => {
  const { jobs } = await execute(packet => { if (packet.url === HUB) packet.body = packet.body.replace('</body>', '<a href="/jobs/london/">More locations</a></body>') })
  assert.equal(jobs.length, 45)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /unassigned.*regional/)
})
test('HappyFox retains partial scope for an unreconciled additional native posting link', async () => {
  const { jobs } = await execute(packet => { if (packet.url === INDIA) packet.body = packet.body.replace('</body>', '<a href="https://hiring.happyfox.co/jobs/additional-role/">More roles</a></body>') })
  assert.equal(jobs.length, 45)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /unreconciled.*posting/)
})
test('HappyFox rejects an explicit native country conflict with the assigned regional country', async () => {
  await assert.rejects(execute(packet => { if (packet.url === ROLE) packet.body = packet.body.replace('</main>', '<span class="meta-job-location-country">United States</span></main>') }), /HappyFox.*country/i)
})
test('HappyFox rejects a conflicting native canonical public URL', async () => {
  await assert.rejects(execute(packet => { if (packet.url === ROLE) packet.body = packet.body.replace('</head>', '<meta property="og:url" content="https://hiring.happyfox.co/jobs/other/" /></head>') }), /HappyFox.*(?:URL|identity)/i)
})
for (const change of [
  body => body.replace('data-consent-video-src="https://www.youtube-nocookie.com/embed/Ap5oBUhI7QQ?rel=0"', 'data-consent-video-src="https://jobs.ashbyhq.com/happyfox"'),
  body => body.replace('data-video-embed', 'src="https://jobs.ashbyhq.com/happyfox" data-video-embed'),
]) test('HappyFox does not treat a changed story frame as verified non-recruiting media', async () => {
  const { jobs } = await execute(packet => { if (packet.url === HUB) packet.body = change(packet.body) })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /additional-active-frame-hiring-scope/)
})
test('HappyFox never silently ignores a legacy transport and makes hidden network calls', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => { throw Error('Unintended default network request') }
  try { await assert.rejects(createHappyFoxScraper().run({ fetchText: async () => '' }), /HappyFox.*fetchPage/i) }
  finally { globalThis.fetch = previous }
})
test('HappyFox excludes a regional city assigned conflicting countries by the current hub', async () => {
  const { jobs } = await execute(packet => { if (packet.url === HUB) packet.body = packet.body.replace('</main>', '<a href="https://www.happyfox.com/jobs/hyderabad/">Open positions in Canada</a></main>') })
  assert.equal(jobs.length, 40)
  assert.ok(!jobs.some(job => job.city === 'Hyderabad'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /conflicting-country-binding/)
})
test('HappyFox removes all inferred India scope when the India entry route has a conflicting country binding', async () => {
  const { jobs } = await execute(packet => { if (packet.url === HUB) packet.body = packet.body.replace('</main>', '<a href="https://www.happyfox.com/jobs/chennai/">Open positions in Canada</a></main>') })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
for (const extra of [
  '<a href="https://happyfox.careers-page.com/">Explore opportunities</a>',
  '<script src="https://happyfox.careers-page.com/embed.js"></script>',
]) test('HappyFox retains partial scope for additional Manatal recruiting surfaces', async () => {
  const { jobs } = await execute(packet => { if (packet.url === HUB) packet.body = packet.body.replace('</body>', extra + '</body>') })
  assert.equal(jobs.length, 45)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /additional-public-hiring-scope/)
})
