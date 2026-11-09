import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createScripboxScraper,
  extractIndiaJobsFromCareersPage,
  hasVerifiedCareersPageSignal,
} from './script.js'

const careersHtml = `<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Scripbox</title>
    <link rel="canonical" href="https://scripbox.com/pages/careers" />
  </head>
  <body>
    <main>
      <h1>Join us in helping make every Indian financially secure</h1>
      <section>
        <div>Job Openings</div>
        <div class="job-opening-wrapper">
          <p class="job-opening-title">
            <a target="_blank" href="https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a27e11ce1d9a?from=all" rel="noopener noreferrer nofollow">DevOps Engineer</a>
          </p>
          <p class="job-opening-location">Location: Bangalore, India <span class="full-time-label">Full Time</span></p>
        </div>
        <div class="job-opening-wrapper">
          <p class="job-opening-title">
            <a target="_blank" href="https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a5f04b4854a5?from=all" rel="noopener noreferrer nofollow">Project Manager</a>
          </p>
          <p class="job-opening-location">Location: Bangalore, India <span class="full-time-label">Full Time</span></p>
        </div>
        <div class="job-opening-wrapper">
          <p class="job-opening-title">
            <a target="_blank" href="https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a560cbbba247?from=all" rel="noopener noreferrer nofollow">Associate Relationship manager</a>
          </p>
          <p class="job-opening-location">Location: Delhi, India <span class="full-time-label">Full Time</span></p>
        </div>
      </section>
      <section>
        <div>Get In Touch</div>
      </section>
    </main>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          jobOpenings: [
            {
              job_id: 'a6a27e11ce1d9a',
              job_title: 'DevOps Engineer',
              location: ['Bangalore, Bangalore, Karnataka, India (SB_CO)'],
              location_city: ['Bangalore'],
              location_country: 'India',
              employee_type: 'Full Time',
              experience_from: '4',
              experience_to: '7',
              post_on_careers_page: 1,
            },
            {
              job_id: 'a6a5f04b4854a5',
              job_title: 'Project Manager',
              location: ['Bangalore, Bangalore, Karnataka, India (SB_CO)'],
              location_city: ['Bangalore'],
              location_country: 'India',
              employee_type: 'Full Time',
              experience_from: '5',
              experience_to: '8',
              post_on_careers_page: 1,
            },
            {
              job_id: 'a6a560cbbba247',
              job_title: 'Associate Relationship manager',
              location: ['Delhi, Delhi, Delhi, India (SB_CO)'],
              location_city: ['Delhi'],
              location_country: 'India',
              employee_type: 'Full Time',
              experience_from: '1',
              experience_to: '3',
              post_on_careers_page: 1,
            },
          ],
        },
      },
    })}</script>
  </body>
</html>`

test('Scripbox trusts the current first-party careers page even when public job titles rotate', () => {
  assert.equal(SOURCE, 'scripbox')
  assert.equal(COMPANY, 'Scripbox')
  assert.equal(CAREERS_URL, 'https://scripbox.com/pages/careers')
  assert.equal(hasVerifiedCareersPageSignal(careersHtml), true)

  assert.deepEqual(
    extractIndiaJobsFromCareersPage(careersHtml, {
      scrapedAt: '2026-08-04T10:00:00.000Z',
    }).map((job) => ({
      title: job.title,
      city: job.city,
      location: job.location,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      experienceRequired: job.experienceRequired,
    })),
    [
      {
        title: 'DevOps Engineer',
        city: 'Bangalore',
        location: 'Bangalore, India',
        jobId: 'a6a27e11ce1d9a',
        sourceUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a27e11ce1d9a?from=all',
        experienceRequired: '4-7 years',
      },
      {
        title: 'Project Manager',
        city: 'Bangalore',
        location: 'Bangalore, India',
        jobId: 'a6a5f04b4854a5',
        sourceUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a5f04b4854a5?from=all',
        experienceRequired: '5-8 years',
      },
      {
        title: 'Associate Relationship manager',
        city: 'Delhi',
        location: 'Delhi, India',
        jobId: 'a6a560cbbba247',
        sourceUrl: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a560cbbba247?from=all',
        experienceRequired: '1-3 years',
      },
    ],
  )
})

test('Scripbox scraper run returns current public India roles from the verified careers page', async () => {
  const requestedUrls = []

  const jobs = await createScripboxScraper().run({
    detailEnrichmentBudgetMs: 0,
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
    now: () => '2026-08-04T10:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      company: job.company,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'DevOps Engineer',
        source: 'scripbox',
        company: 'Scripbox',
        link: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a27e11ce1d9a?from=all',
        scrapedAt: '2026-08-04T10:00:00.000Z',
      },
      {
        title: 'Project Manager',
        source: 'scripbox',
        company: 'Scripbox',
        link: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a5f04b4854a5?from=all',
        scrapedAt: '2026-08-04T10:00:00.000Z',
      },
      {
        title: 'Associate Relationship manager',
        source: 'scripbox',
        company: 'Scripbox',
        link: 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a560cbbba247?from=all',
        scrapedAt: '2026-08-04T10:00:00.000Z',
      },
    ],
  )
})
