import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fireflies.ai | #1 AI Assistant for Meetings, Email, Chat & CRM</title>
    <meta
      name="description"
      content="Fireflies takes notes, manages tasks, and automates workflows across meetings, email, chat, CRM, and your apps."
    />
    <link rel="canonical" href="https://fireflies.ai" />
  </head>
  <body>
    <main>
      <h1>The #1 AI Assistant For Your Meetings</h1>
      <p>Transcribe, summarize, search, and analyze all your team conversations.</p>
      <script id="Organization" type="application/ld+json">
        {"@type":"Organization","name":"Fireflies.ai"}
      </script>
    </main>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Fireflies.ai | #1 AI Teammate for Meetings, Email, Chat & CRM</title>
    <meta content="Fireflies.ai" property="og:site_name" />
  </head>
  <body>
    <p>Fireflies takes notes, manages tasks, and automates workflows across meetings, email, chat, CRM, and your apps.</p>
  </body>
</html>
`

const gemBoardPage = {
  status: 200,
  url: 'https://jobs.gem.com/fireflies',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <meta name="description" content="Fireflies Careers" />
        <meta property="og:title" content="Fireflies Careers" />
        <meta property="og:url" content="https://jobs.gem.com/fireflies" />
        <title>Fireflies Careers</title>
      </head>
      <body>
        <script>
          window['__GEM_TRACKING_CONTEXT__'] = {
            'type': 'job_board',
            'id': '3eab0d5a-721b-4989-89f1-f95971c662ff',
          };
        </script>
        <div id="content"></div>
        <script
          type="module"
          src="https://static.gem.com/scripts/jobBoards.BzUgVe52.v2.min.js"
          crossorigin="anonymous"
        ></script>
      </body>
    </html>
  `,
}

const jobBoardListPayload = {
  data: {
    oatsExternalJobPostings: {
      jobPostings: [
        {
          id: 'T2F0c0pvYlBvc3Q6NDU5MDM5OQ==',
          extId: 'am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
          title: 'Brand & Web Designer',
          locations: [
            {
              id: '57771',
              name: 'Bengaluru',
              city: 'Bengaluru',
              isoCountry: 'IND',
              isRemote: false,
              extId: 'bG9jOgYACQtS8Y_YXuh5usC1i5g',
            },
          ],
          job: {
            id: 'T2F0c0pvYjozNjk0MDU5',
            department: {
              id: '30327',
              name: 'Design',
              extId: 'ZGVwdDpq_hScjgWrt_T7l3ABR6L0',
            },
            locationType: 'REMOTE',
            employmentType: 'FULL_TIME',
          },
        },
        {
          id: 'T2F0c0pvYlBvc3Q6NjU0NTM4Nw==',
          extId: 'am9icG9zdDo7PW8KmWLFrEPxztUFIlrE',
          title: 'Affiliate Partnership Manager',
          locations: [
            {
              id: '32948',
              name: 'Chennai',
              city: 'Chennai',
              isoCountry: 'IND',
              isRemote: false,
              extId: 'bG9jOmQuW8R1oZrLBlvCo4hrdbo',
            },
            {
              id: '32951',
              name: 'Lisbon',
              city: 'Lisbon',
              isoCountry: 'PRT',
              isRemote: false,
              extId: 'bG9jOuLu4e31x5LStpHY3_1OuEM',
            },
            {
              id: '34600',
              name: 'Pune',
              city: 'Pune City',
              isoCountry: 'IND',
              isRemote: false,
              extId: 'bG9jOmculTpBeu-Ler5LY-778m0',
            },
            {
              id: '57771',
              name: 'Bengaluru',
              city: 'Bengaluru',
              isoCountry: 'IND',
              isRemote: false,
              extId: 'bG9jOgYACQtS8Y_YXuh5usC1i5g',
            },
            {
              id: '69210',
              name: 'India',
              city: '',
              isoCountry: 'IND',
              isRemote: true,
              extId: 'bG9jOtSTnyt84cS6Ylm-WneCbic',
            },
          ],
          job: {
            id: 'T2F0c0pvYjo1NjA4MTk2',
            department: {
              id: '30367',
              name: 'Marketing',
              extId: 'ZGVwdDo7nsovOyzSlMiaFK0n-CmR',
            },
            locationType: 'REMOTE',
            employmentType: 'FULL_TIME',
          },
        },
        {
          id: 'T2F0c0pvYlBvc3Q6NTc1MTQ5Ng==',
          extId: 'am9icG9zdDpUriPN15EyqJJ2a1cmJIKY',
          title: 'Security Engineer',
          locations: [
            {
              id: '34605',
              name: 'Vancouver',
              city: 'Vancouver',
              isoCountry: 'CAN',
              isRemote: false,
              extId: 'bG9jOrY_TDY_LoNEyEfShRjLZrQ',
            },
          ],
          job: {
            id: 'T2F0c0pvYjo0ODIzNDgw',
            department: {
              id: '30364',
              name: 'Engineering',
              extId: 'ZGVwdDqAo3yhYQP7twsFLZipUvox',
            },
            locationType: 'REMOTE',
            employmentType: 'FULL_TIME',
          },
        },
      ],
    },
    oatsExternalJobPostingsFilters: [
      {
        type: 'DEPARTMENT',
        displayName: 'Engineering',
        rawValue: 'engineering',
        value: '1__engineering',
        count: 1,
      },
      {
        type: 'LOCATION_CITY',
        displayName: 'Bengaluru',
        rawValue: 'bengaluru',
        value: '2__bengaluru',
        count: 2,
      },
    ],
    jobBoardExternal: {
      id: 'RXh0ZXJuYWxKb2JCb2FyZDoyMDM4OA==',
      teamDisplayName: 'Fireflies',
      descriptionHtml: '<h4><br></h4>',
      pageTitle: 'Fireflies Careers',
    },
  },
}

const brandDesignerDetailPayload = {
  data: {
    oatsExternalJobPosting: {
      id: 'T2F0c0pvYlBvc3Q6NDU5MDM5OQ==',
      title: 'Brand & Web Designer',
      extId: 'am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
      descriptionHtml: `
        <div>
          <a href="http://fireflies.ai/">Fireflies.ai</a> is the <strong>#1 AI teammate for meetings</strong>.
        </div>
        <div>
          We are looking for a <strong>Brand &amp; Web Designer</strong> to shape how Fireflies shows up across product and marketing.
        </div>
      `,
      startDateTs: null,
      firstPublishedTsSec: 1773204415,
      companyLogo: null,
      companyUrl: null,
      isApplicationFormHidden: false,
      isUnlistedExternally: false,
      locations: [
        {
          id: '57771',
          extId: 'bG9jOgYACQtS8Y_YXuh5usC1i5g',
          name: 'Bengaluru',
          city: 'Bengaluru',
          isoCountry: 'IND',
          isRemote: false,
        },
      ],
      job: {
        id: 'T2F0c0pvYjozNjk0MDU5',
        locationType: 'REMOTE',
        employmentType: 'FULL_TIME',
        requisitionId: 'R47',
        teamDisplayName: 'Fireflies',
        department: {
          id: '30327',
          extId: 'ZGVwdDpq_hScjgWrt_T7l3ABR6L0',
          name: 'Design',
        },
        locations: [
          {
            id: '57771',
            extId: 'bG9jOgYACQtS8Y_YXuh5usC1i5g',
            name: 'Bengaluru',
            city: 'Bengaluru',
            isoCountry: 'IND',
            isRemote: false,
          },
        ],
      },
      jobPostSectionHtml: {
        introHtml: null,
        outroHtml: null,
      },
      compensationHtml: null,
    },
  },
}

const affiliateDetailPayload = {
  data: {
    oatsExternalJobPosting: {
      id: 'T2F0c0pvYlBvc3Q6NjU0NTM4Nw==',
      title: 'Affiliate Partnership Manager',
      extId: 'am9icG9zdDo7PW8KmWLFrEPxztUFIlrE',
      descriptionHtml: `
        <div>Own affiliate growth across strategic markets for Fireflies.ai.</div>
        <ul>
          <li>Build regional partner programs.</li>
          <li>Drive performance with data.</li>
        </ul>
      `,
      startDateTs: null,
      firstPublishedTsSec: 1776123456,
      companyLogo: null,
      companyUrl: null,
      isApplicationFormHidden: false,
      isUnlistedExternally: false,
      locations: [
        {
          id: '32948',
          extId: 'bG9jOmQuW8R1oZrLBlvCo4hrdbo',
          name: 'Chennai',
          city: 'Chennai',
          isoCountry: 'IND',
          isRemote: false,
        },
        {
          id: '34600',
          extId: 'bG9jOmculTpBeu-Ler5LY-778m0',
          name: 'Pune',
          city: 'Pune City',
          isoCountry: 'IND',
          isRemote: false,
        },
        {
          id: '57771',
          extId: 'bG9jOgYACQtS8Y_YXuh5usC1i5g',
          name: 'Bengaluru',
          city: 'Bengaluru',
          isoCountry: 'IND',
          isRemote: false,
        },
        {
          id: '69210',
          extId: 'bG9jOtSTnyt84cS6Ylm-WneCbic',
          name: 'India',
          city: '',
          isoCountry: 'IND',
          isRemote: true,
        },
      ],
      job: {
        id: 'T2F0c0pvYjo1NjA4MTk2',
        locationType: 'REMOTE',
        employmentType: 'FULL_TIME',
        requisitionId: 'R88',
        teamDisplayName: 'Fireflies',
        department: {
          id: '30367',
          extId: 'ZGVwdDo7nsovOyzSlMiaFK0n-CmR',
          name: 'Marketing',
        },
        locations: [
          {
            id: '32948',
            extId: 'bG9jOmQuW8R1oZrLBlvCo4hrdbo',
            name: 'Chennai',
            city: 'Chennai',
            isoCountry: 'IND',
            isRemote: false,
          },
          {
            id: '34600',
            extId: 'bG9jOmculTpBeu-Ler5LY-778m0',
            name: 'Pune',
            city: 'Pune City',
            isoCountry: 'IND',
            isRemote: false,
          },
          {
            id: '57771',
            extId: 'bG9jOgYACQtS8Y_YXuh5usC1i5g',
            name: 'Bengaluru',
            city: 'Bengaluru',
            isoCountry: 'IND',
            isRemote: false,
          },
          {
            id: '69210',
            extId: 'bG9jOtSTnyt84cS6Ylm-WneCbic',
            name: 'India',
            city: '',
            isoCountry: 'IND',
            isRemote: true,
          },
        ],
      },
      jobPostSectionHtml: {
        introHtml: null,
        outroHtml: null,
      },
      compensationHtml: null,
    },
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/firefliesai/script.js')
  } catch {
    assert.fail('Expected Fireflies.ai scraper module at ../../scraper/firefliesai/script.js')
  }
}

test('Fireflies.ai helpers stay pinned to the verified first-party careers redirect and Gem public GraphQL contract', async () => {
  const firefliesAi = await loadModule()

  assert.equal(firefliesAi.SOURCE, 'firefliesai')
  assert.equal(firefliesAi.COMPANY, 'Fireflies.ai')
  assert.equal(firefliesAi.OFFICIAL_BRAND_NAME, 'Fireflies.ai')
  assert.equal(firefliesAi.HOMEPAGE_URL, 'https://fireflies.ai/')
  assert.equal(firefliesAi.CAREERS_URL, 'https://fireflies.ai/careers')
  assert.equal(firefliesAi.GEM_BOARD_URL, 'https://jobs.gem.com/fireflies')
  assert.equal(firefliesAi.GRAPHQL_URL, 'https://jobs.gem.com/api/public/graphql')
  assert.equal(
    firefliesAi.GEM_BOARD_BUNDLE_URL,
    'https://static.gem.com/scripts/jobBoards.BzUgVe52.v2.min.js',
  )
  assert.equal(firefliesAi.GEM_BOARD_TRACKING_ID, '3eab0d5a-721b-4989-89f1-f95971c662ff')
  assert.equal(firefliesAi.VERIFIED_ON, '2026-07-15')
  assert.match(firefliesAi.VERIFIED_SURFACE_SUMMARY, /5 India roles/i)
  assert.match(firefliesAi.LIST_QUERY, /query JobBoardList/i)
  assert.match(firefliesAi.DETAIL_QUERY, /query ExternalJobPostingQuery/i)
  assert.equal(firefliesAi.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(firefliesAi.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(firefliesAi.hasOfficialGemBoardSignal(gemBoardPage), true)
  assert.equal(firefliesAi.hasValidJobBoardListPayload(jobBoardListPayload), true)
  assert.equal(
    firefliesAi.toJobDetailUrl('am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3'),
    'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
  )
  assert.equal(
    firefliesAi.toApplyUrl('am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3'),
    'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3/application',
  )
})

test('Fireflies.ai extracts only India-relevant Gem postings and maps detail payloads into shared job fields', async () => {
  const firefliesAi = await loadModule()
  const stubs = firefliesAi.extractIndiaJobStubs(jobBoardListPayload)

  assert.deepEqual(
    stubs.map((job) => ({
      title: job.title,
      extId: job.extId,
      department: job.department,
      indiaLocations: job.indiaLocations.map((location) => ({
        name: location.name,
        city: location.city,
        isRemote: location.isRemote,
      })),
    })),
    [
      {
        title: 'Brand & Web Designer',
        extId: 'am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
        department: 'Design',
        indiaLocations: [
          {
            name: 'Bengaluru',
            city: 'Bengaluru',
            isRemote: false,
          },
        ],
      },
      {
        title: 'Affiliate Partnership Manager',
        extId: 'am9icG9zdDo7PW8KmWLFrEPxztUFIlrE',
        department: 'Marketing',
        indiaLocations: [
          {
            name: 'Chennai',
            city: 'Chennai',
            isRemote: false,
          },
          {
            name: 'Pune',
            city: 'Pune City',
            isRemote: false,
          },
          {
            name: 'Bengaluru',
            city: 'Bengaluru',
            isRemote: false,
          },
          {
            name: 'India',
            city: '',
            isRemote: true,
          },
        ],
      },
    ],
  )

  const brandJob = firefliesAi.buildJobFromDetail(stubs[0], brandDesignerDetailPayload)
  const affiliateJob = firefliesAi.buildJobFromDetail(stubs[1], affiliateDetailPayload)

  assert.deepEqual(brandJob, {
    title: 'Brand & Web Designer',
    company: 'Fireflies.ai',
    department: 'Design',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
    requisitionId: 'R47',
    sourceUrl: 'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
    applyUrl: 'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3/application',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-03-11T04:46:55.000Z',
    closingDate: null,
    jobDescription:
      'Fireflies.ai is the #1 AI teammate for meetings. We are looking for a Brand & Web Designer to shape how Fireflies shows up across product and marketing.',
    remoteStatus: 'Remote',
  })

  assert.deepEqual(affiliateJob, {
    title: 'Affiliate Partnership Manager',
    company: 'Fireflies.ai',
    department: 'Marketing',
    location: 'Chennai, India; Pune, India; Bangalore, India; India',
    city: 'Chennai',
    country: 'India',
    jobId: 'am9icG9zdDo7PW8KmWLFrEPxztUFIlrE',
    requisitionId: 'R88',
    sourceUrl: 'https://jobs.gem.com/fireflies/am9icG9zdDo7PW8KmWLFrEPxztUFIlrE',
    applyUrl: 'https://jobs.gem.com/fireflies/am9icG9zdDo7PW8KmWLFrEPxztUFIlrE/application',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-04-13T23:37:36.000Z',
    closingDate: null,
    jobDescription:
      'Own affiliate growth across strategic markets for Fireflies.ai. Build regional partner programs. Drive performance with data.',
    remoteStatus: 'Remote',
  })
})

test('Fireflies.ai run validates the careers redirect, Gem board shell, public list query, and detail queries before returning India jobs', async () => {
  const firefliesAi = await loadModule()
  const requestedPageUrls = []
  const requestedJsonBodies = []

  const jobs = await firefliesAi.createFirefliesAiScraper({
    now: () => '2026-07-15T18:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === firefliesAi.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === firefliesAi.CAREERS_URL) {
        return gemBoardPage
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchGraphql: async (body) => {
      requestedJsonBodies.push(body)

      if (body.operationName === 'JobBoardList') {
        return jobBoardListPayload
      }

      if (body.variables?.extId === 'am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3') {
        return brandDesignerDetailPayload
      }

      if (body.variables?.extId === 'am9icG9zdDo7PW8KmWLFrEPxztUFIlrE') {
        return affiliateDetailPayload
      }

      throw new Error(`Unexpected GraphQL body: ${JSON.stringify(body)}`)
    },
  })

  assert.deepEqual(requestedPageUrls, [
    firefliesAi.HOMEPAGE_URL,
    firefliesAi.CAREERS_URL,
  ])
  assert.deepEqual(
    requestedJsonBodies.map((body) => ({
      operationName: body.operationName,
      boardId: body.variables?.boardId,
      extId: body.variables?.extId ?? null,
    })),
    [
      {
        operationName: 'JobBoardList',
        boardId: 'fireflies',
        extId: null,
      },
      {
        operationName: 'ExternalJobPostingQuery',
        boardId: 'fireflies',
        extId: 'am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
      },
      {
        operationName: 'ExternalJobPostingQuery',
        boardId: 'fireflies',
        extId: 'am9icG9zdDo7PW8KmWLFrEPxztUFIlrE',
      },
    ],
  )
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      link: job.link,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Affiliate Partnership Manager',
        source: 'firefliesai',
        link: 'https://jobs.gem.com/fireflies/am9icG9zdDo7PW8KmWLFrEPxztUFIlrE/application',
        companyCareerPage: 'https://fireflies.ai/careers',
        companyDomain: 'jobs.gem.com',
        atsPlatform: 'gem',
        scrapedAt: '2026-07-15T18:00:00.000Z',
      },
      {
        title: 'Brand & Web Designer',
        source: 'firefliesai',
        link: 'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3/application',
        companyCareerPage: 'https://fireflies.ai/careers',
        companyDomain: 'jobs.gem.com',
        atsPlatform: 'gem',
        scrapedAt: '2026-07-15T18:00:00.000Z',
      },
    ],
  )
})

test('Fireflies.ai fails closed when the homepage, Gem board shell, list payload, or detail payload drift materially', async () => {
  const firefliesAi = await loadModule()

  await assert.rejects(
    firefliesAi.createFirefliesAiScraper().run({
      fetchPage: async (url) => {
        if (url === firefliesAi.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Different homepage</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    firefliesAi.createFirefliesAiScraper().run({
      fetchPage: async (url) => {
        if (url === firefliesAi.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === firefliesAi.CAREERS_URL) {
          return {
            status: 200,
            url: 'https://jobs.gem.com/fireflies',
            html: '<html><head><title>Fireflies Careers</title></head><body>No Gem bundle</body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /gem board shell no longer matches/i,
  )

  await assert.rejects(
    firefliesAi.createFirefliesAiScraper().run({
      fetchPage: async (url) => {
        if (url === firefliesAi.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === firefliesAi.CAREERS_URL) {
          return gemBoardPage
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchGraphql: async () => ({
        data: {
          oatsExternalJobPostings: {
            jobPostings: [],
          },
          oatsExternalJobPostingsFilters: [],
          jobBoardExternal: {
            id: 'board',
            teamDisplayName: 'Other',
            descriptionHtml: '',
            pageTitle: 'Other Careers',
          },
        },
      }),
    }),
    /public job board list payload/i,
  )

  await assert.rejects(
    firefliesAi.createFirefliesAiScraper().run({
      fetchPage: async (url) => {
        if (url === firefliesAi.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === firefliesAi.CAREERS_URL) {
          return gemBoardPage
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchGraphql: async (body) => {
        if (body.operationName === 'JobBoardList') {
          return jobBoardListPayload
        }

        return {
          data: {
            oatsExternalJobPosting: {
              ...brandDesignerDetailPayload.data.oatsExternalJobPosting,
              title: null,
            },
          },
        }
      },
    }),
    /job detail payload/i,
  )
})
