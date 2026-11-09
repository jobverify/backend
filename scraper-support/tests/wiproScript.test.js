import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import {
  buildApplyUrl,
  buildDetailUrl,
  buildSearchRequestPayload,
  extractJobDetail,
  extractSearchResults,
  extractSearchSummary,
  normalizeEmploymentType,
} from '../../scraper/wipro/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'wipro',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFixture(name))

test('buildSearchRequestPayload keeps Wipro listings on the official SuccessFactors jobs API contract', () => {
  assert.deepEqual(buildSearchRequestPayload(), {
    keywords: '',
    locale: 'en_US',
    location: 'India',
    pageNumber: 0,
    sortBy: 'recent',
  })

  assert.deepEqual(buildSearchRequestPayload(3), {
    keywords: '',
    locale: 'en_US',
    location: 'India',
    pageNumber: 3,
    sortBy: 'recent',
  })
})

test('extractSearchResults parses Wipro SuccessFactors JSON and filters listings to India roles', () => {
  const payload = readJsonFixture('search-results-page-0.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Intern L0 1',
    location: 'Bengaluru, Chennai, Hyderabad, Mumbai, Pune, Delhi, Kochi, New Delhi, India',
    city: 'Bengaluru',
    state: 'Delhi, Karnataka, Kerala, Maharashtra, Tamil Nadu, Telangana',
    jobId: '185093',
    requisitionId: '185093',
    sourceUrl: 'https://careers.wipro.com/job/Intern-L0-1/185093-en_US/',
    applyUrl: 'https://careers.wipro.com/talentcommunity/apply/185093/?locale=en_US&jobID=185093#tracked',
    postingDate: '6/25/26',
    closingDate: '7/2/26',
  })

  assert.deepEqual(jobs[1], {
    title: 'M365 Solution architect',
    location: 'Bengaluru, Bhubaneswar, Chennai, Coimbatore, Delhi, Kolkata, Mumbai, New Delhi, Pune, India',
    city: 'Bengaluru',
    state: 'Delhi, Karnataka, Maharashtra, Odisha, Tamil Nadu, West Bengal',
    jobId: '159390',
    requisitionId: '159390',
    sourceUrl: 'https://careers.wipro.com/job/M365-Solution-architect/159390-en_US/',
    applyUrl: 'https://careers.wipro.com/talentcommunity/apply/159390/?locale=en_US&jobID=159390#tracked',
    postingDate: '4/20/26',
    closingDate: '6/30/26',
  })
})

test('extractSearchSummary reads Wipro total result counts from the SuccessFactors jobs API payload', () => {
  const payload = readJsonFixture('search-results-page-0.json')

  assert.deepEqual(extractSearchSummary(payload), {
    totalJobCount: 5884,
    pageSize: 3,
  })
})

test('normalizeEmploymentType maps Wipro titles into Jobverify employment types', () => {
  assert.equal(normalizeEmploymentType('Intern L0 1'), 'Internship')
  assert.equal(normalizeEmploymentType('Contract Analyst'), 'Contract')
  assert.equal(normalizeEmploymentType('M365 Solution architect'), 'Full-time')
})

test('extractJobDetail pulls Wipro title, location, description, and public apply route from an internship detail page', () => {
  const html = readFixture('job-detail-185093.html')
  const detail = extractJobDetail(html, {
    title: 'Intern L0 1',
    location: 'Bengaluru, Chennai, Hyderabad, Mumbai, Pune, Delhi, Kochi, New Delhi, India',
    city: 'Bengaluru',
    state: 'Delhi, Karnataka, Kerala, Maharashtra, Tamil Nadu, Telangana',
    jobId: '185093',
    requisitionId: '185093',
    sourceUrl: buildDetailUrl('Intern L0 1', '185093'),
    applyUrl: buildApplyUrl('185093'),
    postingDate: '6/25/26',
    closingDate: '7/2/26',
  })

  assert.equal(detail.title, 'Intern L0 1')
  assert.equal(detail.location, 'Bengaluru, Chennai, Hyderabad, Mumbai, Pune, Delhi, Kochi, New Delhi, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.employmentType, 'Internship')
  assert.match(detail.jobDescription, /North America's Transformation Team/i)
  assert.deepEqual(detail.requiredSkills.slice(0, 2), [
    'Collaborate with global teams and senior leaders on internal initiatives aligned to our strategic partners.',
    'Initiatives will offer practical experience and exposure to the Wipro organization.',
  ])
  assert.equal(detail.postingDate, '6/25/26')
  assert.equal(detail.applyUrl, 'https://careers.wipro.com/talentcommunity/apply/185093/?locale=en_US&jobID=185093#tracked')
  assert.equal(detail.sourceUrl, 'https://careers.wipro.com/job/Intern-L0-1/185093-en_US/')
  assert.equal(detail.publicExperienceChecked, true)
  assert.equal(detail.experienceRequired, null)
})

test('extractJobDetail keeps nested Wipro description markup intact and extracts public experience from it', () => {
  const detail = extractJobDetail(`
    <div class="jobDisplayShell">
      <span itemprop="title" class="rtltextaligneligible">Digital Workplace Practice Architect</span>
      <div class="joblayouttoken displayDTM ">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <span class="joblayouttoken-label" role="heading" aria-level="2">Job Description:\u00a0</span>
              <span class="rtltextaligneligible">
                <div>
                  <p>Solution Strategy, Architecture &amp; Integration</p>
                  <p><span>Qualifications:</span></p>
                  <ul>
                    <li>A minimum of ten years of experience in pre-sales and solution designing</li>
                    <li>Proven experience in managing digital workplace services or related IT functions</li>
                  </ul>
                </div>
              </span>
            </div>
          </div>
        </div>
      </div>
      <script>
        j2w.Apply.init({ jobID: 133747, locale: 'en_US' });
      </script>
    </div>
  `, {
    title: 'Digital Workplace Practice Architect',
    location: 'Bengaluru, Mumbai, Pune, India',
    city: 'Bengaluru',
    state: 'Delhi, Karnataka, Maharashtra',
    jobId: '133747',
    requisitionId: '133747',
    sourceUrl: buildDetailUrl('Digital Workplace Practice Architect', '133747'),
    applyUrl: buildApplyUrl('133747'),
    postingDate: '2/10/26',
  })

  assert.match(detail.jobDescription, /ten years of experience in pre-sales and solution designing/i)
  assert.equal(detail.experienceRequired, '10+ years')
  assert.equal(detail.publicExperienceChecked, true)
  assert.deepEqual(detail.requiredSkills.slice(0, 2), [
    'A minimum of ten years of experience in pre-sales and solution designing',
    'Proven experience in managing digital workplace services or related IT functions',
  ])
})

test('extractJobDetail marks Wipro roles as publicly checked when the detail page is present but does not specify experience', () => {
  const detail = extractJobDetail(`
    <div class="jobDisplayShell">
      <span itemprop="title" class="rtltextaligneligible">Associate - Construction 1</span>
      <div class="joblayouttoken displayDTM ">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <span class="joblayouttoken-label" role="heading" aria-level="2">Job Description:\u00a0</span>
              <span class="rtltextaligneligible">
                <div>
                  <p>Support construction operations and project coordination across active delivery locations.</p>
                </div>
              </span>
            </div>
          </div>
        </div>
      </div>
      <script>
        j2w.Apply.init({ jobID: 191066, locale: 'en_US' });
      </script>
    </div>
  `, {
    title: 'Associate - Construction 1',
    location: 'Bengaluru, Chennai, Kolkata, Pune, India',
    city: 'Bengaluru',
    state: 'Karnataka, Maharashtra, Tamil Nadu, West Bengal',
    jobId: '191066',
    requisitionId: '191066',
    sourceUrl: buildDetailUrl('Associate - Construction 1', '191066'),
    applyUrl: buildApplyUrl('191066'),
    postingDate: '7/28/26',
  })

  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.publicExperienceChecked, true)
})

test('normalizeScrapedJob composes Wipro internship and experienced job types from the extracted detail data', () => {
  const internDetail = extractJobDetail(readFixture('job-detail-185093.html'), {
    title: 'Intern L0 1',
    location: 'Bengaluru, Chennai, Hyderabad, Mumbai, Pune, Delhi, Kochi, New Delhi, India',
    city: 'Bengaluru',
    state: 'Delhi, Karnataka, Kerala, Maharashtra, Tamil Nadu, Telangana',
    jobId: '185093',
    requisitionId: '185093',
    sourceUrl: buildDetailUrl('Intern L0 1', '185093'),
    applyUrl: buildApplyUrl('185093'),
    postingDate: '6/25/26',
    closingDate: '7/2/26',
  })
  const experiencedDetail = extractJobDetail(readFixture('job-detail-159390.html'), {
    title: 'M365 Solution architect',
    location: 'Bengaluru, Bhubaneswar, Chennai, Coimbatore, Delhi, Kolkata, Mumbai, New Delhi, Pune, India',
    city: 'Bengaluru',
    state: 'Delhi, Karnataka, Maharashtra, Odisha, Tamil Nadu, West Bengal',
    jobId: '159390',
    requisitionId: '159390',
    sourceUrl: buildDetailUrl('M365 Solution architect', '159390'),
    applyUrl: buildApplyUrl('159390'),
    postingDate: '4/20/26',
    closingDate: '6/30/26',
  })

  const normalizedIntern = normalizeScrapedJob(internDetail, {
    source: 'wipro',
    companyName: 'Wipro Limited',
    companyCareerPage: 'https://careers.wipro.com/search/',
    atsPlatform: 'successfactors',
  })
  const normalizedExperienced = normalizeScrapedJob(experiencedDetail, {
    source: 'wipro',
    companyName: 'Wipro Limited',
    companyCareerPage: 'https://careers.wipro.com/search/',
    atsPlatform: 'successfactors',
  })

  assert.equal(normalizedIntern.employmentType, 'Internship')
  assert.equal(normalizedIntern.jobType, 'Intern')
  assert.equal(normalizedExperienced.employmentType, 'Full-time')
  assert.equal(normalizedExperienced.jobType, 'Full-time Experienced')
})
