import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildJobDetailUrl,
  buildSearchPayload,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/aurigene/script.js'

const searchPayload = {
  data: {
    hasMoreData: true,
    totalCount: 46,
    facetedSearchConfig: {
      paginationHowMuch: '10',
    },
    data: [
      {
        _source: {
          jobTitle: 'Scientist - Analytical R&D',
          departmentName: 'CDMO Biologics',
          DepartmentName: 'CDMO Biologics',
          location: 'Genome Valley, Hyderabad',
          locAgg: 'Genome Valley, Hyderabad',
          jobCode: 10492,
          referenceNumber: '10492',
          refNumber: '10492',
          jobUrl: 'scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675',
          experienceUIField: '4-8 years',
          mandatorySkills: [
            'method development',
            'hplc',
            'elisa',
            'biologics',
            'characterization',
            'LCMS',
            'Flow Cytometry',
            'Electrophoresis',
          ],
          createDate: '08-Apr-2025',
          shortDescription: '<p>We are Expanding our Biologics R&amp;D Teams!</p><p>Hands-on experience with analytical techniques such as HPLC is required.</p>',
          jobLocationRecord: [
            {
              city: 'Hyderabad',
              country: 'India',
              location: 'Genome Valley, Hyderabad',
              state: 'Telangana',
            },
          ],
        },
      },
      {
        _source: {
          jobTitle: 'Scientist',
          departmentName: 'US Biologics',
          location: 'Boston, Massachusetts, United States',
          jobCode: 99999,
          referenceNumber: '99999',
          jobUrl: 'scientist-boston',
          mandatorySkills: ['elisa'],
          createDate: '08-Apr-2025',
          shortDescription: '<p>Ignore non-India rows</p>',
          jobLocationRecord: [
            {
              city: 'Boston',
              country: 'United States',
              location: 'Boston, Massachusetts, United States',
            },
          ],
        },
      },
    ],
  },
}

const detailPayload = {
  jobTitle: 'Scientist - Analytical R&D',
  jobCode: 10492,
  jobUrl: 'scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675',
  location: 'Genome Valley, Hyderabad',
  locationDisplayForManageJobs: 'Genome Valley, Hyderabad',
  referenceNumber: '10492',
  departmentName: 'CDMO Biologics',
  department: {
    departmentName: 'CDMO Biologics',
  },
  designation: null,
  minYrsOfExperience: '4',
  maxYrsOfExperience: '8',
  yrsOfExperience: '4 to 8 Years ',
  skillSet: 'method development, hplc, elisa, biologics, characterization, LCMS, Flow Cytometry, Electrophoresis',
  createDate: '08-Apr-2025',
  endtDate: null,
  longDescription: '<p>We are Expanding our Biologics R&amp;D Teams!</p><p>Hands-on experience with analytical techniques such as HPLC, UPLC, Capillary Electrophoresis, and Mass Spectrometry is required.</p>',
  jobConfigurationData: {
    Description: '<p>We are Expanding our Biologics R&amp;D Teams!</p><p>Hands-on experience with analytical techniques such as HPLC, UPLC, Capillary Electrophoresis, and Mass Spectrometry is required.</p>',
    Department: 'CDMO Biologics',
    'Open Positions': '10',
    'Skills Required': 'method development, hplc, elisa, biologics, characterization, LCMS, Flow Cytometry, Electrophoresis',
    Location: 'Genome Valley, Hyderabad',
    'Education/Qualification': 'M Sc',
    'Years Of Exp': '4 to 8 years',
    'Posted On': '1744095374000',
  },
}

test('buildSearchPayload keeps Aurigene searches on the public Zwayam careers contract', () => {
  assert.deepEqual(buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.aurigeneservices.com',
    companyId: 'MTUxNTc=',
  })

  assert.deepEqual(buildSearchPayload({ page: 2, keywords: 'biology' }), {
    filterCri: JSON.stringify({
      paginationStartNo: 10,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: 'biology',
    }),
    domain: 'careers.aurigeneservices.com',
    companyId: 'MTUxNTc=',
  })
})

test('buildJobDetailUrl keeps Aurigene detail links on the public careers route', () => {
  assert.equal(
    buildJobDetailUrl('scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675'),
    'https://careers.aurigeneservices.com/aurigeneservices/jobview/scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675',
  )
})

test('extractSearchResults keeps only India jobs from Aurigene Zwayam search responses', () => {
  const jobs = extractSearchResults(searchPayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Scientist - Analytical R&D',
    company: 'Aurigene',
    department: 'CDMO Biologics',
    location: 'Hyderabad',
    city: 'Hyderabad',
    jobId: '10492',
    requisitionId: '10492',
    sourceUrl: 'https://careers.aurigeneservices.com/aurigeneservices/jobview/scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675',
    applyUrl: 'https://careers.aurigeneservices.com/aurigeneservices/jobview/scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675',
    employmentType: null,
    experienceRequired: '4-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'method development',
      'hplc',
      'elisa',
      'biologics',
      'characterization',
      'LCMS',
      'Flow Cytometry',
      'Electrophoresis',
    ],
    postingDate: '2025-04-08',
    closingDate: null,
    jobDescription: 'We are Expanding our Biologics R&D Teams! Hands-on experience with analytical techniques such as HPLC is required.',
  })
})

test('extractPaginationSummary reads Aurigene page sizes from the careers search response', () => {
  assert.deepEqual(extractPaginationSummary(searchPayload), {
    hasNext: true,
    pageSize: 10,
    nextOffset: 10,
    totalCount: 46,
  })
})

test('extractJobDetail reads Aurigene detail fields, skills, qualifications, and descriptions', () => {
  const detail = extractJobDetail(detailPayload, {
    title: 'Scientist - Analytical R&D',
    department: 'CDMO Biologics',
    location: 'Hyderabad',
    city: 'Hyderabad',
    jobId: '10492',
    requisitionId: '10492',
    sourceUrl: 'https://careers.aurigeneservices.com/aurigeneservices/jobview/scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675',
  })

  assert.equal(detail.title, 'Scientist - Analytical R&D')
  assert.equal(detail.department, 'CDMO Biologics')
  assert.equal(detail.location, 'Hyderabad')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.jobId, '10492')
  assert.equal(detail.requisitionId, '10492')
  assert.equal(detail.employmentType, null)
  assert.equal(detail.experienceRequired, '4-8 years')
  assert.equal(detail.minimumQualification, 'M Sc')
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [
    'method development',
    'hplc',
    'elisa',
    'biologics',
    'characterization',
    'LCMS',
    'Flow Cytometry',
    'Electrophoresis',
  ])
  assert.equal(detail.postingDate, '2025-04-08')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://careers.aurigeneservices.com/aurigeneservices/jobview/scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.aurigeneservices.com/aurigeneservices/jobview/scientist-analytical-r-d-genome-valley-hyderabad-2025040812303675',
  )
  assert.match(detail.jobDescription, /Biologics R&D Teams/i)
  assert.match(detail.jobDescription, /HPLC/i)
  assert.match(detail.jobDescription, /Mass Spectrometry/i)
})
