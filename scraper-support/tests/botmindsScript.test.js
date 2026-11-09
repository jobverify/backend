import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  buildSearchUrl,
  createBotmindsScraper,
  extractSearchResults,
} from '../../scraper/botminds/script.js'

const buildNextHtml = (jobs) => `
<!doctype html>
<html>
  <body>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          CareerSection: {
            Data: jobs,
          },
        },
      },
    })}</script>
  </body>
</html>
`

test('extractSearchResults parses Botminds jobs embedded in __NEXT_DATA__ and keeps India roles', () => {
  const html = buildNextHtml([
    {
      url: '/careers/principal-ai-engineer',
      data: {
        Header: {
          Title: 'Principal AI Engineer',
          Description: '15+ years of experience in building scalable enterprise platforms.',
          DetailedDescription: 'This role is based in Chennai with a hybrid work model blending in-office collaboration with remote flexibility.',
        },
        OverView: {
          Description: 'Lead the design and development of enterprise-grade Agentic AI systems.',
        },
        Category: 'Engineering',
        CareerSection: [
          {
            Title: 'Requirements',
            Data: [
              '15+ years of software engineering experience.',
              'Deep expertise in .NET and Python.',
            ],
          },
          {
            Title: 'Rewards',
            Data: [
              'Top-tier compensation.',
            ],
          },
        ],
      },
    },
    {
      url: '/careers/vp-of-sales',
      data: {
        Header: {
          Title: 'VP of Sales (US)',
          Description: '10-15+ years of enterprise SaaS sales experience across US markets.',
          DetailedDescription: 'This is a high-impact remote role based in the US.',
        },
        OverView: {
          Description: 'Launch and scale Botminds AI in the US market.',
        },
        Category: 'Functional',
        CareerSection: [],
      },
    },
    {
      url: '/careers/solution-engineer',
      data: {
        Header: {
          Title: 'Solution Engineer/Business Analyst',
          Description: '4+ years experience, RPA technologies, Prompt Engineering',
        },
        OverView: {
          Description: 'Bridge business needs and technology solutions.',
        },
        Category: 'Functional',
        CareerSection: [],
      },
    },
  ])

  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Principal AI Engineer',
    company: 'Botminds',
    department: 'Engineering',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: 'principal-ai-engineer',
    requisitionId: 'principal-ai-engineer',
    sourceUrl: 'https://botminds.ai/careers/principal-ai-engineer',
    applyUrl: 'https://botminds.ai/careers/principal-ai-engineer',
    employmentType: null,
    experienceRequired: '15+ years of experience in building scalable enterprise platforms.',
    minimumQualification: '15+ years of software engineering experience.\nDeep expertise in .NET and Python.',
    preferredQualification: 'Top-tier compensation.',
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'This role is based in Chennai with a hybrid work model blending in-office collaboration with remote flexibility.',
      'Lead the design and development of enterprise-grade Agentic AI systems.',
      'Requirements: 15+ years of software engineering experience. Deep expertise in .NET and Python.',
      'Rewards: Top-tier compensation.',
    ].join('\n'),
  })
})

test('run rejects archived Next data without the current official native board identity', async () => {
  const requestedUrls = []
  const scraper = createBotmindsScraper()

  await assert.rejects(scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return buildNextHtml([
        {
          url: '/careers/full-stack-developer',
          data: {
            Header: {
              Title: 'Full Stack Developer',
              Description: '4+ years experience - Angular, C#, and JavaScript',
              Location: 'Chennai, India',
            },
            OverView: {
              Description: 'Build scalable full-stack product experiences.',
            },
            Category: 'Engineering',
            CareerSection: [
              {
                Title: 'Requirements',
                Data: ['Angular', 'C#', 'SQL'],
              },
            ],
          },
        },
      ])
    },
  }), /Botminds native/)

  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
  assert.deepEqual(requestedUrls, ['https://www.botminds.ai/careers'])
})
