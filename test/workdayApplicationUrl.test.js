import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeResponseJob } from '../src/controllers/jobController.js'

for (const host of ['hpe.wd5.myworkdayjobs.com', 'example.workdayjobs.com', 'wd5.myworkdaysite.com']) {
  test(`public application links open the Workday job page on ${host}`, () => {
    const base = `https://${host}/en-US/Jobs/job/India/Intern_123`
    for (const field of ['applyUrl', 'sourceUrl']) {
      for (const suffix of ['/apply', '/apply/']) {
        const job = normalizeResponseJob({ [field]: `${base}${suffix}?source=careers#details` })
        assert.equal(job.applicationUrl, `${base}?source=careers#details`)
        assert.equal(job.applicationStatus, 'available')
      }
    }
  })
}

test('other application links and Workday job paths stay intact', () => {
  for (const url of [
    'https://jobs.lever.co/example/123/apply',
    'https://myworkdayjobs.com.example.org/job/123/apply',
    'https://hpe.wd5.myworkdayjobs.com/Jobs/job/India/Intern_123',
    'https://hpe.wd5.myworkdayjobs.com/Jobs/job/apply/Intern_123',
  ]) assert.equal(normalizeResponseJob({ applyUrl: url }).applicationUrl, url)
})
