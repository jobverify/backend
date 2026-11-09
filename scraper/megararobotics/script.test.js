import assert from 'node:assert/strict'
import test from 'node:test'

const loadMegaraRoboticsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/megaraLogo.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://res.cloudinary.com" crossorigin>
    <link rel="preload" as="image" href="/megaraLogo.png">
    <link rel="preload" as="image" href="https://res.cloudinary.com/drafn6nrj/image/upload/f_auto,q_auto,w_1200/hero-poster_kgvbtu.webp" fetchpriority="high">
    <title>Megara Robotics</title>
    <script type="module" crossorigin src="/assets/index-DuEawPcq.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-CK3ECkEl.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const bundleSnippet = `
function footer(){
  return m.jsxs("div",{children:m.jsx("footer",{children:m.jsxs("div",{children:[
    m.jsx("h2",{children:"Megara Robotics"}),
    m.jsxs("p",{children:["No: 11B/14 Periyar Salai,","Ayanavaram, Chennai, India ","Phone: +91 8086673701"]}),
    m.jsx("a",{href:"https://www.linkedin.com/company/megararobotics/",children:"Linkedin"}),
    m.jsx("a",{href:"https://www.youtube.com/@megararobotics",children:"YouTube"})
  ]})})})
}
function home(){
  return m.jsxs("section",{children:[
    m.jsx("h2",{children:"Our Robots"}),
    m.jsx("p",{children:"Get in Touch"}),
    m.jsx("p",{children:"You can count on us"})
  ]})
}
function app(){
  return m.jsxs(F0,{children:[
    m.jsx(st,{path:"/",element:m.jsx(u1,{})}),
    m.jsx(st,{path:"/products",element:m.jsx(n1,{})}),
    m.jsx(st,{path:"/about",element:m.jsx(i1,{})}),
    m.jsx(st,{path:"/contact",element:m.jsx(c1,{})}),
    m.jsx(st,{path:"/wheelchair",element:m.jsx(r1,{})}),
    m.jsx(st,{path:"/warehouse",element:m.jsx(d1,{})}),
    m.jsx(st,{path:"/education",element:m.jsx(h1,{})}),
    m.jsx(st,{path:"/kerambot",element:m.jsx(M1,{})})
  ]})
}
`

test('Megara Robotics sentinel validates the verified homepage shell and bundle route contract', async () => {
  const megara = await loadMegaraRoboticsModule()
  assert.ok(megara, 'Expected Megara Robotics scraper module at ./script.js')

  assert.equal(megara.SOURCE, 'megararobotics')
  assert.equal(megara.COMPANY, 'Megara Robotics')
  assert.equal(megara.HOMEPAGE_URL, 'https://megararobotics.com/')
  assert.deepEqual(megara.CAREERS_ROUTE_URLS, [
    'https://megararobotics.com/careers',
    'https://megararobotics.com/career',
    'https://megararobotics.com/jobs',
    'https://megararobotics.com/join-us',
  ])
  assert.equal(
    megara.extractBundleAssetUrl(homepageShellHtml, megara.HOMEPAGE_URL),
    'https://megararobotics.com/assets/index-DuEawPcq.js',
  )
  assert.equal(megara.hasOfficialHomepageShellSignal(homepageShellHtml), true)
  assert.equal(megara.hasOfficialBundleSignal(bundleSnippet), true)
  assert.equal(megara.bundleHasPublicCareersSignal(bundleSnippet), false)
  assert.equal(megara.isVerifiedShellFallback(homepageShellHtml, homepageShellHtml), true)
})

test('Megara Robotics sentinel returns no jobs while careers-like routes stay on the verified app shell', async () => {
  const megara = await loadMegaraRoboticsModule()
  assert.ok(megara, 'Expected Megara Robotics scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await megara.createMegaraRoboticsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === megara.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageShellHtml,
        }
      }

      if (url === 'https://megararobotics.com/assets/index-DuEawPcq.js') {
        return {
          status: 200,
          url,
          html: bundleSnippet,
        }
      }

      if (megara.CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 200,
          url,
          html: homepageShellHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    megara.HOMEPAGE_URL,
    'https://megararobotics.com/assets/index-DuEawPcq.js',
    ...megara.CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Megara Robotics sentinel fails closed when the first-party shell or bundle starts advertising public careers', async () => {
  const megara = await loadMegaraRoboticsModule()
  assert.ok(megara, 'Expected Megara Robotics scraper module at ./script.js')

  await assert.rejects(
    megara.createMegaraRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === megara.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Megara</title></head><body><div id="root"></div></body></html>',
          }
        }

        return {
          status: 200,
          url,
          html: bundleSnippet,
        }
      },
    }),
    /official homepage shell/i,
  )

  await assert.rejects(
    megara.createMegaraRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === megara.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageShellHtml,
          }
        }

        if (url === 'https://megararobotics.com/assets/index-DuEawPcq.js') {
          return {
            status: 200,
            url,
            html: `${bundleSnippet} m.jsx(st,{path:"/careers",element:m.jsx(h1,{})})`,
          }
        }

        return {
          status: 200,
          url,
          html: homepageShellHtml,
        }
      },
    }),
    /public careers surface/i,
  )

  await assert.rejects(
    megara.createMegaraRoboticsScraper().run({
      fetchPage: async (url) => {
        if (url === megara.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageShellHtml,
          }
        }

        if (url === 'https://megararobotics.com/assets/index-DuEawPcq.js') {
          return {
            status: 200,
            url,
            html: bundleSnippet,
          }
        }

        return {
          status: 200,
          url,
          html: `
            <html>
              <head><title>Careers | Megara Robotics</title></head>
              <body>
                <h1>Open Positions</h1>
                <a href="/jobs/robotics-engineer">Apply Now</a>
              </body>
            </html>
          `,
        }
      },
    }),
    /careers routes changed materially/i,
  )
})
