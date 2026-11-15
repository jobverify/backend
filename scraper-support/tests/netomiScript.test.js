import {replayNative, withReplayClock, nativeFeed, ids, boardURL, feedURL} from '../../scraper/netomi/fixtures/replayNative20261115.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Netomi</title>
  </head>
  <body>
    <main>
      <p>Careers at Netomi</p>
      <h1>Join the team</h1>
      <a href="#roles">View open roles</a>
      <section id="roles">
        <h2>Open roles</h2>
      </section>
    </main>
    <script>
      fetch('https://api.lever.co/v0/postings/netomi?mode=json')
    </script>
  </body>
</html>
`

const referralOnlyHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Netomi</title>
  </head>
  <body>
    <main>
      <h1>We create intelligent experiences for the world&rsquo;s most ambitious companies.</h1>
      <p>New engagements are by referral.</p>
    </main>
  </body>
</html>
`

const sampleLeverJobs = [
  {
    id: '8fa09624-2464-4e19-a56d-2c38323ce49d',
    text: 'Agentic AI Forward Deployment Engineering Lead',
    hostedUrl: 'https://jobs.lever.co/netomi/8fa09624-2464-4e19-a56d-2c38323ce49d',
    applyUrl: 'https://jobs.lever.co/netomi/8fa09624-2464-4e19-a56d-2c38323ce49d/apply',
    createdAt: 1_781_953_756_907,
    categories: {
      location: 'Toronto , Canada',
      team: 'Agentic Delivery',
      department: 'Global Services & Delivery',
      commitment: 'Full-time',
      allLocations: ['Toronto , Canada'],
    },
    country: 'CA',
    workplaceType: 'remote',
    descriptionBodyPlain:
      'About the Role As an Agentic AI Forward Deployment Engineering Lead at Netomi, you will lead enterprise deployments.',
  },
  {
    id: 'ba379f47-091b-4f2d-82d3-e97a0821227e',
    text: 'Agentic Engineer',
    hostedUrl: 'https://jobs.lever.co/netomi/ba379f47-091b-4f2d-82d3-e97a0821227e',
    applyUrl: 'https://jobs.lever.co/netomi/ba379f47-091b-4f2d-82d3-e97a0821227e/apply',
    createdAt: 1_781_165_190_864,
    categories: {
      location: 'Remote - India',
      team: 'Agentic Delivery',
      department: 'Global Services & Delivery',
      commitment: 'Full Time - Remote',
      allLocations: ['Remote - India'],
    },
    country: 'IN',
    workplaceType: 'remote',
    descriptionPlain:
      'About the role We are looking for an Agentic Engineer to build and scale agentic workflows and tools.',
  },
]

const loadNetomiModule = async () => {
  try {
    return await import('../../scraper/netomi/script.js')
  } catch {
    assert.fail('Expected Netomi scraper module at ../../scraper/netomi/script.js')
  }
}

test('Netomi scraper pins the verified first-party careers page and embedded Lever API reference', async () => {
  const netomi = await loadNetomiModule()

  assert.equal(netomi.SOURCE, 'netomi')
  assert.equal(netomi.COMPANY, 'Netomi')
  assert.equal(netomi.OFFICIAL_BRAND_NAME, 'Netomi')
  assert.equal(netomi.HOMEPAGE_URL, 'https://www.netomi.com/')
  assert.equal(netomi.CAREERS_URL, 'https://www.netomi.com/careers')
  assert.equal(netomi.LEVER_BOARD_URL, 'https://jobs.lever.co/netomi')
  assert.equal(netomi.LEVER_API_URL, 'https://api.lever.co/v0/postings/netomi?mode=json')
  assert.equal(netomi.COMPANY_DOMAIN, 'netomi.com')
  assert.equal(netomi.VERIFIED_ON, null)
  assert.equal(netomi.hasOfficialNetomiCareersSignal(officialCareersHtml), true)
  assert.equal(netomi.hasReferralOnlyHomepageSignal(referralOnlyHomepageHtml), true)
  assert.equal(
    netomi.extractLeverApiUrl(officialCareersHtml),
    'https://api.lever.co/v0/postings/netomi?mode=json',
  )
})

test('Netomi extracts the live Lever payload shape into shared scraper job fields without an India-only filter', async () => {
  const netomi = await loadNetomiModule()
  const jobs = netomi.extractLeverJobs(sampleLeverJobs)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Agentic AI Forward Deployment Engineering Lead',
    company: 'Netomi',
    department: 'Agentic Delivery',
    location: 'Toronto, Canada',
    city: 'Toronto',
    country: 'Canada',
    jobId: '8fa09624-2464-4e19-a56d-2c38323ce49d',
    requisitionId: '8fa09624-2464-4e19-a56d-2c38323ce49d',
    sourceUrl: 'https://jobs.lever.co/netomi/8fa09624-2464-4e19-a56d-2c38323ce49d',
    applyUrl: 'https://jobs.lever.co/netomi/8fa09624-2464-4e19-a56d-2c38323ce49d/apply',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-20T11:09:16.907Z',
    closingDate: null,
    jobDescription:
      'About the Role As an Agentic AI Forward Deployment Engineering Lead at Netomi, you will lead enterprise deployments.',
    remoteStatus: 'Remote',
  })
  assert.equal(jobs[1].country, 'India')
  assert.equal(jobs[1].city, null)
  assert.equal(jobs[1].location, 'Remote - India')
  assert.equal(jobs[1].title, 'Agentic Engineer')
})

test('Netomi factory qualifies full original native text models and applies caller caps with closing reserved', async t => {
   const netomi = await loadNetomiModule(), replay = replayNative()
   const jobs = await withReplayClock(t, () => netomi.createNetomiScraper({maxJobs: 1}).run({...replay.options, now: () => '2026-11-15T00:00:00.000Z'}))
   assert.equal(replay.audits[0].observations.length, 21)
   assert.equal(jobs.length, 1)
   assert.equal(jobs[0].jobId, ids[0])
   assert.deepEqual(jobs[0].sourceNativeRecord, nativeFeed.find(row => row.id === ids[0]))
   assert.equal(jobs[0].scrapedAt, '2026-11-15T00:00:00.000Z')
   assert.equal(jobs[0].sourceCorporateBindingQualified, false)
   assert.equal(jobs[0].sourceFormalLegalEntityQualified, false)
   assert.equal(replay.calls.length, 6)
   assert.deepEqual(replay.calls.slice(-2).map(row => row.url), [boardURL, feedURL])
})

test('Netomi exported run retains eight genuine paired native text observations while corporate and one closing remain held', async t => {
   const netomi = await loadNetomiModule(), replay = replayNative()
   const jobs = await withReplayClock(t, () => netomi.run(replay.options))
   assert.equal(jobs.length, 8)
   assert.equal(replay.audits[0].observations.length, 21)
   assert.equal(replay.audits[0].corporateBindingQualified, false)
   assert.equal(replay.audits[0].issues.length, 1)
   assert.ok(jobs.every(row => row.sourceNativeTextComplete && !row.sourceCorporateBindingQualified && !row.sourceScopeComplete && !row.lifecycleCleanupAllowed))
   assert.ok(replay.calls.every(row => !row.url.startsWith('https://api.lever.co/v0/postings/netomi/')))
   assert.ok(replay.calls.every(row => !row.replayReuse))
})

test('Netomi unknown original board/feed authority errors reject with retained receipts rather than inventing zero', async t => {
   const netomi = await loadNetomiModule()
   for (const target of [boardURL, feedURL]) {
     const replay = replayNative({mutate: (url, entity) => url === target ? {...entity, bytes: Buffer.from('{"error":"unavailable"}')} : entity})
     await assert.rejects(() => withReplayClock(t, () => netomi.run(replay.options)), error => {
       assert.equal(error.sourceScopeComplete, false)
       assert.equal(error.lifecycleCleanupAllowed, false)
       assert.equal(error.nativeCollectionEvidence.rawPages.at(-1).url, target)
       return true
     })
   }
})
