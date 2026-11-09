import assert from 'node:assert/strict'
import test from 'node:test'

import { extractJobDetail } from '../../scraper/sap/script.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const SAP_DETAIL_HTML = `
  <html>
    <body>
      <div class="jobDisplay">
        <div class="content">
          <div class="jobTitle">
            <div class="applylink pull-right">
              <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn" href="/talentcommunity/apply/1270625401/?locale=en_US">Apply now »</a>
            </div>
          </div>
          <div class="job">
            <span data-careersite-propertyid="department">Information Technology</span>
            <h1><span data-careersite-propertyid="title">AI Security Architect</span></h1>
            <p id="job-location"><span class="jobGeoLocation">Bangalore, Karnataka, India</span></p>
            <span data-careersite-propertyid="date">Jul 26, 2026</span>
            <span
              xml:lang="en-US"
              lang="en-US"
              itemprop="description"
              data-careersite-propertyid="description"
              class="rtltextaligneligible"
            >
              <span class="jobdescription">
                <p><strong>What you bring</strong></p>
                <ul>
                  <li>7-10 years of experience in security architecture or engineering, with exposure to AI/ML systems.</li>
                  <li>Hands-on experience integrating security into CI/CD pipelines.</li>
                </ul>
              </span>
            </span>
          </div>
        </div>
      </div>
    </body>
  </html>
`

test('SAP detail extraction handles the current SuccessFactors description markup', () => {
  const detail = extractJobDetail(SAP_DETAIL_HTML, {
    title: 'AI Security Architect',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '1270625401',
    requisitionId: '1270625401',
    sourceUrl: 'https://careers.sap.com/job/Bangalore-AI-Security-Architect-560066/1270625401/',
  })

  assert.equal(detail.department, 'Information Technology')
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.applyUrl, 'https://careers.sap.com/talentcommunity/apply/1270625401/?locale=en_US')
  assert.match(detail.jobDescription || '', /7-10 years of experience/i)

  const normalized = normalizeScrapedJob({
    ...detail,
    title: detail.title,
    company: 'SAP',
    source: 'sap',
    link: detail.applyUrl,
  })

  assert.equal(normalized.experienceRequired, '7-10 years')
})
