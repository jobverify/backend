import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { run } from './script.js'
import { JOBS_URL } from './employerLinkedIn.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-native-packets.json', import.meta.url), 'utf8'))
const target = 'https://in.linkedin.com/jobs/view/product-designer-at-baazi-games-4483015842'
const exercise = (changes = {}, customPackets = packets) => run({
  now: () => '2026-10-31T06:00:00.000Z',
  fetchPage: async url => {
    assert.equal(typeof customPackets[url], 'string', 'Uncaptured native URL: ' + url)
    return { status: 200, url, html: changes[url] ?? customPackets[url] }
  },
})
const mutateSchema = change => packets[target].replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (all, open, body, close) => {
  const value = JSON.parse(body)
  if (value['@type'] === 'JobPosting') change(value)
  return open + JSON.stringify(value) + close
})
const cardLocation = location => {
  const html = packets[JOBS_URL]
  const starts = [...html.matchAll(/<div\b[^>]*data-entity-urn=["']urn:li:jobPosting:(\d+)["'][^>]*>/gi)]
  const index = starts.findIndex(match => match[1] === '4483015842')
  const start = starts[index].index, end = starts[index + 1]?.index ?? html.length
  return html.slice(0, start) + html.slice(start, end).replaceAll('Delhi, India', location) + html.slice(end)
}

test('Baazi retains native Delhi context and uses the explicit New Delhi JD workplace as a one-way refinement', async () => {
  const jobs = await exercise()
  const job = jobs.find(row => row.jobId === '4483015842')
  assert.equal(jobs.length, 6)
  assert.equal(job.city, 'New Delhi')
  assert.equal(job.state, 'Delhi')
  assert.equal(job.location, 'New Delhi, Delhi, India')
  assert.equal(job.country, 'India')
  assert.equal(job.sourceWorkplaceEvidence.kind, 'native-jd-workplace-refinement')
  assert.equal(job.sourceWorkplaceEvidence.listingLocation, 'Delhi, India')
  assert.equal(job.sourceWorkplaceEvidence.schemaAddress.addressLocality, 'Delhi')
  assert.deepEqual(job.sourceWorkplaceEvidence.jdWorkplaces, ['New Delhi'])
  assert.match(job.sourceWorkplaceEvidence.referenceUrl, /^https:\/\/dmnewdelhi\.delhi\.gov\.in\//)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(job.sourceListingComplete, false)
})

test('Baazi applies the same native country-qualified containment to another otherwise valid role', async () => {
  const renamed = Object.fromEntries(Object.entries(packets).map(([url, html]) => [
    url.replaceAll('4483015842', '4483015843').replaceAll('product-designer-at-baazi-games', 'interface-designer-at-baazi-games'),
    html.replaceAll('4483015842', '4483015843').replaceAll('product-designer-at-baazi-games', 'interface-designer-at-baazi-games').replaceAll('Product Designer', 'Interface Designer'),
  ]))
  const jobs = await exercise({}, renamed)
  const job = jobs.find(row => row.jobId === '4483015843')
  assert.equal(job.title, 'Interface Designer')
  assert.equal(job.city, 'New Delhi')
  assert.equal(job.sourceWorkplaceEvidence.schemaAddress.addressLocality, 'Delhi')
})

test('Baazi refuses the reverse refinement from a New Delhi native locality to a Delhi JD workplace', async () => {
  const html = mutateSchema(job => { job.jobLocation.address.addressLocality = 'New Delhi' })
    .replaceAll('Delhi, India', 'New Delhi, India').replaceAll('Location: New Delhi', 'Location: Delhi')
  await assert.rejects(exercise({ [target]: html, [JOBS_URL]: cardLocation('New Delhi, India') }), /JD workplace/)
})

for (const [label, change] of [
  ['foreign country', job => { job.jobLocation.address.addressCountry = 'US' }],
  ['missing native country', job => { delete job.jobLocation.address.addressCountry }],
  ['conflicting native region', job => { job.jobLocation.address.addressRegion = 'Karnataka' }],
]) test('Baazi refuses a Delhi refinement with ' + label, async () => {
  await assert.rejects(exercise({ [target]: mutateSchema(change) }), /India workplace/)
})

for (const place of ['Mumbai', 'Noida', 'New Delhi, United States']) test('Baazi refuses an unrelated or conflicting explicit JD workplace ' + place, async () => {
  await assert.rejects(exercise({ [target]: packets[target].replaceAll('Location: New Delhi', 'Location: ' + place) }), /JD workplace/)
})

test('Baazi does not refine a city from a New Delhi mention without the explicit workplace label', async () => {
  const jobs = await exercise({ [target]: packets[target].replaceAll('Location: New Delhi', 'Office mention: New Delhi') })
  const job = jobs.find(row => row.jobId === '4483015842')
  assert.equal(job.city, 'Delhi')
  assert.equal(job.location, 'Delhi, India')
  assert.equal(job.sourceWorkplaceEvidence, undefined)
})

test('Baazi does not derive the refined workplace from a hidden JD header', async () => {
  const html = mutateSchema(job => { job.description = job.description.replace('&lt;p&gt;Location: New Delhi', '&lt;p hidden&gt;Location: New Delhi') })
    .replace('<p>Location: New Delhi', '<p hidden>Location: New Delhi')
  await assert.rejects(exercise({ [target]: html }), /workplace|proof/i)
})


test('Baazi refuses duplicate explicit JD workplace headers when refining the native locality', async () => {
  const html = packets[target]
    .replaceAll('&lt;p&gt;Location: New Delhi&lt;/p&gt;', '&lt;p&gt;Location: New Delhi&lt;/p&gt;&lt;p&gt;Location: New Delhi&lt;/p&gt;')
    .replaceAll('<p>Location: New Delhi</p>', '<p>Location: New Delhi</p><p>Location: New Delhi</p>')
  await assert.rejects(exercise({ [target]: html }), /JD workplace/)
})
