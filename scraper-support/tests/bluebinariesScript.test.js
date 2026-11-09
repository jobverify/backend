import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch = async () => { throw new Error('OFFLINE Blue Binaries source-family tripwire') }
const {
  CAREER_PAGE_URL,
  extractJobEntries,
  isIndiaLocation,
} = await import('../../scraper/bluebinaries/script.js')

const listingHtml = `
  <html>
    <body>
      <div class="acc-job-post">
        <div class="job-details" data-attribute="sd">
          <div class="job-role">
            <h3>Software Developer</h3>
            <span>Posted on 01-Mar-2024</span>
          </div>
          <div class="job-location">
            <span>BlueBinaries Engineering and Solutions India Pvt Ltd, Chennai, India</span>
          </div>
        </div>
        <div class="job-requirements" id="sd">
          <p>Job Duties:</p>
          <ul>
            <li>Build embedded software systems</li>
            <li>Collaborate with cross-functional teams</li>
          </ul>
        </div>
      </div>
      <div class="acc-job-post">
        <div class="job-details" data-attribute="qa">
          <div class="job-role">
            <h3>Quality Engineer</h3>
            <span>Posted on 04-Oct-2023</span>
          </div>
          <div class="job-location">
            <span>BlueBinaries Engineering and Solutions Inc., Troy, MI</span>
          </div>
        </div>
        <div class="job-requirements" id="qa">
          <p>Job Duties:</p>
          <ul>
            <li>Lead quality validation activities</li>
          </ul>
        </div>
      </div>
    </body>
  </html>
`

test('CAREER_PAGE_URL keeps the Blue Binaries scraper on the official careers page', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.bluebinaries.com/become-a-bluebee/')
})

test('isIndiaLocation identifies India-based Blue Binaries roles', () => {
  assert.equal(
    isIndiaLocation('BlueBinaries Engineering and Solutions India Pvt Ltd, Chennai, India'),
    true,
  )
  assert.equal(isIndiaLocation('BlueBinaries Engineering and Solutions Inc., Troy, MI'), false)
  assert.equal(isIndiaLocation('Chennai'), false)
  assert.equal(isIndiaLocation('Fort Wayne, IN'), false)
  assert.equal(isIndiaLocation('BlueBinaries India Pvt Ltd, Troy, MI'), false)
})

test('extractJobEntries preserves complete native role identity, criteria and publication without invented application fields', () => {
  const jobs = extractJobEntries(listingHtml)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(job => job.jobId), ['sd', 'qa'])
  const [india, unprovenCountry] = jobs
  assert.equal(india.title, 'Software Developer')
  assert.equal(india.company, 'Blue Binaries')
  assert.equal(india.country, 'India')
  assert.equal(india.city, 'Chennai')
  assert.equal(india.sourceUrl, 'https://www.bluebinaries.com/become-a-bluebee/#sd')
  assert.equal(india.applicationPostingContext.nativePostingId, 'sd')
  assert.equal(india.requisitionId, null)
  assert.equal(india.sourceIdentityComplete, true)
  assert.equal(india.sourceDetailComplete, true)
  assert.equal(india.postingDate, '2024-03-01')
  assert.equal(india.sourceNativeDates.publicationLabel, 'Posted on 01-Mar-2024')
  assert.match(india.jobDescription, /Build embedded software systems/)
  assert.match(india.jobDescription, /Collaborate with cross-functional teams/)
  assert.equal(india.sourceDescription, india.jobDescription)
  assert.equal(india.applyUrl, null)
  assert.equal(india.applicationPublicContextValidated, false)
  assert.equal(india.employmentType, null)
  assert.equal(india.remoteStatus, null)
  assert.equal(unprovenCountry.title, 'Quality Engineer')
  assert.equal(unprovenCountry.country, null)
  assert.equal(unprovenCountry.sourceNativeCountryEvidence.basis, null)
  assert.equal(unprovenCountry.requisitionId, null)
  assert.equal(unprovenCountry.postingDate, '2023-10-04')
  assert.equal(unprovenCountry.sourceIdentityComplete, true)
  assert.equal(unprovenCountry.sourceDetailComplete, true)
  assert.match(unprovenCountry.jobDescription, /Lead quality validation activities/)
})
