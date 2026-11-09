import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildJobDetailUrl,
  buildSearchUrl,
  extractSearchResults,
} from '../../scraper/cerner/script.js'

const samplePayload = {
  items: [
    {
      TotalJobsCount: 6,
      Limit: 24,
      Offset: 0,
      requisitionList: [
        {
          Id: '337984',
          Title: 'Senior Software Engineer - Cerner Millennium',
          Department: 'Oracle Health',
          PrimaryLocation: 'Bengaluru, Karnataka, India',
          PrimaryLocationCountry: 'IN',
          PostedDate: '2026-07-01',
          StudyLevel: 'Bachelor degree in Engineering or related field',
          ShortDescriptionStr: 'Build and support Cerner Millennium services.',
          ExternalResponsibilitiesStr: 'Work across Oracle Health engineering teams.',
        },
        {
          Id: '400001',
          Title: 'Support Engineer',
          Department: 'Oracle',
          PrimaryLocation: 'Austin, Texas, United States',
          PrimaryLocationCountry: 'US',
          PostedDate: '2026-07-01',
          StudyLevel: 'Bachelor degree',
          ShortDescriptionStr: 'Support US customers.',
          ExternalResponsibilitiesStr: 'Participate in on-call rotations.',
        },
      ],
    },
  ],
}

test('buildSearchUrl keeps Cerner searches on the public Oracle Cloud careers finder with keyword scoping', () => {
  assert.equal(
    buildSearchUrl(),
    'https://eeho.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_45001,limit=24,offset=0,location=India,keyword=Cerner',
  )
  assert.equal(
    buildSearchUrl({ page: 1, limit: 10, location: 'India', keyword: 'Oracle Health' }),
    'https://eeho.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_45001,limit=10,offset=10,location=India,keyword=Oracle Health',
  )
})

test('buildJobDetailUrl keeps Cerner detail links on the public Oracle careers route', () => {
  assert.equal(
    buildJobDetailUrl('337984'),
    'https://careers.oracle.com/en/sites/jobsearch/job/337984/',
  )
})

test('extractSearchResults normalizes Cerner Oracle Cloud requisitions and keeps only India jobs', () => {
  const jobs = extractSearchResults(samplePayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer - Cerner Millennium',
    company: 'Cerner',
    department: 'Oracle Health',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '337984',
    requisitionId: '337984',
    sourceUrl: 'https://careers.oracle.com/en/sites/jobsearch/job/337984/',
    applyUrl: 'https://careers.oracle.com/en/sites/jobsearch/job/337984/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: 'Bachelor degree in Engineering or related field',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Build and support Cerner Millennium services. Work across Oracle Health engineering teams.',
  })
})
