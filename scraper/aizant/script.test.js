import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  buildSearchUrl,
  createAizantScraper,
  extractSearchResults,
} from './script.js'

const sampleHtml = `
<html>
  <head>
    <meta property="article:modified_time" content="2025-03-20T05:41:00+00:00" />
  </head>
  <body>
    <div class="fusion-panel">
      <span class="fusion-toggle-heading">Assistant Manager/Dy Manager - Business Development for CMO</span>
      <div id="job-1" class="panel-collapse collapse in">
        <div class="panel-body toggle-content fusion-clearfix">
          <p><strong>Location:</strong> Hyderabad</p>
          <p><strong>Experience:</strong> 5-7 years</p>
          <p>About the Role:</p>
          <p>Drive CMO business development and client relationships.</p>
          <p>Apply Now</p>
        </div>
      </div>
    </div>
    <div class="fusion-panel">
      <span class="fusion-toggle-heading">Executive / Senior Executive - Clinical Operations</span>
      <div id="job-2" class="panel-collapse collapse">
        <div class="panel-body toggle-content fusion-clearfix">
          <p><strong>Location:</strong> Hybrid - Hyderabad</p>
          <p><strong>Experience:</strong> 2-4 years</p>
          <p><strong>Qualifications:</strong> B.Pharm / M.Pharm</p>
          <ul>
            <li>Support BA/BE study coordination.</li>
          </ul>
          <p>Apply Now</p>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('uses the official Aizant hiring page as the search source', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.aizant.com/careers/we-are-hiring/')
  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
})

test('extractSearchResults maps Aizant accordion panels into shared scraper fields', () => {
  const jobs = extractSearchResults(sampleHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Assistant Manager/Dy Manager - Business Development for CMO',
      company: 'Aizant Drug Research Solutions Pvt. Ltd.',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'job-1',
      requisitionId: 'job-1',
      sourceUrl: 'https://www.aizant.com/careers/we-are-hiring/#job-1',
      applyUrl: 'https://www.aizant.com/careers/we-are-hiring/#job-1',
      employmentType: null,
      experienceRequired: '5-7 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-03-20T05:41:00.000Z',
      closingDate: null,
      jobDescription: 'About the Role: Drive CMO business development and client relationships.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Executive / Senior Executive - Clinical Operations',
      company: 'Aizant Drug Research Solutions Pvt. Ltd.',
      department: null,
      location: 'Hybrid - Hyderabad, India',
      city: 'Hybrid - Hyderabad',
      country: 'India',
      jobId: 'job-2',
      requisitionId: 'job-2',
      sourceUrl: 'https://www.aizant.com/careers/we-are-hiring/#job-2',
      applyUrl: 'https://www.aizant.com/careers/we-are-hiring/#job-2',
      employmentType: null,
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-03-20T05:41:00.000Z',
      closingDate: null,
      jobDescription: 'Qualifications: B.Pharm / M.Pharm Support BA/BE study coordination.',
      remoteStatus: 'Hybrid',
    },
  ])
})

test('run decorates scraped jobs and honors maxJobs', async () => {
  const scraper = createAizantScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, CAREER_PAGE_URL)
      return sampleHtml
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'aizant')
  assert.equal(jobs[0].link, 'https://www.aizant.com/careers/we-are-hiring/#job-1')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})
