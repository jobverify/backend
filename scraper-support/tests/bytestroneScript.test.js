import assert from 'node:assert/strict'
import test from 'node:test'

const loadBytestroneModule = async () => {
  try {
    return await import('../../scraper/bytestrone/script.js')
  } catch {
    assert.fail('Expected Bytestrone scraper module at ../../scraper/bytestrone/script.js')
  }
}

const buildNextHtml = ({
  page = '/[locale]/position',
  query = { locale: 'en' },
  pageProps = {},
  title = 'Position',
} = {}) => `
<!doctype html>
<html lang="en">
  <head>
    <title>${title}</title>
    <link rel="canonical" href="https://bytestrone-site.web.app//en/position/" />
  </head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps },
      page,
      query,
      buildId: 'bytestrone-build',
    })}</script>
  </body>
</html>
`

const buildOpening = ({
  id,
  jobTitle,
  position,
  location = 'Kochi',
  skill = '.NET',
  workType = 'On Site',
  details = ['We are seeking engineers who build reliable software.'],
  requirements = ['3 to 6 years of experience.', 'DOTNET Core / .NET 6+ and C# proficiency'],
  responsibilities = ['Develop robust APIs.', 'Collaborate with cross-functional teams.'],
  preferredQualifications = ['Cloud experience (Azure/AWS/GCP)'],
} = {}) => ({
  id,
  attributes: {
    locale: 'en',
    details: details.map((text) => ({
      type: 'paragraph',
      children: [{ type: 'text', text }],
    })),
    jobTitle,
    location: {
      data: {
        attributes: {
          location,
        },
      },
    },
    position: {
      data: {
        attributes: {
          positions: position,
        },
      },
    },
    additionalDetails: [
      {
        label: 'Requirements And Skill',
        content: requirements.map((text) => ({
          type: 'paragraph',
          children: [{ type: 'text', text }],
        })),
      },
      {
        label: 'Responsibilities',
        content: responsibilities.map((text) => ({
          type: 'paragraph',
          children: [{ type: 'text', text }],
        })),
      },
      {
        label: 'Preferred Qualifications',
        content: preferredQualifications.map((text) => ({
          type: 'paragraph',
          children: [{ type: 'text', text }],
        })),
      },
    ],
    skill_area: {
      data: {
        attributes: {
          skill,
        },
      },
    },
    work_type: {
      data: {
        attributes: {
          type: workType,
        },
      },
    },
    localizations: {
      data: [],
    },
  },
})

const buildPositionPageHtml = (openingsData = []) =>
  buildNextHtml({
    page: '/[locale]/position',
    query: { locale: 'en' },
    title: 'Position',
    pageProps: {
      openingPageData: [
        {
          attributes: {
            heading: 'Current Openings',
            page: 'Position',
            noDataMessage: 'Currently we do not have any openings',
          },
        },
      ],
      openingsData,
    },
  })

const buildDetailPageHtml = (opening) =>
  buildNextHtml({
    page: '/[locale]/job/[id]',
    query: { locale: 'en', id: String(opening.id) },
    title: 'Bytestrone',
    pageProps: {
      job: {
        data: {
          id: opening.id,
          attributes: opening.attributes,
        },
      },
      formData: [
        {
          attributes: {
            type: 'Apply',
            description: 'Apply for the position',
          },
        },
      ],
    },
  })

test('Bytestrone helpers validate the official position page and build first-party detail URLs', async () => {
  const bytestrone = await loadBytestroneModule()
  const positionPageHtml = buildPositionPageHtml([
    buildOpening({
      id: 6,
      jobTitle: 'Dot Net Full Stack',
      position: 'Software Engineer',
      workType: 'On Site',
    }),
  ])

  assert.equal(bytestrone.SOURCE, 'bytestrone')
  assert.equal(bytestrone.COMPANY, 'Bytestrone')
  assert.equal(bytestrone.POSITION_PAGE_URL, 'https://bytestrone.com/en/position/')
  assert.equal(bytestrone.buildDetailUrl(6), 'https://bytestrone.com/en/job/6/')
  assert.equal(bytestrone.hasOfficialPositionPageSignal(positionPageHtml), true)
  assert.equal(
    bytestrone.hasOfficialPositionPageSignal(
      buildNextHtml({
        page: '/[locale]',
        pageProps: { openingPageData: [], openingsData: [] },
        title: 'Home',
      }),
    ),
    false,
  )

  const nextData = bytestrone.extractNextData(positionPageHtml)
  assert.equal(Array.isArray(bytestrone.extractOpenings(nextData)), true)
  assert.equal(bytestrone.extractOpenings(nextData).length, 1)
})

test('mapOpeningToJob normalizes a Bytestrone first-party detail page into the shared job shape', async () => {
  const bytestrone = await loadBytestroneModule()
  const opening = buildOpening({
    id: 6,
    jobTitle: 'Dot Net Full Stack',
    position: 'Software Engineer',
    workType: 'On Site',
    details: [
      'We are seeking a skilled and driven Software Engineer - .NET Core.',
    ],
    requirements: [
      '3 to 6 years of experience.',
      'DOTNET Core / .NET 6+ and C# proficiency',
      'Solid understanding of RESTful APIs and microservices',
    ],
    responsibilities: [
      'Develop robust and scalable Web APIs using .NET Core/.NET 6+',
      'Collaborate with cross-functional teams for product delivery',
    ],
    preferredQualifications: [
      'Cloud experience (Azure/AWS/GCP)',
      'Containerization with Docker, experience with Kubernetes',
    ],
  })

  const detailHtml = buildDetailPageHtml(opening)
  const job = bytestrone.mapOpeningToJob({
    openingSummary: opening,
    detailPageHtml: detailHtml,
  })

  assert.deepEqual(job, {
    title: 'Software Engineer - Dot Net Full Stack',
    company: 'Bytestrone',
    department: 'Software Engineer',
    location: 'Kochi, India',
    city: 'Kochi',
    state: null,
    country: 'India',
    jobId: '6',
    requisitionId: '6',
    sourceUrl: 'https://bytestrone.com/en/job/6/',
    applyUrl: 'https://bytestrone.com/en/job/6/',
    employmentType: null,
    experienceRequired: '3 to 6 years of experience.',
    minimumQualification: [
      '3 to 6 years of experience.',
      'DOTNET Core / .NET 6+ and C# proficiency',
      'Solid understanding of RESTful APIs and microservices',
    ].join('\n'),
    preferredQualification: [
      'Cloud experience (Azure/AWS/GCP)',
      'Containerization with Docker, experience with Kubernetes',
    ].join('\n'),
    requiredSkills: ['.NET'],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'We are seeking a skilled and driven Software Engineer - .NET Core.',
      'Requirements And Skill:\n3 to 6 years of experience.\nDOTNET Core / .NET 6+ and C# proficiency\nSolid understanding of RESTful APIs and microservices',
      'Responsibilities:\nDevelop robust and scalable Web APIs using .NET Core/.NET 6+\nCollaborate with cross-functional teams for product delivery',
      'Preferred Qualifications:\nCloud experience (Azure/AWS/GCP)\nContainerization with Docker, experience with Kubernetes',
    ].join('\n\n'),
    remoteStatus: 'On-site',
  })
})

test('run fetches the first-party position page and same-domain detail pages', async () => {
  const bytestrone = await loadBytestroneModule()
  const openingOne = buildOpening({
    id: 1,
    jobTitle: 'Dot Net Full Stack',
    position: 'Jr Software Engineer',
    workType: 'Remote',
    requirements: ['0 to 3 years of experience.', 'Proven experience as a Full Stack Developer or similar role.'],
    responsibilities: ['Build the front-end of applications through appealing visual design.'],
    preferredQualifications: ['Degree in Computer Science, Statistics, or relevant field.'],
  })
  const openingTwo = buildOpening({
    id: 6,
    jobTitle: 'Dot Net Full Stack',
    position: 'Software Engineer',
    workType: 'On Site',
    requirements: ['3 to 6 years of experience.', 'DOTNET Core / .NET 6+ and C# proficiency'],
    responsibilities: ['Develop robust and scalable Web APIs using .NET Core/.NET 6+'],
    preferredQualifications: ['Cloud experience (Azure/AWS/GCP)'],
  })

  const requestedUrls = []
  const jobs = await bytestrone.createBytestroneScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === bytestrone.POSITION_PAGE_URL) {
        return buildPositionPageHtml([openingOne, openingTwo])
      }
      if (url === bytestrone.buildDetailUrl(1)) {
        return buildDetailPageHtml(openingOne)
      }
      if (url === bytestrone.buildDetailUrl(6)) {
        return buildDetailPageHtml(openingTwo)
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T10:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    bytestrone.POSITION_PAGE_URL,
    bytestrone.buildDetailUrl(1),
    bytestrone.buildDetailUrl(6),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Jr Software Engineer - Dot Net Full Stack')
  assert.equal(jobs[0].remoteStatus, 'Remote')
  assert.equal(jobs[0].source, 'bytestrone')
  assert.equal(jobs[0].companyCareerPage, bytestrone.POSITION_PAGE_URL)
  assert.equal(jobs[0].companyDomain, 'bytestrone.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T10:00:00.000Z')
  assert.equal(jobs[1].title, 'Software Engineer - Dot Net Full Stack')
})

test('run returns no jobs for the verified empty-state and fails closed on detail mismatches', async () => {
  const bytestrone = await loadBytestroneModule()

  const emptyJobs = await bytestrone.createBytestroneScraper().run({
    fetchText: async (url) => {
      if (url === bytestrone.POSITION_PAGE_URL) return buildPositionPageHtml([])
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(emptyJobs, [])

  const opening = buildOpening({
    id: 6,
    jobTitle: 'Dot Net Full Stack',
    position: 'Software Engineer',
  })

  await assert.rejects(
    bytestrone.createBytestroneScraper().run({
      fetchText: async (url) => {
        if (url === bytestrone.POSITION_PAGE_URL) return buildPositionPageHtml([opening])
        if (url === bytestrone.buildDetailUrl(6)) {
          return buildNextHtml({
            page: '/[locale]/job/[id]',
            query: { locale: 'en', id: '6' },
            title: 'Bytestrone',
            pageProps: {
              job: {
                data: {
                  id: 999,
                  attributes: opening.attributes,
                },
              },
              formData: [{ attributes: { type: 'Apply' } }],
            },
          })
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /detail page no longer matches the verified first-party job payload/i,
  )
})
