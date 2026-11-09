import assert from 'node:assert/strict'
import test from 'node:test'

const loadNiramaiModule = async () => {
  try {
    return await import('../../scraper/niramai/script.js')
  } catch {
    return null
  }
}

const verifiedCareersPageOneHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Jobs - Niramai</title>
    <meta name="description" content="Jobs Archive - Niramai" />
    <link rel="canonical" href="https://niramai.com/career/" />
    <link rel="next" href="https://niramai.com/career/page/2/" />
    <link rel="alternate" type="application/rss+xml" title="Niramai &raquo; Jobs Feed" href="https://niramai.com/career/feed/" />
  </head>
  <body>
    <div class="sjb-page">
      <div class="list-data">
        <div class="v1 sjb-job-65616">
          <header>
            <div class="row">
              <div class="col-md-5">
                <div class="job-info">
                  <h4>
                    <a href="https://niramai.com/career/talent-acquisition-executive/">
                      <span class="job-title">HR Executive</span>
                    </a>
                  </h4>
                </div>
              </div>
              <div class="col-md-2 col-sm-4 col-xs-12">
                <div class="job-type"><i class="fa fa-briefcase"></i>Full Time</div>
              </div>
              <div class="col-md-2 col-sm-4 col-xs-12">
                <div class="job-location"><i class="fa fa-map-marker"></i>Bangalore, Karnataka</div>
              </div>
              <div class="col-md-3 col-sm-4 col-xs-12">
                <div class="job-date"><i class="fa fa-calendar-check"></i>Posted 3 weeks ago</div>
              </div>
            </div>
          </header>
          <div class="sjb_more_content" id="sjb_more_content_65616">
            <p>NIRAMAI Health Analytix is looking for a <strong>Talent Acquisition Executive</strong> with proven execution excellence and good communication skills to own talent acquisition and support business operations of the company.</p>
            <p><strong>Primary roles &amp; responsibilities:</strong></p>
            <ul class="wp-block-list">
              <li>Responsible for managing talent acquisition process for Screening Operations Function pan India.</li>
              <li>Provide recruitment support to all departments and execute on the hiring strategy.</li>
            </ul>
            <p><strong>Requirements for the role:</strong></p>
            <ul class="wp-block-list">
              <li>2+ years of experience in Talent Acquisition/ Operations</li>
              <li>Education : MBA Preferred; Graduate in any discipline</li>
            </ul>
          </div>
          <div class="job-description">
            <div id="sjb_less_content_65616">
              <p>NIRAMAI Health Analytix is looking for a Talent Acquisition Executive with proven execution excellence...</p>
            </div>
            <div class="sjb-apply-now-btn">
              <p>
                <a href="javascript:void(0)" id="quick-apply-btn" class="btn btn-primary" job_id="65616">Quick Apply</a>
                <a href="https://niramai.com/career/talent-acquisition-executive/" class="btn btn-primary">Read More</a>
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="list-data">
        <div class="v1 sjb-job-62762">
          <header>
            <div class="row">
              <div class="col-md-5">
                <div class="job-info">
                  <h4>
                    <a href="https://niramai.com/career/information-security-manager-ism/">
                      <span class="job-title">Information Security Manager ( ISM )</span> |
                      <span class="company-name">Niramai Health Analytix Pvt.Ltd</span>
                    </a>
                  </h4>
                </div>
              </div>
              <div class="col-md-2 col-sm-4 col-xs-12">
                <div class="job-type"><i class="fa fa-briefcase"></i>Full Time</div>
              </div>
              <div class="col-md-2 col-sm-4 col-xs-12">
                <div class="job-location"><i class="fa fa-map-marker"></i>Bangalore</div>
              </div>
              <div class="col-md-3 col-sm-4 col-xs-12">
                <div class="job-date"><i class="fa fa-calendar-check"></i>Posted 4 months ago</div>
              </div>
            </div>
          </header>
          <div class="sjb_more_content" id="sjb_more_content_62762">
            <p>We’re Hiring: Information Security Manager</p>
            <p>At Niramai Health Analytics, we are committed to building secure, compliant, and innovative healthcare solutions.</p>
            <p>Competency Required:</p>
            <ul class="wp-block-list">
              <li>IT security and compliance, ISO 27001</li>
              <li>Risk assessment &amp; mitigation</li>
            </ul>
            <p>Experience required:</p>
            <ul class="wp-block-list">
              <li>4+ years in IT or cybersecurity</li>
            </ul>
          </div>
          <div class="job-description">
            <div id="sjb_less_content_62762">
              <p>We’re Hiring: Information Security Manager</p>
            </div>
            <div class="sjb-apply-now-btn">
              <p>
                <a href="javascript:void(0)" id="quick-apply-btn" class="btn btn-primary" job_id="62762">Quick Apply</a>
                <a href="https://niramai.com/career/information-security-manager-ism/" class="btn btn-primary">Read More</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <footer>
      <h3 class="title">About Niramai</h3>
      <a href="/careers">Careers</a>
      <script id="simple-job-board-front-end-js-extra">
        var application_form = {"job_listing_content":"logo-detail"};
      </script>
    </footer>
  </body>
</html>
`

const verifiedCareersPageTwoHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Jobs - Niramai</title>
    <meta name="description" content="Jobs Archive - Niramai" />
    <link rel="canonical" href="https://niramai.com/career/page/2/" />
    <link rel="prev" href="https://niramai.com/career/" />
  </head>
  <body>
    <div class="sjb-page">
      <h1><span class="job-title">Job Archives</span></h1>
    </div>
  </body>
</html>
`

test('Niramai validates the verified first-party careers archive and extracts listing cards', async () => {
  const niramai = await loadNiramaiModule()
  assert.ok(niramai, 'Expected Niramai scraper module at ../../scraper/niramai/script.js')

  assert.equal(niramai.hasOfficialCareersSignal(verifiedCareersPageOneHtml), true)
  assert.equal(
    niramai.extractNextPageUrl(verifiedCareersPageOneHtml, niramai.CAREERS_URL),
    'https://niramai.com/career/page/2/',
  )
  assert.equal(
    niramai.extractNextPageUrl(verifiedCareersPageTwoHtml, 'https://niramai.com/career/page/2/'),
    null,
  )

  assert.deepEqual(
    niramai.extractListingCards(verifiedCareersPageOneHtml),
    [
      {
        title: 'HR Executive',
        company: 'Niramai',
        employmentType: 'Full Time',
        location: 'Bangalore, Karnataka',
        sourceUrl: 'https://niramai.com/career/talent-acquisition-executive/',
        descriptionHtml: [
          '<p>NIRAMAI Health Analytix is looking for a <strong>Talent Acquisition Executive</strong> with proven execution excellence and good communication skills to own talent acquisition and support business operations of the company.</p>',
          '<p><strong>Primary roles &amp; responsibilities:</strong></p>',
          '<ul class="wp-block-list">',
          '<li>Responsible for managing talent acquisition process for Screening Operations Function pan India.</li>',
          '<li>Provide recruitment support to all departments and execute on the hiring strategy.</li>',
          '</ul>',
          '<p><strong>Requirements for the role:</strong></p>',
          '<ul class="wp-block-list">',
          '<li>2+ years of experience in Talent Acquisition/ Operations</li>',
          '<li>Education : MBA Preferred; Graduate in any discipline</li>',
          '</ul>',
        ].join(''),
      },
      {
        title: 'Information Security Manager ( ISM )',
        company: 'Niramai Health Analytix Pvt.Ltd',
        employmentType: 'Full Time',
        location: 'Bangalore',
        sourceUrl: 'https://niramai.com/career/information-security-manager-ism/',
        descriptionHtml: [
          '<p>We’re Hiring: Information Security Manager</p>',
          '<p>At Niramai Health Analytics, we are committed to building secure, compliant, and innovative healthcare solutions.</p>',
          '<p>Competency Required:</p>',
          '<ul class="wp-block-list">',
          '<li>IT security and compliance, ISO 27001</li>',
          '<li>Risk assessment &amp; mitigation</li>',
          '</ul>',
          '<p>Experience required:</p>',
          '<ul class="wp-block-list">',
          '<li>4+ years in IT or cybersecurity</li>',
          '</ul>',
        ].join(''),
      },
    ],
  )
})

test('Niramai run validates the verified first-party jobs archive and returns normalized jobs', async () => {
  const niramai = await loadNiramaiModule()
  assert.ok(niramai, 'Expected Niramai scraper module at ../../scraper/niramai/script.js')

  const requestedUrls = []

  const jobs = await niramai.createNiramaiScraper({
    now: () => '2026-07-25T10:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === niramai.CAREERS_URL) return verifiedCareersPageOneHtml
      if (url === 'https://niramai.com/career/page/2/') return verifiedCareersPageTwoHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    niramai.CAREERS_URL,
    'https://niramai.com/career/page/2/',
  ])

  assert.deepEqual(
    jobs.map((job) => job.title),
    ['HR Executive', 'Information Security Manager ( ISM )'],
  )

  assert.deepEqual(jobs[0], {
    title: 'HR Executive',
    company: 'Niramai',
    department: null,
    location: 'Bangalore, Karnataka',
    city: 'Bangalore',
    country: 'India',
    jobId: 'niramai-talent-acquisition-executive',
    requisitionId: 'niramai-talent-acquisition-executive',
    sourceUrl: 'https://niramai.com/career/talent-acquisition-executive/',
    applyUrl: 'https://niramai.com/career/talent-acquisition-executive/',
    employmentType: 'Full Time',
    workplaceType: null,
    experienceRequired: '2+ years of experience in Talent Acquisition/ Operations',
    minimumQualification: 'Education : MBA Preferred; Graduate in any discipline',
    preferredQualification: null,
    requiredSkills: [
      'Responsible for managing talent acquisition process for Screening Operations Function pan India.',
      'Provide recruitment support to all departments and execute on the hiring strategy.',
      '2+ years of experience in Talent Acquisition/ Operations',
      'Education : MBA Preferred; Graduate in any discipline',
    ],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'NIRAMAI Health Analytix is looking for a Talent Acquisition Executive with proven execution excellence and good communication skills to own talent acquisition and support business operations of the company.',
      'Primary roles & responsibilities:',
      '- Responsible for managing talent acquisition process for Screening Operations Function pan India.',
      '- Provide recruitment support to all departments and execute on the hiring strategy.',
      'Requirements for the role:',
      '- 2+ years of experience in Talent Acquisition/ Operations',
      '- Education : MBA Preferred; Graduate in any discipline',
    ].join('\n'),
    source: 'niramai',
    companyCareerPage: 'https://niramai.com/career/',
    companyDomain: 'niramai.com',
    atsPlatform: 'official-company-careers',
    link: 'https://niramai.com/career/talent-acquisition-executive/',
    scrapedAt: '2026-07-25T10:00:00.000Z',
  })

  assert.deepEqual(jobs[1], {
    title: 'Information Security Manager ( ISM )',
    company: 'Niramai Health Analytix Pvt.Ltd',
    department: null,
    location: 'Bangalore',
    city: 'Bangalore',
    country: 'India',
    jobId: 'niramai-information-security-manager-ism',
    requisitionId: 'niramai-information-security-manager-ism',
    sourceUrl: 'https://niramai.com/career/information-security-manager-ism/',
    applyUrl: 'https://niramai.com/career/information-security-manager-ism/',
    employmentType: 'Full Time',
    workplaceType: null,
    experienceRequired: '4+ years in IT or cybersecurity',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'IT security and compliance, ISO 27001',
      'Risk assessment & mitigation',
      '4+ years in IT or cybersecurity',
    ],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'We’re Hiring: Information Security Manager',
      'At Niramai Health Analytics, we are committed to building secure, compliant, and innovative healthcare solutions.',
      'Competency Required:',
      '- IT security and compliance, ISO 27001',
      '- Risk assessment & mitigation',
      'Experience required:',
      '- 4+ years in IT or cybersecurity',
    ].join('\n'),
    source: 'niramai',
    companyCareerPage: 'https://niramai.com/career/',
    companyDomain: 'niramai.com',
    atsPlatform: 'official-company-careers',
    link: 'https://niramai.com/career/information-security-manager-ism/',
    scrapedAt: '2026-07-25T10:00:00.000Z',
  })
})

test('Niramai fails closed when the verified first-party archive drifts or stops exposing jobs', async () => {
  const niramai = await loadNiramaiModule()
  assert.ok(niramai, 'Expected Niramai scraper module at ../../scraper/niramai/script.js')

  await assert.rejects(
    niramai.createNiramaiScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /verified careers archive/i,
  )

  await assert.rejects(
    niramai.createNiramaiScraper().run({
      fetchText: async (url) => {
        if (url === niramai.CAREERS_URL) {
          return verifiedCareersPageOneHtml.replace('Quick Apply', 'Apply Now')
        }

        return verifiedCareersPageTwoHtml
      },
    }),
    /verified careers archive/i,
  )

  await assert.rejects(
    niramai.createNiramaiScraper().run({
      fetchText: async (url) => {
        if (url === niramai.CAREERS_URL) {
          return verifiedCareersPageOneHtml.replace(/<div class="list-data">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '')
        }

        return verifiedCareersPageTwoHtml
      },
    }),
    /listing cards/i,
  )
})
