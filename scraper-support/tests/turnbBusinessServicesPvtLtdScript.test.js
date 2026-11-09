import assert from 'node:assert/strict'
import test from 'node:test'

const loadTurnBModule = async () => {
  try {
    return await import('../../scraper/turnbbusinessservicespvtltd/script.js')
  } catch {
    assert.fail('Expected TurnB Business Services Pvt. Ltd scraper module at ../../scraper/turnbbusinessservicespvtltd/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers At TurnB - Business and Data Analytics Company In India</title>
  </head>
  <body>
    <main>
      <h1>Careers at TurnB</h1>
      <p>Why Work with TurnB?</p>
      <p>Join TurnB, where our diverse team of analytical consultants, chartered accountants, and graduates delivers data-driven solutions to elevate businesses.</p>
      <p>We are proud to be a Great Place to Work Certified organization.</p>

      <div class="nav nav-tabs mb-3" id="nav-tab" role="tablist">
        <button class="nav-link active" id="nav-India-tab" data-bs-toggle="tab" data-bs-target="#nav-India" type="button">India</button>
        <button class="nav-link" id="nav-UAE-tab" data-bs-toggle="tab" data-bs-target="#nav-UAE" type="button">UAE</button>
      </div>

      <div class="tab-content" id="nav-tabContent">
        <div class="tab-pane fade active show" id="nav-India" role="tabpanel" aria-labelledby="nav-India-tab">
          <div class="role-card">
            <h3 class="fnt-22">Sales Associate</h3>
            <a href="https://manage.turnb.com/uploads/media/JD- SALES ASSOCIATE6964a2a861441.pdf" class="text-d" target="_blank" download="">
              <button>Know More</button>
            </a>
          </div>

          <div class="cantfind">
            <h3>Can’t find the job you were looking for?</h3>
            <h4>Send your profile to <a href="mailto:careers@turnb.com">careers@turnb.com</a> and we’ll get back to you.</h4>
          </div>
        </div>

        <div class="tab-pane fade" id="nav-UAE" role="tabpanel" aria-labelledby="nav-UAE-tab">
          <div class="role-card">
            <h3 class="fnt-22">Sales and Marketing Manager</h3>
            <a href="https://manage.turnb.com/uploads/media/MARKETING MANAGER _compressed691c4ae89cc81.pdf" class="text-d" target="_blank" download="">
              <button>Know More</button>
            </a>
          </div>

          <div class="cantfind">
            <h3>Can’t find the job you were looking for?</h3>
            <h4>Send your profile to <a href="mailto:reachus@turnb.com">reachus@turnb.com</a> and we’ll get back to you.</h4>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('TurnB validates the verified tabbed careers surface and keeps only India role cards', async () => {
  const turnB = await loadTurnBModule()

  assert.equal(turnB.SOURCE, 'turnbbusinessservicespvtltd')
  assert.equal(turnB.COMPANY, 'TurnB Business Services Pvt. Ltd')
  assert.equal(turnB.CAREERS_URL, 'https://turnb.com/career')
  assert.equal(turnB.INDIA_APPLY_EMAIL, 'careers@turnb.com')
  assert.equal(turnB.hasOfficialCareersSignal(officialCareersHtml), true)

  assert.deepEqual(turnB.extractPublicListings(officialCareersHtml), [
    {
      title: 'Sales Associate',
      company: 'TurnB Business Services Pvt. Ltd',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'turnbbusinessservicespvtltd-sales-associate-india',
      requisitionId: 'turnbbusinessservicespvtltd-sales-associate-india',
      sourceUrl: 'https://manage.turnb.com/uploads/media/JD-%20SALES%20ASSOCIATE6964a2a861441.pdf',
      applyUrl: 'mailto:careers@turnb.com',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      companyCareerPage: 'https://turnb.com/career',
      atsPlatform: 'official-company-careers',
    },
  ])
})

test('TurnB run fetches the official careers page and decorates the India opening for persistence', async () => {
  const turnB = await loadTurnBModule()
  const requestedUrls = []

  const jobs = await turnB.createTurnBScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
    now: () => '2026-07-10T05:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://turnb.com/career'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'turnbbusinessservicespvtltd')
  assert.equal(jobs[0].link, 'mailto:careers@turnb.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T05:30:00.000Z')
})

test('TurnB fails closed when the verified careers page changes unexpectedly', async () => {
  const turnB = await loadTurnBModule()

  await assert.rejects(
    turnB.createTurnBScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified TurnB careers surface/i,
  )
})
