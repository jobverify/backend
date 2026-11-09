import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html>
  <body>
    <h1>Careers at Mobiloitte That Build Your Future</h1>
    <h2>Current Openings</h2>
    <button>Search Jobs</button>
    <p>Didn't find the right position?</p>
    <p>careers@mobiloitte.com</p>
    <div>No Jobs Found</div>
    <p>We couldn't find any jobs matching your criteria.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/mobiloittetechnologies/script.js')
  } catch {
    assert.fail('Expected Mobiloitte Technologies scraper module at ../../scraper/mobiloittetechnologies/script.js')
  }
}

test('Mobiloitte Technologies accepts the verified no-jobs empty state', async () => {
  const mobiloitte = await loadModule()

  assert.equal(mobiloitte.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(mobiloitte.hasNoJobsFoundState(careersHtml), true)
  assert.deepEqual(
    await mobiloitte.createMobiloitteTechnologiesScraper().run({
      fetchText: async () => careersHtml,
    }),
    [],
  )
})

test('Mobiloitte Technologies can recover with a browser-backed careers page when direct requests are blocked', async () => {
  const mobiloitte = await loadModule()
  const browserUrls = []

  const jobs = await mobiloitte.createMobiloitteTechnologiesScraper().run({
    fetchText: async () => {
      throw new Error(`HTTP 403 for ${mobiloitte.CAREERS_URL}`)
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(browserUrls, [mobiloitte.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

const liveLikeCareersHtml = careersHtml
  .replace('<div>No Jobs Found</div>', '<div class="CurrentOpenings_jobCard__x"><h3 class="CurrentOpenings_jobTitle__x">Interns-Software Engineer</h3><p class="CurrentOpenings_jobDescription__x">Intern software engineer role</p><span>Mobiloitte Delhi Office</span><a href="/careers/JOB000016" class="CurrentOpenings_viewLink__x">View Details</a></div><div class="CurrentOpenings_jobCard__x"><h3 class="CurrentOpenings_jobTitle__x">Sr Business Development Manager</h3><p class="CurrentOpenings_jobDescription__x">AI sales role</p><span>Mobiloitte Delhi Office</span><a href="/careers/JOB000013" class="CurrentOpenings_viewLink__x">View Details</a></div>')
  .replace("<p>We couldn't find any jobs matching your criteria.</p>", '')
const roleDetail = (title, id) => '<html><title>Apply For ' + title + ' At Mobiloitte Technologies India Pvt. Ltd.</title><link rel="canonical" href="https://www.mobiloitte.com/careers/' + id + '"></html>'

test('Mobiloitte Technologies collects first-party Delhi roles from its current careers page', async () => {
  const mobiloitte = await loadModule()
  const jobs = await mobiloitte.run({
    fetchText: async (url) => {
      if (url === mobiloitte.CAREERS_URL) return liveLikeCareersHtml
      if (url.endsWith('/JOB000016')) return roleDetail('Interns-Software Engineer', 'JOB000016')
      if (url.endsWith('/JOB000013')) return roleDetail('Sr Business Development Manager', 'JOB000013')
      throw new Error('Unexpected URL: ' + url)
    },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.deepEqual(jobs.map((job) => job.jobId), ['JOB000016', 'JOB000013'])
  assert.deepEqual(jobs.map((job) => job.title), ['Interns-Software Engineer', 'Sr Business Development Manager'])
  assert.equal(jobs[0].location, 'Delhi, India')
  assert.equal(jobs[0].applyUrl, 'https://www.mobiloitte.com/careers/JOB000016')
  assert.equal(jobs[0].scrapedAt, '2026-10-03T00:00:00.000Z')
})

test('Mobiloitte Technologies rejects a role card without a valid first-party detail link', async () => {
  const mobiloitte = await loadModule()
  await assert.rejects(mobiloitte.run({
    fetchText: async () => liveLikeCareersHtml.replace('/careers/JOB000013', 'https://other.example/job'),
  }), /card|role|link/i)
})
