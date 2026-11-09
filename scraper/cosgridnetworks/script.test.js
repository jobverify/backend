import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  OPENINGS_URL,
  createCosgridNetworksScraper,
  extractJobDetail,
  extractSearchResults,
  hasOfficialCareersLandingSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(currentDir, 'fixtures')

const readFixture = (name) => fs.readFileSync(path.join(fixtureDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')
const openingsHtml = readFixture('openings.html')
const backendDetailHtml = readFixture('backend-developer.html')
const frontendDetailHtml = readFixture('frontend-developer.html')
const embeddedDetailHtml = readFixture('embedded-sw-developer.html')
const salesExecutiveDetailHtml = readFixture('sales-executive.html')
const businessDevelopmentDetailHtml = readFixture('business-development-lead-generation.html')
const productMarketingDetailHtml = readFixture('product-growth-marketing-intern.html')
const digitalMarketingDetailHtml = readFixture('digital-marketing-specialist.html')
const invalidSalesSdrHtml = readFixture('invalid-sales-sdr.html')

const createUnavailableError = () => {
  const error = new Error('fetch failed')
  error.cause = {
    code: 'ECONNREFUSED',
    message: 'connect ECONNREFUSED 13.201.103.180:443',
  }
  return error
}

test('homepage and careers fixtures still match the verified COSGrid first-party shells', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersLandingSignal(careersHtml), true)
})

test('extractSearchResults reads the current COSGrid openings cards and preserves rendered slugs', () => {
  assert.deepEqual(extractSearchResults(openingsHtml), [
    {
      title: 'Backend Developer',
      department: 'Engineering',
      employmentType: 'Full-time',
      slug: 'backend-developer',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/backend-developer',
    },
    {
      title: 'Frontend Developer',
      department: 'Engineering',
      employmentType: 'Full-time',
      slug: 'frontend-developer',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/frontend-developer',
    },
    {
      title: 'Embedded S/W Developer - Networking',
      department: 'Engineering',
      employmentType: 'Full-time',
      slug: 'embedded-sw-developer',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/embedded-sw-developer',
    },
    {
      title: 'Senior Sales Executive',
      department: 'Sales',
      employmentType: 'Full-time',
      slug: 'sales-executive',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/sales-executive',
    },
    {
      title: 'Sales Development Representative- SDR',
      department: 'Sales',
      employmentType: 'Full-time',
      slug: 'sales-SDR',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/sales-SDR',
    },
    {
      title: 'Business Development - Lead Generation',
      department: 'Sales',
      employmentType: 'Full-time',
      slug: 'BusinessDevelpoment_Lead_gen',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/BusinessDevelpoment_Lead_gen',
    },
    {
      title: 'Product Growth Marketing- Intern',
      department: 'Marketing',
      employmentType: 'Internship',
      slug: 'product_Marketing',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/product_Marketing',
    },
    {
      title: 'Digital Marketing Specialist',
      department: 'Marketing',
      employmentType: 'Full-time',
      slug: 'Digital_marketing_content',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/Digital_marketing_content',
    },
  ])
})

test('extractJobDetail retains complete visible criteria while preserving JobPosting metadata', () => {
  const detail = extractJobDetail(backendDetailHtml, {
    sourceUrl: 'https://www.cosgrid.com/company/careers/openings/backend-developer',
    fallbackListing: {
      title: 'Backend Developer',
      department: 'Engineering',
      employmentType: 'Full-time',
    },
  })

  assert.deepEqual(detail, {
    title: 'Backend Developer (Go / Python)',
    department: 'Engineering',
    employmentType: 'Full-time',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    postingDate: '2026-05-01',
    closingDate: null,
    jobDescription: 'Backend Developer | Engineering Chennai, India Full-Time About the company COSGrid Networks is a leading networking and cybersecurity products company. Required Skills 1 - 3 years of experience building web applications and RESTful APIs in Python and Django Hands-on experience with PostgreSQL, Redis, Linux, and distributed systems',
    experienceRequired: '1 - 3 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      '1 - 3 years of experience building web applications and RESTful APIs in Python and Django',
      'Hands-on experience with PostgreSQL, Redis, Linux, and distributed systems',
    ],
    remoteStatus: 'Hybrid',
  })
})

test('extractJobDetail retains visible Responsibilities and Requirements when Required Skills and JSON-LD are absent', () => {
  const detail = extractJobDetail(businessDevelopmentDetailHtml, {
    sourceUrl: 'https://www.cosgrid.com/company/careers/openings/BusinessDevelpoment_Lead_gen',
    fallbackListing: {
      title: 'Business Development - Lead Generation',
      department: 'Sales',
      employmentType: 'Full-time',
    },
  })

  assert.deepEqual(detail, {
    title: 'Business Development - Lead Generation',
    department: 'Sales',
    employmentType: 'Full-time',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    postingDate: null,
    closingDate: null,
    jobDescription: 'Business Development - Lead Generation | Sales Chennai Full-Time About the company COSGrid Networks is a leading networking and cybersecurity products company. Responsibilities Generate new leads using cold calling, email marketing, social media, and other relevant marketing channels Requirements Bachelors / Masters degree in Marketing, sales, Communications, Business, or a related field Experience in B2B sales, preferably for at least 1-2 years',
    experienceRequired: '1-2 years',
    minimumQualification: 'Bachelors / Masters degree in Marketing, sales, Communications, Business, or a related field Experience in B2B sales, preferably for at least 1-2 years',
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: null,
  })
})

test('extractJobDetail rejects COSGrid detail routes that resolve to a non-job shell', () => {
  assert.throws(
    () => extractJobDetail(invalidSalesSdrHtml, {
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/sales-SDR',
      fallbackListing: {
        title: 'Sales Development Representative- SDR',
        department: 'Sales',
        employmentType: 'Full-time',
      },
    }),
    /verified detail surface/i,
  )
})

test('run retains complete COSGrid roles and records incomplete listed details without claiming a complete inventory', async () => {
  const requestedUrls = []
  const fixturesByUrl = new Map([
    [HOMEPAGE_URL, homepageHtml],
    [CAREERS_URL, careersHtml],
    [OPENINGS_URL, openingsHtml],
    ['https://www.cosgrid.com/company/careers/openings/backend-developer', backendDetailHtml],
    ['https://www.cosgrid.com/company/careers/openings/frontend-developer', frontendDetailHtml],
    ['https://www.cosgrid.com/company/careers/openings/embedded-sw-developer', embeddedDetailHtml],
    ['https://www.cosgrid.com/company/careers/openings/sales-executive', salesExecutiveDetailHtml],
    ['https://www.cosgrid.com/company/careers/openings/BusinessDevelpoment_Lead_gen', businessDevelopmentDetailHtml],
    ['https://www.cosgrid.com/company/careers/openings/product_Marketing', productMarketingDetailHtml],
    ['https://www.cosgrid.com/company/careers/openings/Digital_marketing_content', digitalMarketingDetailHtml],
    ['https://www.cosgrid.com/company/careers/openings/sales-SDR', invalidSalesSdrHtml],
  ])
  const scraper = createCosgridNetworksScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const fixture = fixturesByUrl.get(url)
      if (!fixture) throw new Error(`Unexpected URL: ${url}`)
      return fixture
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    OPENINGS_URL,
    'https://www.cosgrid.com/company/careers/openings/backend-developer',
    'https://www.cosgrid.com/company/careers/openings/frontend-developer',
    'https://www.cosgrid.com/company/careers/openings/embedded-sw-developer',
    'https://www.cosgrid.com/company/careers/openings/sales-executive',
    'https://www.cosgrid.com/company/careers/openings/sales-SDR',
    'https://www.cosgrid.com/company/careers/openings/BusinessDevelpoment_Lead_gen',
    'https://www.cosgrid.com/company/careers/openings/product_Marketing',
    'https://www.cosgrid.com/company/careers/openings/Digital_marketing_content',
  ])
  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.employmentType, job.location, job.jobId]),
    [
      ['Backend Developer (Go / Python)', 'Engineering', 'Full-time', 'Chennai, India', 'backend-developer'],
      ['Frontend Developer (React / TypeScript)', 'Engineering', 'Full-time', 'Chennai, India', 'frontend-developer'],
      ['Embedded Software Developer (Linux / C)', 'Engineering', 'Full-time', 'Chennai, India', 'embedded-sw-developer'],
      ['Business Development - Lead Generation', 'Sales', 'Full-time', 'Chennai, India', 'BusinessDevelpoment_Lead_gen'],
      ['Product Growth Marketing- Intern', 'Marketing', 'Internship', 'Chennai, India', 'product_Marketing'],
      ['Digital Marketing Specialist', 'Marketing', 'Full-time', 'Chennai, India', 'Digital_marketing_content'],
    ],
  )
  assert.equal(jobs[0].source, 'cosgridnetworks')
  assert.equal(jobs[0].company, 'COSGrid Networks')
  assert.equal(jobs[0].applyUrl, 'https://www.cosgrid.com/company/careers/openings/backend-developer')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.ok(jobs.every(job => job.jobDescription.length >= 150 && (job.requiredSkills.length > 0 || job.minimumQualification)))
  for (const job of jobs.filter(job => !job.requiredSkills.length)) {
    assert.ok(job.minimumQualification)
    assert.ok(job.jobDescription.includes(job.minimumQualification))
    assert.match(job.jobDescription, /Responsibilities/)
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.reportedTotal, 8)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /unavailable-native-roles:sales-executive,sales-SDR$/)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('run propagates transport failure instead of claiming empty COSGrid inventory', async () => {
  assert.equal(import.meta != null, true)
  const scraper = createCosgridNetworksScraper({
    now: () => '2026-08-15T00:00:00.000Z',
  })

  assert.equal(scraper != null, true)

  const module = await import('./script.js')
  assert.equal(module.isVerifiedCosgridUnavailableError(createUnavailableError()), true)

  const unavailable = createUnavailableError()
  await assert.rejects(scraper.run({
    fetchText: async () => {
      throw unavailable
    },
  }), error => error === unavailable)
})
