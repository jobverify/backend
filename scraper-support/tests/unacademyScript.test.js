import assert from 'node:assert/strict'
import test from 'node:test'

const loadUnacademyModule = async () => {
  try {
    return await import('../../scraper/unacademy/script.js')
  } catch {
    assert.fail('Expected Unacademy scraper module at ../../scraper/scraper/unacademy/script.js')
  }
}

test('createUnacademyScraper targets the Unacademy Darwinbox host', async () => {
  const { createUnacademyScraper } = await loadUnacademyModule()
  const scraper = createUnacademyScraper()

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://unacademy.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://unacademy.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a67de6108bb994'),
    'https://unacademy.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a67de6108bb994',
  )
})

test('run keeps Unacademy jobs on the hosted Darwinbox routes and decorates the shared runner fields', async () => {
  const { createUnacademyScraper } = await loadUnacademyModule()
  const scraper = createUnacademyScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchJobDetail: async () => { throw new Error('Native detail is unavailable in this listing-only fixture') },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'a67de6108bb994',
            title: 'Lead, Community Management',
            department_name: 'Graphy - Business (GLPL_Graphy-Bus)',
            locations: 'Bangalore, Karnataka\r, India',
            country: 'India',
            emp_type_name: 'FTE',
            experience: '',
            posted_on: '22-Mar-2025',
            jd: 'Please enter job description',
          },
        ],
        job_counts: 1,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Unacademy')
  assert.equal(jobs[0].source, 'unacademy')
  assert.equal(
    jobs[0].applyUrl,
    'https://unacademy.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a67de6108bb994',
  )
  assert.equal(
    jobs[0].link,
    'https://unacademy.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a67de6108bb994',
  )
  assert.equal(jobs[0].location, 'Bangalore, Karnataka , India')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceNativeListingDescription, 'Please enter job description')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.notEqual(jobs[0].publicExperienceChecked, true)
})

test('runStandalone writes Darwinbox dry-run results to the provider jobs.json path', async () => {
  const module = await loadUnacademyModule()
  const savedFiles = []
  const savedDatabases = []

  await module.runStandalone({
    argv: ['node', 'unacademy/script.js', '--dry-run'],
    fetchJobDetail: async () => { throw new Error('Native detail is unavailable in this listing-only fixture') },
    fetchListingPage: async ({ page }) => {
      assert.equal(page, 1)
      return {
        status: 'success',
        data: [
          {
            id: 'a67de6108bb994',
            title: 'Lead, Community Management',
            department_name: 'Graphy - Business (GLPL_Graphy-Bus)',
            locations: 'Bangalore, Karnataka\r, India',
            country: 'India',
            emp_type_name: 'FTE',
            experience: '',
            posted_on: '22-Mar-2025',
            jd: 'Please enter job description',
          },
        ],
        job_counts: 1,
      }
    },
    saveToFile: (jobs, filePath) => {
      savedFiles.push({ jobs, filePath })
    },
    saveToDB: async (jobs, source) => {
      savedDatabases.push({ jobs, source })
    },
  })

  assert.equal(savedFiles.length, 1)
  assert.equal(savedDatabases.length, 0)
  assert.match(savedFiles[0].filePath, /unacademy[\\/]jobs\.json$/)
  assert.equal(savedFiles[0].jobs.length, 1)
  assert.equal(savedFiles[0].jobs[0].jobDescription, null)
  assert.equal(savedFiles[0].jobs[0].sourceNativeListingDescription, 'Please enter job description')
  assert.equal(savedFiles[0].jobs[0].sourceDetailComplete, false)
  assert.notEqual(savedFiles[0].jobs[0].publicExperienceChecked, true)
})
