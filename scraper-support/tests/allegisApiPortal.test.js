import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

const listingsPayload = {
  offset: 0,
  limit: 10,
  totalFound: 2,
  content: [
    {
      id: '744000133895351',
      name: 'Instructional Designer II',
      refNumber: 'REF8892R',
      company: {
        identifier: 'AllegisGlobalSolutions',
        name: 'Allegis Global Solutions',
      },
      releasedDate: '2026-06-24T09:04:27.286Z',
      location: {
        city: 'Bengaluru',
        region: 'KA',
        country: 'in',
        remote: false,
        hybrid: false,
        fullLocation: 'Bengaluru, KA, India',
      },
      department: {
        id: '1387326',
        label: 'INDIA',
      },
      function: {
        id: 'consulting',
        label: 'Consulting',
      },
      typeOfEmployment: {
        id: 'permanent',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'mid_senior_level',
        label: 'Mid-Senior Level',
      },
      postingUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133895351-instructional-designer-ii',
      applyUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133895351-instructional-designer-ii?oga=true',
    },
    {
      id: '744000133339629',
      name: 'Sr. Analyst, TA Technology and Analytics - EMEA',
      refNumber: 'REF8810G',
      company: {
        identifier: 'AllegisGlobalSolutions',
        name: 'Allegis Global Solutions',
      },
      releasedDate: '2026-06-22T11:30:05.657Z',
      location: {
        city: 'Bengaluru',
        region: 'KA',
        country: 'in',
        remote: false,
        hybrid: true,
        fullLocation: 'Bengaluru, KA, India',
      },
      department: {
        id: '1387326',
        label: 'INDIA',
      },
      function: {
        id: 'analyst',
        label: 'Analyst',
      },
      typeOfEmployment: {
        id: 'permanent',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'mid_senior_level',
        label: 'Mid-Senior Level',
      },
      postingUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133339629-sr-analyst-ta-technology-and-analytics-emea',
      applyUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133339629-sr-analyst-ta-technology-and-analytics-emea?oga=true',
    },
  ],
}

const firstDetail = {
  id: '744000133895351',
  name: 'Instructional Designer II',
  refNumber: 'REF8892R',
  location: {
    city: 'Bengaluru',
    region: 'KA',
    country: 'in',
    fullLocation: 'Bengaluru, KA, India',
  },
  department: {
    label: 'INDIA',
  },
  typeOfEmployment: {
    label: 'Full-time',
  },
  experienceLevel: {
    label: 'Mid-Senior Level',
  },
  postingUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133895351-instructional-designer-ii',
  applyUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133895351-instructional-designer-ii?oga=true',
  jobAd: {
    sections: {
      jobDescription: {
        text: '<p>Create learning content for managed services programs.</p>',
      },
      qualifications: {
        text: '<p>Experience in instructional design and adult learning.</p>',
      },
      additionalInformation: {
        text: '<p>Hybrid collaboration with global stakeholders.</p>',
      },
    },
  },
}

const secondDetail = {
  ...firstDetail,
  id: '744000133339629',
  name: 'Sr. Analyst, TA Technology and Analytics - EMEA',
  refNumber: 'REF8810G',
  postingUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133339629-sr-analyst-ta-technology-and-analytics-emea',
  applyUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133339629-sr-analyst-ta-technology-and-analytics-emea?oga=true',
  jobAd: {
    sections: {
      jobDescription: {
        text: '<p>Build analytics and TA technology insights for EMEA programs.</p>',
      },
      qualifications: {
        text: '<p>Strong reporting and ATS analytics experience.</p>',
      },
      additionalInformation: {
        text: '<p>Hybrid role based in Bengaluru.</p>',
      },
    },
  },
}

test('runApiPortalScraper maps Allegis Global Solutions SmartRecruiters jobs and keeps India roles with detail enrichment', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'allegis')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url === 'https://api.smartrecruiters.com/v1/companies/AllegisGlobalSolutions/postings?limit=10&country=in&offset=0') {
        return listingsPayload
      }
      if (url === 'https://api.smartrecruiters.com/v1/companies/AllegisGlobalSolutions/postings/744000133895351') {
        return firstDetail
      }
      if (url === 'https://api.smartrecruiters.com/v1/companies/AllegisGlobalSolutions/postings/744000133339629') {
        return secondDetail
      }
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Instructional Designer II',
    company: 'Allegis Global Solutions',
    location: 'Bengaluru, KA, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133895351-instructional-designer-ii',
    applyUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133895351-instructional-designer-ii?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/AllegisGlobalSolutions/744000133895351-instructional-designer-ii',
    source: 'allegis',
    jobId: '744000133895351',
    requisitionId: 'REF8892R',
    department: 'INDIA',
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Mid-Senior Level',
    postingDate: '2026-06-24T09:04:27.286Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })

  assert.match(jobs[0].jobDescription, /learning content/i)
  assert.match(jobs[0].minimumQualification, /instructional design/i)
  assert.match(jobs[0].preferredQualification, /global stakeholders/i)
  assert.equal(jobs[1].jobId, '744000133339629')
  assert.equal(jobs[1].requisitionId, 'REF8810G')
  assert.match(jobs[1].jobDescription, /analytics and TA technology insights/i)
})
