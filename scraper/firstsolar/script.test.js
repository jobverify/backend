import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CANDIDATE_EXPERIENCE_URL,
  CORPORATE_CAREERS_URL,
  extractSearchResults,
  hasOfficialCandidateExperienceSignal,
  hasOfficialCorporateCareersSignal,
} from './script.js'

const corporateHtml = `
  <title>Careers | First Solar</title>
  <a href="${CANDIDATE_EXPERIENCE_URL}">India</a>
  <h1>Find Open Positions and Apply</h1>
`

const candidateHtml = `
  <title>First Solar India</title>
  <meta property="og:title" content="First Solar India Careers"/>
  <meta property="og:site_name" content="First Solar India"/>
  <base href="/hcmUI/CandidateExperience/en/sites/CX_2001"
    data-apibaseurl="https://fa-esbv-saasfaprod1.fa.ocs.oraclecloud.com:443"
    data-sitenumber="CX_2001"/>
`

test('First Solar validates both official career surfaces by exact identity', () => {
  assert.equal(hasOfficialCorporateCareersSignal(corporateHtml), true)
  assert.equal(hasOfficialCandidateExperienceSignal(candidateHtml), true)
  assert.equal(
    hasOfficialCorporateCareersSignal(corporateHtml.replace('First Solar', 'Another Solar')),
    false,
  )
  assert.equal(
    hasOfficialCandidateExperienceSignal(candidateHtml.replace('First Solar India', 'Solar India')),
    false,
  )
})

test('First Solar search extraction keeps only India requisitions', () => {
  const jobs = extractSearchResults({
    items: [{
      TotalJobsCount: 2,
      requisitionList: [
        { Id: '1', Title: 'India role', PrimaryLocationCountry: 'IN', PrimaryLocation: 'Tamil Nadu, India' },
        { Id: '2', Title: 'Other role', PrimaryLocationCountry: 'US', PrimaryLocation: 'Ohio, United States' },
      ],
    }],
  })

  assert.deepEqual(jobs.map(({ jobId, company, country }) => ({ jobId, company, country })), [
    { jobId: '1', company: 'First Solar', country: 'India' },
  ])
})

assert.equal(CORPORATE_CAREERS_URL, 'https://www.firstsolar.com/en/Careers')
