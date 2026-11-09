import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AINDRA1 | Home</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="#technology">Our Technology</a>
        <a href="#careers">Careers</a>
        <a href="#blog">Blog</a>
        <a href="#contact">Contact Us</a>
      </nav>
      <h1>We are an AI powered MedTech company</h1>
      <p>At Aindra, we are building a world where Clinical Pathology is Data driven, Fast and Patient focused.</p>
    </header>

    <section id="careers">
      <h2>Join us at Aindra</h2>

      <article class="career-opening">
        <h3>Electronics Engineer</h3>
        <p class="summary">
          Are you a passionate Hands-On Electronics Engineer with 3 - 6 yrs of experience who wants to create products that change people's lives.
        </p>
        <div class="company-profile">
          <p>
            At AIndra Systems, an exciting early stage Startup based out of Bangalore, our Vision is to build world class systems to aid diagnosis of fatal diseases like cancer with the use of Artificial Intelligence.
          </p>
        </div>
        <div class="experience">
          <p>Experience: 3 - 6 yrs of experience</p>
        </div>
        <div class="key-skills">
          <h4>Key Skills</h4>
          <ul>
            <li>OrCAD</li>
            <li>Embedded Systems Design &amp; Development</li>
            <li>Electronics Design</li>
            <li>PCB Design</li>
          </ul>
        </div>
        <div class="qualification">
          <h4>Highly Desirable</h4>
          <p>MS/MTech in Electronics.</p>
        </div>
        <p class="apply">
          Please send your Details &amp; your Resume to
          <a href="mailto:contactus@aindra.in">contactus@aindra.in</a>
        </p>
      </article>

      <article class="career-opening">
        <h3>Front-end Developer</h3>
        <p class="summary">
          We at Aindra are looking for Tech Ninja's who have a drive to learn and contribute.
        </p>
        <div class="company-profile">
          <p>
            At AIndra Systems, an exciting early stage Start-Up based out of Bangalore, our Vision is to build world class systems to aid diagnosis of fatal diseases like cancer with the use of Artificial Intelligence.
          </p>
        </div>
        <div class="experience">
          <p>Experience: 3+ years' experience in frontend development</p>
        </div>
        <div class="required-skills">
          <h4>Required Skill Set</h4>
          <ul>
            <li>AngularJS, ReactJS</li>
            <li>HTML</li>
            <li>CSS</li>
          </ul>
        </div>
        <div class="qualification">
          <h4>Qualifications</h4>
          <p>Bachelor's degree or equivalent in Computer Science</p>
        </div>
        <p class="apply">
          Please send your Details &amp; your Resume to
          <a href="mailto:contactus@aindra.in">contactus@aindra.in</a>
        </p>
      </article>

      <article class="career-opening">
        <h3>Senior Software Developer</h3>
        <p class="summary">
          Are you a passionate Techie ninja with 5 - 7 yrs of experience who wants to create products that change people's lives.
        </p>
        <div class="company-profile">
          <p>
            At AIndra Systems, an exciting early stage Start-Up based out of Bangalore, our Vision is to build world class systems to aid diagnosis of fatal diseases like cancer with the use of Artificial Intelligence.
          </p>
        </div>
        <div class="experience">
          <p>Experience: 5 - 7 yrs of experience</p>
        </div>
        <div class="required-skills">
          <h4>Required Technical and Professional Expertise</h4>
          <ul>
            <li>Strong expertise in Python, Java, JEE, JSP, Servlets, JDBC, XML, Spring Framework, Hibernate, MVC, SQL, REST APIs, JAX-RS, Web Services &amp; design patterns</li>
            <li>Hands-on experience in Mysql or Postgres with excellent understanding of SQL queries, stored procedure, DB Design etc</li>
            <li>Hands-on experience in Tomcat and JBoss</li>
          </ul>
        </div>
        <div class="qualification">
          <h4>Highly Desirable</h4>
          <p>BS/BTech/MS/MTech (or equivalent degrees) in Computer Science or related technical disciplines</p>
        </div>
        <p class="apply">
          Please send your Details &amp; your Resume to
          <a href="mailto:contactus@aindra.in">contactus@aindra.in</a>
        </p>
      </article>
    </section>

    <section id="contact">
      <p>(+91) 95828 78299</p>
      <p><a href="mailto:contactus@aindra.in">contactus@aindra.in</a></p>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/aindrasystems/script.js')
  } catch {
    assert.fail('Expected Aindra Systems scraper module at ../../scraper/aindrasystems/script.js')
  }
}

test('Aindra Systems scraper pins the verified first-party homepage careers surface and extracts role cards', async () => {
  const aindra = await loadModule()

  assert.equal(aindra.SOURCE, 'aindrasystems')
  assert.equal(aindra.COMPANY, 'Aindra Systems')
  assert.equal(aindra.HOMEPAGE_URL, 'https://www.aindra.in/')
  assert.deepEqual(aindra.CANDIDATE_HOMEPAGE_URLS, [
    'https://www.aindra.in/',
    'https://aindra.in/',
  ])
  assert.equal(aindra.APPLICATION_EMAIL, 'contactus@aindra.in')
  assert.equal(aindra.APPLICATION_URL, 'mailto:contactus@aindra.in')
  assert.equal(aindra.isTrustedUnavailableFailure(new Error('getaddrinfo ENOTFOUND www.aindra.in')), true)
  assert.equal(
    aindra.isTrustedUnavailableFailure(
      new Error('unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca'),
    ),
    true,
  )
  assert.equal(aindra.hasOfficialHomepageSignal(homepageHtml), true)

  const openings = aindra.extractOpenings(homepageHtml)

  assert.equal(openings.length, 3)
  assert.deepEqual(openings[0], {
    title: 'Electronics Engineer',
    company: 'Aindra Systems',
    department: null,
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'aindrasystems-electronics-engineer',
    requisitionId: 'aindrasystems-electronics-engineer',
    sourceUrl: 'https://www.aindra.in/',
    applyUrl: 'mailto:contactus@aindra.in',
    employmentType: null,
    experienceRequired: '3 - 6 yrs of experience',
    minimumQualification: 'MS/MTech in Electronics.',
    preferredQualification: null,
    requiredSkills: [
      'OrCAD',
      'Embedded Systems Design & Development',
      'Electronics Design',
      'PCB Design',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription:
      "Are you a passionate Hands-On Electronics Engineer with 3 - 6 yrs of experience who wants to create products that change people's lives. At AIndra Systems, an exciting early stage Startup based out of Bangalore, our Vision is to build world class systems to aid diagnosis of fatal diseases like cancer with the use of Artificial Intelligence. Apply via contactus@aindra.in.",
  })
  assert.deepEqual(openings[1], {
    title: 'Front-end Developer',
    company: 'Aindra Systems',
    department: null,
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'aindrasystems-front-end-developer',
    requisitionId: 'aindrasystems-front-end-developer',
    sourceUrl: 'https://www.aindra.in/',
    applyUrl: 'mailto:contactus@aindra.in',
    employmentType: null,
    experienceRequired: "3+ years' experience in frontend development",
    minimumQualification: "Bachelor's degree or equivalent in Computer Science",
    preferredQualification: null,
    requiredSkills: [
      'AngularJS, ReactJS',
      'HTML',
      'CSS',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription:
      "We at Aindra are looking for Tech Ninja's who have a drive to learn and contribute. At AIndra Systems, an exciting early stage Start-Up based out of Bangalore, our Vision is to build world class systems to aid diagnosis of fatal diseases like cancer with the use of Artificial Intelligence. Apply via contactus@aindra.in.",
  })
  assert.deepEqual(openings[2], {
    title: 'Senior Software Developer',
    company: 'Aindra Systems',
    department: null,
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'aindrasystems-senior-software-developer',
    requisitionId: 'aindrasystems-senior-software-developer',
    sourceUrl: 'https://www.aindra.in/',
    applyUrl: 'mailto:contactus@aindra.in',
    employmentType: null,
    experienceRequired: '5 - 7 yrs of experience',
    minimumQualification:
      'BS/BTech/MS/MTech (or equivalent degrees) in Computer Science or related technical disciplines',
    preferredQualification: null,
    requiredSkills: [
      'Strong expertise in Python, Java, JEE, JSP, Servlets, JDBC, XML, Spring Framework, Hibernate, MVC, SQL, REST APIs, JAX-RS, Web Services & design patterns',
      'Hands-on experience in Mysql or Postgres with excellent understanding of SQL queries, stored procedure, DB Design etc',
      'Hands-on experience in Tomcat and JBoss',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription:
      "Are you a passionate Techie ninja with 5 - 7 yrs of experience who wants to create products that change people's lives. At AIndra Systems, an exciting early stage Start-Up based out of Bangalore, our Vision is to build world class systems to aid diagnosis of fatal diseases like cancer with the use of Artificial Intelligence. Apply via contactus@aindra.in.",
  })
})

test('Aindra Systems extracts the current first-party modal careers card', async () => {
  const aindra = await loadModule()
  const openings = aindra.extractOpenings(`
    <html><head><title>AINDRA1 | Home</title></head><body>
      <a href="#careers">Careers</a>
      <p>We are an AI powered MedTech company</p><h2>Join us at Aindra</h2>
      <p>contactus@aindra.in</p>
      <div class="blogDiv careers" data-target="#myModal3"><p><b>Senior Software Developer</b></p></div>
      <div id="myModal3"><div class="modal-body">
        <p>Are you a passionate engineer with 3 - 6 yrs of experience?</p>
        <p>Company Profile:</p><p>Aindra Systems is based out of Bangalore.</p>
        <li>JavaScript</li><li>Node.js</li>
      </div></div>
    </body></html>
  `)

  assert.deepEqual(openings.map((job) => ({
    title: job.title,
    location: job.location,
    experienceRequired: job.experienceRequired,
    applyUrl: job.applyUrl,
  })), [{
    title: 'Senior Software Developer',
    location: 'Bangalore, Karnataka, India',
    experienceRequired: '3 - 6 yrs',
    applyUrl: 'mailto:contactus@aindra.in',
  }])
})

test('Aindra Systems run validates the verified homepage and decorates the extracted openings', async () => {
  const aindra = await loadModule()
  const requestedUrls = []

  const jobs = await aindra.createAindraSystemsScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aindra.HOMEPAGE_URL) {
        return homepageHtml
      }

      throw new Error(`Unexpected Aindra Systems URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aindra.HOMEPAGE_URL,
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Electronics Engineer',
        source: 'aindrasystems',
        link: 'mailto:contactus@aindra.in',
        scrapedAt: '2026-07-14T00:00:00.000Z',
      },
      {
        title: 'Front-end Developer',
        source: 'aindrasystems',
        link: 'mailto:contactus@aindra.in',
        scrapedAt: '2026-07-14T00:00:00.000Z',
      },
      {
        title: 'Senior Software Developer',
        source: 'aindrasystems',
        link: 'mailto:contactus@aindra.in',
        scrapedAt: '2026-07-14T00:00:00.000Z',
      },
    ],
  )
})

test('Aindra Systems fails closed when the verified homepage careers surface drifts', async () => {
  const aindra = await loadModule()

  await assert.rejects(
    aindra.createAindraSystemsScraper().run({
      fetchText: async () => '<html><head><title>AINDRA1 | Home</title></head><body><h1>Home</h1></body></html>',
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aindra.createAindraSystemsScraper().run({
      fetchText: async () => homepageHtml.replaceAll('contactus@aindra.in', 'careers@example.com'),
    }),
    /verified official homepage/i,
  )
})

test('Aindra Systems can recover with a browser-backed homepage when direct requests fail', async () => {
  const aindra = await loadModule()
  const browserUrls = []

  const jobs = await aindra.createAindraSystemsScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return homepageHtml
    },
  })

  assert.deepEqual(browserUrls, [aindra.HOMEPAGE_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'aindrasystems')
})

test('Aindra Systems can recover from the legacy www host failing when the bare first-party host still serves the verified homepage', async () => {
  const aindra = await loadModule()
  const requestedUrls = []

  const jobs = await aindra.createAindraSystemsScraper({
    now: () => '2026-07-28T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === 'https://www.aindra.in/') {
        throw new Error('getaddrinfo ENOTFOUND www.aindra.in')
      }

      if (url === 'https://aindra.in/') {
        return homepageHtml
      }

      throw new Error(`Unexpected Aindra Systems URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.aindra.in/',
    'https://aindra.in/',
  ])
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every((job) => job.sourceUrl === 'https://aindra.in/'))
  assert.ok(jobs.every((job) => job.scrapedAt === '2026-07-28T00:00:00.000Z'))
})

test('Aindra Systems stays fail-closed while trusted first-party host variants remain unavailable', async () => {
  const aindra = await loadModule()
  const browserUrls = []

  const jobs = await aindra.createAindraSystemsScraper().run({
    fetchText: async (url) => {
      if (url === 'https://www.aindra.in/') {
        throw new Error('getaddrinfo ENOTFOUND www.aindra.in')
      }

      if (url === 'https://aindra.in/') {
        throw new Error('unable to verify the first certificate')
      }

      throw new Error(`Unexpected Aindra Systems URL: ${url}`)
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)

      if (url === 'https://www.aindra.in/') {
        throw new Error('net::ERR_FAILED at https://www.aindra.in/')
      }

      if (url === 'https://aindra.in/') {
        throw new Error('net::ERR_CERT_AUTHORITY_INVALID at https://aindra.in/')
      }

      throw new Error(`Unexpected browser-backed Aindra Systems URL: ${url}`)
    },
  })

  assert.deepEqual(browserUrls, [])
  assert.deepEqual(jobs, [])
})

test('Aindra Systems treats first-party browser timeouts as trusted host unavailability', async () => {
  const aindra = await loadModule()
  const browserUrls = []

  const jobs = await aindra.createAindraSystemsScraper().run({
    fetchText: async (url) => {
      if (url === 'https://www.aindra.in/') {
        throw new Error('getaddrinfo ENOTFOUND www.aindra.in')
      }

      if (url === 'https://aindra.in/') {
        throw new TypeError('fetch failed')
      }

      throw new Error(`Unexpected Aindra Systems URL: ${url}`)
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)

      if (url === 'https://www.aindra.in/') {
        throw new Error('net::ERR_FAILED at https://www.aindra.in/')
      }

      if (url === 'https://aindra.in/') {
        throw new Error('net::ERR_CONNECTION_TIMED_OUT at https://aindra.in/')
      }

      throw new Error(`Unexpected browser-backed Aindra Systems URL: ${url}`)
    },
  })

  assert.deepEqual(browserUrls, [
    'https://aindra.in/',
  ])
  assert.deepEqual(jobs, [])
})

test('Aindra Systems does not launch a browser fallback when trusted first-party hosts are unavailable', async () => {
  const aindra = await loadModule()
  const browserUrls = []

  const jobs = await aindra.createAindraSystemsScraper().run({
    fetchText: async (url) => {
      if (url === 'https://www.aindra.in/') {
        throw new Error('getaddrinfo ENOTFOUND www.aindra.in')
      }

      if (url === 'https://aindra.in/') {
        throw new Error('unable to verify the first certificate')
      }

      throw new Error(`Unexpected Aindra Systems URL: ${url}`)
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return homepageHtml
    },
  })

  assert.deepEqual(browserUrls, [])
  assert.deepEqual(jobs, [])
})

test('Aindra Systems default fetch probes trusted unavailable first-party hosts only once each before failing closed', async () => {
  const aindra = await loadModule()
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const originalConsoleWarn = console.warn
  const attemptsByUrl = new Map()

  globalThis.setTimeout = (callback) => {
    callback()
    return 0
  }
  globalThis.clearTimeout = () => {}
  console.warn = () => {}
  globalThis.fetch = async (url) => {
    const normalizedUrl = String(url)
    const nextAttempt = (attemptsByUrl.get(normalizedUrl) || 0) + 1
    attemptsByUrl.set(normalizedUrl, nextAttempt)

    if (normalizedUrl === 'https://www.aindra.in/') {
      throw new Error('getaddrinfo ENOTFOUND www.aindra.in')
    }

    if (normalizedUrl === 'https://aindra.in/') {
      throw new Error('unable to verify the first certificate')
    }

    throw new Error(`Unexpected Aindra Systems URL: ${normalizedUrl}`)
  }

  try {
    const jobs = await aindra.createAindraSystemsScraper().run()
    assert.deepEqual(jobs, [])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    console.warn = originalConsoleWarn
  }

  assert.equal(attemptsByUrl.get('https://www.aindra.in/'), 1)
  assert.equal(attemptsByUrl.get('https://aindra.in/'), 1)
  assert.equal(attemptsByUrl.size, 2)
})
