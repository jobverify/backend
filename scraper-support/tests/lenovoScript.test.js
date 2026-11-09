import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildSearchUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/lenovo/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lenovo',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Lenovo listings on the public India search route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://jobs.lenovo.com/en_US/careers/SearchJobs/?3_130_3=37',
  )
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://jobs.lenovo.com/en_US/careers/SearchJobs/?3_130_3=37&jobRecordsPerPage=10&jobOffset=10',
  )
})

test('extractSearchResults keeps only India jobs from Lenovo public search pages', () => {
  const html = readFixture('search-results-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Solutions & Services Executive',
    department: 'Sales',
    location: 'India, Karnataka, Bangalore',
    city: 'Bangalore',
    jobId: '79100',
    requisitionId: 'WD00100939',
    sourceUrl: 'https://jobs.lenovo.com/en_US/careers/JobDetail/Solutions-Services-Executive/79100',
  })
})

test('extractPaginationSummary reads Lenovo next-page offsets from the public search route', () => {
  const html = readFixture('search-results-page-1.html')

  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: true,
    pageSize: 10,
    nextOffset: 10,
  })
})

test('extractJobDetail reads Lenovo detail metadata, public apply links, and HTML description', () => {
  const html = readFixture('job-detail-79100.html')
  const detail = extractJobDetail(html, {
    title: 'Solutions & Services Executive',
    department: 'Sales',
    location: 'India, Karnataka, Bangalore',
    city: 'Bangalore',
    jobId: '79100',
    requisitionId: 'WD00100939',
    sourceUrl: 'https://jobs.lenovo.com/en_US/careers/JobDetail/Solutions-Services-Executive/79100',
    postingDate: '26-Jun-2026',
  })

  assert.equal(detail.title, 'Solutions & Services Executive')
  assert.equal(detail.department, 'Sales')
  assert.equal(detail.location, 'India, Karnataka, Bangalore')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.jobId, '79100')
  assert.equal(detail.requisitionId, 'WD00100939')
  assert.equal(detail.employmentType, null)
  assert.equal(detail.experienceRequired, '15+ years')
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [])
  assert.equal(detail.postingDate, '2026-06-26')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://jobs.lenovo.com/en_US/careers/Login?jobId=79100',
  )
  assert.equal(
    detail.sourceUrl,
    'https://jobs.lenovo.com/en_US/careers/JobDetail/Solutions-Services-Executive/79100',
  )
  assert.match(detail.jobDescription, /Senior Solutions & Services Sales Professional/i)
  assert.match(detail.jobDescription, /Solutions & Services Group/i)
  assert.match(detail.jobDescription, /Minimum Requirements/i)
  assert.equal(detail.publicExperienceChecked, true)
})

test('extractJobDetail prefers the Description and Requirements article on newer Lenovo detail pages', () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Advisory Solution Architect" />
      </head>
      <body>
        <article class="article article--details regular-fields--cols-2 js_collapsible">
          <div class="article__header"><h2>General Information</h2></div>
          <div class="article__content__view__field">
            <div class="article__content__view__field__label">Working time</div>
            <div class="article__content__view__field__value">Full-time</div>
          </div>
        </article>
        <article class="article article--details  js_collapsible">
          <div class="article__header"><h2>Description and Requirements</h2></div>
          <p><strong>Role Brief</strong></p>
          <p>We are seeking a customer-focused Solution Architect.</p>
          <p><strong>Required Qualifications</strong></p>
          <ul>
            <li>5+ years of experience in Managed Services and solution development.</li>
          </ul>
        </article>
        <a class="button button--primary" href="/en_US/careers/Login?jobId=80288">Apply</a>
        <meta name="Description" content="Advisory Solution Architect at created 31-Jul-2026" />
      </body>
    </html>
  `

  const detail = extractJobDetail(html, {
    title: 'Advisory Solution Architect',
    department: 'Information Technology',
    location: 'India, Karnataka, Bangalore',
    city: 'Bangalore',
    jobId: '80288',
    requisitionId: 'WD00102423',
    sourceUrl: 'https://jobs.lenovo.com/en_US/careers/JobDetail/Advisory-Solution-Architect/80288',
  })

  assert.equal(detail.title, 'Advisory Solution Architect')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '5+ years')
  assert.equal(detail.publicExperienceChecked, true)
  assert.match(detail.jobDescription, /^Role Brief/i)
  assert.doesNotMatch(detail.jobDescription, /General Information/i)
  assert.match(detail.jobDescription, /Required Qualifications/i)
  assert.equal(
    detail.applyUrl,
    'https://jobs.lenovo.com/en_US/careers/Login?jobId=80288',
  )
  assert.equal(detail.postingDate, '2026-07-31')
})
