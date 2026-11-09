import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACL_CAREERS_URL,
  ACL_INDIA_JOBS_URL,
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  JOBS_URL,
  REDIRECT_TARGET_URL,
  SOURCE,
  createWaferSpaceScraper,
  hasGenericAclCareersHandoff,
  hasOfficialRedirectTargetSignal,
  hasWaferSpaceSpecificHiringSignal,
  isVerifiedMissingCareersRoute,
} from './script.js'

const redirectPage = {
  status: 200,
  url: REDIRECT_TARGET_URL,
  html: `
    <html>
      <head>
        <title>Innovative Solutions for Semiconductor Industry| ACL Digital</title>
      </head>
      <body>
        <a href="/careers">Join The Team</a>
        <h1>From Design to Silicon, Power the Future with Our Full-Cycle VLSI Expertise</h1>
        <p>Leading Complete VLSI Design and Production with Our Spec-to-Silicon Excellence</p>
        <p>ACL Digital accelerates innovation by offering chip-to-cloud digital transformation solutions.</p>
      </body>
    </html>
  `,
}

const missingCareersPage = {
  status: 404,
  url: CAREERS_URL,
  html: '<html><body><h1>404</h1><p>Not Found</p></body></html>',
}

const missingJobsPage = {
  status: 404,
  url: JOBS_URL,
  html: '<html><body><h1>404</h1><p>Not Found</p></body></html>',
}

const aclCareersPage = {
  status: 200,
  url: ACL_CAREERS_URL,
  html: `
    <html>
      <head>
        <title>Careers - ACL Digital</title>
      </head>
      <body>
        <h1>Ignite Your Passion for Innovation and Unleash True Potential</h1>
        <a href="https://recruitment.acldigital.com/">Jobs In India</a>
        <a href="https://www2.jobdiva.com/">Jobs In The USA</a>
      </body>
    </html>
  `,
}

const aclIndiaJobsPage = {
  status: 200,
  url: ACL_INDIA_JOBS_URL,
  html: `
    <!doctype html>
    <html data-ng-app="TalentRecruit" lang="en">
      <head>
        <title>ACL Digital</title>
      </head>
      <body>
        <h1>Search Jobs</h1>
        <p>ACL Digital</p>
      </body>
    </html>
  `,
}

test('Wafer Space sentinel stays pinned to the verified official redirect and generic ACL handoff', () => {
  assert.equal(SOURCE, 'waferspace')
  assert.equal(COMPANY, 'Wafer Space')
  assert.equal(HOMEPAGE_URL, 'https://waferspace.com/')
  assert.equal(REDIRECT_TARGET_URL, 'https://www.acldigital.com/industries/semiconductor')
  assert.equal(CAREERS_URL, 'https://waferspace.com/careers')
  assert.equal(JOBS_URL, 'https://waferspace.com/jobs')
  assert.equal(ACL_CAREERS_URL, 'https://www.acldigital.com/careers')
  assert.equal(ACL_INDIA_JOBS_URL, 'https://recruitment.acldigital.com/')
  assert.equal(hasOfficialRedirectTargetSignal(redirectPage), true)
  assert.equal(isVerifiedMissingCareersRoute(missingCareersPage), true)
  assert.equal(isVerifiedMissingCareersRoute(missingJobsPage), true)
  assert.equal(hasGenericAclCareersHandoff(aclCareersPage.html), true)
  assert.equal(hasWaferSpaceSpecificHiringSignal(redirectPage.html), false)
  assert.equal(hasWaferSpaceSpecificHiringSignal(aclCareersPage.html), false)
  assert.equal(hasWaferSpaceSpecificHiringSignal(aclIndiaJobsPage.html), false)
})

test('Wafer Space sentinel returns no jobs only while the verified non-listing surface remains unchanged', async () => {
  const requests = []
  const scraper = createWaferSpaceScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requests.push(url)

      if (url === HOMEPAGE_URL) return redirectPage
      if (url === CAREERS_URL) return missingCareersPage
      if (url === JOBS_URL) return missingJobsPage
      if (url === ACL_CAREERS_URL) return aclCareersPage
      if (url === ACL_INDIA_JOBS_URL) return aclIndiaJobsPage

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    HOMEPAGE_URL,
    CAREERS_URL,
    JOBS_URL,
    ACL_CAREERS_URL,
    ACL_INDIA_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Wafer Space sentinel fails closed if the redirect starts exposing Wafer Space-specific hiring', async () => {
  const scraper = createWaferSpaceScraper()

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            ...redirectPage,
            html: `
              <html>
                <body>
                  <h1>Wafer Space Careers</h1>
                  <a href="https://jobs.lever.co/waferspace">Apply now</a>
                </body>
              </html>
            `,
          }
        }

        if (url === CAREERS_URL) return missingCareersPage
        if (url === JOBS_URL) return missingJobsPage
        if (url === ACL_CAREERS_URL) return aclCareersPage
        if (url === ACL_INDIA_JOBS_URL) return aclIndiaJobsPage

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Wafer Space official redirect target now appears to expose hiring content/i,
  )
})
