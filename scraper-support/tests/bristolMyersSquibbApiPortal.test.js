import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Bristol Myers Squibb Eightfold jobs from detail-owned public and apply URLs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bristolmyerssquibb')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 137480083643,
                displayJobId: 'R1600892',
                name: 'Cloud Scrum Master',
                locations: ['Hyderabad - TS - IN'],
                department: 'Systems Architecture',
                postedTs: 1784246400,
                workLocationOption: 'onsite',
              },
              {
                id: 137480083644,
                displayJobId: 'R1600893',
                name: 'US Market Access Lead',
                locations: ['Princeton, NJ, United States'],
                department: 'Market Access',
                postedTs: 1784246401,
                workLocationOption: 'onsite',
              },
            ],
            count: 2,
          },
        }
      }

      if (url.includes('position_id=137480083643')) {
        return {
          data: {
            publicUrl: 'https://jobs.bms.com/careers/job/137480083643',
            jobDescription: '<p>Seeking an experienced and passionate Scrum Master to drive Agile transformation and delivery excellence within our AI Hub.</p>',
            positionUserActions: {
              applyAction: {
                applyUrl: 'https://bristolmyerssquibb.wd5.myworkdayjobs.com/BMS/job/Hyderabad---TS---IN/Cloud-Scrum-Master_R1600892/apply?source=Eightfold',
              },
            },
            workLocationOption: 'onsite',
          },
        }
      }

      if (url.includes('position_id=137480083644')) {
        return {
          data: {
            publicUrl: 'https://jobs.bms.com/careers/job/137480083644',
            jobDescription: '<p>Lead market access programs in the United States.</p>',
            workLocationOption: 'onsite',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Cloud Scrum Master',
    company: 'Bristol Myers Squibb',
    location: 'Hyderabad - TS - IN',
    city: 'Hyderabad',
    country: 'India',
    link: 'https://jobs.bms.com/careers/job/137480083643',
    applyUrl: 'https://jobs.bms.com/careers/job/137480083643',
    sourceUrl: 'https://jobs.bms.com/careers/job/137480083643',
    source: 'bristolmyerssquibb',
    jobId: 137480083643,
    requisitionId: 'R1600892',
    department: 'Systems Architecture',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1784246400,
    jobDescription: '<p>Seeking an experienced and passionate Scrum Master to drive Agile transformation and delivery excellence within our AI Hub.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
