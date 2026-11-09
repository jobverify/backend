import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { inspectRoleObservations, collect, HOMEPAGE_URL, CAREERS_URL } from './native.js'
import { fixture, response } from './test-data/fixture.mjs'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'

// Public /jobs response captured 2026-11-05T02:42:18.042Z. The v2 redesign
// places role content inside v2-job__body rather than direct legacy children.
const html = gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261105.html.gz', import.meta.url))).toString('utf8')

test('Abacus v2 nested role bodies retain authored paragraphs and criteria lists', () => {
  const rows = inspectRoleObservations(html)
  assert.deepEqual(rows.map(row => row.title), [
    'Research Scientist', 'Software Engineer - Generative AI',
    'Junior Sales Development Representative (Jr SDR)',
  ])
  assert.deepEqual(rows[0].descriptionBlocks.map(block => block.tag), ['p', 'p', 'ul', 'p'])
  assert.equal(rows[0].descriptionBlocks[0].text,
    'Responsible for coming up with new techniques in Generative AI that push the boundaries on what is possible with LLMs.')
  assert.equal(rows[0].descriptionBlocks[2].text,
    'LLM tuning techniques LLM Evaluation frameworks Reinforcement Learning to improve Agentic Loops')
  assert.equal(rows[0].descriptionBlocks[3].text,
    'Ideal candidates would be experienced at publishing at top conferences and be able to write code and ideate with the product team.')
  assert.deepEqual(rows[1].descriptionBlocks.map(block => block.tag), ['p', 'p', 'ul'])
  assert.match(rows[1].descriptionBlocks[0].text, /You will play a pivotal role in developing groundbreaking features/)
  assert.equal(rows[1].descriptionBlocks[2].text,
    'Good programming skills Ability to use AI to uplevel yourself for skill and productivity High degree of agency and ownership')
  assert.deepEqual(rows[2].descriptionBlocks.map(block => block.tag), ['p', 'p', 'ul'])
  assert.match(rows[2].descriptionBlocks[2].text, /Interest in technology and SaaS solutions$/)
  for (const row of rows) {
    assert.doesNotMatch(row.descriptionText, /Apply now|Join a high performing/)
    assert.equal(row.country, null)
    assert.equal(row.publicationDate, null)
    assert.equal(row.nativeJobId, null)
    assert.equal(row.qualifiedForPublicCriteria, false)
  }
})

test('Abacus v2 collection preserves real role evidence without inventing India or empty authority', async () => {
  const jobs = await collect({ now: () => new Date('2026-11-05T02:42:18.042Z'), fetchImpl: async url => {
    assert.ok([HOMEPAGE_URL, CAREERS_URL].includes(url))
    return response(url === CAREERS_URL ? html : fixture.packets[0].body, url)
  } })
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => job.nativeRoleObservation.descriptionText.length > 400))
  assert.ok(jobs.every(job => job.country === null && job.jobDescription === null && job.sourceDescription === null))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length, 0)
})

test('Abacus v2 criteria do not recover missing or hidden bodies from unrelated content', () => {
  for (const changed of [
    html.replaceAll('class="v2-job__body"', 'class="unrelated-body"'),
    html.replaceAll('class="v2-job__body"', 'class="v2-job__body" hidden'),
    html.replaceAll('class="v2-job__body"', 'class="v2-job__body" style="display:none"'),
  ]) assert.throws(() => inspectRoleObservations(changed), /criteria missing/)
})
