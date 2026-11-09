import assert from 'node:assert/strict'
import test from 'node:test'

const loadChetuModule = async () => {
  try {
    return await import('../../scraper/chetu/script.js')
  } catch {
    assert.fail('Expected Chetu scraper module at ../../scraper/chetu/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Chetu Careers | IT Careers | Software Engineer Careers</title>
    <meta name="_token" content="meta-token">
  </head>
  <body>
    <nav>
      <ul class="customtabs">
        <li data-target="US" class="tab">US Careers</li>
        <li data-target="UK" class="tab">UK Careers</li>
        <li data-target="IN" class="tab">India Careers</li>
      </ul>
    </nav>
    <div id="job-data-container"></div>
    <script>
      $.ajax({
        url: "https://careers.chetu.com/data/fetch",
        type: 'POST',
        data: {
          tab: tab,
          _token: 'verified-csrf-token',
        },
        success: function (response) {
          const vdata = response.data;
          const encryptedMasterJobId = encodeURIComponent(item.encrypted_master_job_id);
          const encryptedJobName = encodeURIComponent(item.encrypted_job_name);
          const encryptedCountryCode = encodeURIComponent(item.encrypted_country_code);

          if (encryptedMasterJobId == "pW7eQclLZyaJw4JCcSKx8w%3D%3D") {
            html += \`<button onclick="return showPopup(this.value, '\${item.job_name}')" value="\${item.job_apply_link}">Apply Now</button>\`;
          } else {
            html += \`<a href="https://applicant.chetu.com/#/job/apply?countryCode=\${encryptedCountryCode}&masterJobId=\${encryptedMasterJobId}&jobName=\${encryptedJobName}" target="_blank">Apply Now</a>\`;
          }
        }
      });
    </script>
  </body>
</html>
`

const indiaFeedPayload = {
  data: [
    {
      id: 279,
      MasterJobId: 873,
      job_name: 'Channel Partner Manager',
      job_description: 'Build partner pipeline.',
      job_type: null,
      min_experiance: 2,
      max_experiance: 4,
      job_skills: '[Business Development, Channel Partnerships]',
      job_country: 'IN',
      job_location: 'Noida',
      status: 1,
      job_apply_link: 'https://careers.chetu.com/',
      created_at: '2026-07-01T12:09:13.000000Z',
      updated_at: '2026-07-01T12:09:13.000000Z',
      encrypted_master_job_id: '1aOYeM4GCRfJlNdSjjfBcw==',
      encrypted_job_name: 'mBvIpvM42UJ3ApK4HQ44EhGur62xzLdoqGlj9kCoVGI=',
      encrypted_country_code: 'xxfRSf/l/K/R2iAU90eRBw==',
    },
    {
      id: 280,
      MasterJobId: 874,
      job_name: 'Inline Popup Role',
      job_description: 'Handled through the first-party popup.',
      job_type: 'Operations',
      min_experiance: 1,
      max_experiance: 3,
      job_skills: 'null',
      job_country: 'IN',
      job_location: 'Noida',
      status: 1,
      job_apply_link: 'https://careers.chetu.com/',
      created_at: '2026-07-02T08:30:00.000000Z',
      updated_at: '2026-07-02T08:30:00.000000Z',
      encrypted_master_job_id: 'pW7eQclLZyaJw4JCcSKx8w==',
      encrypted_job_name: 'inline-popup-role==',
      encrypted_country_code: 'xxfRSf/l/K/R2iAU90eRBw==',
    },
    {
      id: 281,
      MasterJobId: 875,
      job_name: 'US Sales Role',
      job_description: 'United States only role.',
      job_type: 'Sales',
      min_experiance: 3,
      max_experiance: 5,
      job_skills: '[CRM]',
      job_country: 'US',
      job_location: 'Sunrise',
      status: 1,
      job_apply_link: 'https://careers.chetu.com/',
      created_at: '2026-07-03T08:30:00.000000Z',
      updated_at: '2026-07-03T08:30:00.000000Z',
      encrypted_master_job_id: 'us-role==',
      encrypted_job_name: 'us-sales-role==',
      encrypted_country_code: 'us-country==',
    },
  ],
}

test('Chetu helpers stay pinned to the verified official careers page and first-party feed contract', async () => {
  const chetu = await loadChetuModule()

  assert.equal(chetu.SOURCE, 'chetu')
  assert.equal(chetu.COMPANY, 'Chetu')
  assert.equal(chetu.CAREERS_URL, 'https://careers.chetu.com/')
  assert.equal(chetu.JOBS_API_URL, 'https://careers.chetu.com/data/fetch')
  assert.equal(chetu.APPLICANT_URL_BASE, 'https://applicant.chetu.com/#/job/apply')
  assert.equal(chetu.INDIA_TAB_CODE, 'IN')
  assert.equal(chetu.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(chetu.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(chetu.extractCsrfToken(careersHtml), 'verified-csrf-token')
  assert.equal(
    chetu.buildListingsRequestBody('verified-csrf-token').toString(),
    'tab=IN&_token=verified-csrf-token',
  )
  assert.equal(
    chetu.buildApplyUrl(indiaFeedPayload.data[0]),
    'https://applicant.chetu.com/#/job/apply?countryCode=xxfRSf%2Fl%2FK%2FR2iAU90eRBw%3D%3D&masterJobId=1aOYeM4GCRfJlNdSjjfBcw%3D%3D&jobName=mBvIpvM42UJ3ApK4HQ44EhGur62xzLdoqGlj9kCoVGI%3D',
  )
  assert.equal(
    chetu.buildApplyUrl(indiaFeedPayload.data[1]),
    'https://careers.chetu.com/',
  )
  assert.deepEqual(
    chetu.normalizeJob(indiaFeedPayload.data[0], '2026-07-14T09:30:00.000Z'),
    {
      title: 'Channel Partner Manager',
      company: 'Chetu',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      state: null,
      country: 'India',
      jobId: '873',
      requisitionId: '873',
      sourceUrl: 'https://careers.chetu.com/',
      applyUrl:
        'https://applicant.chetu.com/#/job/apply?countryCode=xxfRSf%2Fl%2FK%2FR2iAU90eRBw%3D%3D&masterJobId=1aOYeM4GCRfJlNdSjjfBcw%3D%3D&jobName=mBvIpvM42UJ3ApK4HQ44EhGur62xzLdoqGlj9kCoVGI%3D',
      employmentType: null,
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Business Development', 'Channel Partnerships'],
      postingDate: '2026-07-01T12:09:13.000000Z',
      closingDate: null,
      jobDescription: 'Build partner pipeline.',
      source: 'chetu',
      link:
        'https://applicant.chetu.com/#/job/apply?countryCode=xxfRSf%2Fl%2FK%2FR2iAU90eRBw%3D%3D&masterJobId=1aOYeM4GCRfJlNdSjjfBcw%3D%3D&jobName=mBvIpvM42UJ3ApK4HQ44EhGur62xzLdoqGlj9kCoVGI%3D',
      scrapedAt: '2026-07-14T09:30:00.000Z',
    },
  )
})

test('Chetu run uses the verified careers session and first-party feed to normalize India jobs', async () => {
  const chetu = await loadChetuModule()
  const requestedSessionUrls = []
  const requestedFeeds = []

  const jobs = await chetu.createChetuScraper({ maxJobs: 2 }).run({
    fetchSessionPage: async (url) => {
      requestedSessionUrls.push(url)
      return {
        html: careersHtml,
        cookieHeader: 'laravel_session=abc123; XSRF-TOKEN=xyz789',
      }
    },
    fetchJson: async (url, options = {}) => {
      requestedFeeds.push({ url, options })
      return indiaFeedPayload
    },
    now: () => '2026-07-14T09:30:00.000Z',
  })

  assert.deepEqual(requestedSessionUrls, [chetu.CAREERS_URL])
  assert.equal(requestedFeeds.length, 1)
  assert.equal(requestedFeeds[0].url, chetu.JOBS_API_URL)
  assert.equal(requestedFeeds[0].options.method, 'POST')
  assert.equal(
    requestedFeeds[0].options.headers['Content-Type'],
    'application/x-www-form-urlencoded; charset=UTF-8',
  )
  assert.equal(requestedFeeds[0].options.headers.Cookie, 'laravel_session=abc123; XSRF-TOKEN=xyz789')
  assert.equal(requestedFeeds[0].options.headers.Referer, chetu.CAREERS_URL)
  assert.equal(requestedFeeds[0].options.body.get('tab'), 'IN')
  assert.equal(requestedFeeds[0].options.body.get('_token'), 'verified-csrf-token')
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, '873')
  assert.equal(jobs[0].city, 'Noida')
  assert.equal(jobs[0].country, 'India')
  assert.equal(
    jobs[0].applyUrl,
    'https://applicant.chetu.com/#/job/apply?countryCode=xxfRSf%2Fl%2FK%2FR2iAU90eRBw%3D%3D&masterJobId=1aOYeM4GCRfJlNdSjjfBcw%3D%3D&jobName=mBvIpvM42UJ3ApK4HQ44EhGur62xzLdoqGlj9kCoVGI%3D',
  )
  assert.equal(jobs[1].jobId, '874')
  assert.equal(jobs[1].department, 'Operations')
  assert.equal(jobs[1].applyUrl, chetu.CAREERS_URL)
  assert.ok(jobs.every((job) => job.country === 'India'))
})

test('Chetu fails closed when the verified careers shell or CSRF token changes', async () => {
  const chetu = await loadChetuModule()

  await assert.rejects(
    chetu.createChetuScraper().run({
      fetchSessionPage: async () => ({
        html: '<html><body><h1>Careers</h1></body></html>',
        cookieHeader: null,
      }),
      fetchJson: async () => indiaFeedPayload,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    chetu.createChetuScraper().run({
      fetchSessionPage: async () => ({
        html: careersHtml.replace("_token: 'verified-csrf-token'", ''),
        cookieHeader: 'laravel_session=abc123',
      }),
      fetchJson: async () => indiaFeedPayload,
    }),
    /csrf token/i,
  )
})
