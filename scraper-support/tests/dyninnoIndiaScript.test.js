import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/dyninnoindia/script.js')
  } catch {
    assert.fail('Expected Dyninno India scraper module at ../../scraper/dyninnoindia/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India Office</title>
  </head>
  <body>
    <h1>India Office</h1>
    <h2>03 Jobs in India</h2>
    <div class="vacancies">
      <div class="vacancy">
        <div class="jobtitle">Remote Freelance Travel Consultant | Dreamport</div>
        <div class="joblocation">India (Global)</div>
        <div class="jobtype">Trevolution</div>
      </div>
      <div class="vacancy">
        <div class="jobtitle">TRAVEL SALES CONSULTANT</div>
        <div class="joblocation">India (Gurugram)</div>
        <div class="jobtype">Trevolution</div>
      </div>
    </div>
    <script>
      var vacancyMapping = {
        "Remote Freelance Travel Consultant | Dreamport": "india",
        "TRAVEL SALES CONSULTANT": "india"
      }
    </script>
  </body>
</html>
`

test('Dyninno India constants stay pinned to the verified first-party office page', async () => {
  const dyninno = await loadModule()

  assert.equal(dyninno.SOURCE, 'dyninnoindia')
  assert.equal(dyninno.COMPANY, 'Dyninno India')
  assert.equal(dyninno.CAREERS_URL, 'https://dyninno.com/en/offices/india/')
  assert.equal(dyninno.hasOfficialCareersSignal(careersHtml), true)
})

test('Dyninno India extracts India office opportunities from the first-party page', async () => {
  const dyninno = await loadModule()

  assert.deepEqual(dyninno.extractIndiaJobs(careersHtml), [
    {
      title: 'Remote Freelance Travel Consultant | Dreamport',
      company: 'Dyninno India',
      department: 'Trevolution',
      location: 'India (Global)',
      city: null,
      state: null,
      country: 'India',
      jobId: 'remote-freelance-travel-consultant-dreamport',
      requisitionId: 'remote-freelance-travel-consultant-dreamport',
      sourceUrl: 'https://dyninno.com/en/offices/india/',
      applyUrl: 'https://dyninno.com/en/offices/india/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
    {
      title: 'TRAVEL SALES CONSULTANT',
      company: 'Dyninno India',
      department: 'Trevolution',
      location: 'India (Gurugram)',
      city: 'Gurugram',
      state: null,
      country: 'India',
      jobId: 'travel-sales-consultant',
      requisitionId: 'travel-sales-consultant',
      sourceUrl: 'https://dyninno.com/en/offices/india/',
      applyUrl: 'https://dyninno.com/en/offices/india/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('Dyninno India run validates the verified office page and decorates public India jobs', async () => {
  const dyninno = await loadModule()
  const jobs = await dyninno.createDyninnoIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'dyninnoindia')
  assert.equal(jobs[0].link, 'https://dyninno.com/en/offices/india/')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})

test('Dyninno India fails closed when the verified office page signal disappears', async () => {
  const dyninno = await loadModule()

  await assert.rejects(
    dyninno.createDyninnoIndiaScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /verified Dyninno India office jobs page/i,
  )
})
