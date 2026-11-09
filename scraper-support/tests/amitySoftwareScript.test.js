import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>A BFSI &amp; Agri Software Company Noida, India</title>
  </head>
  <body>
    <a href="https://www.amitysoftware.com/careers/">Careers <span>WE ARE HIRING</span></a>
    <a href="/careers/">VIEW OPENINGS</a>
  </body>
</html>
`

const careersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers | Amity Software</title>
  </head>
  <body>
    <a href="https://www.amitysoftware.com/careers/">Careers <span>WE ARE HIRING</span></a>
    <section>
      <h4>Current Openings</h4>

      <div class="info-box-content">
        <h4 class="info-box-title">Associate Project Manager/Scrum Master (Banking Domain)</h4>
        <div class="info-box-inner"><p><strong>Experience</strong> – 5+ Years<br /> <strong>Location</strong> – Noida</p></div>
        <div class="info-btn-wrapper"><a href="https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/" title="Associate Project Manager/Scrum Master (Banking Domain)">Apply Now</a></div>
      </div>

      <div class="info-box-content">
        <h4 class="info-box-title">DOT NET (Senior Software Engineer / Technical Lead)</h4>
        <div class="info-box-inner"><p><strong>Experience</strong> – 6-8 Years<br /> <strong>Location</strong> – Noida</p></div>
        <div class="info-btn-wrapper"><a href="https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/" title="DOT NET (Senior Software Engineer / Technical Lead)">Apply Now</a></div>
      </div>

      <div class="info-box-content">
        <h4 class="info-box-title">Lead DevOps Engineer – Cloud, CI/CD, Security (Banking Domain)</h4>
        <div class="info-box-inner"><p><strong>Experience</strong> – 8-12 Years<br /> <strong>Location</strong> – Noida</p></div>
        <div class="info-btn-wrapper"><a href="https://www.amitysoftware.com/lead-devops-engineer-banking-domain/" title="Lead DevOps Engineer – ( Banking Domain)">Apply Now</a></div>
      </div>
    </section>
  </body>
</html>
`

const careersHtmlWithEarlierInfoBox = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers | Amity Software</title>
  </head>
  <body>
    <section>
      <div class="info-box-content">
        <h4 class="info-box-title">Cultural Diversity, Inclusion &amp; Innovation</h4>
        <div class="info-box-inner"><p>Team values and culture highlight.</p></div>
      </div>

      <div class="info-box-content">
        <h4 class="info-box-title">Associate Project Manager/Scrum Master (Banking Domain)</h4>
        <div class="info-box-inner"><p><strong>Experience</strong> – 5+ Years<br /> <strong>Location</strong> – Noida</p></div>
        <div class="info-btn-wrapper"><a href="https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/" title="Associate Project Manager/Scrum Master (Banking Domain)">Apply Now</a></div>
      </div>
    </section>
  </body>
</html>
`

const detailHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Associate Project Manager/Scrum Master (Banking Domain) | Amity Software</title>
    <meta property="article:modified_time" content="2025-08-26T09:05:00+00:00" />
    <script type="application/ld+json" class="yoast-schema-graph">
      {"@context":"https://schema.org","@graph":[{"@type":"WebPage","url":"https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/","name":"Associate Project Manager/Scrum Master (Banking Domain) | Amity Software","datePublished":"2025-08-26T08:57:51+00:00","dateModified":"2025-08-26T09:05:00+00:00"}]}
    </script>
  </head>
  <body>
    <div class="wd-text-block">
      <p><strong>Job Title:</strong> Associate Project Manager/Scrum Master (Banking Domain)<br />
      <strong>Location:</strong> Noida<br />
      <strong>Experience:</strong> 5+ Years<br />
      <strong>Employment Type:</strong> Full-Time</p>
      <h2><strong>Key Responsibilities:</strong></h2>
      <ul>
        <li>Lead and facilitate Sprint Planning sessions.</li>
        <li>Facilitate Scrum ceremonies and ensure adherence to Agile principles.</li>
      </ul>
      <h2><strong>Required Skills and Qualifications:</strong></h2>
      <ul>
        <li>2+ years of experience in project management and/or as a Scrum Master.</li>
        <li>Strong knowledge of Agile frameworks and Jira.</li>
      </ul>
    </div>
    <form id="wpforms-form-18314">
      <input type="hidden" name="page_url" value="https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/">
      <select name="wpforms[fields][11]">
        <option value="Associate Project Manager/Scrum Master (Banking Domain)" selected>Associate Project Manager/Scrum Master (Banking Domain)</option>
      </select>
      <input type="file" name="wpforms_18314_6">
      <button type="submit">Submit</button>
    </form>
  </body>
</html>
`

const secondDetailHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>DOT NET (Senior Software Engineer / Technical Lead) | Amity Software</title>
    <script type="application/ld+json" class="yoast-schema-graph">
      {"@context":"https://schema.org","@graph":[{"@type":"WebPage","url":"https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/","name":"DOT NET (Senior Software Engineer / Technical Lead) | Amity Software","datePublished":"2025-08-26T09:10:00+00:00"}]}
    </script>
  </head>
  <body>
    <div class="wd-text-block">
      <p><strong>Job Title:</strong> DOT NET (Senior Software Engineer / Technical Lead)<br />
      <strong>Location:</strong> Noida<br />
      <strong>Experience:</strong> 6-8 Years<br />
      <strong>Employment Type:</strong> Full-Time</p>
      <h2><strong>Key Responsibilities:</strong></h2>
      <ul>
        <li>Design and build enterprise-grade .NET services.</li>
      </ul>
      <h2><strong>Required Skills and Qualifications:</strong></h2>
      <ul>
        <li>Hands-on experience with C#, ASP.NET, and SQL Server.</li>
      </ul>
    </div>
    <form id="wpforms-form-18314">
      <input type="hidden" name="page_url" value="https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/">
      <input type="file" name="wpforms_18314_6">
    </form>
  </body>
</html>
`

const thirdDetailHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Lead DevOps Engineer – Cloud, CI/CD, Security (Banking Domain) | Amity Software</title>
    <script type="application/ld+json" class="yoast-schema-graph">
      {"@context":"https://schema.org","@graph":[{"@type":"WebPage","url":"https://www.amitysoftware.com/lead-devops-engineer-banking-domain/","name":"Lead DevOps Engineer – Cloud, CI/CD, Security (Banking Domain) | Amity Software","datePublished":"2025-07-03T05:50:00+00:00"}]}
    </script>
  </head>
  <body>
    <div class="wd-text-block">
      <p><strong>Job Title:</strong> Lead DevOps Engineer – Cloud, CI/CD, Security (Banking Domain)<br />
      <strong>Location:</strong> Noida<br />
      <strong>Experience:</strong> 8-12 Years<br />
      <strong>Employment Type:</strong> Full-Time<br />
      <strong>Work Mode:</strong> Onsite</p>
      <h2><strong>Job Summary:</strong></h2>
      <p>Lead cloud, CI/CD, and security delivery for banking workloads.</p>
      <h2><strong>Key Responsibilities:</strong></h2>
      <ul>
        <li>Own CI/CD and cloud security architecture.</li>
      </ul>
      <h2><strong>Required Skills and Experience:</strong></h2>
      <ul>
        <li>AWS, Kubernetes, Terraform, CI/CD, and security experience.</li>
      </ul>
    </div>
    <form id="wpforms-form-18314">
      <input type="file" name="wpforms_18314_6">
    </form>
  </body>
</html>
`

const subjectMatterDetailHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Subject Matter Expert (Insurance Domain) | Amity Software</title>
    <script type="application/ld+json" class="yoast-schema-graph">
      {"@context":"https://schema.org","@graph":[{"@type":"WebPage","url":"https://www.amitysoftware.com/subject-matter-expert-insurance-domain/","name":"Subject Matter Expert (Insurance Domain) | Amity Software","datePublished":"2025-07-03T05:30:03+00:00"}]}
    </script>
  </head>
  <body>
    <div class="wd-text-block">
      <p><u><strong>Roles and Responsibilities</strong></u></p>
      <ul>
        <li>Process Study and Requirement Gathering.</li>
      </ul>
      <p><strong>Role &amp; Responsibilities:</strong></p>
      <ul>
        <li>Responsible for finalizing Business Requirements from the insurance company.</li>
        <li>Perform detailed analysis of existing processes.</li>
      </ul>
      <p><u><strong>Requirements for the Position</strong></u></p>
      <ul>
        <li><strong>Qualification:</strong> Graduate/MCA/B.Tech./MBA.</li>
      </ul>
      <ul>
        <li>Extensive knowledge and experience in Insurance industry processes.</li>
      </ul>
    </div>
    <form id="wpforms-form-18314">
      <input type="file" name="wpforms_18314_6">
    </form>
  </body>
</html>
`

const seniorExpertDetailHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Senior/Expert Software Developer DOT NET | Amity Software</title>
    <script type="application/ld+json" class="yoast-schema-graph">
      {"@context":"https://schema.org","@graph":[{"@type":"WebPage","url":"https://www.amitysoftware.com/senior-expert-software-developer-dot-net/","name":"Senior/Expert Software Developer DOT NET | Amity Software","datePublished":"2022-04-18T06:30:00+00:00"}]}
    </script>
  </head>
  <body>
    <div class="wd-text-block">
      <p><strong><u>Responsibilities:</u></strong></p>
      <ul>
        <li>Full stack development for software products without needing help.</li>
        <li>Write programs and test code thoroughly.</li>
      </ul>
      <p><strong><u>Requirements:</u></strong></p>
      <ul>
        <li>Minimum 6 years work experience in ASP.NET, C#, JavaScript, jQuery, and MVC.</li>
        <li>Experience in developing enterprise applications.</li>
      </ul>
    </div>
    <form id="wpforms-form-18314">
      <input type="file" name="wpforms_18314_6">
    </form>
  </body>
</html>
`

const angularDetailHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Front End Developer - Angular | Amity Software</title>
    <script type="application/ld+json" class="yoast-schema-graph">
      {"@context":"https://schema.org","@graph":[{"@type":"WebPage","url":"https://www.amitysoftware.com/front-end-developer-angular/","name":"Front End Developer - Angular | Amity Software","datePublished":"2025-07-03T05:31:00+00:00"}]}
    </script>
  </head>
  <body>
    <div class="wd-text-block">
      <h2>Job description</h2>
      <p><strong>Role &amp; responsibilities-</strong></p>
      <ul>
        <li>Develop and maintain web applications using Angular.</li>
        <li>Collaborate with UI/UX designers and backend developers.</li>
      </ul>
      <p><strong>Required Skills and Qualifications-</strong></p>
      <ul>
        <li>Strong experience with Angular framework.</li>
        <li>Proficiency in HTML5, CSS3, JavaScript, and TypeScript.</li>
      </ul>
    </div>
    <form id="wpforms-form-18314">
      <input type="file" name="wpforms_18314_6">
    </form>
  </body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.amitysoftware.com/post-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.amitysoftware.com/page-sitemap.xml</loc></sitemap>
</sitemapindex>
`

const publicJobsDriftHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers | Amity Software</title>
  </head>
  <body>
    <h4>Current Openings</h4>
    <a href="https://external.example/jobs">Apply Now</a>
  </body>
</html>
`

const loadAmitySoftwareModule = async () => {
  try {
    return await import('../../scraper/amitysoftware/script.js')
  } catch {
    assert.fail('Expected Amity Software scraper module at ../../scraper/amitysoftware/script.js')
  }
}

test('Amity Software helpers stay pinned to the verified homepage, careers cards, and first-party detail-page form signals', async () => {
  const amitySoftware = await loadAmitySoftwareModule()

  assert.equal(amitySoftware.SOURCE, 'amitysoftware')
  assert.equal(amitySoftware.COMPANY, 'Amity Software')
  assert.equal(amitySoftware.OFFICIAL_BRAND_NAME, 'Amity Software')
  assert.equal(amitySoftware.VERIFIED_ON, '2026-07-15')
  assert.equal(amitySoftware.HOMEPAGE_URL, 'https://www.amitysoftware.com/')
  assert.equal(amitySoftware.CAREERS_URL, 'https://www.amitysoftware.com/careers/')
  assert.equal(amitySoftware.SITEMAP_URL, 'https://www.amitysoftware.com/sitemap_index.xml')
  assert.deepEqual(amitySoftware.VERIFIED_JOB_DETAIL_URLS, [
    'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
    'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/',
    'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/',
    'https://www.amitysoftware.com/database-architect-financial-systems/',
    'https://www.amitysoftware.com/product-owner-banking-domain/',
    'https://www.amitysoftware.com/subject-matter-expert-insurance-domain/',
    'https://www.amitysoftware.com/senior-expert-software-developer-dot-net/',
    'https://www.amitysoftware.com/front-end-developer-angular/',
  ])
  assert.equal(amitySoftware.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(amitySoftware.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(amitySoftware.hasEmbeddedApplyFormSignal(detailHtml), true)
  assert.deepEqual(amitySoftware.extractOpeningCards(careersHtml), [
    {
      title: 'Associate Project Manager/Scrum Master (Banking Domain)',
      location: 'Noida',
      experience: '5+ Years',
      detailUrl: 'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
    },
    {
      title: 'DOT NET (Senior Software Engineer / Technical Lead)',
      location: 'Noida',
      experience: '6-8 Years',
      detailUrl: 'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/',
    },
    {
      title: 'Lead DevOps Engineer – Cloud, CI/CD, Security (Banking Domain)',
      location: 'Noida',
      experience: '8-12 Years',
      detailUrl: 'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/',
    },
  ])
  assert.equal(
    amitySoftware.extractPostingDate(detailHtml),
    '2025-08-26',
  )
  assert.equal(
    amitySoftware.extractEmploymentType(detailHtml),
    'Full-Time',
  )
  assert.match(
    amitySoftware.extractJobDescription(detailHtml),
    /Lead and facilitate Sprint Planning sessions/i,
  )
  assert.match(
    amitySoftware.extractJobDescription(detailHtml),
    /Strong knowledge of Agile frameworks and Jira/i,
  )
})

test('Amity Software keeps opening-card titles scoped to the actual job card when earlier info boxes are present', async () => {
  const amitySoftware = await loadAmitySoftwareModule()

  assert.deepEqual(amitySoftware.extractOpeningCards(careersHtmlWithEarlierInfoBox), [
    {
      title: 'Associate Project Manager/Scrum Master (Banking Domain)',
      location: 'Noida',
      experience: '5+ Years',
      detailUrl: 'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
    },
  ])
})

test('Amity Software extracts job descriptions from the additional verified detail-page template variants', async () => {
  const amitySoftware = await loadAmitySoftwareModule()

  assert.match(
    amitySoftware.extractJobDescription(subjectMatterDetailHtml),
    /Responsible for finalizing Business Requirements from the insurance company/i,
  )
  assert.match(
    amitySoftware.extractJobDescription(subjectMatterDetailHtml),
    /Graduate\/MCA\/B\.Tech\.\/MBA/i,
  )
  assert.match(
    amitySoftware.extractJobDescription(seniorExpertDetailHtml),
    /Full stack development for software products without needing help/i,
  )
  assert.match(
    amitySoftware.extractJobDescription(seniorExpertDetailHtml),
    /Minimum 6 years work experience/i,
  )
  assert.match(
    amitySoftware.extractJobDescription(angularDetailHtml),
    /Develop and maintain web applications using Angular/i,
  )
  assert.match(
    amitySoftware.extractJobDescription(angularDetailHtml),
    /Strong experience with Angular framework/i,
  )
})

test('Amity Software run returns first-party India jobs from the verified careers page and detail pages', async () => {
  const amitySoftware = await loadAmitySoftwareModule()
  const requestedUrls = []

  const jobs = await amitySoftware.createAmitySoftwareScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === amitySoftware.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === amitySoftware.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === amitySoftware.SITEMAP_URL) {
        return { status: 200, url, html: sitemapIndexXml }
      }

      if (url === 'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/') {
        return { status: 200, url, html: detailHtml }
      }

      if (url === 'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/') {
        return { status: 200, url, html: secondDetailHtml }
      }

      if (url === 'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/') {
        return { status: 200, url, html: thirdDetailHtml }
      }

      throw new Error(`Unexpected Amity Software URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    amitySoftware.HOMEPAGE_URL,
    amitySoftware.CAREERS_URL,
    amitySoftware.SITEMAP_URL,
    'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
    'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/',
    'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/',
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Associate Project Manager/Scrum Master (Banking Domain)',
      company: 'Amity Software',
      department: null,
      location: 'Noida',
      city: 'Noida',
      country: 'India',
      jobId: 'associate-project-manager-scrum-master-banking-domain',
      requisitionId: null,
      sourceUrl: 'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
      applyUrl: 'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
      employmentType: 'Full-Time',
      experienceRequired: '5+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-08-26',
      closingDate: null,
      jobDescription: 'Key Responsibilities: Lead and facilitate Sprint Planning sessions. Facilitate Scrum ceremonies and ensure adherence to Agile principles. Required Skills and Qualifications: 2+ years of experience in project management and/or as a Scrum Master. Strong knowledge of Agile frameworks and Jira.',
      source: 'amitysoftware',
      link: 'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'DOT NET (Senior Software Engineer / Technical Lead)',
      company: 'Amity Software',
      department: null,
      location: 'Noida',
      city: 'Noida',
      country: 'India',
      jobId: 'dot-net-senior-software-engineer-technical-lead',
      requisitionId: null,
      sourceUrl: 'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/',
      applyUrl: 'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/',
      employmentType: 'Full-Time',
      experienceRequired: '6-8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-08-26',
      closingDate: null,
      jobDescription: 'Key Responsibilities: Design and build enterprise-grade .NET services. Required Skills and Qualifications: Hands-on experience with C#, ASP.NET, and SQL Server.',
      source: 'amitysoftware',
      link: 'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      title: 'Lead DevOps Engineer – Cloud, CI/CD, Security (Banking Domain)',
      company: 'Amity Software',
      department: null,
      location: 'Noida',
      city: 'Noida',
      country: 'India',
      jobId: 'lead-devops-engineer-banking-domain',
      requisitionId: null,
      sourceUrl: 'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/',
      applyUrl: 'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/',
      employmentType: 'Full-Time',
      experienceRequired: '8-12 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-03',
      closingDate: null,
      jobDescription: 'Key Responsibilities: Own CI/CD and cloud security architecture. Required Skills and Qualifications: AWS, Kubernetes, Terraform, CI/CD, and security experience.',
      source: 'amitysoftware',
      link: 'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('Amity Software fails closed when the homepage, careers listing surface, or detail-page application form drifts', async () => {
  const amitySoftware = await loadAmitySoftwareModule()

  await assert.rejects(
    amitySoftware.createAmitySoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === amitySoftware.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Amity Software URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    amitySoftware.createAmitySoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === amitySoftware.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === amitySoftware.CAREERS_URL) {
          return { status: 200, url, html: publicJobsDriftHtml }
        }

        throw new Error(`Unexpected Amity Software URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    amitySoftware.createAmitySoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === amitySoftware.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === amitySoftware.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === amitySoftware.SITEMAP_URL) {
          return { status: 200, url, html: sitemapIndexXml }
        }

        if (url === 'https://www.amitysoftware.com/associate-project-manager-scrum-master-banking-domain/') {
          return { status: 200, url, html: detailHtml.replace('type="file"', 'type="text"') }
        }

        if (url === 'https://www.amitysoftware.com/dot-net-senior-software-engineer-technical-lead/') {
          return { status: 200, url, html: secondDetailHtml }
        }

        if (url === 'https://www.amitysoftware.com/lead-devops-engineer-banking-domain/') {
          return { status: 200, url, html: thirdDetailHtml }
        }

        throw new Error(`Unexpected Amity Software URL: ${url}`)
      },
    }),
    /detail page surface changed/i,
  )
})
