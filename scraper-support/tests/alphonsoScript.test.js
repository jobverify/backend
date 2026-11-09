import assert from 'node:assert/strict'
import test from 'node:test'

const loadAlphonsoModule = async () => {
  try {
    return await import('../../scraper/alphonso/script.js')
  } catch {
    assert.fail('Expected Alphonso scraper module at ../../scraper/alphonso/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Alphonso &#8211; The TV Data Company</title>
  </head>
  <body>
    <main>
      <h2>Leaders in Technology for Connected TV Advertising</h2>
      <p>
        For more information, information, see
        <a href="http://www.lgads.tv">LG Ad Solutions</a>
        or contact <a href="mailto:info@alphonso.tv">info@alphonso.tv</a>.
      </p>
      <p><a href="https://alphonso.tv/privacy">View privacy center &gt;</a></p>
    </main>
    <footer>
      <ul>
        <li id="copyright">&copy; 2026 Alphonso Inc. </li>
      </ul>
    </footer>
  </body>
</html>
`

const parentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | LG Ad Solutions</title>
    <meta
      name="description"
      content="Are you passionate about the TV industry? Do you enjoy a fast-paced, global culture where no two days are the same? Come join us!"
    />
    <link rel="canonical" href="https://lgads.tv/careers/" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Are you passionate about the TV industry? Do you enjoy a fast-paced, global culture where no two days are the same? Come join us!</p>
      <p>We are hiring!</p>
      <p>If the opportunity to work alongside the brightest brains in a fast-paced environment is your calling, send us your resume at careers@lgads.tv</p>
      <section>
        <h2>Why LG Ad Solutions</h2>
        <p>Come join us!</p>
      </section>
    </main>
    <footer>
      <p>
        LG Ad Solutions, incorporated as Alphonso Inc., is a global leader in advanced advertising for Connected TV and cross-screen devices.
      </p>
    </footer>
    <a href="mailto:careers@lgads.tv">careers@lgads.tv</a>
  </body>
</html>
`

const ashbyPayload = {
  jobs: [
    {
      id: '2aa225f0-5b7f-46ce-bb47-917323b22051',
      isListed: true,
      title: 'Product Manager',
      department: 'Product',
      jobUrl: 'https://jobs.ashbyhq.com/lgads/2aa225f0-5b7f-46ce-bb47-917323b22051',
      applyUrl: 'https://jobs.ashbyhq.com/lgads/2aa225f0-5b7f-46ce-bb47-917323b22051/application',
      employmentType: 'FullTime',
      publishedAt: '2026-05-12T16:54:10.231+00:00',
      location: 'Bangalore, India',
      address: {
        postalAddress: {
          addressLocality: 'Bangalore',
          addressRegion: 'Karnataka',
          addressCountry: 'India',
        },
      },
      secondaryLocations: [],
      descriptionHtml: '<p>Own roadmap execution for ad products.</p>',
    },
    {
      id: 'f16f72ec-1fc9-41da-a4b5-4cb2ac2b897a',
      isListed: true,
      title: 'Technical Recruiter (Contract)',
      department: 'G&A',
      jobUrl: 'https://jobs.ashbyhq.com/lgads/f16f72ec-1fc9-41da-a4b5-4cb2ac2b897a',
      applyUrl: 'https://jobs.ashbyhq.com/lgads/f16f72ec-1fc9-41da-a4b5-4cb2ac2b897a/application',
      employmentType: 'Contract',
      publishedAt: '2026-06-04T18:50:14.094+00:00',
      location: 'Bangalore, India',
      address: {
        postalAddress: {
          addressLocality: 'Bangalore',
          addressRegion: 'Karnataka',
          addressCountry: 'India',
        },
      },
      secondaryLocations: [],
      descriptionHtml: '<p>Support hiring in Bangalore.</p>',
    },
    {
      id: '01f0da80-1e77-4ea9-851b-1f664aeb6c00',
      isListed: true,
      title: 'Human Resources Business Partner',
      department: 'G&A',
      jobUrl: 'https://jobs.ashbyhq.com/lgads/01f0da80-1e77-4ea9-851b-1f664aeb6c00',
      applyUrl: 'https://jobs.ashbyhq.com/lgads/01f0da80-1e77-4ea9-851b-1f664aeb6c00/application',
      employmentType: 'FullTime',
      publishedAt: '2026-05-26T16:16:19.418+00:00',
      location: 'Denver, CO',
      address: {
        postalAddress: {
          addressLocality: 'Denver',
          addressRegion: 'Colorado',
          addressCountry: 'United States',
        },
      },
      secondaryLocations: [],
      descriptionHtml: '<p>Support HR in Denver.</p>',
    },
  ],
}

test('Alphonso scraper pins the verified homepage, parent careers redirect, and Ashby handoff', async () => {
  const alphonso = await loadAlphonsoModule()

  assert.equal(alphonso.SOURCE, 'alphonso')
  assert.equal(alphonso.COMPANY, 'Alphonso')
  assert.equal(alphonso.HOMEPAGE_URL, 'https://alphonso.tv/')
  assert.equal(alphonso.CAREERS_ROUTE_URL, 'https://alphonso.tv/careers')
  assert.equal(alphonso.PARENT_CAREERS_URL, 'https://lgads.tv/careers/')
  assert.equal(alphonso.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/lgads')
  assert.equal(
    alphonso.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/lgads',
  )
  assert.equal(alphonso.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(alphonso.hasParentCareersSignal(parentCareersHtml), true)
  assert.equal(alphonso.extractVerifiedAshbyJobBoardUrl(parentCareersHtml), null)
})

test('Alphonso run validates the verified redirecting first-party careers surface and returns only India jobs from Ashby', async () => {
  const alphonso = await loadAlphonsoModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await alphonso.createAlphonsoScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === alphonso.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === alphonso.CAREERS_ROUTE_URL) {
        return {
          status: 200,
          url: alphonso.PARENT_CAREERS_URL,
          html: parentCareersHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return ashbyPayload
    },
  })

  assert.deepEqual(requestedPages, [
    alphonso.HOMEPAGE_URL,
    alphonso.CAREERS_ROUTE_URL,
  ])
  assert.deepEqual(requestedJson, [alphonso.ASHBY_JOB_BOARD_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Product Manager',
      company: 'Alphonso',
      department: 'Product',
      location: 'Bangalore, India',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      jobId: '2aa225f0-5b7f-46ce-bb47-917323b22051',
      requisitionId: '2aa225f0-5b7f-46ce-bb47-917323b22051',
      sourceUrl: 'https://jobs.ashbyhq.com/lgads/2aa225f0-5b7f-46ce-bb47-917323b22051',
      applyUrl: 'https://jobs.ashbyhq.com/lgads/2aa225f0-5b7f-46ce-bb47-917323b22051/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-12T16:54:10.231+00:00',
      closingDate: null,
      jobDescription: 'Own roadmap execution for ad products.',
      source: 'alphonso',
      link: 'https://jobs.ashbyhq.com/lgads/2aa225f0-5b7f-46ce-bb47-917323b22051/application',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'Technical Recruiter (Contract)',
      company: 'Alphonso',
      department: 'G&A',
      location: 'Bangalore, India',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      jobId: 'f16f72ec-1fc9-41da-a4b5-4cb2ac2b897a',
      requisitionId: 'f16f72ec-1fc9-41da-a4b5-4cb2ac2b897a',
      sourceUrl: 'https://jobs.ashbyhq.com/lgads/f16f72ec-1fc9-41da-a4b5-4cb2ac2b897a',
      applyUrl: 'https://jobs.ashbyhq.com/lgads/f16f72ec-1fc9-41da-a4b5-4cb2ac2b897a/application',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-04T18:50:14.094+00:00',
      closingDate: null,
      jobDescription: 'Support hiring in Bangalore.',
      source: 'alphonso',
      link: 'https://jobs.ashbyhq.com/lgads/f16f72ec-1fc9-41da-a4b5-4cb2ac2b897a/application',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('Alphonso run fails closed when the homepage, redirect target, parent surface, or Ashby API payload changes', async () => {
  const alphonso = await loadAlphonsoModule()

  await assert.rejects(
    alphonso.createAlphonsoScraper().run({
      fetchPage: async (url) => {
        if (url === alphonso.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected homepage</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => ashbyPayload,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    alphonso.createAlphonsoScraper().run({
      fetchPage: async (url) => {
        if (url === alphonso.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === alphonso.CAREERS_ROUTE_URL) {
          return {
            status: 200,
            url: alphonso.CAREERS_ROUTE_URL,
            html: parentCareersHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => ashbyPayload,
    }),
    /verified parent careers redirect/i,
  )

  await assert.rejects(
    alphonso.createAlphonsoScraper().run({
      fetchPage: async (url) => {
        if (url === alphonso.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === alphonso.CAREERS_ROUTE_URL) {
          return {
            status: 200,
            url: alphonso.PARENT_CAREERS_URL,
            html: parentCareersHtml.replaceAll('careers@lgads.tv', 'jobs@example.com'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => ashbyPayload,
    }),
    /verified parent careers surface/i,
  )

  await assert.rejects(
    alphonso.createAlphonsoScraper().run({
      fetchPage: async (url) => {
        if (url === alphonso.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === alphonso.CAREERS_ROUTE_URL) {
          return {
            status: 200,
            url: alphonso.PARENT_CAREERS_URL,
            html: parentCareersHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => ({ jobs: null }),
    }),
    /public Ashby job-board payload/i,
  )
})
