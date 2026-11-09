import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createAxisEnergyScraper,
  extractListings,
  pageIndicatesJobs,
} from './script.js'

const listingsHtml = `
<title>Career - Axis Energy</title>
<h2>Interested to join Axis</h2>
<h2>Current Opening's</h2>
<div class="job-listing">
  <div class="job-header">
    <div class="job-title">Manager&ndash; Electrical Engineering</div>
    <button class="view-button">View Details</button>
  </div>
  <div class="job-details">
    <p><strong>Position:</strong> Manager &ndash; Electrical Engineering</p>
    <p><strong>Location:</strong> Hyderabad</p>
    <p><strong>Reporting to:</strong> Head &ndash; Electrical Engineering</p>
    <p><strong>Qualification &amp; Experience</strong></p>
    <p>Qualification: B.E. / M.E. in Electrical Engineering</p>
    <p>Experience: 8&ndash;10 years in wind farm electrical design.</p>
    <p>Develop and manage project designs.</p>
    <a class="elementor-button" href="#elementor-action">Apply For Job</a>
  </div>
</div>
`

test('extractListings parses Axis Energy job listing blocks', () => {
  assert.equal(pageIndicatesJobs(listingsHtml), true)
  assert.deepEqual(extractListings(listingsHtml), [{
    title: 'Manager - Electrical Engineering',
    company: 'Axis Energy',
    department: 'Electrical Engineering',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'axisenergy-manager-electrical-engineering',
    requisitionId: 'axisenergy-manager-electrical-engineering',
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: CAREER_PAGE_URL,
    employmentType: null,
    experienceRequired: '8-10 years in wind farm electrical design.',
    minimumQualification: 'B.E. / M.E. in Electrical Engineering',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Position: Manager - Electrical Engineering Location: Hyderabad Reporting to: Head - Electrical Engineering Qualification & Experience Qualification: B.E. / M.E. in Electrical Engineering Experience: 8-10 years in wind farm electrical design. Develop and manage project designs. Apply via the Axis Energy careers page.',
  }])
})

test('run decorates Axis Energy jobs for persistence', async () => {
  const jobs = await createAxisEnergyScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREER_PAGE_URL)
      return listingsHtml
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'axisenergy')
  assert.equal(jobs[0].link, CAREER_PAGE_URL)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run rejects an Axis Energy page without the expected job listings', async () => {
  await assert.rejects(
    createAxisEnergyScraper().run({
      fetchText: async () => '<title>Career - Axis Energy</title><h2>Interested to join Axis</h2>',
    }),
    /no longer exposes the expected job listing blocks/,
  )
})
