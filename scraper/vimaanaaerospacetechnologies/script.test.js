import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  buildPageDataUrls,
  createVimaanaAerospaceTechnologiesScraper,
  extractRoleCardsFromPagePayload,
  pageIndicatesJobs,
} from './script.js'

const MASTER_PAGE_DATA_URL = 'https://siteassets.parastorage.com/pages/pages/thunderbolt?module=thunderbolt-features&pageId=master-page.json'
const CAREER_PAGE_DATA_URL = 'https://siteassets.parastorage.com/pages/pages/thunderbolt?module=thunderbolt-features&pageId=career-page.json'

const careerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CAREER | Vimaana Technologies</title>
    <link rel="preload" href="${MASTER_PAGE_DATA_URL}">
    <link rel="preload" href="${CAREER_PAGE_DATA_URL}">
  </head>
  <body>
    <h1>Vimaana Aerospace Technologies</h1>
    <p>we make things fly</p>
    <p>Click Here To Apply</p>
  </body>
</html>
`

const emptyPayload = {
  structure: {
    components: {
      masterPage: {
        componentType: 'Page',
        components: [],
      },
    },
  },
  props: {
    render: {
      compProps: {},
    },
  },
}

const careerPayload = {
  structure: {
    components: {
      careerPage: {
        componentType: 'Page',
        components: ['careerCard1', 'careerCard2', 'careerCard3', 'careerCard4'],
      },
      careerCard1: {
        componentType: 'Container',
        components: ['title1', 'description1', 'button1'],
      },
      careerCard2: {
        componentType: 'Container',
        components: ['title2', 'description2', 'button2'],
      },
      careerCard3: {
        componentType: 'Container',
        components: ['title3', 'description3', 'button3'],
      },
      careerCard4: {
        componentType: 'Container',
        components: ['title4', 'description4', 'button4'],
      },
      title1: { componentType: 'WRichText' },
      title2: { componentType: 'WRichText' },
      title3: { componentType: 'WRichText' },
      title4: { componentType: 'WRichText' },
      description1: { componentType: 'WRichText' },
      description2: { componentType: 'WRichText' },
      description3: { componentType: 'WRichText' },
      description4: { componentType: 'WRichText' },
      button1: { componentType: 'SiteButton' },
      button2: { componentType: 'SiteButton' },
      button3: { componentType: 'SiteButton' },
      button4: { componentType: 'SiteButton' },
    },
  },
  props: {
    render: {
      compProps: {
        title1: {
          html: '<h5>UAV PROJECT INTERN</h5>',
        },
        description1: {
          html: `
            <p>Apply for UAV Project Intern in which you will get full hands on experience on Drones.</p>
            <p>Completing this intern can lead to full time Placement Opportunity.</p>
          `,
        },
        button1: {
          label: 'Click Here To Apply',
          link: null,
        },
        title2: {
          html: '<h5>UAV ENGINEER</h5>',
        },
        description2: {
          html: `
            <p>The UAV Engineer is required to work on requirement specifications, architecture design, development and maintenance of drone and its components.</p>
            <p>We are seeking full time employees who can work on real time projects and help us create a better world using UAVs.</p>
          `,
        },
        button2: {
          label: 'Click Here To Apply',
          link: {
            href: '',
            target: '_self',
            linkPopupId: 'k38v3',
            type: 'PageLink',
            id: 'dataItem-km1xk7rs',
          },
        },
        title3: {
          html: '<h5>TECHNICAL SALES &amp; MARKETING INTERN</h5>',
        },
        description3: {
          html: `
            <p>The Digital Marketing Intern is required to work on generating sales and creating content and marketing strategies for the company.</p>
            <p>We are seeking interns who can create significant impact by their content.</p>
          `,
        },
        button3: {
          label: 'Click Here To Apply',
          link: {
            href: '',
            target: '_self',
            linkPopupId: 'k38v3',
            type: 'PageLink',
            id: 'dataItem-kmg7d6w7',
          },
        },
        title4: {
          html: '<h5>UAV TRAINER</h5>',
        },
        description4: {
          html: `
            <p>The UAV Trainer is required to guide the trainees in development and maintenance of drone and its components.</p>
            <p>Individuals who can enhance and support Vimaana products, services, credibility, performance and quality are welcomed.</p>
          `,
        },
        button4: {
          label: 'Click Here To Apply',
          link: {
            href: '',
            target: '_self',
            linkPopupId: 'k38v3',
            type: 'PageLink',
            id: 'dataItem-kmg7dcnu',
          },
        },
      },
    },
  },
}

test('pageIndicatesJobs and buildPageDataUrls recognize the verified Vimaana career page contract', () => {
  assert.equal(pageIndicatesJobs(careerHtml), true)
  assert.deepEqual(buildPageDataUrls(careerHtml), [
    MASTER_PAGE_DATA_URL,
    CAREER_PAGE_DATA_URL,
  ])
})

test('extractRoleCardsFromPagePayload normalizes the public roles from the Wix page payload', () => {
  assert.deepEqual(extractRoleCardsFromPagePayload(careerPayload), [
    {
      title: 'UAV PROJECT INTERN',
      description: 'Apply for UAV Project Intern in which you will get full hands on experience on Drones. Completing this intern can lead to full time Placement Opportunity.',
      applyUrl: null,
    },
    {
      title: 'UAV ENGINEER',
      description: 'The UAV Engineer is required to work on requirement specifications, architecture design, development and maintenance of drone and its components. We are seeking full time employees who can work on real time projects and help us create a better world using UAVs.',
      applyUrl: null,
    },
    {
      title: 'TECHNICAL SALES & MARKETING INTERN',
      description: 'The Digital Marketing Intern is required to work on generating sales and creating content and marketing strategies for the company. We are seeking interns who can create significant impact by their content.',
      applyUrl: null,
    },
    {
      title: 'UAV TRAINER',
      description: 'The UAV Trainer is required to guide the trainees in development and maintenance of drone and its components. Individuals who can enhance and support Vimaana products, services, credibility, performance and quality are welcomed.',
      applyUrl: null,
    },
  ])
})

test('run resolves the first page payload with public jobs and decorates jobs for persistence', async () => {
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await createVimaanaAerospaceTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === CAREER_PAGE_URL) return careerHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === MASTER_PAGE_DATA_URL) return emptyPayload
      if (url === CAREER_PAGE_DATA_URL) return careerPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [CAREER_PAGE_URL])
  assert.deepEqual(requestedJsonUrls, [MASTER_PAGE_DATA_URL, CAREER_PAGE_DATA_URL])
  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'UAV PROJECT INTERN',
      'UAV ENGINEER',
      'TECHNICAL SALES & MARKETING INTERN',
      'UAV TRAINER',
    ],
  )
  assert.equal(jobs[0].source, 'vimaanaaerospacetechnologies')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].sourceUrl, CAREER_PAGE_URL)
  assert.equal(jobs[0].applyUrl, null)
  assert.equal(jobs[0].link, CAREER_PAGE_URL)
  assert.match(jobs[0].jobId, /^vimaanaaerospacetechnologies-/)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run throws when no candidate Wix page payload exposes the verified role cards', async () => {
  await assert.rejects(
    createVimaanaAerospaceTechnologiesScraper().run({
      fetchText: async () => careerHtml,
      fetchJson: async () => emptyPayload,
    }),
    /no longer exposes the expected public role cards/i,
  )
})
