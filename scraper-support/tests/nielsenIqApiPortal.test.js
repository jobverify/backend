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
      id: '744000136429895',
      name: 'Data Operations Analyst',
      refNumber: 'REF-NIQ-1',
      releasedDate: '2026-07-08T09:00:00.000Z',
      location: {
        city: 'Pune',
        region: 'MH',
        country: 'in',
        remote: false,
        hybrid: true,
        fullLocation: 'Pune, MH, India',
      },
      department: {
        label: 'Operations',
      },
      typeOfEmployment: {
        label: 'Full-time',
      },
      experienceLevel: {
        label: 'Associate',
      },
      postingUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000136429895-data-operations-analyst',
      applyUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000136429895-data-operations-analyst?oga=true',
    },
    {
      id: '744000135870099',
      name: 'R2R Analyst',
      refNumber: 'REF-NIQ-2',
      releasedDate: '2026-07-07T09:00:00.000Z',
      location: {
        city: 'Chicago',
        region: 'IL',
        country: 'us',
        remote: false,
        hybrid: false,
        fullLocation: 'Chicago, IL, United States',
      },
      department: {
        label: 'Finance',
      },
      typeOfEmployment: {
        label: 'Full-time',
      },
      experienceLevel: {
        label: 'Associate',
      },
      postingUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000135870099-r2r-analyst',
      applyUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000135870099-r2r-analyst?oga=true',
    },
  ],
}

const firstDetail = {
  id: '744000136429895',
  name: 'Data Operations Analyst',
  refNumber: 'REF-NIQ-1',
  location: {
    city: 'Pune',
    region: 'MH',
    country: 'in',
    fullLocation: 'Pune, MH, India',
  },
  department: {
    label: 'Operations',
  },
  typeOfEmployment: {
    label: 'Full-time',
  },
  experienceLevel: {
    label: 'Associate',
  },
  postingUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000136429895-data-operations-analyst',
  applyUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000136429895-data-operations-analyst?oga=true',
  jobAd: {
    sections: {
      jobDescription: {
        text: '<p>Run data operations workflows for retail measurement.</p>',
      },
      qualifications: {
        text: '<p>Strong SQL and data-quality fundamentals.</p>',
      },
      additionalInformation: {
        text: '<p>Hybrid role based in Pune.</p>',
      },
    },
  },
}

const secondDetail = {
  id: '744000135870099',
  name: 'R2R Analyst',
  refNumber: 'REF-NIQ-2',
  location: {
    city: 'Chicago',
    region: 'IL',
    country: 'us',
    fullLocation: 'Chicago, IL, United States',
  },
  department: {
    label: 'Finance',
  },
  typeOfEmployment: {
    label: 'Full-time',
  },
  experienceLevel: {
    label: 'Associate',
  },
  postingUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000135870099-r2r-analyst',
  applyUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000135870099-r2r-analyst?oga=true',
  jobAd: {
    sections: {
      jobDescription: {
        text: '<p>Support record-to-report operations in the United States.</p>',
      },
      qualifications: {
        text: '<p>Finance operations experience.</p>',
      },
      additionalInformation: {
        text: '<p>Chicago-based role.</p>',
      },
    },
  },
}

test('runApiPortalScraper maps NielsenIQ SmartRecruiters jobs and keeps India roles with detail enrichment', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nielseniq')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url === 'https://api.smartrecruiters.com/v1/companies/NielsenIQ/postings?limit=10&country=in&offset=0') {
        return listingsPayload
      }
      if (url === 'https://api.smartrecruiters.com/v1/companies/NielsenIQ/postings/744000136429895') {
        return firstDetail
      }
      if (url === 'https://api.smartrecruiters.com/v1/companies/NielsenIQ/postings/744000135870099') {
        return secondDetail
      }
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Data Operations Analyst',
    company: 'NielsenIQ',
    location: 'Pune, MH, India',
    city: 'Pune',
    country: 'India',
    link: 'https://jobs.smartrecruiters.com/NielsenIQ/744000136429895-data-operations-analyst',
    applyUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000136429895-data-operations-analyst?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000136429895-data-operations-analyst',
    source: 'nielseniq',
    jobId: '744000136429895',
    requisitionId: 'REF-NIQ-1',
    department: 'Operations',
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Associate',
    postingDate: '2026-07-08T09:00:00.000Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })

  assert.match(jobs[0].jobDescription, /data operations workflows/i)
  assert.match(jobs[0].minimumQualification, /SQL/i)
  assert.match(jobs[0].preferredQualification, /Hybrid role based in Pune/i)
})
