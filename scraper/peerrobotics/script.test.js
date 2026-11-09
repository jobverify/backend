import assert from 'node:assert/strict'
import test from 'node:test'

const loadPeerRoboticsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Peer Robotics scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Peer Robotics | Collaborative Mobile Robots</title>
  </head>
  <body data-wf-domain="peerrobotics.ai">
    <p>Designed to work with humans</p>
    <p>Enabling automation using collaborative mobile robots</p>
    <p>Shaping the future of automation, with human-centric robots</p>
  </body>
</html>
`

const officialAboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Peer Robotics | Revolutionizing the Robotics Industry</title>
  </head>
  <body data-wf-domain="peerrobotics.ai">
    <h1>Innovating a manufacturing future together</h1>
    <p>At Peer Robotics, we're revolutionizing manufacturing</p>
    <p>Where is Peer Robotics based out of?</p>
    <p>We are headquartered out of the USA with our R&D center in India.</p>
    <a href="https://wellfound.com/company/peer-robotics/jobs">Join us</a>
  </body>
</html>
`

const legacyChallengePage = {
  status: 403,
  url: 'https://wellfound.com/company/peer-robotics/jobs',
  html: `
    <html>
      <body>
        <p>Please enable JS and disable any ad blocker</p>
        <iframe src="https://captcha-delivery.com/challenge"></iframe>
      </body>
    </html>
  `,
}

const currentChallengePage = {
  status: 403,
  url: 'https://wellfound.com/company/peer-robotics/jobs',
  headers: {
    server: 'cloudflare',
    'cf-mitigated': 'challenge',
  },
  html: `
    <html lang="en-US">
      <head><title>Just a moment...</title></head>
      <body>
        <p>Checking if the site connection is secure</p>
        <p>Enable JavaScript and cookies to continue</p>
        <p>Email us at team@wellfound.com if you're facing issues.</p>
        <p>Cloudflare Ray ID: a2799067ddb47e69</p>
      </body>
    </html>
  `,
}

const accessibleWellfoundBoardPage = {
  status: 200,
  url: 'https://wellfound.com/company/peer-robotics/jobs',
  html: `
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
  `,
}

test('Peer Robotics pins the verified homepage, about-page hiring handoff, and both challenge-gated Wellfound shapes', async () => {
  const peerrobotics = await loadPeerRoboticsModule()

  assert.equal(peerrobotics.SOURCE, 'peerrobotics')
  assert.equal(peerrobotics.COMPANY, 'Peer Robotics')
  assert.equal(peerrobotics.HOMEPAGE_URL, 'https://peerrobotics.ai/')
  assert.equal(peerrobotics.ABOUT_URL, 'https://peerrobotics.ai/about')
  assert.equal(peerrobotics.WELLFOUND_JOBS_URL, 'https://wellfound.com/company/peer-robotics/jobs')
  assert.equal(peerrobotics.VERIFIED_ON, '2026-08-15')
  assert.equal(peerrobotics.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(peerrobotics.hasOfficialAboutSignal(officialAboutHtml), true)
  assert.equal(
    peerrobotics.extractWellfoundJobsUrl(officialAboutHtml),
    'https://wellfound.com/company/peer-robotics/jobs',
  )
  assert.equal(peerrobotics.isVerifiedWellfoundChallenge(legacyChallengePage), true)
  assert.equal(peerrobotics.isVerifiedWellfoundChallenge(currentChallengePage), true)
  assert.equal(peerrobotics.hasAccessibleWellfoundJobsSignal(accessibleWellfoundBoardPage), true)
})

test('Peer Robotics returns an honest zero result while the Wellfound board remains challenge-gated', async () => {
  const peerrobotics = await loadPeerRoboticsModule()
  const requestedUrls = []

  const jobs = await peerrobotics.createPeerRoboticsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === peerrobotics.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === peerrobotics.ABOUT_URL) {
        return { status: 200, url, html: officialAboutHtml }
      }

      if (url === peerrobotics.WELLFOUND_JOBS_URL) {
        return currentChallengePage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    peerrobotics.HOMEPAGE_URL,
    peerrobotics.ABOUT_URL,
    peerrobotics.WELLFOUND_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Peer Robotics returns the live public Wellfound job when the board is readable', async () => {
  const peerrobotics = await loadPeerRoboticsModule()
  const requestedUrls = []

  const jobs = await peerrobotics.createPeerRoboticsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === peerrobotics.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === peerrobotics.ABOUT_URL) {
        return { status: 200, url, html: officialAboutHtml }
      }

      if (url === peerrobotics.WELLFOUND_JOBS_URL) {
        return accessibleWellfoundBoardPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    peerrobotics.HOMEPAGE_URL,
    peerrobotics.ABOUT_URL,
    peerrobotics.WELLFOUND_JOBS_URL,
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

test('Peer Robotics fails closed when the hiring handoff or blocked-board contract changes', async () => {
  const peerrobotics = await loadPeerRoboticsModule()

  await assert.rejects(
    peerrobotics.createPeerRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === peerrobotics.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === peerrobotics.ABOUT_URL) {
          return {
            status: 200,
            url,
            html: officialAboutHtml.replace(
              'https://wellfound.com/company/peer-robotics/jobs',
              'https://wellfound.com/company/peer-robotics/roles',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified hiring handoff/i,
  )

  await assert.rejects(
    peerrobotics.createPeerRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === peerrobotics.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === peerrobotics.ABOUT_URL) {
          return { status: 200, url, html: officialAboutHtml }
        }

        if (url === peerrobotics.WELLFOUND_JOBS_URL) {
          return {
            status: 200,
            url: peerrobotics.WELLFOUND_JOBS_URL,
            html: '<html><body><h1>Open Positions</h1><a href=\"/1\">Robotics Engineer</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public jobs board/i,
  )
})
