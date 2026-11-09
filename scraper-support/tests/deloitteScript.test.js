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
} from '../../scraper/deloitte/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'deloitte',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Deloitte listings on the public India USI search route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://usijobs.deloitte.com/en_US/careersUSI',
  )
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://usijobs.deloitte.com/en_US/careersUSI/SearchJobs/?jobRecordsPerPage=10&jobOffset=10',
  )
})

test('extractSearchResults keeps Deloitte India jobs from the public USI search page', () => {
  const html = readFixture('search-results-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Anaplan - Consultant, Technical Transformation - Sales & Service - Customer',
    department: 'Deloitte Consulting India Private Limited',
    location: 'Multiple Locations',
    city: null,
    jobId: '357954',
    requisitionId: '357954',
    sourceUrl: 'https://usijobs.deloitte.com/en_US/careersUSI/JobDetail/USI-EH27-Consulting-Customer-S-S-Anaplan-Consultant-Technical-Transformation/357954',
  })
})

test('extractPaginationSummary reads Deloitte next-page offsets from the public search route', () => {
  const html = readFixture('search-results-page-1.html')

  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: true,
    pageSize: 10,
    nextOffset: 10,
  })
})

test('extractJobDetail reads Deloitte India detail metadata, multi-location listings, and apply links', () => {
  const html = readFixture('job-detail-357954.html')
  const detail = extractJobDetail(html, {
    title: 'Anaplan - Consultant, Technical Transformation - Sales & Service - Customer',
    department: 'Deloitte Consulting India Private Limited',
    location: 'Multiple Locations',
    city: null,
    jobId: '357954',
    requisitionId: '357954',
    sourceUrl: 'https://usijobs.deloitte.com/en_US/careersUSI/JobDetail/USI-EH27-Consulting-Customer-S-S-Anaplan-Consultant-Technical-Transformation/357954',
  })

  assert.equal(detail.title, 'Anaplan - Consultant, Technical Transformation - Sales & Service - Customer')
  assert.equal(detail.department, 'Deloitte Consulting India Private Limited')
  assert.equal(
    detail.location,
    'Bengaluru, Karnataka, India; Chennai, Tamil Nadu, India; Hyderabad, Telangana, India; Pune, Maharashtra, India',
  )
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.jobId, '357954')
  assert.equal(detail.requisitionId, '357954')
  assert.equal(detail.employmentType, null)
  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-05-28')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://usijobs.deloitte.com/en_US/careersUSI/Login?jobId=357954',
  )
  assert.deepEqual(detail.requiredSkills.slice(0, 3), [
    'Configure/custom build user stories, unit test, document design and deployment.',
    'Support story estimation using guidelines. Gradually pick up more complex stories; maintain defined velocity.',
    'Ensure quality via thorough unit testing and code coverage.',
  ])
  assert.match(detail.jobDescription, /The Customer Team empowers organizations/i)
  assert.match(detail.jobDescription, /Qualifications/i)
})

test('extractJobDetail falls back to Deloitte JobPosting JSON-LD when the rich-text block is unavailable', () => {
  const detail = extractJobDetail(`
    <a class="button button--default" href="https://usijobs.deloitte.com/en_US/careersUSI/Login?jobId=357954">Apply</a>
    <p class="paragraph">Requisition code: 357954</p>
    <script type="application/ld+json">
    {
      "@context": "http://schema.org",
      "@type": "JobPosting",
      "datePosted": "2026-05-28",
      "description": "<p>Primary responsibilities</p><ul><li>Build Anaplan models</li><li>Work with stakeholders</li></ul>"
    }
    </script>
  `, {
    title: 'Anaplan - Consultant, Technical Transformation - Sales & Service - Customer',
    department: 'Deloitte Consulting India Private Limited',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '357954',
    requisitionId: '357954',
    sourceUrl: 'https://usijobs.deloitte.com/en_US/careersUSI/JobDetail/USI-EH27-Consulting-Customer-S-S-Anaplan-Consultant-Technical-Transformation/357954',
  })

  assert.equal(detail.postingDate, '2026-05-28')
  assert.deepEqual(detail.requiredSkills, [
    'Build Anaplan models',
    'Work with stakeholders',
  ])
  assert.match(detail.jobDescription, /Primary responsibilities/i)
})

test('extractJobDetail prefers Deloitte JobPosting JSON-LD when the visible rich-text block is truncated', () => {
  const detail = extractJobDetail(`
    <div class="article__view__item view--row no-label view--rich-text">
      <span data-map="item-value" class="field-value">
        <p>Primary responsibilities</p>
      </span>
    </div>
    <a class="button button--default" href="https://usijobs.deloitte.com/en_US/careersUSI/Login?jobId=357954">Apply</a>
    <p class="paragraph">Requisition code: 357954</p>
    <script type="application/ld+json">
    {
      "@context": "http://schema.org",
      "@type": "JobPosting",
      "datePosted": "2026-05-28",
      "description": "<p>Primary responsibilities</p><ul><li>Build Anaplan models</li><li>Work with stakeholders</li></ul>"
    }
    </script>
  `, {
    title: 'Anaplan - Consultant, Technical Transformation - Sales & Service - Customer',
    department: 'Deloitte Consulting India Private Limited',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '357954',
    requisitionId: '357954',
    sourceUrl: 'https://usijobs.deloitte.com/en_US/careersUSI/JobDetail/USI-EH27-Consulting-Customer-S-S-Anaplan-Consultant-Technical-Transformation/357954',
  })

  assert.deepEqual(detail.requiredSkills, [
    'Build Anaplan models',
    'Work with stakeholders',
  ])
})
