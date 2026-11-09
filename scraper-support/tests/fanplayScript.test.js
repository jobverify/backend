import assert from 'node:assert/strict'
import test from 'node:test'

const LISTING_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Join Our Team</h2>
    <div class="awsm-job-listings awsm-lists">
      <div class="awsm-job-listing-item awsm-list-item" id="awsm-list-item-1597">
        <div class="awsm-job-item">
          <h2 class="awsm-job-post-title">
            <a href="https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer">Full Stack Web Developer</a>
          </h2>
          <div class="awsm-job-specification-wrapper">
            <div class="awsm-job-specification-item awsm-job-specification-job-category"><span class="awsm-job-specification-term">R&amp;D</span></div>
            <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">Bengaluru</span></div>
          </div>
          <div class="awsm-job-more-container"><a class="awsm-job-more" href="https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer">More Details</a></div>
        </div>
      </div>
      <div class="awsm-job-listing-item awsm-list-item" id="awsm-list-item-1888">
        <div class="awsm-job-item">
          <h2 class="awsm-job-post-title">
            <a href="https://fanplayiot.com/?awsm_job_openings=digital-marketing-internship">Digital Marketing &#8211; Internship</a>
          </h2>
          <div class="awsm-job-specification-wrapper">
            <div class="awsm-job-specification-item awsm-job-specification-job-category"><span class="awsm-job-specification-term">R&amp;D</span></div>
            <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">Bengaluru</span></div>
          </div>
          <div class="awsm-job-more-container"><a class="awsm-job-more" href="https://fanplayiot.com/?awsm_job_openings=digital-marketing-internship">More Details</a></div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Full Stack Web Developer</h1>
    <p>By fpadmin / June 13, 2024</p>
    <h3>Job Description</h3>
    <p>We are looking for a Full Stack Developer to produce scalable software solutions.</p>
    <h3>Responsibilities</h3>
    <ul>
      <li>Write effective APIs</li>
      <li>Build features and applications with a mobile responsive design</li>
    </ul>
    <h3>Requirements and skills</h3>
    <ul>
      <li>Proven experience as a Full Stack Developer or similar role</li>
      <li>Degree in Computer Science, Statistics or relevant field</li>
    </ul>
    <p>Job Category: R&amp;D</p>
    <p>Job Type: Full Time</p>
    <p>Job Location: Bengaluru</p>
    <h2>Apply for this position</h2>
  </body>
</html>
`

const loadFanplayModule = async () => {
  try {
    return await import('../../scraper/fanplay/script.js')
  } catch {
    assert.fail('Expected Fanplay scraper module at ../../scraper/fanplay/script.js')
  }
}

test('extractJobCards maps Fanplay WP Job Openings cards from the official careers page', async () => {
  const fanplay = await loadFanplayModule()

  assert.equal(fanplay.CAREERS_URL, 'https://fanplayiot.com/?page_id=834')
  assert.deepEqual(fanplay.extractJobCards(LISTING_HTML), [{
    title: 'Full Stack Web Developer',
    company: 'Fanplay',
    department: 'R&D',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '1597',
    requisitionId: '1597',
    sourceUrl: 'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer',
    applyUrl: 'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  }, {
    title: 'Digital Marketing - Internship',
    company: 'Fanplay',
    department: 'R&D',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '1888',
    requisitionId: '1888',
    sourceUrl: 'https://fanplayiot.com/?awsm_job_openings=digital-marketing-internship',
    applyUrl: 'https://fanplayiot.com/?awsm_job_openings=digital-marketing-internship',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  }])
})

test('extractJobDetail enriches Fanplay detail pages with category, type, location, and description', async () => {
  const fanplay = await loadFanplayModule()

  const detail = fanplay.extractJobDetail(DETAIL_HTML, {
    title: 'Full Stack Web Developer',
    company: 'Fanplay',
    department: 'R&D',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '1597',
    requisitionId: '1597',
    sourceUrl: 'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer',
    applyUrl: 'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })

  assert.deepEqual(detail, {
    title: 'Full Stack Web Developer',
    company: 'Fanplay',
    department: 'R&D',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '1597',
    requisitionId: '1597',
    sourceUrl: 'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer',
    applyUrl: 'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Write effective APIs',
      'Build features and applications with a mobile responsive design',
      'Proven experience as a Full Stack Developer or similar role',
      'Degree in Computer Science, Statistics or relevant field',
    ],
    postingDate: '2024-06-13',
    closingDate: null,
    jobDescription: 'We are looking for a Full Stack Developer to produce scalable software solutions. Write effective APIs Build features and applications with a mobile responsive design Proven experience as a Full Stack Developer or similar role Degree in Computer Science, Statistics or relevant field',
    remoteStatus: 'On-site',
  })
})

test('run fetches Fanplay listing and detail pages and decorates runner fields', async () => {
  const fanplay = await loadFanplayModule()
  const requestedUrls = []

  const jobs = await fanplay.createFanplayScraper().run({
    fetchListingHtml: async () => LISTING_HTML,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer') return DETAIL_HTML
      if (url === 'https://fanplayiot.com/?awsm_job_openings=digital-marketing-internship') return DETAIL_HTML.replace(/Full Stack Web Developer/g, 'Digital Marketing - Internship').replace('Full Time', 'Internship')
      throw new Error(`Unexpected Fanplay URL: ${url}`)
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer',
    'https://fanplayiot.com/?awsm_job_openings=digital-marketing-internship',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'fanplay')
  assert.equal(jobs[0].link, 'https://fanplayiot.com/?awsm_job_openings=full-stack-web-developer')
  assert.equal(jobs[0].scrapedAt, '2026-07-09T12:00:00.000Z')
})
