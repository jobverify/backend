import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSearchUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/electronicarts/script.js'

test('buildSearchUrl keeps Electronic Arts listings on the public Avature route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://jobs.ea.com/en_US/careers/Home/?jobRecordsPerPage=20&jobOffset=0',
  )
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://jobs.ea.com/en_US/careers/Home/?jobRecordsPerPage=20&jobOffset=20',
  )
})

test('extractSearchResults keeps only India jobs from Electronic Arts public search pages', () => {
  const html = `
    <article class="article article--result article--non-toggle" id="article--1">
      <div class="article__header">
        <div class="article__header__text">
          <h3 class="article__header__text__title title title--04 ">
            <a class="link link_result" href="https://jobs.ea.com/en_US/careers/JobDetail/Data-Science-Engineer/208410">
              Data Science Engineer
            </a>
          </h3>
          <div class="article__header__text__subtitle">
            <span class="list-item-location">Hyderabad, Telangana, India</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-id">Role ID 208410</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-workerType">Regular Employee</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-department">CTO - IT</span>
          </div>
        </div>
      </div>
    </article>
    <article class="article article--result article--non-toggle" id="article--2">
      <div class="article__header">
        <div class="article__header__text">
          <h3 class="article__header__text__title title title--04 ">
            <a class="link link_result" href="https://jobs.ea.com/en_US/careers/JobDetail/Core-Agentic-Solutions-Lead-Architect/214206">
              Core Agentic Solutions Lead Architect
            </a>
          </h3>
          <div class="article__header__text__subtitle">
            <span class="list-item-location">Galway, Ireland</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-id">Role ID 214206</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-workerType">Regular Employee</span>
            <span class="separator">&nbsp;&#8226;&nbsp;</span>
            <span class="list-item-department">Marketing</span>
          </div>
        </div>
      </div>
    </article>
  `

  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Data Science Engineer',
    department: 'CTO - IT',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '208410',
    requisitionId: '208410',
    employmentType: 'Regular Employee',
    sourceUrl: 'https://jobs.ea.com/en_US/careers/JobDetail/Data-Science-Engineer/208410',
  })
})

test('extractPaginationSummary reads Electronic Arts next-page offsets from the public search route', () => {
  const html = `
    <a class="list-controls__pagination__item paginationNextLink"
       href="https://jobs.ea.com/en_US/careers/Home/?jobRecordsPerPage=20&amp;jobOffset=20">
      Next &gt;&gt;
    </a>
  `

  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: true,
    pageSize: 20,
    nextOffset: 20,
  })
})

test('extractJobDetail reads Electronic Arts detail metadata and description content', () => {
  const html = `
    <meta property="og:title" content="Data Science Engineer" />
    <article class="article article--details regular-fields--cols-2Z regular-fields-label--inline table-fields-label--hidden">
      <div class="article__content">
        <div class="article__content__view">
          <div class="article__content__view__field field--locations regular-fields--cols-2Z-clearer">
            <div class="article__content__view__field__value">
              <strong>Locations</strong>: Hyderabad, Telangana, India&nbsp; <br>
            </div>
          </div>
          <div class="article__content__view__field ">
            <div class="article__content__view__field__label">Role ID</div>
            <div class="article__content__view__field__value">208410</div>
          </div>
          <div class="article__content__view__field ">
            <div class="article__content__view__field__label">Worker Type</div>
            <div class="article__content__view__field__value">Regular Employee</div>
          </div>
          <div class="article__content__view__field ">
            <div class="article__content__view__field__label">Studio/Department</div>
            <div class="article__content__view__field__value">CTO - IT</div>
          </div>
          <div class="article__content__view__field ">
            <div class="article__content__view__field__label">Work Model</div>
            <div class="article__content__view__field__value">Hybrid</div>
          </div>
        </div>
      </div>
    </article>
    <article class="article article--details ">
      <div class="article__header">
        <div class="article__header__text">
          <h3 class="article__header__text__title title title--04">Description &amp; Requirements</h3>
        </div>
      </div>
      <div class="article__content">
        <div class="article__content__view">
          <div class="article__content__view__field ">
            <div class="article__content__view__field__value">
              <p><strong>Responsibilities:</strong></p>
              <p>&nbsp;• &nbsp;Build scalable ML pipelines.</p>
              <p>&nbsp;• &nbsp;Partner with product and engineering teams.</p>
              <p><strong>Qualifications:</strong></p>
              <p>&nbsp;• &nbsp;Expert Python experience.</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  `

  const detail = extractJobDetail(html, {
    title: 'Data Science Engineer',
    department: 'CTO - IT',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '208410',
    requisitionId: '208410',
    employmentType: 'Regular Employee',
    sourceUrl: 'https://jobs.ea.com/en_US/careers/JobDetail/Data-Science-Engineer/208410',
  })

  assert.equal(detail.title, 'Data Science Engineer')
  assert.equal(detail.department, 'CTO - IT')
  assert.equal(detail.location, 'Hyderabad, Telangana, India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.jobId, '208410')
  assert.equal(detail.requisitionId, '208410')
  assert.equal(detail.employmentType, 'Regular Employee')
  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, null)
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://jobs.ea.com/en_US/careers/JobDetail/Data-Science-Engineer/208410',
  )
  assert.equal(detail.workModel, 'Hybrid')
  assert.deepEqual(detail.requiredSkills, [
    'Build scalable ML pipelines.',
    'Partner with product and engineering teams.',
    'Expert Python experience.',
  ])
  assert.match(detail.jobDescription, /Responsibilities/i)
  assert.match(detail.jobDescription, /Qualifications/i)
})
