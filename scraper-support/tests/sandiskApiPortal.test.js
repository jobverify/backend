import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

const listingsPayload = {
  offset: 0,
  limit: 100,
  totalFound: 2,
  content: [
    {
      id: '744000136475149',
      name: 'Principal Engineer, Data Engineering',
      refNumber: 'REF-SD-1',
      releasedDate: '2026-07-09T09:00:00.000Z',
      location: {
        city: 'Bengaluru',
        region: 'KA',
        country: 'in',
        remote: false,
        hybrid: false,
        fullLocation: 'Bengaluru, Karnataka, India',
      },
      department: {
        label: 'Engineering',
      },
      typeOfEmployment: {
        label: 'Full-time',
      },
      experienceLevel: {
        label: 'Mid-Senior level',
      },
      postingUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475149-principal-engineer-data-engineering',
      applyUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475149-principal-engineer-data-engineering?oga=true',
    },
    {
      id: '744000136475150',
      name: 'Firmware Engineer',
      refNumber: 'REF-SD-2',
      releasedDate: '2026-07-08T09:00:00.000Z',
      location: {
        city: 'Irvine',
        region: 'CA',
        country: 'us',
        remote: false,
        hybrid: false,
        fullLocation: 'Irvine, California, United States',
      },
      department: {
        label: 'Engineering',
      },
      typeOfEmployment: {
        label: 'Full-time',
      },
      experienceLevel: {
        label: 'Associate',
      },
      postingUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475150-firmware-engineer',
      applyUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475150-firmware-engineer?oga=true',
    },
  ],
}

const firstDetail = {
  id: '744000136475149',
  name: 'Principal Engineer, Data Engineering',
  refNumber: 'REF-SD-1',
  location: {
    city: 'Bengaluru',
    region: 'KA',
    country: 'in',
    fullLocation: 'Bengaluru, Karnataka, India',
  },
  department: {
    label: 'Engineering',
  },
  typeOfEmployment: {
    label: 'Full-time',
  },
  experienceLevel: {
    label: 'Mid-Senior level',
  },
  postingUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475149-principal-engineer-data-engineering',
  applyUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475149-principal-engineer-data-engineering?oga=true',
  jobAd: {
    sections: {
      jobDescription: {
        text: '<p>Build data platforms for high-performance compute clusters.</p>',
      },
      qualifications: {
        text: '<p>Strong distributed systems and orchestration experience.</p>',
      },
      additionalInformation: {
        text: '<p>Bengaluru hybrid engineering role.</p>',
      },
    },
  },
}

const secondDetail = {
  id: '744000136475150',
  name: 'Firmware Engineer',
  refNumber: 'REF-SD-2',
  location: {
    city: 'Irvine',
    region: 'CA',
    country: 'us',
    fullLocation: 'Irvine, California, United States',
  },
  department: {
    label: 'Engineering',
  },
  typeOfEmployment: {
    label: 'Full-time',
  },
  experienceLevel: {
    label: 'Associate',
  },
  postingUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475150-firmware-engineer',
  applyUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475150-firmware-engineer?oga=true',
  jobAd: {
    sections: {
      jobDescription: {
        text: '<p>Develop firmware for storage hardware.</p>',
      },
      qualifications: {
        text: '<p>Embedded systems experience required.</p>',
      },
      additionalInformation: {
        text: '<p>Irvine-based role.</p>',
      },
    },
  },
}

test('runApiPortalScraper maps Sandisk SmartRecruiters jobs and keeps India roles with detail enrichment', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sandisk')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url === 'https://api.smartrecruiters.com/v1/companies/Sandisk/postings?limit=100&country=in&offset=0') {
        return listingsPayload
      }
      if (url === 'https://api.smartrecruiters.com/v1/companies/Sandisk/postings/744000136475149') {
        return firstDetail
      }
      if (url === 'https://api.smartrecruiters.com/v1/companies/Sandisk/postings/744000136475150') {
        return secondDetail
      }
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Principal Engineer, Data Engineering',
    company: 'Sandisk',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://jobs.smartrecruiters.com/Sandisk/744000136475149-principal-engineer-data-engineering',
    applyUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475149-principal-engineer-data-engineering?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/Sandisk/744000136475149-principal-engineer-data-engineering',
    source: 'sandisk',
    jobId: '744000136475149',
    requisitionId: 'REF-SD-1',
    department: 'Engineering',
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Mid-Senior level',
    postingDate: '2026-07-09T09:00:00.000Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })

  assert.match(jobs[0].jobDescription, /high-performance compute clusters/i)
  assert.match(jobs[0].minimumQualification, /distributed systems/i)
  assert.match(jobs[0].preferredQualification, /Bengaluru hybrid engineering role/i)
})
