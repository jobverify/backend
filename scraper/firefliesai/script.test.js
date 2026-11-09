import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  GEM_BOARD_URL,
  HOMEPAGE_URL,
  LIST_QUERY,
  createFirefliesAiScraper,
  hasOfficialGemBoardSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Fireflies.ai | #1 AI assistant for meetings, email, chat & CRM</title>
    </head>
    <body>
      <a href="https://fireflies.ai/">Home</a>
      <h1>The #1 AI assistant for your meetings</h1>
      <p>Transcribe, summarize, search, and analyze all your team conversations.</p>
      <script type="application/ld+json">
        {"name":"Fireflies.ai"}
      </script>
    </body>
  </html>
`

const currentGemBoardHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Fireflies Careers</title>
    </head>
    <body>
      <div id="root"></div>
      <script>window.GEM_TRACKING_ID="3eab0d5a-721b-4989-89f1-f95971c662ff"</script>
      <script src="https://static.gem.com/scripts/jobBoards.BpHUFx-E.v2.min.js"></script>
    </body>
  </html>
`

const listPayload = {
  data: {
    oatsExternalJobPostings: {
      jobPostings: [
        {
          id: 'posting-1',
          extId: 'role-1',
          title: 'Machine Learning Engineer',
          locations: [
            {
              id: 'loc-1',
              name: 'Bengaluru',
              city: 'Bengaluru',
              isoCountry: 'IND',
              isRemote: false,
              extId: 'loc-1',
            },
          ],
          job: {
            id: 'job-1',
            locationType: 'ONSITE',
            employmentType: 'FULL_TIME',
            department: {
              id: 'dept-1',
              name: 'Engineering',
              extId: 'dept-1',
            },
          },
        },
      ],
    },
    oatsExternalJobPostingsFilters: [],
    jobBoardExternal: {
      id: 'board-1',
      pageTitle: 'Fireflies Careers',
      teamDisplayName: 'Fireflies.ai',
      descriptionHtml: '<p>Join Fireflies</p>',
    },
  },
}

const detailPayload = {
  data: {
    oatsExternalJobPosting: {
      id: 'posting-1',
      title: 'Machine Learning Engineer',
      extId: 'role-1',
      descriptionHtml: '<p>Build meeting intelligence for global teams.</p>',
      startDateTs: null,
      firstPublishedTsSec: 1754049600,
      companyLogo: null,
      companyUrl: 'https://fireflies.ai/',
      isApplicationFormHidden: false,
      isUnlistedExternally: false,
      locations: [
        {
          id: 'loc-1',
          extId: 'loc-1',
          name: 'Bengaluru',
          city: 'Bengaluru',
          isoCountry: 'IND',
          isRemote: false,
        },
      ],
      job: {
        id: 'job-1',
        locationType: 'ONSITE',
        employmentType: 'FULL_TIME',
        requisitionId: 'REQ-1',
        teamDisplayName: 'Engineering',
        department: {
          id: 'dept-1',
          extId: 'dept-1',
          name: 'Engineering',
        },
        locations: [],
      },
      jobPostSectionHtml: {
        introHtml: '',
        outroHtml: '',
      },
      compensationHtml: null,
    },
  },
}

test('Fireflies.ai accepts the current Gem board bundle pattern and updated vanity query contract', () => {
  assert.match(LIST_QUERY, /jobBoardExternal\(vanityUrlPath:\s*\$boardId\)/)
  assert.equal(
    hasOfficialGemBoardSignal({
      status: 200,
      url: GEM_BOARD_URL,
      html: currentGemBoardHtml,
    }),
    true,
  )
})

test('Fireflies.ai run uses the updated Gem board contract and returns current India jobs', async () => {
  const graphqlOperations = []

  const jobs = await createFirefliesAiScraper({
    now: () => '2026-08-02T04:35:00.000Z',
  }).run({
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === CAREERS_URL) return { status: 200, url: GEM_BOARD_URL, html: currentGemBoardHtml }
      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchGraphql: async (body) => {
      graphqlOperations.push(body)

      if (body.operationName === 'JobBoardList') return listPayload
      if (body.operationName === 'ExternalJobPostingQuery') return detailPayload

      throw new Error(`Unexpected operation: ${body.operationName}`)
    },
  })

  assert.equal(graphqlOperations.length, 2)
  assert.match(graphqlOperations[0].query, /jobBoardExternal\(vanityUrlPath:\s*\$boardId\)/)
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      location: jobs[0].location,
      city: jobs[0].city,
      requisitionId: jobs[0].requisitionId,
      employmentType: jobs[0].employmentType,
      link: jobs[0].link,
      scrapedAt: jobs[0].scrapedAt,
    },
    {
      title: 'Machine Learning Engineer',
      location: 'Bangalore, India',
      city: 'Bangalore',
      requisitionId: 'REQ-1',
      employmentType: 'Full-time',
      link: 'https://jobs.gem.com/fireflies/role-1/application',
      scrapedAt: '2026-08-02T04:35:00.000Z',
    },
  )
})
