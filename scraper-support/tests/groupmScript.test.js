import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const loadGroupMModule = async () => {
  try {
    return await import('../../scraper/groupm/script.js')
  } catch {
    assert.fail('Expected GroupM scraper module at ../../scraper/groupm/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Let's build the future together</h1>
      <p>
        We only hire through our careers site and @wppmedia.com or @wpp.com emails.
        No fees, ever.
      </p>
      <section>
        <h2>Your opportunities</h2>
        <a href="https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046626008">APAC</a>
        <a href="https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046626007">EMEA</a>
      </section>
      <footer>© Copyright 2026 WPP Media Limited.</footer>
    </main>
  </body>
</html>
`

const officialCareersHtmlWithNestedApacLabel = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Let's build the future together</h1>
      <p>
        We only hire through our careers site and @wppmedia.com or @wpp.com emails.
        No fees, ever.
      </p>
      <section>
        <a href='https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046746008'>
          <span>North America Open Roles</span>
        </a>
        <a href='https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046626008'>
          <span>APAC Open Roles</span>
        </a>
      </section>
      <footer>© Copyright 2026 WPP Media Limited.</footer>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 901,
      title: 'Associate Director - Creative',
      location: { name: 'Bangalore, India' },
      absolute_url: 'https://job-boards.greenhouse.io/wppmedia/jobs/901',
      departments: [{ name: 'Client Teams' }],
      content: '<p>Lead brand storytelling for regional accounts.</p>',
      updated_at: '2026-07-08T09:00:00Z',
    },
    {
      id: 902,
      title: 'Business Director',
      location: { name: 'Singapore, Singapore' },
      absolute_url: 'https://job-boards.greenhouse.io/wppmedia/jobs/902',
      departments: [{ name: 'Client Teams' }],
      content: '<p>Manage strategic regional growth.</p>',
      updated_at: '2026-07-07T09:00:00Z',
    },
  ],
}

test('GroupM reconciles the documented Greenhouse total without claiming whole-employer completeness', async () => {
  const groupm = await loadGroupMModule()
  const jobs = await groupm.run({ fetchText: async () => officialCareersHtml,
    fetchJson: async () => ({ ...structuredClone(greenhousePayload), meta: { total: 2 } }) })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /whole-groupm-scope-unverified/)
  assert.doesNotMatch(evidence.reason, /configured-continuation-unavailable/)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('a GroupM output cap retains inventory evidence and prevents lifecycle cleanup', async () => {
  const groupm = await loadGroupMModule()
  const payload = structuredClone(greenhousePayload)
  payload.jobs.push({ ...payload.jobs[0], id: 903, absolute_url: 'https://job-boards.greenhouse.io/wppmedia/jobs/903' })
  payload.meta = { total: 3 }
  const jobs = await groupm.run({ maxJobs: 1, fetchText: async () => officialCareersHtml,
    fetchJson: async () => payload })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 3)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.match(readInventoryEvidence(jobs)?.reason, /source-job-limit/)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('GroupM constants stay pinned to the verified WPP Media careers handoff and APAC Greenhouse board', async () => {
  const groupm = await loadGroupMModule()

  assert.equal(groupm.SOURCE, 'groupm')
  assert.equal(groupm.COMPANY, 'GroupM')
  assert.equal(groupm.CAREERS_URL, 'https://www.wppmedia.com/careers')
  assert.equal(
    groupm.APAC_JOBS_BOARD_URL,
    'https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046626008',
  )
  assert.equal(groupm.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    groupm.extractVerifiedJobsBoardUrl(officialCareersHtml),
    'https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046626008',
  )
  assert.equal(
    groupm.extractVerifiedJobsBoardUrl(officialCareersHtmlWithNestedApacLabel),
    'https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046626008',
  )
})

test('GroupM run validates the official careers handoff and keeps only India jobs from the APAC Greenhouse board', async () => {
  const groupm = await loadGroupMModule()
  const requestedUrls = []

  const jobs = await groupm.createGroupMScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, groupm.CAREERS_URL)
      return officialCareersHtml
    },
    fetchJson: async (url, options = {}) => {
      requestedUrls.push(url)
      assert.match(url, /boards-api\.greenhouse\.io\/v1\/boards\/wppmedia\/jobs\?content=true$/i)
      assert.equal(options.method, 'GET')
      return greenhousePayload
    },
  })

  assert.deepEqual(requestedUrls, [
    groupm.CAREERS_URL,
    'https://boards-api.greenhouse.io/v1/boards/wppmedia/jobs?content=true',
  ])
  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-08T09:00:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Associate Director - Creative',
    company: 'GroupM',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/wppmedia/jobs/901',
    applyUrl: 'https://job-boards.greenhouse.io/wppmedia/jobs/901',
    sourceUrl: 'https://job-boards.greenhouse.io/wppmedia/jobs/901',
    source: 'groupm',
    jobId: 901,
    requisitionId: null,
    department: 'Client Teams',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Lead brand storytelling for regional accounts.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
    sourceScopeComplete: false,
    lifecycleCleanupAllowed: false,
  })
})

test('GroupM fails closed when the official WPP Media careers handoff changes', async () => {
  const groupm = await loadGroupMModule()

  await assert.rejects(
    groupm.createGroupMScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /official careers surface changed/i,
  )

  await assert.rejects(
    groupm.createGroupMScraper().run({
      fetchText: async () => officialCareersHtml.replace(
        'https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046626008',
        'https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=9999999999',
      ),
      fetchJson: async () => greenhousePayload,
    }),
    /verified apac jobs handoff changed/i,
  )
})
