import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import * as famapp from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = (name) => readFile(new URL('./fixtures/' + name, import.meta.url), 'utf8')
const pages = new Map([
  [famapp.HOMEPAGE_URL, await fixture('homepage.html')],
  [famapp.CAREERS_URL, await fixture('careers.html')],
  [famapp.JOBS_URL, await fixture('jobs.html')],
])
const client = await fixture('jobs-client.js')
const actualGroups = JSON.parse(await fixture('lever-grouped.json'))
const actualPostings = actualGroups.flatMap((group) => group.postings)

const syntheticPosting = (id, overrides = {}) => ({
  ...actualPostings[0], id,
  hostedUrl: 'https://jobs.lever.co/fampay/' + id,
  applyUrl: 'https://jobs.lever.co/fampay/' + id + '/apply',
  ...overrides,
})

const harness = ({ groups = actualGroups, pagePayload, clientText = client, pageOverride } = {}) => {
  const apiCalls = []
  const postings = Array.isArray(groups) ? groups.flatMap((group) => group.postings ?? []) : []
  return {
    apiCalls,
    options: {
      fetchPage: async (url) => {
        const page = { status: 200, url, html: pages.get(url) ?? (
          url.endsWith('/46b0e91d4324e433.js') ? clientText : '/* unrelated client bundle */'
        ) }
        return pageOverride?.(url, page) ?? page
      },
      fetchJson: async (url) => {
        apiCalls.push(url)
        if (url === famapp.LEVER_API_URL) return groups
        if (pagePayload !== undefined) return pagePayload
        const query = new URL(url).searchParams
        return postings.slice(Number(query.get('skip')), Number(query.get('skip')) + Number(query.get('limit')))
      },
      now: () => '2026-10-08T18:15:00.000Z',
    },
  }
}

test('FamApp pages beyond the first 100 postings and reconciles the complete grouped inventory', async () => {
  const postings = Array.from({ length: 101 }, (_, index) => syntheticPosting('synthetic-' + index))
  const mock = harness({ groups: [{ title: 'Business', postings }] })
  const jobs = await famapp.run(mock.options)
  assert.equal(jobs.length, 101)
  assert.deepEqual(mock.apiCalls.slice(1), [famapp.buildLeverPageUrl(0), famapp.buildLeverPageUrl(100)])
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 101)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('FamApp rejects malformed, duplicate, and incomplete Lever inventories', async () => {
  const posting = syntheticPosting('synthetic-one')
  for (const [options, expected] of [
    [{ groups: { postings: [] } }, /grouped inventory contract/i],
    [{ groups: [{ title: 'Business', postings: [posting, posting] }] }, /duplicate posting/i],
    [{ groups: [{ title: 'Business', postings: [posting] }], pagePayload: {} }, /paginated inventory contract/i],
    [{ groups: [{ title: 'Business', postings: [posting] }], pagePayload: [] }, /incomplete inventory/i],
    [{ groups: [{ title: 'Business', postings: [{ ...posting, applyUrl: 'https://jobs.lever.co/other-company/synthetic-one/apply' }] }] }, /posting contract/i],
  ]) {
    await assert.rejects(famapp.run(harness(options).options), expected)
  }
})

test('FamApp requires the verified first-party jobs page and its Fampay Lever client handoff', async () => {
  await assert.rejects(famapp.run(harness({
    clientText: client.replaceAll(famapp.LEVER_API_URL, 'https://api.lever.co/v0/postings/other-company?mode=json'),
  }).options), /no longer exposes the verified Fampay Lever API/i)
  await assert.rejects(famapp.run(harness({
    pageOverride: (url, page) => url === famapp.JOBS_URL ? { ...page, url: 'https://unrelated.example/jobs/' } : page,
  }).options), /verified official jobs page/i)
  await assert.rejects(famapp.run(harness({
    pageOverride: (url, page) => url === famapp.JOBS_URL ? { ...page, status: 503 } : page,
  }).options), /verified official jobs page/i)
})

test('FamApp retains only explicit India postings and keeps complete inventory evidence for zero India matches', async () => {
  const foreign = syntheticPosting('foreign', { country: 'US' })
  const unknownRemote = syntheticPosting('unknown-remote', { country: null, workplaceType: 'remote', categories: { location: 'Remote', team: 'Business' } })
  const india = syntheticPosting('india', { country: 'IN', workplaceType: 'hybrid' })
  const groups = [{ title: 'Business', postings: [foreign, unknownRemote, india] }]
  const jobs = await famapp.run(harness({ groups }).options)
  assert.deepEqual(jobs.map((job) => job.jobId), ['india'])
  assert.equal(jobs[0].remoteStatus, 'Hybrid')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)

  const noIndia = await famapp.run(harness({ groups: [{ title: 'Business', postings: [foreign, unknownRemote] }] }).options)
  assert.deepEqual(noIndia, [])
  assert.equal(readInventoryEvidence(noIndia).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(noIndia).reportedTotal, 2)
  assert.equal(readInventoryEvidence(noIndia).indiaFacetCount, 0)
})

test('FamApp accepts zero openings only after the verified client and both Lever inventories report empty', async () => {
  const mock = harness({ groups: [] })
  const jobs = await famapp.run(mock.options)
  assert.deepEqual(jobs, [])
  assert.equal(mock.apiCalls.length, 2)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})

test('FamApp preserves the complete public description including requirements and closing perks', () => {
  const jobs = famapp.extractIndiaJobs(actualPostings)
  const accounting = jobs.find((job) => job.title === 'Assistant Manager(Controllership)')
  assert.match(accounting.jobDescription, /On the Job/)
  assert.match(accounting.jobDescription, /Semi-Qualified CA \(Inter CA cleared\)/)
  assert.match(accounting.jobDescription, /Perks That Go Beyond the Paycheck/)
  assert.equal(accounting.employmentType, 'Full-time')
  assert.equal(jobs.find((job) => job.title === 'Copy Intern').employmentType, 'Internship')
  assert.equal(jobs.find((job) => job.title === 'Brand Marketing Manager').employmentType, null)
})

test('FamApp decodes public list HTML without losing punctuation or quoted requirements', () => {
  const posting = syntheticPosting('description-example', {
    descriptionPlain: 'Real opening',
    lists: [{ text: 'Requirements', content: '<li>Research &amp; risk &#39;analysis&#39; &ndash; India</li>' }],
    additionalPlain: '',
  })
  assert.equal(famapp.extractIndiaJobs([posting])[0].jobDescription,
    "Real opening\n\nRequirements\n\nResearch & risk 'analysis' – India")
})
