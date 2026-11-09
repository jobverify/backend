import {replay as currentReplay} from '../../scraper-support/native-sources/publicNativeGetSources/fixtureReplay.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ASHBY_BOARD_URL,
  ASHBY_JOB_BOARD_URL,
  CAREER_PAGE_URL,
  createOdinScraper,
  extractAshbyJobs,
} from './script.js'

const ashbyPayload = {
  jobs: [
    {
      id: '286f6bba-b3f8-4473-a0ed-38e9d8b9e3d5',
      title: '  People Ops & Events Intern  ',
      department: 'People & Talent',
      employmentType: 'FullTime',
      location: 'London',
      workplaceType: 'Hybrid',
      publishedAt: '2026-06-09T14:54:26.289+00:00',
      isListed: true,
      address: {
        postalAddress: {
          addressCountry: 'United Kingdom',
          addressLocality: 'London',
        },
      },
      secondaryLocations: [],
      jobUrl: 'https://jobs.ashbyhq.com/odin/286f6bba-b3f8-4473-a0ed-38e9d8b9e3d5',
      applyUrl: 'https://jobs.ashbyhq.com/odin/286f6bba-b3f8-4473-a0ed-38e9d8b9e3d5/application',
      descriptionHtml: '<p>Support office operations and events.</p>',
    },
    {
      id: '421e17e4-e312-41a6-9da3-9aaf3d139591',
      title: 'Founding Customer Experience Lead',
      department: 'Customer Experience',
      employmentType: 'FullTime',
      location: 'United Kingdom',
      workplaceType: 'Remote',
      publishedAt: '2026-06-10T20:41:25.202+00:00',
      isListed: true,
      address: {
        postalAddress: {
          addressCountry: 'United Kingdom',
          addressRegion: 'London',
          addressLocality: 'United Kingdom',
        },
      },
      secondaryLocations: [],
      jobUrl: 'https://jobs.ashbyhq.com/odin/421e17e4-e312-41a6-9da3-9aaf3d139591',
      applyUrl: 'https://jobs.ashbyhq.com/odin/421e17e4-e312-41a6-9da3-9aaf3d139591/application',
      descriptionHtml: '<p>Own the end-to-end customer experience.</p>',
    },
    {
      id: 'hidden-role',
      title: 'Stealth Role',
      isListed: false,
      jobUrl: 'https://jobs.ashbyhq.com/odin/hidden-role',
      applyUrl: 'https://jobs.ashbyhq.com/odin/hidden-role/application',
    },
    {
      id: null,
      title: 'Missing identifiers',
      isListed: true,
      jobUrl: 'https://jobs.ashbyhq.com/odin/missing-identifiers',
      applyUrl: 'https://jobs.ashbyhq.com/odin/missing-identifiers/application',
    },
  ],
}

test('extractAshbyJobs returns listed Odin jobs with normalized Ashby fields', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.joinodin.com/')
  assert.equal(ASHBY_BOARD_URL, 'https://jobs.ashbyhq.com/odin')
  assert.equal(ASHBY_JOB_BOARD_URL, 'https://api.ashbyhq.com/posting-api/job-board/odin')

  const jobs = extractAshbyJobs(ashbyPayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'People Ops & Events Intern',
    company: 'Odin',
    department: 'People & Talent',
    location: 'London',
    city: 'London',
    state: null,
    country: 'United Kingdom',
    jobId: '286f6bba-b3f8-4473-a0ed-38e9d8b9e3d5',
    requisitionId: null,
    sourceUrl: 'https://jobs.ashbyhq.com/odin/286f6bba-b3f8-4473-a0ed-38e9d8b9e3d5',
    applyUrl: 'https://jobs.ashbyhq.com/odin/286f6bba-b3f8-4473-a0ed-38e9d8b9e3d5/application',
    employmentType: 'Full Time',
    workplaceType: 'Hybrid',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-09T14:54:26.289+00:00',
    closingDate: null,
    jobDescription: '<p>Support office operations and events.</p>',
  })
  assert.equal(jobs[1].location, 'United Kingdom')
  assert.equal(jobs[1].city, 'United Kingdom')
  assert.equal(jobs[1].state, 'London')
  assert.equal(jobs[1].country, 'United Kingdom')
  assert.equal(jobs[1].workplaceType, 'Remote')
})



test('Odin live factory accepts original HTTP injection, preserves Global own observations and current binding hold',async()=>{const r=currentReplay(),jobs=await createOdinScraper().run(r.options);assert.equal(jobs.length,0);assert.equal(r.audits.length,1);assert.equal(r.records[0].length,6);assert.equal(r.audits[0].countryFilter,'Global');assert.ok(r.records[0].every(r=>r.requisitionId===null&&r.sourceNativeDetailQualified))})
