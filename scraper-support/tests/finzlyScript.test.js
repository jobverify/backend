import assert from 'node:assert/strict'
import test from 'node:test'

const loadFinzlyModule = async () => {
  try {
    return await import('../../scraper/finzly/script.js')
  } catch {
    assert.fail('Expected Finzly scraper module at ../../scraper/finzly/script.js')
  }
}

const emptyJobsMarkdown = `# Finzly - Current Openings

0 current openings

Powered by Workable
`

const jobsMarkdownWithIndiaRole = `# Finzly - Current Openings

1 current opening

- [Senior Platform Engineer](https://apply.workable.com/finzly/j/ABC123/) - Bengaluru, Karnataka, India

Powered by Workable
`

test('extractJobsFromMarkdown parses Workable jobs.md content and understands an empty Finzly board', async () => {
  const finzly = await loadFinzlyModule()

  assert.equal(finzly.LEGACY_WORKABLE_BOARD_URL, 'https://apply.workable.com/finzly/')
  assert.equal(finzly.LEGACY_WORKABLE_FEED_URL, 'https://apply.workable.com/finzly/jobs.md')
  assert.deepEqual(finzly.extractJobsFromMarkdown(emptyJobsMarkdown), [])
})

test('run follows the current native source and forwards caller time and limits', async () => {
  const finzly = await loadFinzlyModule()
  const { finzlyNativeOptions } = await import('./fixtures/finzlyNativeOptions.js')
  const options = finzlyNativeOptions()
  const jobs = await finzly.run({ ...options, maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(finzly.BOARD_URL, 'https://finzly.com/careers/')
  assert.ok(jobs.every(job => job.country === 'India' && job.postingDate === null))
  assert.equal(options.calls.filter(url => /\/wp-json\/wp\/v2\/pages\/\d+$/.test(url)).length, 14)
})
