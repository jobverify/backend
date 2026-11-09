import assert from 'node:assert/strict'
import test from 'node:test'

const careersPage = {
  status: 200,
  url: 'https://promptql.io/careers',
  html: `
<!doctype html>
<html lang="en">
  <head>
    <title>Join us to build the future of reliable AI | PromptQL</title>
  </head>
  <body>
    <h1>Join us to build the future of reliable AI</h1>
    <p>Life at PromptQL</p>
    <a href="https://jobs.gem.com/promptql">See open roles</a>
  </body>
</html>
`,
}

const gemBoardPage = {
  status: 200,
  url: 'https://jobs.gem.com/promptql',
  html: `
<!doctype html>
<html lang="en">
  <head>
    <title>PromptQL Careers</title>
  </head>
  <body>
    <script src="https://static.gem.com/scripts/jobBoards.BpHUFx-E.v2.min.js"></script>
    <script>window.__gemTrackingId = "4a76acaa-70ac-4e16-bedb-d4426e6a9d3c"</script>
  </body>
</html>
`,
}

const listPayload = {
  data: {
    oatsExternalJobPostings: {
      jobPostings: [
        {
          extId: 'am9icG9zdDqFcCqALL3yOrMp6tFzI6t8',
          title: 'Forward Deployed Analyst, Bangalore',
          locations: [
            {
              id: '30622',
              name: 'Bengaluru - Office',
              city: 'Bengaluru',
              isoCountry: 'IND',
              isRemote: false,
              extId: 'bG9jOilk4M_xyFJNk1KsufNhiQQ',
            },
            {
              id: '31361',
              name: 'Remote - India',
              city: 'Bengaluru',
              isoCountry: 'IND',
              isRemote: true,
              extId: 'bG9jOkwiuasEezaDpQLsaoxFcJ8',
            },
          ],
          job: {
            department: {
              name: 'Forward Deployed Engineering',
            },
          },
        },
        {
          extId: 'talent-community',
          title: 'Talent Community',
          locations: [
            {
              id: '31362',
              name: 'Remote - India',
              city: 'Bengaluru',
              isoCountry: 'IND',
              isRemote: true,
              extId: 'bG9jOkwiuasEezaDpQLsaoxFcJ9',
            },
          ],
          job: {
            department: {
              name: 'Community',
            },
          },
        },
      ],
    },
    jobBoardExternal: {
      pageTitle: 'PromptQL Careers',
      teamDisplayName: 'PromptQL',
    },
  },
}

const detailPayload = {
  data: {
    oatsExternalJobPosting: {
      extId: 'am9icG9zdDqFcCqALL3yOrMp6tFzI6t8',
      title: 'Forward Deployed Analyst, Bangalore',
      descriptionHtml: '<p>Help customers operationalize reliable AI.</p>',
      firstPublishedTsSec: 1785542400,
      locations: [
        {
          id: '30622',
          name: 'Bengaluru - Office',
          city: 'Bengaluru',
          isoCountry: 'IND',
          isRemote: false,
          extId: 'bG9jOilk4M_xyFJNk1KsufNhiQQ',
        },
        {
          id: '31361',
          name: 'Remote - India',
          city: 'Bengaluru',
          isoCountry: 'IND',
          isRemote: true,
          extId: 'bG9jOkwiuasEezaDpQLsaoxFcJ8',
        },
      ],
      job: {
        employmentType: 'FULL_TIME',
        locationType: 'REMOTE',
        requisitionId: 'HASURA-IND-001',
        department: {
          name: 'Forward Deployed Engineering',
        },
      },
    },
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/hasura/script.js')
  } catch {
    assert.fail('Expected Hasura scraper module at ../../scraper/hasura/script.js')
  }
}

test('Hasura accepts the current PromptQL redirect shell and Gem board bundle contract', async () => {
  const hasura = await loadModule()

  assert.equal(hasura.hasOfficialCareersSignal(careersPage), true)
  assert.equal(hasura.hasOfficialGemBoardSignal(gemBoardPage), true)
  assert.equal(hasura.hasValidJobBoardListPayload(listPayload), true)
  assert.deepEqual(hasura.extractIndiaJobStubs(listPayload).map((job) => job.title), [
    'Forward Deployed Analyst, Bangalore',
  ])
})

test('Hasura run validates the PromptQL handoff, filters talent-community posts, and decorates India jobs', async () => {
  const hasura = await loadModule()
  const graphqlBodies = []

  const jobs = await hasura.createHasuraScraper({
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      if (url === hasura.CAREERS_URL) return careersPage
      if (url === hasura.GEM_BOARD_URL) return gemBoardPage
      throw new Error(`Unexpected Hasura page URL: ${url}`)
    },
    fetchGraphql: async (body) => {
      graphqlBodies.push(body.operationName)
      if (body.operationName === 'JobBoardList') return listPayload
      if (body.operationName === 'ExternalJobPostingQuery') return detailPayload
      throw new Error(`Unexpected Hasura GraphQL operation: ${body.operationName}`)
    },
  })

  assert.deepEqual(graphqlBodies, [
    'JobBoardList',
    'ExternalJobPostingQuery',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'hasura')
  assert.equal(jobs[0].title, 'Forward Deployed Analyst, Bangalore')
  assert.equal(
    jobs[0].applyUrl,
    'https://jobs.gem.com/promptql/am9icG9zdDqFcCqALL3yOrMp6tFzI6t8/application',
  )
  assert.equal(jobs[0].remoteStatus, 'Remote')
})
