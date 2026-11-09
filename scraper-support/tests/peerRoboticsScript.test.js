import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <!doctype html>
  <html data-wf-domain="peerrobotics.ai" lang="en">
    <head>
      <title>Peer Robotics | Collaborative Mobile Robots</title>
    </head>
    <body>
      <h1>designed to work with humans</h1>
      <p>enabling automation using collaborative mobile robots</p>
      <p>Shaping the future of automation, with human-centric robots</p>
      <p>Peer Robotics transforms manufacturing through intelligent mobile robots that learn directly from humans.</p>
      <footer>© 2025 Peer Robotics. All rights reserved.</footer>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html data-wf-domain="peerrobotics.ai" lang="en">
    <head>
      <title>About Peer Robotics | Revolutionizing the Robotics Industry</title>
      <meta
        name="description"
        content="Learn about Peer Robotics and our mission to revolutionize the robotics industry. Explore our team, expertise, and commitment to innovation."
      >
    </head>
    <body>
      <section>
        <h2>What we do</h2>
        <h3>innovating a manufacturing future together</h3>
        <p>
          At Peer Robotics, we&#x27;re revolutionizing manufacturing with our deep understanding of the industry&#x27;s core challenges.
        </p>
      </section>
      <section class="section-hire">
        <h4>We’re hiring</h4>
        <p>Our team is growing fast and we’re always looking for smart people.</p>
        <a href="https://wellfound.com/company/peer-robotics/jobs">View jobs</a>
      </section>
      <section class="section-faq">
        <h2>faq<span>s</span></h2>
        <p>Where is Peer Robotics based out of?</p>
        <p>We are headquartered out of the USA with our R&amp;D center in India.</p>
      </section>
      <footer>© 2025 Peer Robotics. All rights reserved.</footer>
    </body>
  </html>
`

const wellfoundChallengeHtml = `
  <html lang="en">
    <head>
      <title>wellfound.com</title>
    </head>
    <body style="margin:0">
      <p id="cmsg">Please enable JS and disable any ad blocker</p>
      <script src="https://ct.captcha-delivery.com/c.js"></script>
    </body>
  </html>
`

const currentWellfoundChallengeHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="robots" content="noindex, nofollow" />
      <title>Security Check | Wellfound</title>
    </head>
    <body>
      <h1>Security Check</h1>
      <p>Before you continue, please verify your request.</p>
      <p>Enable JavaScript and cookies to continue</p>
      <div>Cloudflare Ray ID: a2b63193396b9bed</div>
      <script>
        window._cf_chl_opt = { cZone: 'wellfound.com' }
      </script>
      <script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>
    </body>
  </html>
`

const accessibleWellfoundBoardHtml = `
  <html>
    <head><title>Jobs at Peer Robotics: Explore current Opportunities</title></head>
    <body>
      <p>Peer Robotics</p>
      <p>View 1 job</p>
      <h1>Jobs at Peer Robotics</h1>
      <a href="https://wellfound.com/jobs/4457983-senior-hardware-systems-engineer">
        Senior Hardware Systems Engineer
      </a>
      <p>Engineering</p>
      <p>In office • Khed Shivapur</p>
      <p>₹10L – ₹30L • No equity</p>
      <p>3 years of exp</p>
      <p>Full Time</p>
      <p>
        Safety PLC integration, including personnel detection, e-stop,
        velocity/position monitoring, safety stop, restart/recovery behavior,
        and PLC-to-robot communication.
      </p>
    </body>
  </html>
`

const loadPeerRoboticsModule = async () => {
  try {
    return await import('../../scraper/peerrobotics/script.js')
  } catch {
    assert.fail('Expected Peer Robotics scraper module at ../../scraper/peerrobotics/script.js')
  }
}

test('Peer Robotics validates the verified homepage, about-page hiring handoff, and current Wellfound challenge gate', async () => {
  const peerRobotics = await loadPeerRoboticsModule()

  assert.equal(peerRobotics.SOURCE, 'peerrobotics')
  assert.equal(peerRobotics.COMPANY, 'Peer Robotics')
  assert.equal(peerRobotics.HOMEPAGE_URL, 'https://peerrobotics.ai/')
  assert.equal(peerRobotics.ABOUT_URL, 'https://peerrobotics.ai/about')
  assert.equal(peerRobotics.WELLFOUND_JOBS_URL, 'https://wellfound.com/company/peer-robotics/jobs')
  assert.equal(peerRobotics.VERIFIED_ON, '2026-08-15')
  assert.equal(peerRobotics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(peerRobotics.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(
    peerRobotics.extractWellfoundJobsUrl(aboutHtml),
    'https://wellfound.com/company/peer-robotics/jobs',
  )
  assert.equal(
    peerRobotics.isVerifiedWellfoundChallenge({
      status: 403,
      url: 'https://wellfound.com/company/peer-robotics/jobs',
      headers: {},
      html: wellfoundChallengeHtml,
    }),
    true,
  )
  assert.equal(
    peerRobotics.isVerifiedWellfoundChallenge({
      status: 403,
      url: 'https://wellfound.com/company/peer-robotics/jobs',
      headers: {
        server: 'cloudflare',
        'cf-mitigated': 'challenge',
      },
      html: currentWellfoundChallengeHtml,
    }),
    true,
  )
  assert.equal(
    peerRobotics.hasAccessibleWellfoundJobsSignal({
      status: 200,
      url: 'https://wellfound.com/company/peer-robotics/jobs',
      html: accessibleWellfoundBoardHtml,
    }),
    true,
  )
})

test('Peer Robotics returns no jobs while the verified Wellfound board remains challenge-gated', async () => {
  const peerRobotics = await loadPeerRoboticsModule()
  const requestedUrls = []

  const jobs = await peerRobotics.createPeerRoboticsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === peerRobotics.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === peerRobotics.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (url === peerRobotics.WELLFOUND_JOBS_URL) {
        return {
          status: 403,
          url,
          headers: {
            server: 'cloudflare',
            'cf-mitigated': 'challenge',
          },
          html: currentWellfoundChallengeHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    peerRobotics.HOMEPAGE_URL,
    peerRobotics.ABOUT_URL,
    peerRobotics.WELLFOUND_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Peer Robotics returns the live public Wellfound job when the board is readable', async () => {
  const peerRobotics = await loadPeerRoboticsModule()
  const requestedUrls = []

  const jobs = await peerRobotics.createPeerRoboticsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === peerRobotics.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === peerRobotics.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (url === peerRobotics.WELLFOUND_JOBS_URL) {
        return {
          status: 200,
          url,
          html: accessibleWellfoundBoardHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    peerRobotics.HOMEPAGE_URL,
    peerRobotics.ABOUT_URL,
    peerRobotics.WELLFOUND_JOBS_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      department: job.department,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      remoteStatus: job.remoteStatus,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      link: job.link,
    })),
    [
      {
        title: 'Senior Hardware Systems Engineer',
        location: 'Khed Shivapur, India',
        city: 'Khed Shivapur',
        country: 'India',
        department: 'Engineering',
        employmentType: 'Full Time',
        experienceRequired: '3 years of exp',
        remoteStatus: 'On-site',
        sourceUrl: 'https://wellfound.com/jobs/4457983-senior-hardware-systems-engineer',
        applyUrl: 'https://wellfound.com/jobs/4457983-senior-hardware-systems-engineer',
        link: 'https://wellfound.com/jobs/4457983-senior-hardware-systems-engineer',
      },
    ],
  )
})

test('Peer Robotics fails closed when the verified homepage, hiring handoff, or challenge gate drifts', async () => {
  const peerRobotics = await loadPeerRoboticsModule()

  await assert.rejects(
    peerRobotics.createPeerRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === peerRobotics.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Placeholder</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    peerRobotics.createPeerRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === peerRobotics.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === peerRobotics.ABOUT_URL) {
          return {
            status: 200,
            url,
            html: aboutHtml.replace(
              'https://wellfound.com/company/peer-robotics/jobs',
              'https://wellfound.com/company/peer-robotics',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /hiring handoff/i,
  )

  await assert.rejects(
    peerRobotics.createPeerRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === peerRobotics.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === peerRobotics.ABOUT_URL) {
          return { status: 200, url, html: aboutHtml }
        }

        if (url === peerRobotics.WELLFOUND_JOBS_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Peer Robotics Jobs</title></head><body><h1>Open Roles</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public jobs board/i,
  )
})
