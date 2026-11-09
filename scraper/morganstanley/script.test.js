import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../../scraper-support/providers/index.js'
import {
  buildCompanyLookup,
  normalizeCompanyName,
} from '../../scraper-support/providers/companyCoverage.js'

test('getScraperCatalog includes Morgan Stanley as an Eightfold apiPortal provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'morganstanley')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(
    provider.companyCareerPage,
    'https://www.morganstanley.com/careers/career-opportunities-search',
  )
  assert.equal(provider.companyDomain, 'morganstanley.com')
  assert.match(provider.config.discovery.listingApiUrl, /morganstanley\.eightfold\.ai\/api\/pcsx\/search/i)
  assert.equal(provider.config.request.query.domain, 'morganstanley.com')
  assert.equal(provider.config.request.query.location, 'India')
})

test('buildCompanyLookup maps the CSV typo Morgan Stanely to the Morgan Stanley lane', () => {
  const lookup = buildCompanyLookup({ catalog: getScraperCatalog() })

  assert.equal(lookup.get(normalizeCompanyName('Morgan Stanely')), 'morganstanley')
})

test('buildScrapers exposes a runnable Morgan Stanley apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'morganstanley')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /morganstanley[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'morganstanley')
  assert.equal(scraper.provider.atsPlatform, 'eightfold')
})

test('runApiPortalScraper maps Morgan Stanley Eightfold jobs with detail-owned metadata', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'morganstanley')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 549798123013,
                displayJobId: 'PT-JR038677',
                name: 'Senior Software Engineer - Parametric',
                locations: ['Mumbai, Maharashtra, India'],
                department: 'Data & Technology',
                postedTs: 1782950400,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=549798123013')) {
        return {
          data: {
            publicUrl: 'https://morganstanley.eightfold.ai/careers/job/549798123013',
            jobDescription: '<p>Build shared Java platform capabilities.</p>',
            efcustomTextTextTimeType: ['Full time'],
            workLocationOption: 'hybrid',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer - Parametric',
    company: 'Morgan Stanley',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    link: 'https://morganstanley.eightfold.ai/careers/job/549798123013',
    applyUrl: 'https://morganstanley.eightfold.ai/careers/job/549798123013',
    sourceUrl: 'https://morganstanley.eightfold.ai/careers/job/549798123013',
    source: 'morganstanley',
    jobId: 549798123013,
    requisitionId: 'PT-JR038677',
    department: 'Data & Technology',
    employmentType: 'Full-time',
    experienceRequired: null,
    postingDate: 1782950400,
    jobDescription: '<p>Build shared Java platform capabilities.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'Hybrid',
    scrapedAt: jobs[0].scrapedAt,
  })
})
