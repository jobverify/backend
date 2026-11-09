import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<title>MPM Infosoft - Green Sand Molding Process | Sand Analytics Process | Sand Analysis</title>
<a href="/careers" class="nav-link">Careers</a>
<a href="/contactus" class="">Contact Us</a>
<a href="https://www.linkedin.com/company/mpm-infosoft-private-limited/" target="_blank">LinkedIn</a>
<p>© Copyright 2026. All Rights Reserved by <span>MPM Infosoft</span></p>
`

const contactHtml = `
<title>Contact Us - Green Sand Molding Process | Sand Analytics Process | Sand Analysis | MPM Infosoft</title>
<h1>Contact Us</h1>
<p>
  MPM Infosoft Private Limited.,
  A6/3, Phase II, 6th Floor,
  IIT Madras Research Park,
  Kanagam Road, Taramani,
  Chennai - 600113,
  India.
</p>
<p>MPM Infosoft Pvt. Ltd., M-22 M.I.D.C., Hingna Industrial Estate, Nagpur - 440016, Maharashtra, India.</p>
<a href="tel:+914449597202">+91 44 49597202</a>
<a href="mailto:info@sandman.co.in">info@sandman.co.in</a>
`

const careersHtml = `
<title>Career - Green Sand Molding Process | Sand Analytics Process | Sand Analysis</title>
<a href="/careers" class="active nav-link">Careers</a>
<h1>JOB OPENINGS</h1>
<div class="item">
  <div class="title"><h4>Front End Developer</h4></div>
  <p>Good experience working with front-end web applications. Develop web front-end pages providing cutting-edge UI experience to users utilizing XHTML, CSS and JavaScript. General knowledge of back-end web development. Excellent communication skills (in English).</p>
  <p class="mt-3">Job Location : Chennai, India</p>
  <a class="btn btn-theme effect btn-sm" href="careers/front-end-developer">Learn more</a>
</div>
<div class="item">
  <div class="title"><h4>Java Developer</h4></div>
  <p>We are looking for a Java developer with at least three years of overall software development experience, specifically in Java development. The primary responsibility will be to design and develop JAVA applications, and to coordinate with the rest of the team working on different layers of the infrastructure.</p>
  <p class="mt-3">Job Location : Chennai, India</p>
  <a class="btn btn-theme effect btn-sm" href="careers/java-developer">Learn more</a>
</div>
`

const frontEndDetailHtml = `
<title>Front End Developer, Career - Green Sand Molding Process | Sand Analytics Process | Sand Analysis</title>
<h1>Front End Developer</h1>
<div class="job-detail-area">
  <h3>FRONT END DEVELOPER</h3>
  <h5>Job Post Date</h5><p>October 17, 2015</p>
  <h5>Role</h5><p>Front End Developer</p>
  <h5>Experience</h5><p>4 - 8 years</p>
  <h5>Key Skills</h5>
  <ul>
    <li>Excellent hands-on experience on HTML/XHTML, HTML5, JavaScript, CSS, JSON, JQuery</li>
    <li>Experience on using various java script plug in to build responsive UI that is compatible of multiple devices (desktops, mobile and tablets) and on multiple browsers.</li>
    <li>Experienced in various browser specific development.</li>
    <li>Knows how to interpret the wireframes and build common modules and architect reusable front end code</li>
  </ul>
  <h5>City</h5><p>Chennai, India</p>
  <h5>Job Description</h5>
  <p>Good experience working with front-end web applications. Develop web front-end pages providing cutting-edge UI experience to users utilizing XHTMl, CSS and JavaScript.</p>
  <p>General knowledge of back-end web development. Excellent communication skills (in English).</p>
  <h5>Min. Qualification</h5><p>BE / MCA Computer Science or equivalent.</p>
  <p class="fs-5 text-black">Share your resume on the <a href="mailto:info@sandman.co.in">info@sandman.co.in</a></p>
</div>
`

const javaDetailHtml = `
<title>Java Developer, Career - Green Sand Molding Process | Sand Analytics Process | Sand Analysis</title>
<h1>JAVA DEVELOPER</h1>
<div class="job-detail-area">
  <h3>JAVA DEVELOPER</h3>
  <h5>Job Post Date</h5><p>August 6, 2015</p>
  <h5>Role</h5><p>JAVA DEVELOPER</p>
  <h5>Experience</h5><p>2 – 4 years</p>
  <h5>Key Skills</h5>
  <ul>
    <li>Spring Web MVC framework (it is implicit that the user know core-Java here)</li>
    <li>Libraries such as Apache Math, Apache Lang, Jackson, Apache POI to name a few</li>
    <li>JavaScript (JQuery preferred)</li>
    <li>MySQL</li>
    <li>Maintaining/Running web-servers and web application deployment</li>
    <li>Bootstrap (preferred but not necessary)</li>
  </ul>
  <h5>City</h5><p>Chennai, India</p>
  <h5>Job Description</h5>
  <p>We are looking for a Java developer with at least three years of overall software development experience, specifically in Java development. The primary responsibility will be to design and develop JAVA applications, and to coordinate with the rest of the team working on different layers of the infrastructure.</p>
  <h5>Min. Qualification</h5><p>BE / MCA Computer Science or equivalent.</p>
  <p class="fs-5 text-black">Share your resume on the <a href="mailto:info@sandman.co.in">info@sandman.co.in</a></p>
</div>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected MPM Infosoft Pvt. Ltd. scraper module at ./script.js')
  }
}

test('MPM Infosoft first-party constants and verified page signals match the 2026-07-13 careers surface', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'mpminfosoftpvtltd')
  assert.equal(scraper.COMPANY, 'MPM Infosoft Pvt. Ltd.')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.equal(scraper.HOMEPAGE_URL, 'https://www.mpminfosoft.com/')
  assert.equal(scraper.CAREERS_URL, 'https://www.mpminfosoft.com/careers')
  assert.equal(scraper.CONTACT_URL, 'https://www.mpminfosoft.com/contactus')
  assert.equal(scraper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraper.hasOfficialContactSignal(contactHtml), true)
  assert.equal(scraper.hasOfficialCareersSignal(careersHtml), true)
})

test('extractJobCards finds the two current MPM Infosoft openings from the first-party careers page', async () => {
  const scraper = await loadModule()

  assert.deepEqual(scraper.extractJobCards(careersHtml), [
    {
      title: 'Front End Developer',
      detailUrl: 'https://www.mpminfosoft.com/careers/front-end-developer',
      location: 'Chennai, India',
      summary:
        'Good experience working with front-end web applications. Develop web front-end pages providing cutting-edge UI experience to users utilizing XHTML, CSS and JavaScript. General knowledge of back-end web development. Excellent communication skills (in English).',
    },
    {
      title: 'Java Developer',
      detailUrl: 'https://www.mpminfosoft.com/careers/java-developer',
      location: 'Chennai, India',
      summary:
        'We are looking for a Java developer with at least three years of overall software development experience, specifically in Java development. The primary responsibility will be to design and develop JAVA applications, and to coordinate with the rest of the team working on different layers of the infrastructure.',
    },
  ])
})

test('run scrapes the two verified MPM Infosoft jobs with detail enrichment', async () => {
  const scraper = await loadModule()
  const requestedUrls = []
  const pages = new Map([
    [scraper.HOMEPAGE_URL, homepageHtml],
    [scraper.CONTACT_URL, contactHtml],
    [scraper.CAREERS_URL, careersHtml],
    ['https://www.mpminfosoft.com/careers/front-end-developer', frontEndDetailHtml],
    ['https://www.mpminfosoft.com/careers/java-developer', javaDetailHtml],
  ])

  const jobs = await scraper.createMpmInfosoftPvtLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const html = pages.get(url)
      assert.ok(html, `Unexpected URL fetched: ${url}`)
      return html
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.CONTACT_URL,
    scraper.CAREERS_URL,
    'https://www.mpminfosoft.com/careers/front-end-developer',
    'https://www.mpminfosoft.com/careers/java-developer',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      postingDate: job.postingDate,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      applyUrl: job.applyUrl,
      requiredSkills: job.requiredSkills,
    })),
    [
      {
        title: 'Front End Developer',
        location: 'Chennai, India',
        city: 'Chennai',
        country: 'India',
        jobId: 'mpminfosoftpvtltd-front-end-developer',
        postingDate: '2015-10-17',
        experienceRequired: '4 - 8 years',
        minimumQualification: 'BE / MCA Computer Science or equivalent.',
        applyUrl: 'mailto:info@sandman.co.in',
        requiredSkills: [
          'Excellent hands-on experience on HTML/XHTML, HTML5, JavaScript, CSS, JSON, JQuery',
          'Experience on using various java script plug in to build responsive UI that is compatible of multiple devices (desktops, mobile and tablets) and on multiple browsers.',
          'Experienced in various browser specific development.',
          'Knows how to interpret the wireframes and build common modules and architect reusable front end code',
        ],
      },
      {
        title: 'Java Developer',
        location: 'Chennai, India',
        city: 'Chennai',
        country: 'India',
        jobId: 'mpminfosoftpvtltd-java-developer',
        postingDate: '2015-08-06',
        experienceRequired: '2 - 4 years',
        minimumQualification: 'BE / MCA Computer Science or equivalent.',
        applyUrl: 'mailto:info@sandman.co.in',
        requiredSkills: [
          'Spring Web MVC framework (it is implicit that the user know core-Java here)',
          'Libraries such as Apache Math, Apache Lang, Jackson, Apache POI to name a few',
          'JavaScript (JQuery preferred)',
          'MySQL',
          'Maintaining/Running web-servers and web application deployment',
          'Bootstrap (preferred but not necessary)',
        ],
      },
    ],
  )

  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[0].company, 'MPM Infosoft Pvt. Ltd.')
  assert.equal(jobs[0].source, 'mpminfosoftpvtltd')
  assert.equal(jobs[0].link, 'https://www.mpminfosoft.com/careers/front-end-developer')
  assert.equal(
    jobs[0].jobDescription,
    'Good experience working with front-end web applications. Develop web front-end pages providing cutting-edge UI experience to users utilizing XHTMl, CSS and JavaScript. General knowledge of back-end web development. Excellent communication skills (in English).',
  )
})

test('run fails closed when the careers page no longer exposes the verified job cards', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createMpmInfosoftPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return homepageHtml
        if (url === scraper.CONTACT_URL) return contactHtml
        if (url === scraper.CAREERS_URL) {
          return '<title>Career - Green Sand Molding Process | Sand Analytics Process | Sand Analysis</title><h1>JOB OPENINGS</h1>'
        }
        assert.fail(`Unexpected URL fetched: ${url}`)
      },
    }),
    /verified careers page no longer exposes the expected job cards/i,
  )
})
