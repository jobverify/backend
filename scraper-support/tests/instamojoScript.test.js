import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const teamPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Life at Instamojo - Culture, team, jobs, and mojo!</title>
    <link rel="canonical" href="https://www.instamojo.com/company/team/" />
  </head>
  <body>
    <h1>People That Put The Mojo (Magic) In Instamojo</h1>
    <p>Discover the people of Instamojo that power lakhs of Indian eCommerce businesses. Meet the team, apply for roles or just hit us up to have a conversation.</p>
    <p>Apply to open roles or refer folks that are looking to make an impact on thousands of small businesses in India. You can also write to us at careers@instamojo.com.</p>
    <a href="https://recruiterflow.com/instamojo/jobs">Apply here</a>
  </body>
</html>
`

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Instamojo</title>
  </head>
  <body>
    <h2>Check out our job openings here!</h2>
    <script>
      window.jobsList = {"department":[["Growth",[{"apply_link":"instamojo/jobs/136","details":"Bangalore","employment_type":"Full time","job_id":136,"job_name":"Key Account Manager","last_opened":"2023-04-14T09:04:37+0000","remote_type":null}]],["Support",[{"apply_link":"instamojo/jobs/137","details":"Bangalore","employment_type":"Full time","job_id":137,"job_name":"Customer Support Executive","last_opened":"2023-05-02T08:01:56+0000","remote_type":"Remote"}]]],"group":[]};
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/instamojo/script.js')
  } catch {
    assert.fail('Expected Instamojo scraper module at ../../scraper/instamojo/script.js')
  }
}

test('Instamojo constants and validators stay pinned to the verified team page and Recruiterflow board', async () => {
  const instamojo = await loadModule()

  assert.equal(instamojo.COMPANY, 'Instamojo')
  assert.equal(instamojo.SOURCE, 'instamojo')
  assert.equal(instamojo.VERIFIED_ON, '2026-07-16')
  assert.equal(instamojo.HOMEPAGE_URL, 'https://www.instamojo.com/')
  assert.equal(instamojo.CAREERS_PAGE_URL, 'https://www.instamojo.com/company/team/')
  assert.equal(instamojo.JOBS_BOARD_URL, 'https://recruiterflow.com/instamojo/jobs')
  assert.equal(instamojo.VERIFIED_SAMPLE_JOB_URL, 'https://recruiterflow.com/instamojo/jobs/137')
  assert.match(instamojo.VERIFIED_SURFACE_SUMMARY, /public Recruiterflow board/i)
  assert.equal(instamojo.extractJobsBoardUrl(teamPageHtml), instamojo.JOBS_BOARD_URL)
  assert.equal(instamojo.hasOfficialTeamPageSignal(teamPageHtml), true)
  assert.equal(instamojo.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
})

test('extractRecruiterflowJobs maps Instamojo Recruiterflow jobs into India records', async () => {
  const instamojo = await loadModule()
  const jobs = instamojo.extractRecruiterflowJobs(jobsBoardHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Key Account Manager',
      company: 'Instamojo',
      department: 'Growth',
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: '136',
      requisitionId: '136',
      sourceUrl: 'https://recruiterflow.com/instamojo/jobs/136',
      applyUrl: 'https://recruiterflow.com/instamojo/jobs/136',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2023-04-14T09:04:37+0000',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Customer Support Executive',
      company: 'Instamojo',
      department: 'Support',
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: '137',
      requisitionId: '137',
      sourceUrl: 'https://recruiterflow.com/instamojo/jobs/137',
      applyUrl: 'https://recruiterflow.com/instamojo/jobs/137',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2023-05-02T08:01:56+0000',
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
  ])
})

test('run validates the verified Instamojo surface before fetching and decorating Recruiterflow jobs', async () => {
  const instamojo = await loadModule()
  const requestedUrls = []

  const jobs = await instamojo.createInstamojoScraper({
    maxJobs: 1,
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === instamojo.CAREERS_PAGE_URL) return teamPageHtml
      if (url === instamojo.JOBS_BOARD_URL) return jobsBoardHtml

      assert.fail(`Unexpected Instamojo HTML request: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    instamojo.CAREERS_PAGE_URL,
    instamojo.JOBS_BOARD_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'instamojo')
  assert.equal(jobs[0].link, 'https://recruiterflow.com/instamojo/jobs/136')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Instamojo scraper fails closed when the verified team page or Recruiterflow board drifts', async () => {
  const instamojo = await loadModule()

  await assert.rejects(
    instamojo.createInstamojoScraper().run({
      fetchText: async (url) => {
        if (url === instamojo.CAREERS_PAGE_URL) {
          return teamPageHtml.replace('https://recruiterflow.com/instamojo/jobs', 'https://example.com/jobs')
        }

        return jobsBoardHtml
      },
    }),
    /official Instamojo team page/i,
  )

  await assert.rejects(
    instamojo.createInstamojoScraper().run({
      fetchText: async (url) => {
        if (url === instamojo.CAREERS_PAGE_URL) return teamPageHtml
        return '<html><body>Broken board</body></html>'
      },
    }),
    /Recruiterflow jobs board/i,
  )
})
