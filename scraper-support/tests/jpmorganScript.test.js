import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildJobDetailUrl,
  extractJobDetail,
  extractSearchResults,
} from '../../scraper/jpmorgan/script.js'

test('extractSearchResults derives experienceRequired from JPMorgan India listing text', () => {
  const jobs = extractSearchResults({
    items: [{
      Limit: 24,
      TotalJobsCount: 1,
      requisitionList: [
        {
          Id: '210721769',
          Title: 'Software Engineer III',
          PostedDate: '2026-07-23',
          PrimaryLocationCountry: 'IN',
          PrimaryLocation: 'Hyderabad, Telangana, India',
          JobFunction: 'Technology',
          JobSchedule: 'Full time',
          ShortDescriptionStr:
            'Should have Bachelor degree in Engineering with Minimum 3+ years relevant experience in Java',
          secondaryLocations: [],
        },
      ],
    }],
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].experienceRequired, '3+ years')
  assert.equal(jobs[0].sourceUrl, buildJobDetailUrl('210721769'))
})

test('extractJobDetail derives experienceRequired from JPMorgan qualifications and description text', () => {
  const listing = {
    title: 'Software Engineer III - DevOps',
    company: 'JP Morgan',
    department: 'Technology',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '210730212',
    requisitionId: '210730212',
    sourceUrl: buildJobDetailUrl('210730212'),
    applyUrl: buildJobDetailUrl('210730212'),
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-24',
    closingDate: '2026-07-31',
    jobDescription:
      'Formal training or certification on software engineering concepts and 6+ years applied experience',
  }

  const job = extractJobDetail({
    items: [{
      Id: '210730212',
      Title: 'Software Engineer III - DevOps',
      JobFunction: 'Technology',
      JobSchedule: 'Full time',
      PrimaryLocationCountry: 'IN',
      PrimaryLocation: 'Hyderabad, Telangana, India',
      ExternalPostedStartDate: '2026-07-24T00:00:00+00:00',
      ExternalPostedEndDate: '2026-07-31T00:00:00+00:00',
      ExternalDescriptionStr:
        '<p>Formal training or certification on software engineering concepts and 6+ years applied experience</p>',
      ExternalQualificationsStr:
        'Formal training or certification on software engineering concepts and 6+ years applied experience.',
      secondaryLocations: [],
    }],
  }, listing)

  assert.equal(job.experienceRequired, '6+ years')
  assert.equal(job.minimumQualification, 'Formal training or certification on software engineering concepts and 6+ years applied experience.')
  assert.equal(job.jobDescription.includes('6+ years applied experience'), true)
})
