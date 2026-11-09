import assert from 'node:assert/strict'
import test from 'node:test'

const loadAspireModule = async () => {
  try {
    return await import('../../scraper/aspiresystems/script.js')
  } catch {
    return null
  }
}

const buildListingHtml = (jobs) => `
<!doctype html>
<html>
  <body>
    <div id="openings">
      <div class="openings-oppourtunity-right">
        ${jobs.map((job) => `
          <div class="views-row"><div class="opening-oppourtunity">
            <div class="op-oppourtunity-title">
              <h3><a href="${job.detailPath}" hreflang="en">${job.title}</a></h3>
            </div>
            <div class="op-oppourtunity-details">
              <span class="op-location">${job.country}</span> |
              <span class="op-statename">${job.cities}</span>
              <span class="op-job-type">${job.employmentType}</span>
              <span class="op-exp-year">${job.experienceRequired}</span>
            </div>
            <div class="op-oppourtunity-description">${job.summaryHtml}</div>
            <div class="op-oppourtunity-apply-post">
              <div class="op-job-apply-bt">
                <a href="${job.applyPath}">Apply now</a>
              </div>
            </div>
          </div></div>
        `).join('')}
      </div>
    </div>
  </body>
</html>
`

const buildDetailHtml = ({
  title,
  country,
  jobId,
  employmentType,
  postedDate,
  descriptionHtml,
  applyPath,
}) => `
<!doctype html>
<html>
  <head>
    <meta name="description" content="Short summary for ${title}" />
  </head>
  <body>
    <h1><span>${title}</span></h1>
    <div id="openings-detailpage" class="row">
      <div class="opening-details-section col-lg-9 col-md-9 col-sm-12">
        <div class="row">
          <div class="job-locaiton col-lg-3 col-md-6 col-sm-12">${country}</div>
          <div class="job-id col-lg-4 col-md-6 col-sm-12">ID ${jobId}</div>
          <div class="job-type col-lg-3 col-md-6 col-sm-12"><div><div>${employmentType}</div></div></div>
          <div class="job-submit-date col-lg-2 col-md-6 col-sm-12">${postedDate}</div>
        </div>
        <div class="row">
          <div>${descriptionHtml}</div>
        </div>
        <div class="row opening-details-submit-section">
          <a href="${applyPath}">Apply</a>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('extractSearchResults maps Aspire Systems openings listings plus detail pages into shared scraper fields', async () => {
  const aspire = await loadAspireModule()
  assert.ok(aspire)

  const experiencedHtml = buildListingHtml([
    {
      title: 'Finance Executive (Revenue Accounting)',
      detailPath: '/openings/asp-003-0626',
      applyPath: '/openings/careers-apply?utm_jobid=asp-003-0626',
      country: 'India',
      cities: 'Chennai',
      employmentType: 'Full Time',
      experienceRequired: '2 to 6 years',
      summaryHtml: '<p><strong>Work Mode:</strong> Hybrid</p>',
    },
    {
      title: 'Dotnet &amp; React Fullstack - Tech Lead',
      detailPath: '/openings/asp-002-0626',
      applyPath: '/openings/careers-apply?utm_jobid=asp-002-0626',
      country: 'India',
      cities: 'Bangalore, Kochi, Hyderabad, Chennai',
      employmentType: 'Full Time',
      experienceRequired: '9 to 15 years',
      summaryHtml: '<p><strong>Work Mode:</strong> Hybrid/Remote</p>',
    },
  ])

  const fresherHtml = buildListingHtml([
    {
      title: 'Graduate Engineer Trainee',
      detailPath: '/openings/asp-010-0626',
      applyPath: '/openings/careers-apply?utm_jobid=asp-010-0626',
      country: 'India',
      cities: 'Chennai',
      employmentType: 'Full Time',
      experienceRequired: '0 to 1 years',
      summaryHtml: '<p><strong>Work Mode:</strong> Hybrid</p>',
    },
    {
      title: 'Finance Executive (Revenue Accounting)',
      detailPath: '/openings/asp-003-0626',
      applyPath: '/openings/careers-apply?utm_jobid=asp-003-0626',
      country: 'India',
      cities: 'Chennai',
      employmentType: 'Full Time',
      experienceRequired: '2 to 6 years',
      summaryHtml: '<p><strong>Work Mode:</strong> Hybrid</p>',
    },
  ])

  const jobs = aspire.extractSearchResults({
    listingHtmlByUrl: {
      [aspire.EXPERIENCED_OPENINGS_URL]: experiencedHtml,
      [aspire.FRESHER_OPENINGS_URL]: fresherHtml,
    },
    detailHtmlByUrl: {
      'https://www.aspiresys.com/openings/asp-003-0626': buildDetailHtml({
        title: 'Finance Executive (Revenue Accounting)',
        country: 'India',
        jobId: 'asp-003-0626',
        employmentType: 'Full Time',
        postedDate: '16/06/2026',
        descriptionHtml: '<p><strong>Work Mode:</strong> Hybrid</p><p><strong>Role Overview:</strong> Support revenue recognition and invoicing.</p>',
        applyPath: '/openings/careers-apply?utm_jobid=asp-003-0626',
      }),
      'https://www.aspiresys.com/openings/asp-002-0626': buildDetailHtml({
        title: 'Dotnet &amp; React Fullstack - Tech Lead',
        country: 'India',
        jobId: 'asp-002-0626',
        employmentType: 'Full Time',
        postedDate: '10/06/2026',
        descriptionHtml: '<p><strong>Work Mode:</strong> Hybrid/Remote</p><p><strong>Role Overview:</strong> Build full-stack platforms across multiple delivery centers.</p>',
        applyPath: '/openings/careers-apply?utm_jobid=asp-002-0626',
      }),
      'https://www.aspiresys.com/openings/asp-010-0626': buildDetailHtml({
        title: 'Graduate Engineer Trainee',
        country: 'India',
        jobId: 'asp-010-0626',
        employmentType: 'Full Time',
        postedDate: '01/06/2026',
        descriptionHtml: '<p><strong>Work Mode:</strong> Hybrid</p><p><strong>Role Overview:</strong> Launch an engineering career in digital product delivery.</p>',
        applyPath: '/openings/careers-apply?utm_jobid=asp-010-0626',
      }),
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Finance Executive (Revenue Accounting)',
    company: 'Aspire Systems',
    department: null,
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: 'asp-003-0626',
    requisitionId: 'asp-003-0626',
    sourceUrl: 'https://www.aspiresys.com/openings/asp-003-0626',
    applyUrl: 'https://www.aspiresys.com/openings/careers-apply?utm_jobid=asp-003-0626',
    employmentType: 'Full Time',
    experienceRequired: '2 to 6 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-16T00:00:00.000Z',
    closingDate: null,
    jobDescription: 'Work Mode: Hybrid Role Overview: Support revenue recognition and invoicing.',
    remoteStatus: 'Hybrid',
  })
  assert.equal(jobs[1].title, 'Dotnet & React Fullstack - Tech Lead')
  assert.equal(jobs[1].city, 'Bangalore')
  assert.equal(jobs[1].remoteStatus, 'Hybrid')
  assert.equal(jobs[2].title, 'Graduate Engineer Trainee')
  assert.equal(jobs[2].jobId, 'asp-010-0626')
})

test('run fetches Aspire Systems experienced and fresher openings, enriches details, and decorates jobs', async () => {
  const aspire = await loadAspireModule()
  assert.ok(aspire)

  const experiencedHtml = buildListingHtml([
    {
      title: 'Lead Gen AI Developer',
      detailPath: '/openings/asp-001-0626',
      applyPath: '/openings/careers-apply?utm_jobid=asp-001-0626',
      country: 'India',
      cities: 'Bangalore, Kochi, Hyderabad, Chennai',
      employmentType: 'Full Time',
      experienceRequired: '7 to 16 years',
      summaryHtml: '<p><strong>Work Mode:</strong> Hybrid/Remote</p>',
    },
  ])

  const fresherHtml = buildListingHtml([])

  const detailHtml = buildDetailHtml({
    title: 'Lead Gen AI Developer',
    country: 'India',
    jobId: 'asp-001-0626',
    employmentType: 'Full Time',
    postedDate: '05/06/2026',
    descriptionHtml: '<p><strong>Work Mode:</strong> Hybrid/Remote</p><p><strong>Role Overview:</strong> Build AI-driven lead generation workflows.</p>',
    applyPath: '/openings/careers-apply?utm_jobid=asp-001-0626',
  })

  const requestedUrls = []
  const scraper = aspire.createAspireSystemsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === aspire.EXPERIENCED_OPENINGS_URL) return experiencedHtml
      if (url === aspire.FRESHER_OPENINGS_URL) return fresherHtml
      if (url === 'https://www.aspiresys.com/openings/asp-001-0626') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aspire.EXPERIENCED_OPENINGS_URL,
    aspire.FRESHER_OPENINGS_URL,
    'https://www.aspiresys.com/openings/asp-001-0626',
  ])
  assert.equal(aspire.buildSearchUrls().length, 2)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'aspiresystems')
  assert.equal(jobs[0].link, 'https://www.aspiresys.com/openings/careers-apply?utm_jobid=asp-001-0626')
  assert.equal(jobs[0].company, 'Aspire Systems')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
