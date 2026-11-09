import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/spsoftware/script.js')
  } catch {
    assert.fail('Expected SP Software scraper module at ../../scraper/spsoftware/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SPSoft</title>
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime.js"></script>
    <script src="polyfills.js"></script>
    <script src="app-career-career-module.js"></script>
  </body>
</html>
`

const currentCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>SPSoft</title>
    <base href="/">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/x-icon" href="assets/images/splogo.png">
    <link rel="preconnect" href="https://fonts.gstatic.com">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
  </head>
  <body class="mat-typography">
    <app-root></app-root>
    <script src="runtime.js" defer></script>
    <script src="polyfills.js" defer></script>
    <script src="scripts.js" defer></script>
    <script src="vendor.js" defer></script>
    <script src="main.js" defer></script>
  </body>
</html>
`

const careersBundleText = `
careers@spsoftglobal.com
#001582-
Java Developer: 5-8 Yrs, Location: Hyderabad (WFO)
Rest APIs
API development & Application Deployment
#001585-
.NET Developer: 3-6 Yrs, Location: Hyderabad (WFO)
Web API
SQL Server
`

const compiledCareersBundleText = `
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](30, "#001582-");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](31, "Java Developer: 5-8 Yrs, Location: Hyderabad (WFO) ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](35, "Job Description:");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](38, " Strong Core Java 8 or above Java EE hands on skills including design patterns. ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](40, " Strong experience in handling Multithreading, Data Structures, concurrency scenarios. ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](42, " Hands-on experience with Spring components viz. MVC, JDBC, Batch, Security, Boot, etc. ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](44, " Hands on experience in writing & optimizing (analyzing query plans) SQL queries on Database like SQL server OR Oracle. ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](46, " Practical experience with Rest APIs, XML, JAXB, JSON in creating a layered system. ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](48, " Hands-on experience with API development & Application Deployment. ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](56, "Skills Set:");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](57, "OOPS, Java APIs, Java Web Services, Java, Restful, Design Patterns, Spring Boot, Hibernate, SQL, GIT, etc.");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](60, "Educational Qualification:");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](61, "Bachelor or master's degree in Computer Science.");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](63, "Send your CV to: ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](64, "careers@spsoftglobal.com");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](70, "#001585-");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](71, " .NET Developer: 3-6 Yrs, Location: Hyderabad (WFO) ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](75, "Job Description:");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](78, " Good knowledge of OOPS, C#, ASP.NET 4.0/4.5/4.6, SQL Server 2008-12, Ajax, Web services. ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](80, "Good to have exposure to .NET Core");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](82, " Knowledge of MVC 3/4, Multilingual, XML and XSLT, 3-tier architecture ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](84, "Knowledge of SQL queries, stored procedures");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](86, " Good understanding of Web services (SOAP/REST) and Web applications ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](88, "Good Knowledge of Entity Framework, LINQ and REST APIs");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](90, "Knowledge of GIT");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](98, "Skills Set:");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](99, "OOPS, C#, ASP.NET MVC, .NET Framework, Web Services, WCF, WPF, Restful, Design Patterns, Oracle, PostgreSQL, GIT, etc.");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](102, "Educational Qualification:");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](103, "Bachelor or master's degree in Computer Science.");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](105, "Send your CV to ");
_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](106, "careers@spsoftglobal.com");
`

test('SP Software constants stay pinned to the verified first-party careers route and current shell-plus-bundle contract', async () => {
  const spSoftware = await loadModule()

  assert.equal(spSoftware.SOURCE, 'spsoftware')
  assert.equal(spSoftware.COMPANY, 'SP Software')
  assert.equal(spSoftware.CAREERS_URL, 'https://www.spsoftglobal.com/career')
  assert.equal(
    spSoftware.CAREERS_BUNDLE_URL,
    'https://www.spsoftglobal.com/app-career-career-module.js',
  )
  assert.equal(spSoftware.CAREERS_EMAIL, 'careers@spsoftglobal.com')
  assert.equal(spSoftware.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(spSoftware.hasOfficialCareersPageSignal(currentCareersPageHtml), true)
  assert.equal(
    spSoftware.hasOfficialCareersPageSignal('<html><head><title>SPSoft</title></head><body></body></html>'),
    false,
  )
  assert.equal(spSoftware.hasVerifiedCareerBundleSignal(careersBundleText), true)
})

test('SP Software extracts India roles from the compiled careers bundle', async () => {
  const spSoftware = await loadModule()

  assert.deepEqual(spSoftware.extractIndiaJobs(careersBundleText), [
    {
      title: 'Java Developer',
      company: 'SP Software',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: null,
      country: 'India',
      jobId: '001582',
      requisitionId: '001582',
      sourceUrl: 'https://www.spsoftglobal.com/career',
      applyUrl: 'mailto:careers@spsoftglobal.com',
      employmentType: null,
      experienceRequired: '5-8 Yrs',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Rest APIs', 'API development & Application Deployment'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Rest APIs API development & Application Deployment',
      remoteStatus: 'On-site',
    },
    {
      title: '.NET Developer',
      company: 'SP Software',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: null,
      country: 'India',
      jobId: '001585',
      requisitionId: '001585',
      sourceUrl: 'https://www.spsoftglobal.com/career',
      applyUrl: 'mailto:careers@spsoftglobal.com',
      employmentType: null,
      experienceRequired: '3-6 Yrs',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Web API', 'SQL Server'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Web API SQL Server',
      remoteStatus: 'On-site',
    },
  ])
})

test('SP Software extracts India roles from the live compiled Angular text nodes', async () => {
  const spSoftware = await loadModule()

  assert.equal(spSoftware.extractIndiaJobs(compiledCareersBundleText).length, 2)
})

test('SP Software run validates the first-party careers shell and decorates bundle-derived India jobs', async () => {
  const spSoftware = await loadModule()
  const requestedUrls = []

  const jobs = await spSoftware.createSpSoftwareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === spSoftware.CAREERS_URL) return currentCareersPageHtml
      if (url === spSoftware.CAREERS_BUNDLE_URL) return careersBundleText
      throw new Error(`Unexpected text URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.spsoftglobal.com/career',
    'https://www.spsoftglobal.com/app-career-career-module.js',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'spsoftware')
  assert.equal(jobs[0].link, 'mailto:careers@spsoftglobal.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})

test('SP Software fails closed when the verified bundle signal disappears', async () => {
  const spSoftware = await loadModule()

  await assert.rejects(
    spSoftware.createSpSoftwareScraper().run({
      fetchText: async (url) => {
        if (url === spSoftware.CAREERS_URL) return careersPageHtml
        return 'unexpected bundle content'
      },
    }),
    /verified SP Software careers bundle/i,
  )
})
