import assert from 'node:assert/strict'
import test from 'node:test'

const loadBrillioModule = async () => {
  try {
    return await import('../../scraper/brillio/script.js')
  } catch {
    return null
  }
}

const buildListingHtml = ({ jobs = [], pageLinks = [] } = {}) => `
<!doctype html>
<html>
  <body>
    ${jobs.map((job) => `
      <div class="job-list-wrap job_list">
        <a href="${job.detailUrl}"></a>
        <div class="job-card">
          <h4>${job.title}</h4>
          <p class="infoline">
            <span>${job.location}</span>
            <span>${job.department}</span>
            <span>${job.requisitionId}</span>
          </p>
          <p>${job.summary}</p>
        </div>
      </div>
    `).join('')}
    <nav class="pagination">
      ${pageLinks.map((page) => `<a href="https://careers.brillio.com/job-listing/page/${page}/">${page}</a>`).join('')}
    </nav>
  </body>
</html>
`

const buildDetailHtml = ({
  title,
  descriptionHtml,
  applyUrl,
} = {}) => `
<!doctype html>
<html>
  <body>
    <div class="_jobtop">
      <a href="${applyUrl}" class="btn btn-light btn-lg">APPLY</a>
    </div>
    <section id="section-1">
      <div class="job-detail-wrapper">
        <div class="row">
          <div class="col-lg-8 col-md-12">
            <div class="_detail-content">
              <h1>${title}</h1>
              <p>${descriptionHtml}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

test('extractSearchResults maps Brillio listing pages and detail pages into India job records', async () => {
  const brillio = await loadBrillioModule()
  assert.ok(brillio)

  const listingPage1 = buildListingHtml({
    jobs: [
      {
        detailUrl: 'https://careers.brillio.com/job-details?job-id=21186',
        title: 'Manager, Cyber Security &#8211; R01566909',
        location: 'Bangalore, India',
        department: 'Digital Office',
        requisitionId: 'R01566909',
        summary: 'Lead cyber security controls and audit readiness.',
      },
      {
        detailUrl: 'https://careers.brillio.com/job-details?job-id=21191',
        title: 'Product Manager with Amazon Connect- R01566925',
        location: 'Dallas, United States',
        department: 'Digital Engineering',
        requisitionId: 'R01566925',
        summary: 'US-only product leadership role.',
      },
    ],
    pageLinks: [2],
  })

  const listingPage2 = buildListingHtml({
    jobs: [
      {
        detailUrl: 'https://careers.brillio.com/job-details?job-id=21192',
        title: 'Analytics Manager (CX analytics) &#8211; R01566789',
        location: 'Bengaluru, India',
        department: 'Data Analytics',
        requisitionId: 'R01566789',
        summary: 'Drive CX analytics programs for enterprise clients.',
      },
    ],
  })

  const jobs = brillio.extractSearchResults({
    listingHtmlByUrl: {
      [brillio.LISTING_PAGE_URL]: listingPage1,
      [brillio.buildListingUrl(2)]: listingPage2,
    },
    detailHtmlByUrl: {
      'https://careers.brillio.com/job-details?job-id=21186': buildDetailHtml({
        title: 'Manager, Cyber Security - R01566909',
        descriptionHtml: '<div><u><strong>Senior Specialist, Security</strong></u></div><h6>Primary Skills</h6><ul><li>ISO Management Systems Standard, Application Security, Operational / Process Excellence</li></ul><h6>Job requirements</h6><ul><li>Location: Bengaluru We are seeking a detail-oriented and highly skilled ITGC Auditor.</li></ul>',
        applyUrl: 'https://careers.brillio.com/privacy-notice?job-id=21186',
      }),
      'https://careers.brillio.com/job-details?job-id=21192': buildDetailHtml({
        title: 'Analytics Manager (CX analytics) - R01566789',
        descriptionHtml: '<div><strong>Analytics leadership role.</strong></div><ul><li>Lead CX analytics delivery for enterprise programs.</li></ul>',
        applyUrl: 'https://careers.brillio.com/privacy-notice?job-id=21192',
      }),
    },
  })

  assert.equal(jobs.length, 2)
  const expected = {
    title: 'Manager, Cyber Security - R01566909',
    company: 'Brillio',
    department: 'Digital Office',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '21186',
    requisitionId: 'R01566909',
    sourceUrl: 'https://careers.brillio.com/job-details?job-id=21186',
    applyUrl: 'https://careers.brillio.com/privacy-notice?job-id=21186',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'ISO Management Systems Standard',
      'Application Security',
      'Operational / Process Excellence',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Senior Specialist, Security Primary Skills ISO Management Systems Standard, Application Security, Operational / Process Excellence Job requirements Location: Bengaluru We are seeking a detail-oriented and highly skilled ITGC Auditor.',
    remoteStatus: null,
  }
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(jobs[0][key], value, key)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs[1].title, 'Analytics Manager (CX analytics) - R01566789')
  assert.equal(jobs[1].city, 'Bengaluru')
  assert.equal(jobs[1].applyUrl, 'https://careers.brillio.com/privacy-notice?job-id=21192')
})

test('run rejects a legacy listing-only transport without current corporate and client binding', async () => {
  const brillio = await loadBrillioModule()
  const requestedUrls = []
  const jobs = await brillio.createBrillioScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw new Error('This fixture has no current corporate handoff')
    },
  })
  assert.deepEqual(requestedUrls, ['https://www.brillio.com/'])
  assert.equal(jobs.length, 0)
})

test('a failed legacy detail remains a partial preview without a fabricated privacy-notice URL', async () => {
  const brillio = await loadBrillioModule()
  const jobs = brillio.extractSearchResults({
    listingHtmlByUrl: { [brillio.LISTING_PAGE_URL]: buildListingHtml({jobs:[{
      detailUrl:'https://careers.brillio.com/job-details?job-id=21192',
      title:'Analytics Manager - R01566789',location:'Bengaluru, India',department:'Data Analytics',
      requisitionId:'R01566789',summary:'Drive CX analytics programs for enterprise clients.',
    }]}) },
  })
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].applyUrl,null)
  assert.equal(jobs[0].jobDescription,'Drive CX analytics programs for enterprise clients.')
  assert.equal(jobs[0].sourceDescriptionType,'listing-preview')
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].sourceListingComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})