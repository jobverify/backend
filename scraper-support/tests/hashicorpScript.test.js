import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { runHashiCorpSearch } from '../../scraper/hashicorp/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'hashicorp',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('runHashiCorpSearch scopes IBM careers search to official HashiCorp roles in India', async () => {
  const payload = readJsonFixture('hashicorp-india-search.json')
  const requests = []

  const jobs = await runHashiCorpSearch({
    fetchJson: async (_url, options) => {
      requests.push(JSON.parse(options.body))
      return payload
    },
  })

  assert.equal(requests.length, 1)
  assert.equal(
    requests[0].query.bool.must[0].simple_query_string.query,
    'hashicorp',
  )
  assert.equal(requests[0].post_filter.term.field_keyword_05, 'India')

  assert.equal(jobs.length, 10)
  assert.equal(jobs[0].company, 'HashiCorp')
  assert.equal(jobs[0].source, 'hashicorp')
  assert.equal(jobs[0].jobId, '108218')
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.ibm.com/careers/JobDetail?jobId=108218',
  )
  assert.ok(jobs.every((job) => job.applyUrl === job.sourceUrl))
  assert.ok(jobs.every((job) => job.location === 'India' || /india/i.test(job.location)))
})
