import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildSearchRequestBody,
  extractSearchResults,
  runSearch,
} from '../../scraper/hashicorp/searchApi.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'hashicorp',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchRequestBody targets the official IBM careers API with country filtering and optional text search', () => {
  const indiaBody = buildSearchRequestBody({
    country: 'India',
    size: 100,
    from: 200,
  })

  assert.equal(indiaBody.appId, 'careers')
  assert.equal(indiaBody.post_filter.term.field_keyword_05, 'India')
  assert.equal(indiaBody.size, 100)
  assert.equal(indiaBody.from, 200)
  assert.deepEqual(indiaBody.query.bool.must, [])
  assert.deepEqual(indiaBody.sm, { query: '', lang: 'zz' })

  const hashicorpBody = buildSearchRequestBody({
    query: 'hashicorp',
    country: 'India',
    size: 25,
    from: 50,
  })

  assert.equal(
    hashicorpBody.query.bool.must[0].simple_query_string.query,
    'hashicorp',
  )
  assert.equal(hashicorpBody.sm.query, 'hashicorp')
  assert.equal(hashicorpBody.post_filter.term.field_keyword_05, 'India')
})

test('extractSearchResults maps IBM careers search hits into the shared scraper job shape', () => {
  const payload = readJsonFixture('hashicorp-india-search.json')
  const jobs = extractSearchResults(payload, { companyName: 'HashiCorp' })

  assert.equal(jobs.length, 10)
  assert.deepEqual(jobs[0], {
    title: 'Engineering Manager - Hashicorp Vault Cryptosec',
    company: 'HashiCorp',
    department: 'Software Engineering',
    location: 'India',
    city: 'Multiple Cities',
    jobId: '108218',
    requisitionId: '108218',
    sourceUrl: 'https://careers.ibm.com/careers/JobDetail?jobId=108218',
    applyUrl: 'https://careers.ibm.com/careers/JobDetail?jobId=108218',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'As the Engineering Manager for the Vault Cryptosec team, you will lead a new high-performing team responsible for advancing the product’s security, scalability, and enterprise readiness for our self-managed offerings. You will drive Engineering to...',
  })

  assert.equal(jobs[1].location, 'Bangalore, India')
  assert.equal(jobs[1].city, 'Bangalore')
  assert.equal(jobs[1].jobId, '105527')
})

test('runSearch paginates official IBM India results and de-duplicates overlapping hits', async () => {
  const requests = []
  const pageOne = {
    hits: {
      total: { value: 3, relation: 'eq' },
      hits: [
        {
          _source: {
            url: 'https://careers.ibm.com/careers/JobDetail?jobId=1001',
            title: 'Software Engineer',
            description: 'Build internal platforms.',
            field_keyword_05: 'India',
            field_keyword_08: 'Software Engineering',
            field_keyword_19: 'Bangalore, IN',
          },
        },
        {
          _source: {
            url: 'https://careers.ibm.com/careers/JobDetail?jobId=1002',
            title: 'Data Engineer',
            description: 'Scale data pipelines.',
            field_keyword_05: 'India',
            field_keyword_08: 'Data & Analytics',
            field_keyword_19: 'Pune, IN',
          },
        },
      ],
    },
  }
  const pageTwo = {
    hits: {
      total: { value: 3, relation: 'eq' },
      hits: [
        {
          _source: {
            url: 'https://careers.ibm.com/careers/JobDetail?jobId=1002',
            title: 'Data Engineer',
            description: 'Scale data pipelines.',
            field_keyword_05: 'India',
            field_keyword_08: 'Data & Analytics',
            field_keyword_19: 'Pune, IN',
          },
        },
        {
          _source: {
            url: 'https://careers.ibm.com/careers/JobDetail?jobId=1003',
            title: 'DevOps Engineer',
            description: 'Automate deployments.',
            field_keyword_05: 'India',
            field_keyword_08: 'Software Engineering',
            field_keyword_19: 'Hyderabad, IN',
          },
        },
      ],
    },
  }

  const jobs = await runSearch({
    source: 'hashicorp',
    companyName: 'HashiCorp',
    pageSize: 2,
    fetchJson: async (_url, options) => {
      const body = JSON.parse(options.body)
      requests.push(body)
      return body.from === 0 ? pageOne : pageTwo
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(requests[0].from, 0)
  assert.equal(requests[1].from, 2)
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => job.jobId),
    ['1001', '1002', '1003'],
  )
  assert.ok(jobs.every((job) => job.source === 'hashicorp'))
  assert.ok(jobs.every((job) => job.company === 'HashiCorp'))
})


test('HashiCorp requests and preserves the full public indexed role body instead of the shortened search snippet', () => {
  assert.ok(buildSearchRequestBody()._source.includes('body'))
  const payload = readJsonFixture('hashicorp-india-search.json')
  payload.hits.hits[0]._source.body = 'HashiCorp needs a Cloud Engineer. Responsibilities include Azure delivery. Required experience: 4 years. India HashiCorp India Private Limited.'
  const [job] = extractSearchResults(payload)
  assert.equal(job.jobDescription, payload.hits.hits[0]._source.body)
  assert.equal(job.publicExperienceChecked, true)
})

test('HashiCorp public search forwards cancellation to its default HTTP transport', async t => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.signal, controller.signal)
    return new Response(JSON.stringify({ hits: { total: 0, hits: [] } }), { headers: { 'Content-Type': 'application/json' } })
  })
  assert.deepEqual(await runSearch({ signal: controller.signal }), [])
})
