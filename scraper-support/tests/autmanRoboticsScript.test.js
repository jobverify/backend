import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Autman Robotics</title>
    <link rel="canonical" href="https://www.aut-man.com/careers" />
  </head>
  <body>
    <h1>WE MAKE BIG IDEAS HAPPEN</h1>
    <p>Welcome to AUTMAN Robotics - a hub of innovation located in the heart of Birmingham, UK</p>
    <h2>CAREER OPPORTUNITIES</h2>
    <h3>Robotics Engineer</h3>
    <p>Birmingham, UK</p>
    <p>We are looking for a Robotics Engineer with expertise in control systems, motion planning, and industrial robot programming. Strong skills in kinematics, real-time feedback control, and sensor fusion are essential. If you excel at problem-solving and designing adaptive robotic systems, let's connect.</p>
    <a href="mailto:shini@aut-man.com?subject=Interested%20to%20join%20Autman%20%3A%20Robotics%20Engineer" aria-label="Apply Now"><span>Apply Now</span></a>
    <a href="mailto:shini@aut-man.com?subject=Interested%20to%20join%20Autman%20%3A%20Robotics%20Engineer"><svg></svg></a>
    <p>Don't see a position that matches your skills? We welcome you to submit your CV for our review.</p>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Autman Robotics - Physical AI for Adaptive Manufacturing</title>
    <meta
      name="description"
      content="Autman Robotics builds Physical AI that makes any industrial robot adaptive. Vision, neuro-haptic sensing and RAiOS let robots handle variation without task-specific retraining."
    />
    <link rel="canonical" href="https://aut-man.com/" />
    <meta property="og:title" content="Autman Robotics - Physical AI for Adaptive Manufacturing" />
  </head>
  <body>
    <nav>
      <a href="#technology">Technology</a>
      <a href="#about">About</a>
      <a href="#careers">Careers</a>
      <a href="#contact">Contact</a>
    </nav>
    <main>
      <h1>The future of automation doesn't follow scripts.</h1>
      <p>Making every robot adaptable and every product limitless. One intelligence layer, any machine.</p>
      <section id="careers">
        <h2>Careers</h2>
        <h3>Join the Mission</h3>
        <p>We are always looking for exceptional innovators, roboticists, and neuroengineers ready to build the physical intelligence behind the next generation of machines.</p>
        <article>
          <h4>Drop Your CV</h4>
          <p>Don't see a role matching your exact specifications? Send us your deatails, resume and a description of the foundational challenges you want to solve.</p>
          <a href="mailto:info@aut-man.com?subject=General%20Application%20-%20Autman%20Careers">
            Submit Application
          </a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const unreachableCareersRuntimeText = 'Runtime is unreachable'

const loadAutmanRoboticsModule = async () => {
  try {
    return await import('../../scraper/autmanrobotics/script.js')
  } catch {
    assert.fail('Expected Autman Robotics scraper module at ../../scraper/autmanrobotics/script.js')
  }
}

test('Autman Robotics sentinels recognize the verified homepage and first-party careers page', async () => {
  const autmanRobotics = await loadAutmanRoboticsModule()

  assert.equal(autmanRobotics.SOURCE, 'autmanrobotics')
  assert.equal(autmanRobotics.COMPANY, 'Autman Robotics')
  assert.equal(autmanRobotics.COMPANY_DOMAIN, 'aut-man.com')
  assert.equal(autmanRobotics.HOMEPAGE_URL, 'https://www.aut-man.com/')
  assert.equal(autmanRobotics.CAREERS_URL, 'https://www.aut-man.com/careers')
  assert.equal(autmanRobotics.APPLY_EMAIL, 'shini@aut-man.com')
  assert.equal(autmanRobotics.VERIFIED_ON, '2026-08-07')
  assert.match(autmanRobotics.VERIFIED_SURFACE_SUMMARY, /Friday, August 7, 2026/i)
  assert.match(autmanRobotics.VERIFIED_SURFACE_SUMMARY, /Robotics Engineer/i)
  assert.equal(autmanRobotics.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(autmanRobotics.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(autmanRobotics.extractApplyRoleLinks(careersHtml), [
    {
      title: 'Robotics Engineer',
      applyUrl: 'mailto:shini@aut-man.com?subject=Interested%20to%20join%20Autman%20%3A%20Robotics%20Engineer',
    },
  ])
})

test('Autman Robotics extracts the current inline public openings from the verified careers page', async () => {
  const autmanRobotics = await loadAutmanRoboticsModule()

  const jobs = autmanRobotics.extractPublicOpenings(careersHtml)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs, [
    {
      title: 'Robotics Engineer',
      department: null,
      location: 'Birmingham, United Kingdom',
      city: 'Birmingham',
      state: null,
      country: 'United Kingdom',
      sourceUrl: 'https://www.aut-man.com/careers',
      applyUrl: 'mailto:shini@aut-man.com?subject=Interested%20to%20join%20Autman%20%3A%20Robotics%20Engineer',
      jobId: 'autmanrobotics-robotics-engineer',
      requisitionId: 'autmanrobotics-robotics-engineer',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        "We are looking for a Robotics Engineer with expertise in control systems, motion planning, and industrial robot programming. Strong skills in kinematics, real-time feedback control, and sensor fusion are essential. If you excel at problem-solving and designing adaptive robotic systems, let's connect.",
      remoteStatus: null,
    },
  ])
})

test('Autman Robotics run verifies the trusted first-party surfaces and decorates the scraped jobs', async () => {
  const autmanRobotics = await loadAutmanRoboticsModule()
  const requestedUrls = []

  const jobs = await autmanRobotics.createAutmanRoboticsScraper({
    maxJobs: 1,
    now: () => '2026-08-07T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === autmanRobotics.HOMEPAGE_URL) return currentHomepageHtml
      if (url === autmanRobotics.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected Autman Robotics URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    autmanRobotics.HOMEPAGE_URL,
    autmanRobotics.CAREERS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Robotics Engineer',
    department: null,
    company: 'Autman Robotics',
    location: 'Birmingham, United Kingdom',
    city: 'Birmingham',
    state: null,
    country: 'United Kingdom',
    source: 'autmanrobotics',
    companyCareerPage: 'https://www.aut-man.com/careers',
    companyDomain: 'aut-man.com',
    atsPlatform: 'official-company-careers',
    sourceUrl: 'https://www.aut-man.com/careers',
    applyUrl: 'mailto:shini@aut-man.com?subject=Interested%20to%20join%20Autman%20%3A%20Robotics%20Engineer',
    link: 'mailto:shini@aut-man.com?subject=Interested%20to%20join%20Autman%20%3A%20Robotics%20Engineer',
    jobId: 'autmanrobotics-robotics-engineer',
    requisitionId: 'autmanrobotics-robotics-engineer',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      "We are looking for a Robotics Engineer with expertise in control systems, motion planning, and industrial robot programming. Strong skills in kinematics, real-time feedback control, and sensor fusion are essential. If you excel at problem-solving and designing adaptive robotic systems, let's connect.",
    remoteStatus: null,
    scrapedAt: '2026-08-07T00:00:00.000Z',
  })
})

test('Autman Robotics fails closed when the homepage or careers page contract changes', async () => {
  const autmanRobotics = await loadAutmanRoboticsModule()

  await assert.rejects(
    autmanRobotics.createAutmanRoboticsScraper().run({
      fetchText: async (url) => {
        if (url === autmanRobotics.HOMEPAGE_URL) {
          return currentHomepageHtml.replaceAll('#careers', '#contact')
        }

        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    autmanRobotics.createAutmanRoboticsScraper().run({
      fetchText: async (url) => {
        if (url === autmanRobotics.HOMEPAGE_URL) return currentHomepageHtml
        if (url === autmanRobotics.CAREERS_URL) {
          return careersHtml.replace('CAREER OPPORTUNITIES', 'TEAM OPPORTUNITIES')
        }

        throw new Error(`Unexpected Autman Robotics URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )
})

test('Autman Robotics returns [] when the verified homepage degrades to a general-application-only surface and the dedicated careers runtime is unreachable', async () => {
  const autmanRobotics = await loadAutmanRoboticsModule()

  const jobs = await autmanRobotics.createAutmanRoboticsScraper({
    now: () => '2026-08-13T17:35:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === autmanRobotics.HOMEPAGE_URL) return currentHomepageHtml
      if (url === autmanRobotics.CAREERS_URL) return unreachableCareersRuntimeText
      throw new Error(`Unexpected Autman Robotics URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Autman Robotics returns [] when the verified general-application homepage remains live but the dedicated careers route responds with a 504', async () => {
  const autmanRobotics = await loadAutmanRoboticsModule()

  const jobs = await autmanRobotics.createAutmanRoboticsScraper().run({
    fetchText: async (url) => {
      if (url === autmanRobotics.HOMEPAGE_URL) return currentHomepageHtml
      if (url === autmanRobotics.CAREERS_URL) {
        throw new Error(`HTTP 504 for ${autmanRobotics.CAREERS_URL}`)
      }

      throw new Error(`Unexpected Autman Robotics URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
