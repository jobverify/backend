import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'primenumberstechnologies',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedCareersHtml = readFixture('careers.html')
const accountExecutiveDetailHtml = readFixture('role-3vsn.html')
const dataEngineeringInternDetailHtml = readFixture('role-is77.html')
const businessDevelopmentManagerDetailHtml = readFixture('role-c632.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/primenumberstechnologies/script.js')
  } catch {
    assert.fail('Expected Primenumbers Technologies scraper module at ../../scraper/primenumberstechnologies/script.js')
  }
}

test('Primenumbers sentinels recognize the verified careers index and extract first-party role cards', async () => {
  const primenumbers = await loadModule()

  assert.equal(primenumbers.SOURCE, 'primenumberstechnologies')
  assert.equal(primenumbers.COMPANY, 'Primenumbers Technologies Private Limited')
  assert.equal(primenumbers.CAREERS_URL, 'https://primenumbers.in/careers/')
  assert.equal(primenumbers.hasOfficialCareersIndexSignal(verifiedCareersHtml), true)

  assert.deepEqual(primenumbers.extractRoleListings(verifiedCareersHtml), [
    {
      title: 'Account Executive - Renewals & Customer Success',
      location: 'Indiranagar, Bengaluru (On-site)',
      department: 'Sales',
      employmentType: 'Full Time',
      sourceUrl: 'https://primenumbers.in/careers/3vsn/',
      teaser:
        'We are seeking two Account Executives to manage our government contract bidding clients across India.',
    },
    {
      title: 'Data Engineering Intern',
      location: 'Indiranagar, Bengaluru',
      department: 'Technology & Engineering',
      employmentType: 'Full Time',
      sourceUrl: 'https://primenumbers.in/careers/is77/',
      teaser:
        'A 6-month, in-office internship building Palladium - the data + AI platform trusted by hundreds of mid-to-large Indian enterprises.',
    },
    {
      title: 'Business Development Manager (Enterprise Accounts)',
      location: 'Indiranagar, Bengaluru',
      department: 'Sales',
      employmentType: 'Full Time',
      sourceUrl: 'https://primenumbers.in/careers/c632/',
      teaser:
        "Drive enterprise sales for Primenumbers' AI business-intelligence platform - owning the full sales cycle from prospecting to close.",
    },
  ])
})

test('Primenumbers detail extraction trusts same-domain JobPosting pages and first-party apply links', async () => {
  const primenumbers = await loadModule()
  const sourceUrl = 'https://primenumbers.in/careers/3vsn/'

  assert.equal(primenumbers.hasOfficialJobDetailSignal(accountExecutiveDetailHtml, sourceUrl), true)

  assert.deepEqual(
    primenumbers.extractJobDetail(accountExecutiveDetailHtml, {
      title: 'Account Executive - Renewals & Customer Success',
      location: 'Indiranagar, Bengaluru (On-site)',
      department: 'Sales',
      employmentType: 'Full Time',
      sourceUrl,
      teaser:
        'We are seeking two Account Executives to manage our government contract bidding clients across India.',
    }),
    {
      title: 'Account Executive - Renewals & Customer Success',
      company: 'Primenumbers Technologies Private Limited',
      department: 'Sales',
      location: 'Indiranagar, Bengaluru (On-site)',
      city: 'Bengaluru',
      country: 'India',
      jobId: '3vsn',
      requisitionId: '3vsn',
      sourceUrl,
      applyUrl:
        'https://primenumbers.in/apply.html?t=RNiNhS-7e5AZ4F2jeW6w8k_NQ0CtGgT_cm6zWLJs9Pk&role=Account%20Executive%20-%20Renewals%20%26%20Customer%20Success',
      employmentType: 'Full Time',
      experienceRequired: 'Minimum 2+ years of experience in a technology company is mandatory.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Graduation is mandatory.',
        'MBA is mandatory.',
        'Minimum 2+ years of experience in a technology company is mandatory.',
      ],
      postingDate: '2026-07-08',
      closingDate: null,
      jobDescription:
        'We are seeking two Account Executives to manage our government contract bidding clients across India. The Account Executive will be the primary point of contact for a portfolio of accounts and will be responsible for renewals, issue resolution, client communication, and identifying cross-sell opportunities. Responsibilities: Own renewals for an assigned portfolio of government contract bidding clients across India. Act as the primary contact for client communication over calls, email, WhatsApp, and meetings. Requirements: Graduation is mandatory. MBA is mandatory. Minimum 2+ years of experience in a technology company is mandatory. Perks: Portfolio ownership with direct exposure to clients across India.',
    },
  )
})

test('Primenumbers run walks the first-party index and detail pages and decorates current openings', async () => {
  const primenumbers = await loadModule()
  const requestedUrls = []

  const jobs = await primenumbers.createPrimenumbersTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === primenumbers.CAREERS_URL) return verifiedCareersHtml
      if (url === 'https://primenumbers.in/careers/3vsn/') return accountExecutiveDetailHtml
      if (url === 'https://primenumbers.in/careers/is77/') return dataEngineeringInternDetailHtml
      if (url === 'https://primenumbers.in/careers/c632/') return businessDevelopmentManagerDetailHtml

      throw new Error(`Unexpected Primenumbers URL: ${url}`)
    },
    now: () => '2026-07-11T11:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    primenumbers.CAREERS_URL,
    'https://primenumbers.in/careers/3vsn/',
    'https://primenumbers.in/careers/is77/',
    'https://primenumbers.in/careers/c632/',
  ])

  assert.equal(jobs.length, 3)
  const expectedLegacyJob = {
    title: 'Account Executive - Renewals & Customer Success',
    company: 'Primenumbers Technologies Private Limited',
    department: 'Sales',
    location: 'Indiranagar, Bengaluru (On-site)',
    city: 'Bengaluru',
    country: 'India',
    source: 'primenumberstechnologies',
    sourceUrl: 'https://primenumbers.in/careers/3vsn/',
    applyUrl:
      'https://primenumbers.in/apply.html?t=RNiNhS-7e5AZ4F2jeW6w8k_NQ0CtGgT_cm6zWLJs9Pk&role=Account%20Executive%20-%20Renewals%20%26%20Customer%20Success',
    link:
      'https://primenumbers.in/apply.html?t=RNiNhS-7e5AZ4F2jeW6w8k_NQ0CtGgT_cm6zWLJs9Pk&role=Account%20Executive%20-%20Renewals%20%26%20Customer%20Success',
    jobId: '3vsn',
    requisitionId: '3vsn',
    employmentType: 'Full Time',
    experienceRequired: 'Minimum 2+ years of experience in a technology company is mandatory.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Graduation is mandatory.',
      'MBA is mandatory.',
      'Minimum 2+ years of experience in a technology company is mandatory.',
    ],
    postingDate: '2026-07-08',
    closingDate: null,
    jobDescription:
      'We are seeking two Account Executives to manage our government contract bidding clients across India. The Account Executive will be the primary point of contact for a portfolio of accounts and will be responsible for renewals, issue resolution, client communication, and identifying cross-sell opportunities. Responsibilities: Own renewals for an assigned portfolio of government contract bidding clients across India. Act as the primary contact for client communication over calls, email, WhatsApp, and meetings. Requirements: Graduation is mandatory. MBA is mandatory. Minimum 2+ years of experience in a technology company is mandatory. Perks: Portfolio ownership with direct exposure to clients across India.',
    scrapedAt: '2026-07-11T11:00:00.000Z',
  }
  assert.deepEqual(Object.fromEntries(Object.keys(expectedLegacyJob).map(key=>[key,jobs[0][key]])),expectedLegacyJob)
  assert.equal(jobs[0].nativeHiringOrganization.legalName,primenumbers.COMPANY)
  assert.equal(jobs[0].sourceDescription,jobs[0].nativeSourceRecord.description)
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)

  assert.equal(jobs[1].title, 'Data Engineering Intern')
  assert.equal(jobs[1].department, 'Technology & Engineering')
  assert.equal(jobs[1].employmentType, 'Full Time')
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[2].title, 'Business Development Manager (Enterprise Accounts)')
  assert.equal(jobs[2].department, 'Sales')
  assert.equal(jobs[2].experienceRequired, '2-4 years of experience in outbound or inside sales, preferably in SaaS, IT, or technology sales.')
})

test('Primenumbers fails closed when the verified index or detail contract drifts', async () => {
  const primenumbers = await loadModule()

  await assert.rejects(
    primenumbers.createPrimenumbersTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === primenumbers.CAREERS_URL) {
          return verifiedCareersHtml.replaceAll('primenumbers.in', 'unrelated.example')
        }

        throw new Error(`Unexpected Primenumbers URL: ${url}`)
      },
    }),
    /verified Primenumbers careers index/i,
  )

  await assert.rejects(
    primenumbers.createPrimenumbersTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === primenumbers.CAREERS_URL) return verifiedCareersHtml
        if (url === 'https://primenumbers.in/careers/3vsn/') {
          return accountExecutiveDetailHtml.replace('/apply.html?', '/resume.html?')
        }
        if (url === 'https://primenumbers.in/careers/is77/') return dataEngineeringInternDetailHtml
        if (url === 'https://primenumbers.in/careers/c632/') return businessDevelopmentManagerDetailHtml

        throw new Error(`Unexpected Primenumbers URL: ${url}`)
      },
    }),
    /verified Primenumbers job detail/i,
  )
})
