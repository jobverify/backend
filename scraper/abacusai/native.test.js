import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { collect, inspectHomepage, inspectRoleObservations, HOMEPAGE_URL, CAREERS_URL } from './native.js'
import { fixture, replay } from './test-data/fixture.mjs'
import { readInventoryEvidence, isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { decorateJobsWithProviderMetadata } from '../../scraper-support/providers/index.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
const sha = text => createHash('sha256').update(text).digest('hex')
const homepage = fixture.packets[0].body, html = fixture.packets[1].body

test('captured raw role criteria match independently frozen paragraph and list text', () => {
  for (const packet of fixture.packets) {
    assert.equal(packet.status, 200)
    assert.equal(Buffer.byteLength(packet.body), packet.bytes)
    assert.equal(sha(packet.body), packet.sha256)
  }
  const observations = inspectRoleObservations(html)
  assert.equal(observations.length, 3)
  for (const [index, row] of observations.entries()) {
    assert.equal(row.title, fixture.expectedRoles[index].title)
    assert.equal(sha(row.descriptionText), fixture.expectedRoles[index].descriptionSHA256)
    assert.deepEqual(row.descriptionBlocks.map(block => block.text), fixture.expectedRoles[index].descriptionBlocks)
    assert.equal(row.nativeJobId, null)
    assert.equal(row.legalEmployer, null)
    assert.equal(row.country, null)
    assert.equal(row.location, null)
    assert.equal(row.publicationDate, null)
    assert.equal(row.layoutQualified, false)
    assert.equal(row.qualifiedForPublicCriteria, false)
  }
})

test('native collection keeps raw observations and null authority instead of a verified empty inventory', async () => {
  const options = replay(), jobs = await collect(options)
  assert.deepEqual(options.requested, [HOMEPAGE_URL, CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.deepEqual(readSourceObservationEvidence(jobs, 'abacusai'), {
    source: 'abacusai', recordKind: 'vacancy-rows', observedRecordCount: 3, observedVacancyCount: 3,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
  })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.pagesFetched, 2)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: fixture.capture.completedAt }), false)
  assert.deepEqual(jobs.nativePrimaryReceipts.packets.map(packet => packet.sha256), fixture.packets.map(packet => packet.sha256))
  assert.equal(jobs.nativePrimaryReceipts.currentRoleAvailabilityProven, false)
  assert.equal(jobs.nativePrimaryReceipts.httpInterface, 'injected-http-interface')
  assert.equal(jobs.nativePrimaryReceipts.clockInjected, true)
})

test('provider and normalizer retain unknown countries and withhold all raw criteria from public fields', async () => {
  const jobs = await collect(replay())
  const provider = { source: 'abacusai', companyName: 'Abacus.AI', countryFilter: 'India',
    companyCountry: 'India', companyDomain: 'abacus.ai', companyCareerPage: CAREERS_URL }
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  const normalized = decorated.map(job => normalizeScrapedJob(job, provider))
  for (const job of [...jobs, ...decorated, ...normalized]) {
    assert.equal(job.country, null)
    assert.equal(job.location, null)
    assert.equal(job.jobId, null)
    assert.equal(job.requisitionId, null)
    assert.equal(job.nativeLegalEmployer, null)
    assert.ok(!job.jobDescription)
    assert.ok(!job.sourceDescription)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceAvailabilityEvidence, undefined)
    assert.ok(job.nativeRoleObservation.descriptionText.length > 400)
  }
  for (const rows of [jobs, decorated, normalized]) assert.equal(analyzePublishableJobs(rows).eligibleJobs.length, 0)
  assert.equal(readInventoryEvidence(decorated).indiaFacetCount, null)
})

for (const [name, change] of [
  ['wrong primary brand', value => value.replace('content="Abacus.AI"', 'content="Different employer"')],
  ['wrong primary title', value => value.replace('Abacus.AI - Careers &amp; Jobs', 'Another Company Jobs')],
  ['wrong primary domain', value => value.replace('property="og:url" content="https://abacus.ai"', 'property="og:url" content="https://unrelated.example"')],
  ['missing role heading', value => value.replace('class="jobs-job-title"', 'class="unrelated-title"')],
  ['foreign application email', value => value.replace('mailto:jobs@abacus.ai', 'mailto:jobs@unrelated.example')],
  ['missing authored criteria', value => value.replaceAll(/jobs-job-(?:description|requirements|list)/g, 'unrelated-content')],
  ['missing role cards', value => value.replaceAll('class="jobs-job"', 'class="unrelated-card"')],
  ['hidden role cards', value => value + '<style>.jobs-job { display:none }</style>'],
]) test('native role observations reject ' + name, () => {
  const changed = change(html)
  assert.notEqual(changed, html, 'Control must mutate the frozen source')
  assert.throws(() => inspectRoleObservations(changed))
})

test('duplicate native titles without native IDs are ambiguous rather than fabricated vacancy identities', () => {
  const card = html.match(/<div class="jobs-job">[\s\S]*?<\/div>/)?.[0]
  assert.ok(card)
  assert.throws(() => inspectRoleObservations(html.replace(card, card + card)), /duplicate/)
})

test('an absent or inert primary jobs link cannot activate the native jobs request', async () => {
  const pattern = /<a\b[^>]*href="\/jobs"[^>]*>[\s\S]*?<\/a>/g
  assert.equal([...homepage.matchAll(pattern)].length, 4)
  for (const changed of [homepage.replaceAll(pattern, ''), homepage.replaceAll(pattern, link => '<template>' + link + '</template>'),
    homepage.replaceAll(pattern, link => link.replace('<a ', '<a style="display:none" '))]) {
    assert.throws(() => inspectHomepage(changed), /handoff/)
    const options = replay((body, url) => url === HOMEPAGE_URL ? changed : body)
    await assert.rejects(collect(options), /handoff/)
    assert.deepEqual(options.requested, [HOMEPAGE_URL])
  }
})

test('removing one hidden legacy jobs anchor preserves the independent active handoff', async () => {
  const first = homepage.match(/<a\b[^>]*href="\/jobs"[^>]*>[\s\S]*?<\/a>/)?.[0]
  assert.ok(first)
  const changed = homepage.replace(first, '')
  assert.equal(inspectHomepage(changed).careersURL, CAREERS_URL)
  const options = replay((body, url) => url === HOMEPAGE_URL ? changed : body)
  assert.equal((await collect(options)).length, 3)
  assert.deepEqual(options.requested, [HOMEPAGE_URL, CAREERS_URL])
})

test('native inline scripts and unrelated frames remain inert and cause no extra HTTP calls', async () => {
  const sentinel = '__abacusNativeScriptMustRemainData__'
  delete globalThis[sentinel]
  const options = replay(body => body + `<script>globalThis.${sentinel}=true</script><iframe src="https://unrelated.example/jobs"></iframe>`)
  const jobs = await collect(options)
  assert.equal(globalThis[sentinel], undefined)
  assert.equal(jobs.length, 3)
  assert.deepEqual(options.requested, [HOMEPAGE_URL, CAREERS_URL])
})

test('India mentions and closure copy remain unqualified raw observations', () => {
  const changed = html.replace('Responsible for coming up', 'This role is closed. Our India office is hiring. Responsible for coming up')
  const rows = inspectRoleObservations(changed)
  assert.equal(rows.length, 3)
  assert.equal(rows[0].country, null)
  assert.equal(rows[0].nativeJobId, null)
  assert.equal(rows[0].publicationDate, null)
  assert.equal(rows[0].qualifiedForPublicCriteria, false)
  assert.match(rows[0].descriptionText, /This role is closed/)
})
