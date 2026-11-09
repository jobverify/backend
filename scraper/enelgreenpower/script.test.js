import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSearchUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from './script.js'

test('buildSearchUrl keeps Enel Green Power listings on the public Avature route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://jobs.enel.com/en_US/careers/JobOpenings/?jobRecordsPerPage=6&jobOffset=0',
  )
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://jobs.enel.com/en_US/careers/JobOpenings/?jobRecordsPerPage=6&jobOffset=6',
  )
})

test('extractSearchResults keeps only India Renewable Energies jobs from Enel public search pages', () => {
  const html = `
    <article class="article article--result article--non-toggle" id="article--1">
      <div class="article__header">
        <div class="article__header__text">
          <h3 class="article__header__text__title title title--04 ">
            <a class="link link_result" href="https://jobs.enel.com/en_US/careers/JobDetail/22990?team=RenewableEnergies">
              Solar Site Reliability Engineer
            </a>
          </h3>
          <div class="article__header__text__subtitle">
            <span class="list-item-location">Bengaluru, Karnataka, India</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-id">Role ID 22990</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-workerType">Regular Employee</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-department">Renewable Energies</span>
          </div>
        </div>
      </div>
    </article>
    <article class="article article--result article--non-toggle" id="article--2">
      <div class="article__header">
        <div class="article__header__text">
          <h3 class="article__header__text__title title title--04 ">
            <a class="link link_result" href="https://jobs.enel.com/en_US/careers/JobDetail/33991?team=Corporate">
              Finance Analyst
            </a>
          </h3>
          <div class="article__header__text__subtitle">
            <span class="list-item-location">Rome, Italy</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-id">Role ID 33991</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-workerType">Regular Employee</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-department">Corporate</span>
          </div>
        </div>
      </div>
    </article>
  `

  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Solar Site Reliability Engineer',
    department: 'Renewable Energies',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '22990',
    requisitionId: '22990',
    employmentType: 'Regular Employee',
    sourceUrl: 'https://jobs.enel.com/en_US/careers/JobDetail/22990?team=RenewableEnergies',
  })
})

test('extractPaginationSummary reads Enel next-page offsets from the public search route', () => {
  const html = `
    <a class="list-controls__pagination__item paginationNextLink"
       href="https://jobs.enel.com/en_US/careers/JobOpenings/?jobRecordsPerPage=6&amp;jobOffset=6">
      Next &gt;&gt;
    </a>
  `

  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: true,
    pageSize: 6,
    nextOffset: 6,
  })
})

test('extractJobDetail reads Enel Avature detail metadata and apply links', () => {
  const html = `
    <meta property="og:title" content="Solar Site Reliability Engineer" />
    <article class="article article--details regular-fields--cols-2Z regular-fields-label--inline table-fields-label--hidden">
      <div class="article__content">
        <div class="article__content__view">
          <div class="article__content__view__field field--locations regular-fields--cols-2Z-clearer">
            <div class="article__content__view__field__value">
              <strong>Locations</strong>: Bengaluru, Karnataka, India&nbsp; <br>
            </div>
          </div>
          <div class="article__content__view__field ">
            <div class="article__content__view__field__label">Role ID</div>
            <div class="article__content__view__field__value">22990</div>
          </div>
          <div class="article__content__view__field ">
            <div class="article__content__view__field__label">Worker Type</div>
            <div class="article__content__view__field__value">Regular Employee</div>
          </div>
          <div class="article__content__view__field ">
            <div class="article__content__view__field__label">Department</div>
            <div class="article__content__view__field__value">Renewable Energies</div>
          </div>
        </div>
      </div>
    </article>
    <article class="article article--details ">
      <div class="article__header">
        <div class="article__header__text">
          <h3 class="article__header__text__title title title--04">Description</h3>
        </div>
      </div>
      <div class="article__content">
        <div class="article__content__view">
          <div class="article__content__view__field ">
            <div class="article__content__view__field__value">
              <p>Maintain solar monitoring systems across India sites.</p>
              <p>Collaborate with operations and engineering stakeholders.</p>
            </div>
          </div>
        </div>
      </div>
    </article>
    <a class="button job-apply top" href="https://jobs.enel.com/en_US/careers/ApplicationMethods?jobId=22990">Apply</a>
  `

  const detail = extractJobDetail(html, {
    title: 'Solar Site Reliability Engineer',
    department: 'Renewable Energies',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '22990',
    requisitionId: '22990',
    employmentType: 'Regular Employee',
    sourceUrl: 'https://jobs.enel.com/en_US/careers/JobDetail/22990?team=RenewableEnergies',
  })

  assert.equal(detail.title, 'Solar Site Reliability Engineer')
  assert.equal(detail.department, 'Renewable Energies')
  assert.equal(detail.location, 'Bengaluru, Karnataka, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '22990')
  assert.equal(detail.requisitionId, '22990')
  assert.equal(detail.employmentType, 'Regular Employee')
  assert.equal(
    detail.applyUrl,
    'https://jobs.enel.com/en_US/careers/ApplicationMethods?jobId=22990',
  )
  assert.deepEqual(detail.requiredSkills, [
    'Maintain solar monitoring systems across India sites.',
    'Collaborate with operations and engineering stakeholders.',
  ])
  assert.match(detail.jobDescription, /Maintain solar monitoring systems/i)
})
