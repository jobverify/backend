import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Mad Street Den®</title>
  </head>
  <body>
    <h1>Careers at Mad Street Den®</h1>
    <p>Current Openings</p>
    <div id="jobList"></div>
    <p>
      If the position that you're looking for is currently unavailable, reach out to us
      <a href="https://msd.darwinbox.in/ms/candidate/careers/others?apply=1">here</a>
    </p>
  </body>
</html>
`

const driftedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <p>Placeholder</p>
  </body>
</html>
`

const darwinboxEmptyBoardText = `
Careers
LOGIN
Sign Up
Search for jobs
Current Openings
No jobs found
Please try using a different set of filter combinations
If you don’t see any open positions, please submit your resume & we will get back to you if there are any suitable openings that match your profile.
Apply here
Powered by: darwinbox
`

const darwinboxShellPage = {
  status: 200,
  url: 'https://msd.darwinbox.in/ms/candidate/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title></title>
        <base href="/ms/candidatev2/">
      </head>
      <body>
        <app-root></app-root>
        <script type="module" src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.esm.js"></script>
        <script nomodule src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.js"></script>
        <script src="/ms/formbuilder/assets/db-form/db-form.js"></script>
      </body>
    </html>
  `,
}

const darwinboxBrandedStubPage = {
  status: 200,
  url: 'https://msd.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <title>Mad Street Den</title>
        <meta property="og:title" content="Mad Street Den " />
        <meta property="og:image" content="https://s3-ap-southeast-1.amazonaws.com/darwinbox-data/logo.png" />
        <meta property="og:image:alt" content="Mad Street Den" />
      </head>
      <body>
        Mad Street Den -
      </body>
    </html>
  `,
}

const darwinboxLiveJobsText = `
Careers
Search for jobs
Current Openings
Senior Machine Learning Engineer
Bengaluru, India
Apply now
Powered by: darwinbox
`

const apiInvalidUrlResponse = {
  status: 401,
  url: 'https://www.madstreetden.com/api/joblist.php',
  html: '{"status":0,"message":"Invalid Url"}',
}

const apiLiveJobsResponse = {
  status: 200,
  url: 'https://www.madstreetden.com/api/joblist.php',
  html: '[{"job_id":"job-123","title":"Senior Machine Learning Engineer"}]',
}

const loadModule = async () => {
  try {
    return await import('../../scraper/madstreetden/script.js')
  } catch {
    assert.fail('Expected Mad Street Den scraper module at ../../scraper/madstreetden/script.js')
  }
}

test('Mad Street Den helpers stay pinned to the verified exact-name first-party empty-board contract', async () => {
  const madStreetDen = await loadModule()

  assert.equal(madStreetDen.SOURCE, 'madstreetden')
  assert.equal(madStreetDen.COMPANY, 'Mad Street Den')
  assert.equal(madStreetDen.OFFICIAL_BRAND_NAME, 'Mad Street Den')
  assert.equal(madStreetDen.VERIFIED_ON, '2026-08-15')
  assert.equal(madStreetDen.HOMEPAGE_URL, 'https://www.madstreetden.com/')
  assert.equal(madStreetDen.CAREERS_URL, 'https://www.madstreetden.com/careers/')
  assert.equal(madStreetDen.JOBLIST_API_URL, 'https://www.madstreetden.com/api/joblist.php')
  assert.equal(
    madStreetDen.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://msd.darwinbox.in/ms/candidate/careers/others?apply=1',
  )
  assert.equal(
    madStreetDen.DARWINBOX_PUBLIC_BOARD_URL,
    'https://msd.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    madStreetDen.extractOfficialDarwinboxHandoffUrl(careersHtml),
    madStreetDen.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(madStreetDen.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(madStreetDen.isVerifiedJobListApiFailure(apiInvalidUrlResponse), true)
  assert.equal(madStreetDen.hasVerifiedDarwinboxEmptyBoardSignal(darwinboxEmptyBoardText), true)
  assert.equal(madStreetDen.hasVerifiedDarwinboxShellSignal(darwinboxShellPage), true)
  assert.equal(madStreetDen.hasVerifiedDarwinboxShellSignal(darwinboxBrandedStubPage), true)
  assert.equal(madStreetDen.textExposesPublicJobs(darwinboxEmptyBoardText), false)
  assert.equal(madStreetDen.textExposesPublicJobs(darwinboxLiveJobsText), true)
})

test('Mad Street Den returns [] only while the official careers page, joblist API, and Darwinbox board stay in the verified empty contract', async () => {
  const madStreetDen = await loadModule()
  const requestedUrls = []
  const requestedBoardUrls = []

  const jobs = await madStreetDen.createMadStreetDenScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === madStreetDen.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === madStreetDen.JOBLIST_API_URL) {
        return apiInvalidUrlResponse
      }

      throw new Error(`Unexpected Mad Street Den URL: ${url}`)
    },
    fetchDarwinboxBoardPage: async (url) => {
      requestedBoardUrls.push(url)
      return {
        status: 200,
        url,
        html: `<html><body>${darwinboxEmptyBoardText}</body></html>`,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    madStreetDen.CAREERS_URL,
    madStreetDen.JOBLIST_API_URL,
  ])
  assert.deepEqual(requestedBoardUrls, [madStreetDen.DARWINBOX_PUBLIC_BOARD_URL])
  assert.deepEqual(jobs, [])
})

test('Mad Street Den also accepts the verified raw Darwinbox shell contract', async () => {
  const madStreetDen = await loadModule()

  const jobs = await madStreetDen.createMadStreetDenScraper().run({
    fetchPage: async (url) => {
      if (url === madStreetDen.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === madStreetDen.JOBLIST_API_URL) {
        return apiInvalidUrlResponse
      }

      throw new Error(`Unexpected Mad Street Den URL: ${url}`)
    },
    fetchDarwinboxBoardPage: async () => darwinboxBrandedStubPage,
  })

  assert.deepEqual(jobs, [])
})

test('Mad Street Den fails closed when the official careers page, joblist API, or Darwinbox board changes materially', async () => {
  const madStreetDen = await loadModule()

  await assert.rejects(
    madStreetDen.createMadStreetDenScraper().run({
      fetchPage: async (url) => {
        if (url === madStreetDen.CAREERS_URL) {
          return { status: 200, url, html: driftedCareersHtml }
        }

        if (url === madStreetDen.JOBLIST_API_URL) {
          return apiInvalidUrlResponse
        }

        throw new Error(`Unexpected Mad Street Den URL: ${url}`)
      },
      fetchDarwinboxBoardPage: async () => ({
        status: 200,
        url: madStreetDen.DARWINBOX_PUBLIC_BOARD_URL,
        html: `<html><body>${darwinboxEmptyBoardText}</body></html>`,
      }),
    }),
    /careers page/i,
  )

  await assert.rejects(
    madStreetDen.createMadStreetDenScraper().run({
      fetchPage: async (url) => {
        if (url === madStreetDen.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === madStreetDen.JOBLIST_API_URL) {
          return apiLiveJobsResponse
        }

        throw new Error(`Unexpected Mad Street Den URL: ${url}`)
      },
      fetchDarwinboxBoardPage: async () => ({
        status: 200,
        url: madStreetDen.DARWINBOX_PUBLIC_BOARD_URL,
        html: `<html><body>${darwinboxEmptyBoardText}</body></html>`,
      }),
    }),
    /joblist api/i,
  )

  await assert.rejects(
    madStreetDen.createMadStreetDenScraper().run({
      fetchPage: async (url) => {
        if (url === madStreetDen.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === madStreetDen.JOBLIST_API_URL) {
          return apiInvalidUrlResponse
        }

        throw new Error(`Unexpected Mad Street Den URL: ${url}`)
      },
      fetchDarwinboxBoardPage: async () => ({
        status: 200,
        url: madStreetDen.DARWINBOX_PUBLIC_BOARD_URL,
        html: `<html><body>${darwinboxLiveJobsText}</body></html>`,
      }),
    }),
    /darwinbox board/i,
  )
})
