import assert from 'node:assert/strict'
import test from 'node:test'

const loadSigtupleModule = async () => {
  try {
    return await import('../../scraper/sigtuple/script.js')
  } catch {
    assert.fail('Expected Sigtuple scraper module at ../../scraper/sigtuple/script.js')
  }
}

const emptyJobsMarkdown = `# Sigtuple - Current Openings

0 current openings

Powered by Workable
`

const jobsMarkdownWithIndiaRole = `# Sigtuple - Current Openings

1 current opening

- [Software Engineer, Platform](https://apply.workable.com/sigtuple/j/3F4D5E6C7B8A9/) - Bengaluru, Karnataka, India

Powered by Workable
`

const jobsMarkdownWithMixedLocations = `# Sigtuple - Current Openings

2 current openings

- [Software Engineer, Platform](https://apply.workable.com/sigtuple/j/3F4D5E6C7B8A9/) - Bengaluru, Karnataka, India
- [Clinical Data Analyst](https://apply.workable.com/sigtuple/j/8A7B6C5D4E3F2/) - London, United Kingdom

Powered by Workable
`

test('archived SigTuple Workable markdown helpers remain available without authorizing current inventory', async () => {
  const sigtuple = await loadSigtupleModule()

  assert.equal(sigtuple.BOARD_URL, 'https://apply.workable.com/sigtuple/')
  assert.equal(sigtuple.JOBS_FEED_URL, 'https://apply.workable.com/sigtuple/jobs.md')
  assert.deepEqual(sigtuple.extractJobsFromMarkdown(emptyJobsMarkdown), [])
  assert.equal(typeof sigtuple.createSigtupleScraper().run, 'function')
})

test('extractJobsFromMarkdown preserves an archived SigTuple row without promoting it to runtime output', async () => {
  const sigtuple = await loadSigtupleModule()

  assert.deepEqual(sigtuple.extractJobsFromMarkdown(jobsMarkdownWithIndiaRole), [{
    title: 'Software Engineer, Platform',
    company: 'Sigtuple',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: '3F4D5E6C7B8A9',
    requisitionId: '3F4D5E6C7B8A9',
    sourceUrl: 'https://apply.workable.com/sigtuple/j/3F4D5E6C7B8A9/',
    applyUrl: 'https://apply.workable.com/sigtuple/j/3F4D5E6C7B8A9/',
    department: null,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  }])

})

test('extractJobsFromMarkdown ignores future non-India Workable rows for Sigtuple', async () => {
  const sigtuple = await loadSigtupleModule()

  assert.deepEqual(
    sigtuple.extractJobsFromMarkdown(jobsMarkdownWithMixedLocations).map((job) => job.title),
    ['Software Engineer, Platform'],
  )
})
