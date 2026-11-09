import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-05T10:00:00.000Z'
const APPLICATION_ENGINEER_URL = 'https://sterlingsoftware.global/new/application-engineer'
const JAVA_ARCHITECT_URL = 'https://sterlingsoftware.global/new/java-architect'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Career | Sterling | Financial Technology. Digital. Consulting</title>
  </head>
  <body>
    <main>
      <h1>Work at Sterling</h1>
      <h2>Current Opening</h2>
      <p>We have inspiring people and stimulating work environment coupled with competitive compensation and other benefits.</p>
      <a href="/contact#careers">Careers</a>
      <script type="text/javascript">
        var joblist = [ 'Html', 'Java', 'Css', 'Application Engineer' ];
      </script>
      <!--
      <table class="job_listing">
        <tr>
          <td>Application Engineer</td>
          <td>1</td>
          <td>2 - 3 Years</td>
          <td>15 May 2019</td>
          <td><a href="/new/application-engineer">View more</a></td>
          <td style="display:none">Chennai</td>
        </tr>
        <tr>
          <td>Java</td>
          <td>2</td>
          <td>2 - 3 Years</td>
          <td>15 May 2019</td>
          <td><a href="/new/java-architect">View more</a></td>
          <td style="display:none">Chennai</td>
        </tr>
      </table>
      -->
    </main>
  </body>
</html>
`

const commentedOnlyCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Career | Sterling | Financial Technology. Digital. Consulting</title>
  </head>
  <body>
    <main>
      <h1>Work at Sterling</h1>
      <h2>Current Opening</h2>
      <p>We have inspiring people and stimulating work environment coupled with competitive compensation and other benefits.</p>
      <a href="/contact#careers">Careers</a>
      <!--
      <table class="job_listing">
        <tr>
          <td>Application Engineer</td>
          <td>1</td>
          <td>2 - 3 Years</td>
          <td>15 May 2019</td>
          <td><a href="/new/application-engineer">View more</a></td>
          <td style="display:none">Chennai</td>
        </tr>
        <tr>
          <td>Java</td>
          <td>2</td>
          <td>2 - 3 Years</td>
          <td>15 May 2019</td>
          <td><a href="/new/java-architect">View more</a></td>
          <td style="display:none">Chennai</td>
        </tr>
      </table>
      -->
    </main>
  </body>
</html>
`

const applicationEngineerDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Application Engineer | Sterling | Financial Technology. Digital. Consulting</title>
  </head>
  <body>
    <section>
      <h2>Application Engineer</h2>
      <span class="loc">Location: Chennai</span>
    </section>
    <ul class="app-inner">
      <h4>Job Responsibilities</h4>
      <li><a>Design and develop clean and intuitive user interface to teach and program robots.</a></li>
      <li><a>Collaborate with other engineers and communicate design priorities and provide constructive guidance.</a></li>
      <div class="line"></div>
    </ul>
    <ul class="app-inner">
      <h4>Key Skills & Experience</h4>
      <li><a>2+ years of experience with c++ and object-oriented software design.</a></li>
      <li><a>Experience in Linux application development.</a></li>
      <div class="line"></div>
    </ul>
    <ul class="app-inner">
      <h4>Desired Skills</h4>
      <li><a>Experience in Python, Java, Objective-C etc is a plus.</a></li>
      <div class="line"></div>
    </ul>
    <ul class="app-inner">
      <h4>Education</h4>
      <li><a>BE/BTech (or higher) in computer science, electrical engineering or any other related field.</a></li>
      <div class="line"></div>
    </ul>
    <h2>Apply now</h2>
  </body>
</html>
`

const javaArchitectDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Java Architect | Sterling | Financial Technology. Digital. Consulting</title>
  </head>
  <body>
    <section>
      <h2>Java Architect</h2>
      <span class="loc">Location: Chennai</span>
    </section>
    <ul class="app-inner">
      <h4>Job Responsibilities</h4>
      <li><a>Lead architecture decisions for enterprise Java systems.</a></li>
      <li><a>Partner with engineering teams to deliver scalable solutions.</a></li>
      <div class="line"></div>
    </ul>
    <ul class="app-inner">
      <h4>Key Skills & Experience</h4>
      <li><a>2+ years of experience with Java and object-oriented software design.</a></li>
      <div class="line"></div>
    </ul>
    <ul class="app-inner">
      <h4>Education</h4>
      <li><a>BE/BTech in computer science or related field.</a></li>
      <div class="line"></div>
    </ul>
    <h2>Apply now</h2>
  </body>
</html>
`

const applicationEngineerDescription = 'Job Responsibilities: Design and develop clean and intuitive user interface to teach and program robots. Collaborate with other engineers and communicate design priorities and provide constructive guidance. Key Skills & Experience: 2+ years of experience with c++ and object-oriented software design. Experience in Linux application development. Desired Skills: Experience in Python, Java, Objective-C etc is a plus. Education: BE/BTech (or higher) in computer science, electrical engineering or any other related field.'
const javaArchitectDescription = 'Job Responsibilities: Lead architecture decisions for enterprise Java systems. Partner with engineering teams to deliver scalable solutions. Key Skills & Experience: 2+ years of experience with Java and object-oriented software design. Education: BE/BTech in computer science or related field.'

const loadModule = async () => {
  try {
    return await import('../../scraper/sterlingsoftwareprivatelimited/script.js')
  } catch {
    assert.fail('Expected Sterling Software Private Limited scraper module at ../../scraper/sterlingsoftwareprivatelimited/script.js')
  }
}

test('Sterling Software Private Limited helpers stay pinned to the verified first-party careers page and public detail pages', async () => {
  const sterlingSoftware = await loadModule()

  assert.equal(sterlingSoftware.SOURCE, 'sterlingsoftwareprivatelimited')
  assert.equal(sterlingSoftware.COMPANY, 'Sterling Software Private Limited')
  assert.equal(sterlingSoftware.CAREERS_URL, 'https://sterlingsoftware.global/career/')
  assert.equal(sterlingSoftware.VERIFIED_ON, '2026-08-05')
  assert.equal(sterlingSoftware.hasVerifiedCareersSignal(verifiedCareersHtml), true)
  assert.equal(sterlingSoftware.hasOnlyCommentedHistoricalOpenings(commentedOnlyCareersHtml), true)

  assert.deepEqual(sterlingSoftware.extractLiveOpeningRows(verifiedCareersHtml), [
    {
      title: 'Application Engineer',
      requisitionId: '1',
      experienceRequired: '2 - 3 Years',
      postingDate: '2019-05-15',
      city: 'Chennai',
      location: 'Chennai, India',
      country: 'India',
      detailUrl: APPLICATION_ENGINEER_URL,
    },
    {
      title: 'Java',
      requisitionId: '2',
      experienceRequired: '2 - 3 Years',
      postingDate: '2019-05-15',
      city: 'Chennai',
      location: 'Chennai, India',
      country: 'India',
      detailUrl: JAVA_ARCHITECT_URL,
    },
  ])

  assert.deepEqual(sterlingSoftware.extractOpeningDetail(applicationEngineerDetailHtml, APPLICATION_ENGINEER_URL), {
    title: 'Application Engineer',
    city: 'Chennai',
    location: 'Chennai, India',
    country: 'India',
    minimumQualification: 'BE/BTech (or higher) in computer science, electrical engineering or any other related field.',
    jobDescription: applicationEngineerDescription,
    detailUrl: APPLICATION_ENGINEER_URL,
  })
})

test('Sterling Software Private Limited extracts live public openings from the verified careers table and detail pages', async () => {
  const sterlingSoftware = await loadModule()
  const requestedUrls = []

  const jobs = await sterlingSoftware.createSterlingSoftwarePrivateLimitedScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sterlingSoftware.CAREERS_URL) return verifiedCareersHtml
      if (url === APPLICATION_ENGINEER_URL) return applicationEngineerDetailHtml
      if (url === JAVA_ARCHITECT_URL) return javaArchitectDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sterlingSoftware.CAREERS_URL,
    APPLICATION_ENGINEER_URL,
    JAVA_ARCHITECT_URL,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Application Engineer',
      company: 'Sterling Software Private Limited',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      state: null,
      country: 'India',
      jobId: '1',
      requisitionId: '1',
      sourceUrl: APPLICATION_ENGINEER_URL,
      applyUrl: APPLICATION_ENGINEER_URL,
      employmentType: null,
      experienceRequired: '2 - 3 Years',
      minimumQualification: 'BE/BTech (or higher) in computer science, electrical engineering or any other related field.',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2019-05-15',
      closingDate: null,
      jobDescription: applicationEngineerDescription,
      remoteStatus: 'On-site',
      source: 'sterlingsoftwareprivatelimited',
      link: APPLICATION_ENGINEER_URL,
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Java Architect',
      company: 'Sterling Software Private Limited',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      state: null,
      country: 'India',
      jobId: '2',
      requisitionId: '2',
      sourceUrl: JAVA_ARCHITECT_URL,
      applyUrl: JAVA_ARCHITECT_URL,
      employmentType: null,
      experienceRequired: '2 - 3 Years',
      minimumQualification: 'BE/BTech in computer science or related field.',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2019-05-15',
      closingDate: null,
      jobDescription: javaArchitectDescription,
      remoteStatus: 'On-site',
      source: 'sterlingsoftwareprivatelimited',
      link: JAVA_ARCHITECT_URL,
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Sterling Software Private Limited fails closed when the verified careers page or public detail page drifts', async () => {
  const sterlingSoftware = await loadModule()

  await assert.rejects(
    sterlingSoftware.createSterlingSoftwarePrivateLimitedScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified Sterling careers page/i,
  )

  await assert.rejects(
    sterlingSoftware.createSterlingSoftwarePrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === sterlingSoftware.CAREERS_URL) return verifiedCareersHtml
        return '<html><body><h1>Broken detail</h1></body></html>'
      },
    }),
    /Sterling opening detail page/i,
  )
})
