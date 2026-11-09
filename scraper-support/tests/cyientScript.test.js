import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobDetailUrl,
  buildSearchPayload,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/cyient/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'cyient',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchPayload keeps Cyient searches on the public Zwayam careers contract', () => {
  assert.deepEqual(buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.cyient.com',
    companyId: 'MTU0ODY=',
  })

  assert.deepEqual(buildSearchPayload({ page: 2, keywords: 'writer' }), {
    filterCri: JSON.stringify({
      paginationStartNo: 10,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: 'writer',
    }),
    domain: 'careers.cyient.com',
    companyId: 'MTU0ODY=',
  })
})

test('buildJobDetailUrl keeps Cyient detail links on the public careers route', () => {
  assert.equal(
    buildJobDetailUrl('technical-writer-pune-india-2026051517003855'),
    'https://careers.cyient.com/cyient/jobview/technical-writer-pune-india-2026051517003855',
  )
})

test('extractSearchResults keeps only India jobs from Cyient Zwayam search responses', () => {
  const payload = readJsonFixture('search-results.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Technical Writer',
    company: 'Cyient',
    department: 'Automotive & Mobility (India) Associate',
    location: 'Pune',
    city: 'Pune',
    jobId: '29748',
    requisitionId: 'JR-069965',
    sourceUrl: 'https://careers.cyient.com/cyient/jobview/technical-writer-pune-india-2026051517003855',
    applyUrl: 'https://careers.cyient.com/cyient/jobview/technical-writer-pune-india-2026051517003855',
    employmentType: null,
    experienceRequired: '1-3 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['PTC Creo', 'PTC Arbortext Editor', 'Arbortext IsoDraw'],
    postingDate: '2026-05-15',
    closingDate: null,
    jobDescription: 'Roles & Responsibilities: Create/author Technical Manuals such as Operators Manauls, Maintenance Manuals, Parts Catalogs for automotive and agriculture products and systems.',
  })
})

test('extractPaginationSummary reads Cyient page sizes from the careers search response', () => {
  const payload = readJsonFixture('search-results.json')

  assert.deepEqual(extractPaginationSummary(payload), {
    hasNext: true,
    pageSize: 10,
    nextOffset: 10,
    totalCount: 132,
  })
})

test('extractJobDetail reads Cyient detail fields, skills, and closing dates', () => {
  const payload = readJsonFixture('job-detail-29748.json')
  const detail = extractJobDetail(payload, {
    title: 'Technical Writer',
    department: 'Automotive & Mobility (India) Associate',
    location: 'Pune',
    city: 'Pune',
    jobId: '29748',
    requisitionId: 'JR-069965',
    sourceUrl: 'https://careers.cyient.com/cyient/jobview/technical-writer-pune-india-2026051517003855',
  })

  assert.equal(detail.title, 'Technical Writer')
  assert.equal(detail.department, 'Automotive & Mobility (India) Associate')
  assert.equal(detail.location, 'Pune')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.jobId, '29748')
  assert.equal(detail.requisitionId, 'JR-069965')
  assert.equal(detail.employmentType, null)
  assert.equal(detail.experienceRequired, '1-3 years')
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [
    'PTC Creo',
    'PTC Arbortext Editor',
    'Arbortext IsoDraw',
  ])
  assert.equal(detail.postingDate, '2026-05-15')
  assert.equal(detail.closingDate, '2026-07-04')
  assert.equal(
    detail.applyUrl,
    'https://careers.cyient.com/cyient/jobview/technical-writer-pune-india-2026051517003855',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.cyient.com/cyient/jobview/technical-writer-pune-india-2026051517003855',
  )
  assert.match(detail.jobDescription, /Roles & Responsibilities/i)
  assert.match(detail.jobDescription, /Educational Qualification/i)
  assert.match(detail.jobDescription, /Required Skills/i)
})
