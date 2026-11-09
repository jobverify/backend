import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T08:30:00.000Z'
const ENGINEERING_MANAGER_URL = 'https://www.amantra.ai/careers/engineering-manager'
const FULL_STACK_URL = 'https://www.amantra.ai/careers/full-stack-developer'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI Agents for Enterprise | Agentic AI Platform | Amantra</title>
    <link rel="canonical" href="https://www.amantra.ai/">
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Amantra AI"}
    </script>
  </head>
  <body>
    <nav>
      <a href="./about-us">About us</a>
      <a href="./careers">Careers</a>
      <a href="./contact">Contact us</a>
    </nav>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our AI Innovation Team | Amantra</title>
    <meta
      name="description"
      content="Join Amantra AI and build the future of intelligent communication and automation. Explore open roles in AI engineering, product design, and enterprise systems."
    >
    <link rel="canonical" href="https://www.amantra.ai/careers">
  </head>
  <body>
    <main>
      <a href="./careers#jobs-openings">See Open Roles</a>
      <a href="./careers/technical-project-manager">Technical Project Manager</a>
      <a href="./careers/engineering-manager">Engineering Manager</a>
      <a href="./careers/business-development-executive-(bde)">Business Development Executive (BDE)</a>
      <a href="./careers/qa-manual">QA Manual</a>
      <a href="./careers/business-development-manager-(bdm)">Business Development Manager (BDM)</a>
      <a href="./careers/full-stack-developer">Full-stack developer</a>
      <a href="./careers/nodejs-developer">Node.js developer</a>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.amantra.ai/</loc></url>
  <url><loc>https://www.amantra.ai/about-us</loc></url>
  <url><loc>https://www.amantra.ai/careers</loc></url>
  <url><loc>https://www.amantra.ai/careers/technical-project-manager</loc></url>
  <url><loc>https://www.amantra.ai/careers/engineering-manager</loc></url>
  <url><loc>https://www.amantra.ai/careers/business-development-executive-(bde)</loc></url>
  <url><loc>https://www.amantra.ai/careers/qa-manual</loc></url>
  <url><loc>https://www.amantra.ai/careers/business-development-manager-(bdm)</loc></url>
  <url><loc>https://www.amantra.ai/careers/full-stack-developer</loc></url>
  <url><loc>https://www.amantra.ai/careers/nodejs-developer</loc></url>
</urlset>
`

const engineeringManagerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Amantra - Engineering Manager</title>
    <meta name="description" content="We&#8217;re looking for a mid-level Engineering Manager to join our team.">
    <link rel="canonical" href="${ENGINEERING_MANAGER_URL}">
  </head>
  <body>
    <h3>Engineering Manager</h3>
    <p>Indore, India</p>
    <p>On-site</p>
    <p>Full-time</p>
    <h3>About us</h3>
    <p>Amantra is a fast-growing, technology-driven company delivering innovative and scalable solutions to global clients.</p>
    <h3>Responsibilities</h3>
    <ul>
      <li>Lead engineering delivery across backend, frontend, and platform teams.</li>
      <li>Mentor engineers, drive technical excellence, and improve execution quality.</li>
    </ul>
    <h3>Requirements</h3>
    <ul>
      <li>8+ years of software development experience with 3-4+ years in an Engineering Manager role.</li>
      <li>Strong knowledge of system design, architecture, and delivery management.</li>
      <li>Excellent stakeholder communication and team leadership skills.</li>
    </ul>
    <h3>Preferred Qualifications</h3>
    <ul>
      <li>Bachelor&#8217;s/Master&#8217;s degree in Computer Science, IT, or related field.</li>
      <li>Experience in SaaS or AI product engineering is an added advantage.</li>
    </ul>
    <h3>How to Apply</h3>
    <p>Interested candidates can share their cv at <strong>careers@amantra.ai</strong>.</p>
  </body>
</html>
`

const fullStackHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Amantra - Full-stack developer</title>
    <meta name="description" content="We&#8217;re looking for a Full-stack developer to join our team.">
    <link rel="canonical" href="${FULL_STACK_URL}">
  </head>
  <body>
    <h3>Full-stack developer</h3>
    <p>Indore, India</p>
    <p>On-site</p>
    <p>Full-time</p>
    <h3>About us</h3>
    <p>Amantra is a fast-growing, technology-driven company delivering innovative and scalable solutions to global clients.</p>
    <h3>Responsibilities</h3>
    <ul>
      <li>Design, develop, and maintain scalable web applications across frontend and backend.</li>
      <li>Build robust backend services using Node.js (Express.js / Nest.js / AdonisJs) and develop secure RESTful APIs.</li>
      <li>Develop responsive, high-performance user interfaces using React.js and modern JavaScript frameworks.</li>
    </ul>
    <h3>Requirements</h3>
    <ul>
      <li>5&#8211;8 years of hands-on experience in Full Stack development.</li>
      <li>Strong expertise in Node.js (Express.js / Nest.js) and React.js.</li>
      <li>Proficiency in JavaScript (ES6+), HTML5, CSS3.</li>
      <li>Solid understanding of REST APIs, microservices architecture, and component-based frontend design.</li>
      <li>Experience with AWS services (EC2, S3, Lambda, RDS, CloudFront) and CI/CD pipelines.</li>
      <li>Strong knowledge of databases such as MySQL, PostgreSQL, or MongoDB.</li>
      <li>Experience with Git, Docker, and cloud deployment workflows.</li>
      <li>Understanding of performance optimization, caching mechanisms, and debugging techniques.</li>
      <li>Ability to work independently and handle complete features/modules end-to-end.</li>
    </ul>
    <h3>Preferred Qualifications</h3>
    <ul>
      <li>Bachelor&#8217;s/Master&#8217;s degree in Computer Science, IT, or related field (or equivalent experience)</li>
      <li>5&#8211;8 years of experience in full-stack development</li>
      <li>Strong expertise in Node.js (Express/Nest/Adonis) and React.js</li>
      <li>Hands-on experience with AWS, REST APIs, databases (SQL/NoSQL), and CI/CD pipelines</li>
      <li>Product development experience is an added advantage</li>
    </ul>
    <h3>How to Apply</h3>
    <p>Ready to take the next step in your career? Apply now and become part of our growing team. You can also send your resume to <strong>careers@amantra.ai</strong>.</p>
  </body>
</html>
`

const currentTechnicalProjectManagerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Amantra - Sr. Technical Project Manager</title>
    <meta name="description" content="We&#8217;re looking for a Sr. Technical Project Manager to join our team.">
    <link rel="canonical" href="https://www.amantra.ai/careers/technical-project-manager">
  </head>
  <body>
    <h6>Back to Careers</h6>
    <h1>Sr. Technical Project Manager</h1>
    <h1>Sr. Technical Project Manager</h1>
    <p>Project Management</p>
    <p>On-site</p>
    <p>Indore</p>
    <p>Full-time</p>
    <h3>About us</h3>
    <p>Amantra is a technology-driven company focused on building innovative digital solutions and next-generation products for global clients.</p>
    <h3>Responsibilities</h3>
    <ul>
      <li>Lead end-to-end planning, execution, monitoring, and delivery of multiple projects and customer engagements.</li>
    </ul>
    <h3>Requirements</h3>
    <ul>
      <li>8+ years of experience in software development, project management, or technical delivery.</li>
      <li>Strong communication and stakeholder management skills.</li>
    </ul>
    <h3>Preferred Qualifications</h3>
    <ul>
      <li>Experience with AI/ML product development and delivery is preferred.</li>
    </ul>
    <h3>How to Apply</h3>
    <p>Interested candidates can share their cv at <strong>careers@amantra.ai</strong>.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/amantra/script.js')
  } catch {
    assert.fail('Expected Amantra scraper module at ../../scraper/amantra/script.js')
  }
}

test('Amantra helpers stay pinned to the verified first-party homepage, careers page, sitemap role set, and role details', async () => {
  const amantra = await loadModule()

  assert.equal(amantra.SOURCE, 'amantra')
  assert.equal(amantra.COMPANY, 'Amantra')
  assert.equal(amantra.HOMEPAGE_URL, 'https://www.amantra.ai/')
  assert.equal(amantra.CAREERS_URL, 'https://www.amantra.ai/careers')
  assert.equal(amantra.SITEMAP_URL, 'https://www.amantra.ai/sitemap.xml')
  assert.equal(amantra.APPLICATION_EMAIL, 'careers@amantra.ai')
  assert.equal(amantra.APPLICATION_URL, 'mailto:careers@amantra.ai')
  assert.deepEqual(amantra.VERIFIED_ROLE_URLS, [
    'https://www.amantra.ai/careers/technical-project-manager',
    'https://www.amantra.ai/careers/engineering-manager',
    'https://www.amantra.ai/careers/business-development-executive-(bde)',
    'https://www.amantra.ai/careers/qa-manual',
    'https://www.amantra.ai/careers/business-development-manager-(bdm)',
    'https://www.amantra.ai/careers/full-stack-developer',
    'https://www.amantra.ai/careers/nodejs-developer',
  ])
  assert.equal(amantra.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(amantra.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(amantra.extractCareerRoleUrls(careersHtml), amantra.VERIFIED_ROLE_URLS)
  assert.deepEqual(amantra.extractCareerRoleUrlsFromSitemap(sitemapXml), amantra.VERIFIED_ROLE_URLS)
  assert.equal(amantra.hasOfficialRoleDetailSignal(engineeringManagerHtml, ENGINEERING_MANAGER_URL), true)
  assert.equal(amantra.hasOfficialRoleDetailSignal(fullStackHtml, FULL_STACK_URL), true)
  assert.equal(
    amantra.hasOfficialRoleDetailSignal(
      currentTechnicalProjectManagerHtml,
      'https://www.amantra.ai/careers/technical-project-manager',
    ),
    true,
  )

  assert.deepEqual(amantra.extractRoleDetail(engineeringManagerHtml, ENGINEERING_MANAGER_URL), {
    title: 'Engineering Manager',
    company: 'Amantra',
    department: null,
    location: 'Indore, India',
    city: 'Indore',
    country: 'India',
    jobId: 'engineering-manager',
    requisitionId: 'engineering-manager',
    sourceUrl: ENGINEERING_MANAGER_URL,
    applyUrl: 'mailto:careers@amantra.ai',
    employmentType: 'Full-time',
    workplaceType: 'On-site',
    experienceRequired: '8+ years of software development experience with 3-4+ years in an Engineering Manager role.',
    minimumQualification: "Bachelor's/Master's degree in Computer Science, IT, or related field.",
    preferredQualification: 'Experience in SaaS or AI product engineering is an added advantage.',
    requiredSkills: [
      'Strong knowledge of system design, architecture, and delivery management.',
      'Excellent stakeholder communication and team leadership skills.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      "We're looking for a mid-level Engineering Manager to join our team.",
      '',
      'About us',
      'Amantra is a fast-growing, technology-driven company delivering innovative and scalable solutions to global clients.',
      '',
      'Responsibilities',
      '- Lead engineering delivery across backend, frontend, and platform teams.',
      '- Mentor engineers, drive technical excellence, and improve execution quality.',
      '',
      'Requirements',
      '- 8+ years of software development experience with 3-4+ years in an Engineering Manager role.',
      '- Strong knowledge of system design, architecture, and delivery management.',
      '- Excellent stakeholder communication and team leadership skills.',
      '',
      'Preferred Qualifications',
      "- Bachelor's/Master's degree in Computer Science, IT, or related field.",
      '- Experience in SaaS or AI product engineering is an added advantage.',
      '',
      'How to Apply',
      '- Interested candidates can share their cv at careers@amantra.ai.',
    ].join('\n'),
  })

  assert.deepEqual(
    amantra.extractRoleDetail(
      currentTechnicalProjectManagerHtml,
      'https://www.amantra.ai/careers/technical-project-manager',
    ),
    {
      title: 'Sr. Technical Project Manager',
      company: 'Amantra',
      department: null,
      location: 'Indore, India',
      city: 'Indore',
      country: 'India',
      jobId: 'technical-project-manager',
      requisitionId: 'technical-project-manager',
      sourceUrl: 'https://www.amantra.ai/careers/technical-project-manager',
      applyUrl: 'mailto:careers@amantra.ai',
      employmentType: 'Full-time',
      workplaceType: 'On-site',
      experienceRequired: '8+ years of experience in software development, project management, or technical delivery.',
      minimumQualification: null,
      preferredQualification: 'Experience with AI/ML product development and delivery is preferred.',
      requiredSkills: [
        'Strong communication and stakeholder management skills.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        "We're looking for a Sr. Technical Project Manager to join our team.",
        '',
        'About us',
        'Amantra is a technology-driven company focused on building innovative digital solutions and next-generation products for global clients.',
        '',
        'Responsibilities',
        '- Lead end-to-end planning, execution, monitoring, and delivery of multiple projects and customer engagements.',
        '',
        'Requirements',
        '- 8+ years of experience in software development, project management, or technical delivery.',
        '- Strong communication and stakeholder management skills.',
        '',
        'Preferred Qualifications',
        '- Experience with AI/ML product development and delivery is preferred.',
        '',
        'How to Apply',
        '- Interested candidates can share their cv at careers@amantra.ai.',
      ].join('\n'),
    },
  )
})

test('Amantra run validates the verified first-party careers flow and returns normalized email-apply jobs', async () => {
  const amantra = await loadModule()
  const requestedUrls = []

  const jobs = await amantra.createAmantraScraper({
    now: () => FIXED_SCRAPED_AT,
    roleUrlsToFetch: [ENGINEERING_MANAGER_URL, FULL_STACK_URL],
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === amantra.HOMEPAGE_URL) return homepageHtml
      if (url === amantra.CAREERS_URL) return careersHtml
      if (url === amantra.SITEMAP_URL) return sitemapXml
      if (url === ENGINEERING_MANAGER_URL) return engineeringManagerHtml
      if (url === FULL_STACK_URL) return fullStackHtml

      throw new Error(`Unexpected Amantra fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    amantra.HOMEPAGE_URL,
    amantra.CAREERS_URL,
    amantra.SITEMAP_URL,
    ENGINEERING_MANAGER_URL,
    FULL_STACK_URL,
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Engineering Manager',
      company: 'Amantra',
      department: null,
      location: 'Indore, India',
      city: 'Indore',
      country: 'India',
      jobId: 'engineering-manager',
      requisitionId: 'engineering-manager',
      sourceUrl: ENGINEERING_MANAGER_URL,
      applyUrl: 'mailto:careers@amantra.ai',
      employmentType: 'Full-time',
      workplaceType: 'On-site',
      experienceRequired: '8+ years of software development experience with 3-4+ years in an Engineering Manager role.',
      minimumQualification: "Bachelor's/Master's degree in Computer Science, IT, or related field.",
      preferredQualification: 'Experience in SaaS or AI product engineering is an added advantage.',
      requiredSkills: [
        'Strong knowledge of system design, architecture, and delivery management.',
        'Excellent stakeholder communication and team leadership skills.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        "We're looking for a mid-level Engineering Manager to join our team.",
        '',
        'About us',
        'Amantra is a fast-growing, technology-driven company delivering innovative and scalable solutions to global clients.',
        '',
        'Responsibilities',
        '- Lead engineering delivery across backend, frontend, and platform teams.',
        '- Mentor engineers, drive technical excellence, and improve execution quality.',
        '',
        'Requirements',
        '- 8+ years of software development experience with 3-4+ years in an Engineering Manager role.',
        '- Strong knowledge of system design, architecture, and delivery management.',
        '- Excellent stakeholder communication and team leadership skills.',
        '',
        'Preferred Qualifications',
        "- Bachelor's/Master's degree in Computer Science, IT, or related field.",
        '- Experience in SaaS or AI product engineering is an added advantage.',
        '',
        'How to Apply',
        '- Interested candidates can share their cv at careers@amantra.ai.',
      ].join('\n'),
      source: 'amantra',
      companyCareerPage: 'https://www.amantra.ai/careers',
      companyDomain: 'amantra.ai',
      atsPlatform: 'official-company-careers',
      link: 'mailto:careers@amantra.ai',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Full-stack developer',
      company: 'Amantra',
      department: null,
      location: 'Indore, India',
      city: 'Indore',
      country: 'India',
      jobId: 'full-stack-developer',
      requisitionId: 'full-stack-developer',
      sourceUrl: FULL_STACK_URL,
      applyUrl: 'mailto:careers@amantra.ai',
      employmentType: 'Full-time',
      workplaceType: 'On-site',
      experienceRequired: '5-8 years of hands-on experience in Full Stack development.',
      minimumQualification: "Bachelor's/Master's degree in Computer Science, IT, or related field (or equivalent experience)",
      preferredQualification: 'Product development experience is an added advantage',
      requiredSkills: [
        'Strong expertise in Node.js (Express.js / Nest.js) and React.js.',
        'Proficiency in JavaScript (ES6+), HTML5, CSS3.',
        'Solid understanding of REST APIs, microservices architecture, and component-based frontend design.',
        'Experience with AWS services (EC2, S3, Lambda, RDS, CloudFront) and CI/CD pipelines.',
        'Strong knowledge of databases such as MySQL, PostgreSQL, or MongoDB.',
        'Experience with Git, Docker, and cloud deployment workflows.',
        'Understanding of performance optimization, caching mechanisms, and debugging techniques.',
        'Ability to work independently and handle complete features/modules end-to-end.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        "We're looking for a Full-stack developer to join our team.",
        '',
        'About us',
        'Amantra is a fast-growing, technology-driven company delivering innovative and scalable solutions to global clients.',
        '',
        'Responsibilities',
        '- Design, develop, and maintain scalable web applications across frontend and backend.',
        '- Build robust backend services using Node.js (Express.js / Nest.js / AdonisJs) and develop secure RESTful APIs.',
        '- Develop responsive, high-performance user interfaces using React.js and modern JavaScript frameworks.',
        '',
        'Requirements',
        '- 5-8 years of hands-on experience in Full Stack development.',
        '- Strong expertise in Node.js (Express.js / Nest.js) and React.js.',
        '- Proficiency in JavaScript (ES6+), HTML5, CSS3.',
        '- Solid understanding of REST APIs, microservices architecture, and component-based frontend design.',
        '- Experience with AWS services (EC2, S3, Lambda, RDS, CloudFront) and CI/CD pipelines.',
        '- Strong knowledge of databases such as MySQL, PostgreSQL, or MongoDB.',
        '- Experience with Git, Docker, and cloud deployment workflows.',
        '- Understanding of performance optimization, caching mechanisms, and debugging techniques.',
        '- Ability to work independently and handle complete features/modules end-to-end.',
        '',
        'Preferred Qualifications',
        "- Bachelor's/Master's degree in Computer Science, IT, or related field (or equivalent experience)",
        '- 5-8 years of experience in full-stack development',
        '- Strong expertise in Node.js (Express/Nest/Adonis) and React.js',
        '- Hands-on experience with AWS, REST APIs, databases (SQL/NoSQL), and CI/CD pipelines',
        '- Product development experience is an added advantage',
        '',
        'How to Apply',
        '- Ready to take the next step in your career? Apply now and become part of our growing team. You can also send your resume to careers@amantra.ai.',
      ].join('\n'),
      source: 'amantra',
      companyCareerPage: 'https://www.amantra.ai/careers',
      companyDomain: 'amantra.ai',
      atsPlatform: 'official-company-careers',
      link: 'mailto:careers@amantra.ai',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Amantra discovers added roles and tolerates sitemap ordering changes', async () => {
  const amantra = await loadModule()
  const newRoleUrl = 'https://www.amantra.ai/careers/hr-executive'
  const currentCareers = careersHtml.replace('</main>', '<a href="./careers/hr-executive">HR Executive</a></main>')
  const currentSitemap = sitemapXml.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.amantra.ai/careers/hr-executive</loc></url>')
  const newRoleHtml = engineeringManagerHtml
    .replaceAll(ENGINEERING_MANAGER_URL, newRoleUrl)
    .replaceAll('Engineering Manager', 'HR Executive')
  const jobs = await amantra.createAmantraScraper({ roleUrlsToFetch: [newRoleUrl] }).run({
    fetchText: async (url) => {
      if (url === amantra.HOMEPAGE_URL) return homepageHtml
      if (url === amantra.CAREERS_URL) return currentCareers
      if (url === amantra.SITEMAP_URL) return currentSitemap
      if (url === newRoleUrl) return newRoleHtml
      throw new Error(`Unexpected Amantra fixture URL: ${url}`)
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'HR Executive')
  assert.equal(jobs[0].sourceUrl, newRoleUrl)
  assert.equal(jobs[0].location, 'Indore, India')
})

test('Amantra preserves country-only remote locations without inventing a city', async () => {
  const amantra = await loadModule()
  const remoteHtml = engineeringManagerHtml
    .replace('<p>Indore, India</p>\n    <p>On-site</p>', '<p>Remote</p><p>India</p>')
  const job = amantra.extractRoleDetail(remoteHtml, ENGINEERING_MANAGER_URL)
  assert.equal(job.location, 'India')
  assert.equal(job.city, null)
  assert.equal(job.country, 'India')
  assert.equal(job.workplaceType, 'Remote')
})

test('Amantra fails closed when the homepage, careers list, sitemap role set, or role detail surface drifts', async () => {
  const amantra = await loadModule()

  await assert.rejects(
    amantra.createAmantraScraper().run({
      fetchText: async (url) => {
        if (url === amantra.HOMEPAGE_URL) {
          return homepageHtml.replace('AI Agents for Enterprise | Agentic AI Platform | Amantra', 'Unexpected')
        }

        throw new Error(`Unexpected Amantra fixture URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    amantra.createAmantraScraper().run({
      fetchText: async (url) => {
        if (url === amantra.HOMEPAGE_URL) return homepageHtml
        if (url === amantra.CAREERS_URL) {
          return careersHtml.replace('Join Our AI Innovation Team | Amantra', 'Unrelated careers page')
        }

        throw new Error(`Unexpected Amantra fixture URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    amantra.createAmantraScraper().run({
      fetchText: async (url) => {
        if (url === amantra.HOMEPAGE_URL) return homepageHtml
        if (url === amantra.CAREERS_URL) return careersHtml
        if (url === amantra.SITEMAP_URL) {
          return sitemapXml.replace(
            '<url><loc>https://www.amantra.ai/careers/full-stack-developer</loc></url>',
            '',
          )
        }

        throw new Error(`Unexpected Amantra fixture URL: ${url}`)
      },
    }),
    /verified sitemap role set/i,
  )

  await assert.rejects(
    amantra.createAmantraScraper({
      roleUrlsToFetch: [ENGINEERING_MANAGER_URL],
    }).run({
      fetchText: async (url) => {
        if (url === amantra.HOMEPAGE_URL) return homepageHtml
        if (url === amantra.CAREERS_URL) return careersHtml
        if (url === amantra.SITEMAP_URL) return sitemapXml
        if (url === ENGINEERING_MANAGER_URL) {
          return engineeringManagerHtml.replace('careers@amantra.ai', 'jobs@example.com')
        }

        throw new Error(`Unexpected Amantra fixture URL: ${url}`)
      },
    }),
    /verified role detail/i,
  )
})
