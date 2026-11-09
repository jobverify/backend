import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createKeecheryScraper,
  extractPublicListings,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const homepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')

test('extractPublicListings maps the visible Keechery jobs from the official careers page', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(extractPublicListings(careersHtml), [
    {
      title: 'Marketing Executives',
      company: 'Keechery',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'keechery-marketing-executives',
      requisitionId: 'keechery-marketing-executives',
      sourceUrl: 'https://www.keechery.com/career/#keechery-marketing-executives',
      applyUrl: 'https://www.keechery.com/career/',
      employmentType: null,
      experienceRequired: 'Freshers',
      minimumQualification: 'Undergraduate degree in any stream',
      preferredQualification: null,
      requiredSkills: ['Strong Communication Skills'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Freshers with an undergraduate degree in any stream. Strong Communication Skills. Apply via the official Keechery careers page.',
    },
    {
      title: 'Project Engineers',
      company: 'Keechery',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'keechery-project-engineers',
      requisitionId: 'keechery-project-engineers',
      sourceUrl: 'https://www.keechery.com/career/#keechery-project-engineers',
      applyUrl: 'https://www.keechery.com/career/',
      employmentType: null,
      experienceRequired: '1-2 Years of Work experience in similar roles',
      minimumQualification: 'B.E/B.Tech in Civil or Mechanical Engineering',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'B.E/B.Tech in Civil or Mechanical Engineering. 1-2 Years of Work experience in similar roles. Apply via the official Keechery careers page.',
    },
    {
      title: 'Quantity Surveyors',
      company: 'Keechery',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'keechery-quantity-surveyors',
      requisitionId: 'keechery-quantity-surveyors',
      sourceUrl: 'https://www.keechery.com/career/#keechery-quantity-surveyors',
      applyUrl: 'https://www.keechery.com/career/',
      employmentType: null,
      experienceRequired: '2-3 Years of Work Experience in similar reputed project execution firms',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: '2-3 Years of Work Experience in similar reputed project execution firms. Apply via the official Keechery careers page.',
    },
  ])
})

test('run validates the official homepage handoff and decorates extracted Keechery jobs', async () => {
  const requestedUrls = []
  const scraper = createKeecheryScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Marketing Executives',
        source: 'keechery',
        link: 'https://www.keechery.com/career/',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Project Engineers',
        source: 'keechery',
        link: 'https://www.keechery.com/career/',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Quantity Surveyors',
        source: 'keechery',
        link: 'https://www.keechery.com/career/',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  )
})
