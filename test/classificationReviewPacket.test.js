import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReviewPacket } from '../scripts/classificationReviewPacket.js'

test('blind review includes employer text, excludes predictions, and keeps each company in one split', () => {
  const jobs = Array.from({ length: 120 }, (_, i) => ({
    trialId: `job-${i}`, source: `source-${i}`, company: `Company ${Math.floor(i/2)}`,
    title: ['Software Intern', 'Contract Engineer', 'Graduate Engineer', 'Senior Engineer'][i%4],
    sourceDescription: `Employer vacancy ${i}. Full-time employment. 3 years of engineering experience required.`,
    sourceEmploymentType: 'Full time', sourceUrl: `https://example.com/jobs/${i}`,
    jobType: 'Unspecified', classification: { resolved: { jobType: 'Intern' } },
    prediction: { modelLabel: 'Contract' },
  }))
  const packet = buildReviewPacket(jobs, { seed: 'trial' })
  assert.ok(packet.jobs.length >= 30)
  assert.ok(packet.jobs.length <= 60)
  assert.equal(new Set(packet.jobs.map(job => job.id)).size, packet.jobs.length)
  const companies = new Map()
  for (const job of packet.jobs) {
    assert.ok(job.body.startsWith('Employer vacancy'))
    assert.ok(['development', 'holdout'].includes(job.split))
    assert.equal(Object.hasOwn(job, 'prediction'), false)
    assert.equal(Object.hasOwn(job, 'jobType'), false)
    assert.equal(Object.hasOwn(job, 'classification'), false)
    if (companies.has(job.company)) assert.equal(companies.get(job.company), job.split)
    else companies.set(job.company, job.split)
  }
  assert.deepEqual(buildReviewPacket([...jobs].reverse(), { seed: 'trial' }).jobs.map(job => job.id), packet.jobs.map(job => job.id))
})
