import assert from 'node:assert/strict'
import test from 'node:test'

const loadBullMachinesModule = async () => {
  try {
    return await import('../../scraper/bullmachines/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!doctype html>
<html>
  <body>
    <div class="count flex-end">
      <p>Open Roles</p>
    </div>
    <div id="jar">
      <div class="row mx-auto content">
        <h4 class="jtitle mb1">Channel Development Manager-TA</h4>
        <div class="anr">
          <p>We are seeking a results-driven Channel Development Manager to join with our tractor attachment division. Responsibilities: Identify and recruit new channel partners. Qualifications: Bachelor’s degree in Business Administration, Marketing, or a related field; MBA preferred.</p>
          <div><a href="#applynow" class="cbtn">Apply Now</a></div>
        </div>
      </div>
      <div class="row mx-auto content">
        <h4 class="jtitle mb1">GET - R&amp;D</h4>
        <div class="anr">
          <p>We are looking for a candidate with 0-3 years of experience. Roles &amp; Responsibilities: Preparing reports and documents. Collecting testing and validation reports.</p>
          <div><a href="#applynow" class="cbtn">Apply Now</a></div>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('extractOpenRoles maps public Bull Machines career cards into shared scraper fields', async () => {
  const bullmachines = await loadBullMachinesModule()
  assert.ok(bullmachines)

  const jobs = bullmachines.extractOpenRoles(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Channel Development Manager-TA',
    company: 'Bull Machines',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'channel-development-manager-ta-1',
    requisitionId: null,
    sourceUrl: 'https://www.bullindia.com/career.php#channel-development-manager-ta-1',
    applyUrl: 'https://www.bullindia.com/career.php#applynow',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'We are seeking a results-driven Channel Development Manager to join with our tractor attachment division. Responsibilities: Identify and recruit new channel partners. Qualifications: Bachelor’s degree in Business Administration, Marketing, or a related field; MBA preferred.',
    remoteStatus: null,
  })
  assert.equal(jobs[1].title, 'GET - R&D')
  assert.equal(jobs[1].jobId, 'get-r-and-d-2')
})

test('run fetches the Bull Machines careers page and decorates the extracted jobs', async () => {
  const bullmachines = await loadBullMachinesModule()
  assert.ok(bullmachines)

  const requestedUrls = []
  const scraper = bullmachines.createBullMachinesScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === bullmachines.CAREER_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [bullmachines.CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'bullmachines')
  assert.equal(jobs[0].link, 'https://www.bullindia.com/career.php#applynow')
  assert.equal(jobs[0].company, 'Bull Machines')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
