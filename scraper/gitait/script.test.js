import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  DETAIL_URLS,
  HOMEPAGE_URL,
  SOURCE,
  createGitaitScraper,
  extractCareerListingUrls,
  extractJobDetail,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <html lang="en">
    <head>
      <title>GITA IT Pvt Ltd | E-Learning</title>
    </head>
    <body>
      <main>
        <h3>Career</h3>
        <h3 class="text-uppercase bold text-left"> Current openings </h3>
        <p>
          We are headquartered in Hyderabad and are a team of finance professionals, engineers
          & designers with diverse backgrounds and skills. See the openings below.
        </p>
        <div id="career-collapse">
          <div class="career-box menu-career-box" id="meanDevBox">
            <a class="meanDevBox__link" href="meanstackdev.html"></a>
            <a class="jobdesc__link" href="meanstackdev.html">MEAN Full Stack Developer with React js</a>
          </div>
          <div class="career-box menu-career-box" id="reactDevBox">
            <a class="reactDevBox__link" href="reactjsNreactnative.html"></a>
            <a class="jobdesc__link" href="reactjsNreactnative.html">Reactjs and React Native web-developer</a>
          </div>
          <div class="career-box menu-career-box" id="techLeadBox">
            <a class="techLead__link" href="techLead.html"></a>
            <a class="jobdesc__link" href="techLead.html">Tech Lead</a>
          </div>
        </div>
        <p>HIG 128, 1st Floor, 5th Phase, KPHB Colony, Hyderabad, Telangana 500072.</p>
        <p>murthy@gitait.com</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <html lang="en">
    <head>
      <title>GITA IT Pvt Ltd | E-Learning</title>
    </head>
    <body>
      <main>
        <h3 class="text-uppercase bold text-center"> Current openings </h3>
        <p>
          We are headquartered in Hyderabad and are a team of finance professionals, engineers
          & designers with diverse backgrounds and skills. See the openings below.
        </p>
        <div id="career-collapse">
          <div class="career-box" id="meanDevBox">
            <a class="meanDevBox__link" href="meanstackdev.html"></a>
            <a class="jobdesc__link" href="meanstackdev.html">MEAN Full Stack Developer with React js</a>
          </div>
          <div class="career-box" id="reactDevBox">
            <a class="reactDevBox__link" href="reactjsNreactnative.html"></a>
            <a class="jobdesc__link" href="reactjsNreactnative.html">Reactjs and React Native web-developer</a>
          </div>
          <div class="career-box" id="techLeadBox">
            <a class="techLead__link" href="techLead.html"></a>
            <a class="jobdesc__link" href="techLead.html">Tech Lead</a>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" id="applyBtn">Apply</button>
        <p>murthy@gitait.com</p>
      </main>
    </body>
  </html>
`

const meanStackDetailHtml = `
  <html>
    <head>
      <title>GITA IT Pvt Ltd | Careers | Dotnet-Full STACK-Developer | SAP ERP, E-Learning, Data Science, Machine Learning & Artifical Intelligent Company</title>
    </head>
    <body>
      <div class="career-box-details" id="mean-stack-react">
        <h6 class="bold">Job Summary</h6>
        <ul>
          <li>Must be very strong in .NET core MVC.</li>
          <li>Full stack development experience with C#, ASP.NET MVC, and Web API.</li>
          <li>Working experience in Web services (SOAP/Restful) integration, failure analysis etc...</li>
          <li>Hands-on development experience using JavaScript, HTML5, CSS 3, AJAX, JSON, Bootstrap, and Angular(optional).</li>
          <li>SQL Server Knowledge or experience in SQL.</li>
          <li>Understanding of back-end technologies.</li>
          <li>Good Communication and analytic skills.</li>
          <li>Good Ttime-management skills.</li>
          <li>Critical thinking and problem-solving skills.</li>
          <li>You will be working closely with the UI, UX and QA team.</li>
          <li>A technology enthusiast who is passionate about coding.</li>
          <li>Willing to learn, unlearn and relearn.</li>
          <li>Be a team player.</li>
        </ul>
        <h6 class="bold">Key Skills</h6>
        <p>ASP.Net Core, Web API, Entity Framework, LINQ, SQL Server, Angular.</p>
        <h6 class="bold">Work Location: </h6>Hyderabad.
        <h6 class="bold">Contact Details:</h6>
        <p>Mohan Babu R<br>HR Manager<br>mohan.r@gitait.com<br>M: 90324 12579</p>
      </div>
      <section class="section-contact">
        <div class="heading-title">Join Our Team</div>
        <form method="POST" enctype="multipart/form-data" action="#">
          <label>Resume Upload</label>
          <input type="file" accept="application/pdf, application/vnd.ms-office" />
        </form>
      </section>
      <button type="submit" class="btn btn-primary" id="applyBtn">Apply</button>
    </body>
  </html>
`

const reactDetailHtml = `
  <html>
    <head>
      <title>NimbleSoft Technologies | Careers | ReactJs & React-Native Developer | SAP ERP, E-Learning, Data Science, Machine Learning & Artifical Intelligent Company</title>
    </head>
    <body>
      <div class="career-box-details" id="react-developer">
        <h6 class="bold">Job Summary</h6>
        <ul>
          <li>Build pixel-perfect, UI across both web and mobile platforms.</li>
          <li>Design, develop, secure high performing applications using Reactjs, ReactNative for both web & mobile.</li>
          <li>Translate designs & wireframes into a high-quality code & UI.</li>
          <li>Leverage native APIs for deep integrations with both platforms.</li>
          <li>Diagnose, fix bugs & performance bottlenecks that feels native.</li>
          <li>Reach out to the open source community to encourage & help implement mission-critical software fixes - React Native moves fast & often breaks things.</li>
          <li>Maintain code & write automated tests to ensure the product is of the highest quality Skills</li>
        </ul>
        <h6 class="bold">Responsibilities and Duties</h6>
        <ul>
          <li>2-4 years software development experience.</li>
          <li>Hands on experience in Reactjs, React Native, Redux.</li>
          <li>Firm grasp of the JavaScript language & its nuances, including ES6 syntax.</li>
          <li>Object-oriented programming.</li>
          <li>Write well-documented, clean JavaScript code.</li>
          <li>Working with third-party dependencies and debugging dependency conflicts.</li>
          <li>Familiarity with native build tools, like XCode, Android Studio.</li>
          <li>Understanding of REST APIs, the document request model, & offline storage.</li>
          <li>Experience with automated testing suites, like Jest.</li>
        </ul>
        <h6 class="bold">Key Skills</h6>
        <p>Reactjs, React Native, ES6, xcode, restapi, android studio, Jest.</p>
      </div>
      <section class="section-contact">
        <div class="heading-title">Join Our Team</div>
        <form method="POST" enctype="multipart/form-data" action="#">
          <label>Resume Upload</label>
          <input type="file" accept="application/pdf, application/vnd.ms-office" />
        </form>
      </section>
      <button type="submit" class="btn btn-primary" id="applyBtn">Apply</button>
    </body>
  </html>
`

const techLeadDetailHtml = `
  <html>
    <head>
      <title>NimbleSoft Technologies | Careers | Tech-Lead | SAP ERP, E-Learning, Data Science, Machine Learning & Artifical Intelligent Company</title>
    </head>
    <body>
      <div class="career-box-details" id="react-developer">
        <h6 class="bold">Job Summary</h6>
        <ul>
          <li>We are looking for MEAN with react experiance candidate.</li>
          <li>Minimum 5 years of experiance in software development industry.</li>
          <li>Need to manage a team and strategize to deliver the product on time.</li>
        </ul>
        <h6 class="bold">Responsibilities and Duties</h6>
        <ul>
          <li>Working experience of RESTful APIs.</li>
          <li>Well acquainted with working in an Agile environment.</li>
          <li>Well versed with the relevant coding standards.</li>
          <li>Develop high performance & scalable applications.</li>
          <li>Hands-on experience in Reactjs, Angular 6+.</li>
          <li>Working experience in Node.Js, MongoDB and Express.</li>
          <li>Hands on experience with JavaScript Development on both the client and server-side.</li>
          <li>Experience in working with different front-end components.</li>
          <li>Experience in working with RESTful APIs and Routers.</li>
        </ul>
        <h6 class="bold">Key Skills</h6>
        <p>Express.js, Node.js, Full Stack Development, Angular JS, React Native, Software Development, React.js</p>
      </div>
      <section class="section-contact">
        <div class="heading-title">Join Our Team</div>
        <form method="POST" enctype="multipart/form-data" action="#">
          <label>Resume Upload</label>
          <input type="file" accept="application/pdf, application/vnd.ms-office" />
        </form>
      </section>
      <button type="submit" class="btn btn-primary" id="applyBtn">Apply</button>
    </body>
  </html>
`

const detailHtmlByUrl = {
  [DETAIL_URLS.meanstack]: meanStackDetailHtml,
  [DETAIL_URLS.react]: reactDetailHtml,
  [DETAIL_URLS.techLead]: techLeadDetailHtml,
}

test('GITA IT constants and official surface helpers stay pinned to the verified first-party pages', () => {
  assert.equal(SOURCE, 'gitait')
  assert.equal(COMPANY, 'GITA IT')
  assert.equal(HOMEPAGE_URL, 'https://gitait.com/')
  assert.equal(CAREERS_URL, 'https://gitait.com/careers.html')
  assert.deepEqual(DETAIL_URLS, {
    meanstack: 'https://gitait.com/meanstackdev.html',
    react: 'https://gitait.com/reactjsNreactnative.html',
    techLead: 'https://gitait.com/techLead.html',
  })

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><title>Placeholder</title></html>'), false)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialCareersSignal('<html><body>No openings here</body></html>'), false)
})

test('extractCareerListingUrls returns the three verified first-party detail routes', () => {
  assert.deepEqual(
    extractCareerListingUrls(careersHtml),
    [
      DETAIL_URLS.meanstack,
      DETAIL_URLS.react,
      DETAIL_URLS.techLead,
    ],
  )
})

test('extractJobDetail parses the verified GITA IT role detail pages', () => {
  const meanJob = extractJobDetail(DETAIL_URLS.meanstack, meanStackDetailHtml)
  assert.equal(meanJob.title, 'Dotnet Full Stack Developer')
  assert.equal(meanJob.location, 'Hyderabad, Telangana, India')
  assert.equal(meanJob.city, 'Hyderabad')
  assert.equal(meanJob.country, 'India')
  assert.equal(meanJob.contactEmail, 'mohan.r@gitait.com')
  assert.deepEqual(meanJob.requiredSkills, [
    'ASP.Net Core',
    'Web API',
    'Entity Framework',
    'LINQ',
    'SQL Server',
    'Angular',
  ])

  const reactJob = extractJobDetail(DETAIL_URLS.react, reactDetailHtml)
  assert.equal(reactJob.title, 'Reactjs and React Native web-developer')
  assert.equal(reactJob.experienceRequired, '2-4 years')
  assert.deepEqual(reactJob.requiredSkills, [
    'Reactjs',
    'React Native',
    'ES6',
    'xcode',
    'restapi',
    'android studio',
    'Jest',
  ])

  const techLeadJob = extractJobDetail(DETAIL_URLS.techLead, techLeadDetailHtml)
  assert.equal(techLeadJob.title, 'Tech Lead')
  assert.equal(techLeadJob.experienceRequired, 'Minimum 5 years')
  assert.match(techLeadJob.jobDescription, /agile environment/i)
})

test('run scrapes the verified first-party GITA IT careers surface and decorates the jobs', async () => {
  const requestedUrls = []
  const scraper = createGitaitScraper({ now: () => '2026-07-13T00:00:00.000Z' })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === CAREERS_URL) {
        return careersHtml
      }

      if (detailHtmlByUrl[url]) {
        return detailHtmlByUrl[url]
      }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    DETAIL_URLS.meanstack,
    DETAIL_URLS.react,
    DETAIL_URLS.techLead,
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Dotnet Full Stack Developer',
      'Reactjs and React Native web-developer',
      'Tech Lead',
    ],
  )
  assert.equal(jobs[0].company, COMPANY)
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'gitait.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, DETAIL_URLS.meanstack)
  assert.equal(jobs[0].scrapedAt, '2026-07-13T00:00:00.000Z')
})

test('run fails closed when the verified homepage or careers contract drifts', async () => {
  await assert.rejects(
    createGitaitScraper().run({
      fetchText: async () => '<html><title>Maintenance</title><body>No careers</body></html>',
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    createGitaitScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return homepageHtml
        }

        if (url === CAREERS_URL) {
          return careersHtml.replaceAll('techLead.html', 'engineering-manager.html')
        }

        throw new Error(`Unexpected URL ${url}`)
      },
    }),
    /verified official careers page/i,
  )
})

test('run fails closed when a verified detail page loses its apply flow or job block', async () => {
  await assert.rejects(
    createGitaitScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return homepageHtml
        }

        if (url === CAREERS_URL) {
          return careersHtml
        }

        if (url === DETAIL_URLS.meanstack) {
          return meanStackDetailHtml.replace('Resume Upload', 'Portfolio Upload')
        }

        if (detailHtmlByUrl[url]) {
          return detailHtmlByUrl[url]
        }

        throw new Error(`Unexpected URL ${url}`)
      },
    }),
    /verified GITA IT detail page/i,
  )
})
