import assert from 'node:assert/strict'
import test from 'node:test'

const loadFlexModule = () => import('../../scraper/flex.workday/script.js')

test('uses Flex official careers and Workday jobs API endpoints', async () => {
  const {
    BASE_URL,
    CAREER_PAGE_URL,
    INDIA_COUNTRY_FACET_ID,
    JOBS_API_URL,
    buildJobsApiRequest,
  } = await loadFlexModule()

  assert.equal(CAREER_PAGE_URL, 'https://flex.com/careers')
  assert.equal(BASE_URL, 'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers')
  assert.equal(
    JOBS_API_URL,
    'https://flextronics.wd1.myworkdayjobs.com/wday/cxs/flextronics/Careers/jobs',
  )
  assert.equal(INDIA_COUNTRY_FACET_ID, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.deepEqual(buildJobsApiRequest(20, 2), {
    appliedFacets: {
      Location_Country: ['c4f78be1a8f14da0ab49ce1162348a5e'],
    },
    limit: 2,
    offset: 20,
    searchText: '',
  })
})

test('run posts the India country facet to Flex Workday and normalizes jobs', async () => {
  const { JOBS_API_URL, createFlexScraper } = await loadFlexModule()
  const requests = []
  const scraper = createFlexScraper({ pageSize: 2 })
  const detailPageHtmlByUrl = {
    'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Bangalore/Manager---Production_WD224562': `
      <html>
        <body>
          <section data-automation-id="jobPostingDescription">
            <div>
              <p>Lead production planning and execution for high-volume manufacturing programs.</p>
            </div>
          </section>
        </body>
      </html>
    `,
    'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Remote/Manager---Government-Affairs_WD224329': `
      <html>
        <body>
          <section data-automation-id="jobPostingDescription">
            <div>
              <p>Build regional government engagement strategies and executive relationships.</p>
            </div>
          </section>
        </body>
      </html>
    `,
    'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Chennai/Analyst---Procurement_WD224473': `
      <html>
        <body>
          <section data-automation-id="jobPostingDescription">
            <div>
              <p>One or two years of Experience in the GL or Intercompany Activity or AR or AP.</p>
            </div>
          </section>
        </body>
      </html>
    `,
  }

  const jobs = await scraper.run({
    fetchJson: async (url, options) => {
      requests.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      if (requests.length === 1) {
        return {
          total: 3,
          jobPostings: [
            {
              title: 'Manager - Production',
              externalPath: '/job/India-Bangalore/Manager---Production_WD224562',
              locationsText: 'India, Bangalore',
              postedOn: 'Posted Today',
              bulletFields: ['WD224562'],
            },
            {
              title: 'Manager - Government Affairs',
              externalPath: '/job/India-Remote/Manager---Government-Affairs_WD224329',
              locationsText: 'India, Remote',
              postedOn: 'Posted Today',
              bulletFields: ['WD224329'],
            },
          ],
        }
      }

      return {
        total: 3,
        jobPostings: [
          {
            title: 'Analyst - Procurement',
            externalPath: '/job/India-Chennai/Analyst---Procurement_WD224473',
            locationsText: 'India, Chennai',
            postedOn: 'Posted Yesterday',
            bulletFields: ['WD224473'],
          },
        ],
      }
    },
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: detailPageHtmlByUrl[url],
    }),
  })

  assert.deepEqual(requests, [
    {
      url: JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          Location_Country: ['c4f78be1a8f14da0ab49ce1162348a5e'],
        },
        limit: 2,
        offset: 0,
        searchText: '',
      },
    },
    {
      url: JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          Location_Country: ['c4f78be1a8f14da0ab49ce1162348a5e'],
        },
        limit: 2,
        offset: 2,
        searchText: '',
      },
    },
  ])

  assert.equal(jobs.length, 3)

  const [{ scrapedAt, ...firstJob }, { scrapedAt: secondScrapedAt, ...secondJob }] = jobs

  assert.deepEqual(firstJob, {
    title: 'Manager - Production',
    company: 'Flex',
    department: null,
    location: 'India, Bangalore',
    city: 'Bangalore',
    country: 'India',
    jobId: 'WD224562',
    requisitionId: 'WD224562',
    sourceUrl:
      'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Bangalore/Manager---Production_WD224562',
    applyUrl:
      'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Bangalore/Manager---Production_WD224562/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Lead production planning and execution for high-volume manufacturing programs.',
    remoteStatus: null,
    source: 'flex',
    link:
      'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Bangalore/Manager---Production_WD224562/apply',
  })

  assert.deepEqual(secondJob, {
    title: 'Manager - Government Affairs',
    company: 'Flex',
    department: null,
    location: 'India, Remote',
    city: null,
    country: 'India',
    jobId: 'WD224329',
    requisitionId: 'WD224329',
    sourceUrl:
      'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Remote/Manager---Government-Affairs_WD224329',
    applyUrl:
      'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Remote/Manager---Government-Affairs_WD224329/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Build regional government engagement strategies and executive relationships.',
    remoteStatus: 'Remote',
    source: 'flex',
    link:
      'https://flextronics.wd1.myworkdayjobs.com/en-US/Careers/job/India-Remote/Manager---Government-Affairs_WD224329/apply',
  })

  assert.equal(jobs[2].experienceRequired, '2 years')
  assert.match(jobs[2].jobDescription || '', /One or two years of Experience/i)
  assert.match(scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.match(secondScrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
