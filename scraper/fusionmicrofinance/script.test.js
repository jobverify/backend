import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractGenericJobTitles,
  extractFeaturedJobDetail,
  hasOfficialDetailPageSignal,
  hasOfficialCareersSurface,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Fusion Finance Limited – NBFC | MFI Company, Microfinance, MSME, Machinery, New Small Business Loans in India</title>
    </head>
    <body>
      <p>Fusion Finance Limited</p>
      <a href="https://fusionfin.com/careers/" class="elementor-item has-submenu">Careers<span class="sub-arrow"></span></a>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Fusion Finance – Microfinance Jobs, opportunities &amp; Careers</title>
      <link rel="canonical" href="https://fusionfin.com/careers/" />
    </head>
    <body>
      <p>Current Openings</p>
      <p>Click here to apply against open job postings</p>
      <p>Click here to apply for Area Manager, Branch Manager, Audit Officer &amp; Relationship Officer jobs at branches of Fusion Micro Finance Ltd.</p>
      <label>Job Title</label>
      <select>
        <option>Select The Job</option>
        <option>MFI - Relationship Officer</option>
        <option>MFI - Audit Officer</option>
        <option>MFI - Branch Manager</option>
        <option>MFI - Area Manager</option>
        <option>MSME - Business Development Officer</option>
        <option>MSME - Credit Officer</option>
        <option>MSME - Executive Operations</option>
      </select>
      <p>Apply Now</p>
      <a href="https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/">More Details</a>
      <div>QA Engineer/Sr. QA Engineer 1-5 Haryana Gurgaon/Gurugram Automation Testing More Details</div>
    </body>
  </html>
`

const detailHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>QA Engineer/Sr. QA Engineer - Fusion Finance Limited</title>
    </head>
    <body>
      <h1 class="entry-title">QA Engineer/Sr. QA Engineer</h1>
      <div>
        <span class="awsm-job-specification-label"><strong>Experience: </strong></span><a class="awsm-job-specification-term">1-5</a>
        <span class="awsm-job-specification-label"><strong>State: </strong></span><a class="awsm-job-specification-term">Haryana</a>
        <span class="awsm-job-specification-label"><strong>City: </strong></span><a class="awsm-job-specification-term">Gurgaon/Gurugram</a>
        <span class="awsm-job-specification-label"><strong>Job Role: </strong></span><a class="awsm-job-specification-term">Automation Testing</a>
      </div>
      <ul>
        <li>Execute test cases</li>
        <li>Maintain QA best practices</li>
      </ul>
      <p>Interested applicants can reach out to us at <strong>recruiter@fusionfin.com</strong></p>
      <h2>Apply for this position</h2>
      <input type="file" />
    </body>
  </html>
`

test('Fusion Microfinance accepts the current homepage title and the careers placeholder drift', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.deepEqual(extractGenericJobTitles(careersHtml), [
    'MFI - Relationship Officer',
    'MFI - Audit Officer',
    'MFI - Branch Manager',
    'MFI - Area Manager',
    'MSME - Business Development Officer',
    'MSME - Credit Officer',
    'MSME - Executive Operations',
  ])
  assert.equal(hasOfficialCareersSurface(careersHtml), true)
})

test('Fusion Microfinance accepts the current nested featured-job detail field layout', () => {
  assert.equal(hasOfficialDetailPageSignal(detailHtml), true)

  const detail = extractFeaturedJobDetail(detailHtml)
  assert.deepEqual(
    {
      title: detail.title,
      state: detail.state,
      city: detail.city,
      department: detail.department,
      experienceRequired: detail.experienceRequired,
    },
    {
      title: 'QA Engineer/Sr. QA Engineer',
      state: 'Haryana',
      city: 'Gurgaon/Gurugram',
      department: 'Automation Testing',
      experienceRequired: '1-5',
    },
  )
})
