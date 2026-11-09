import assert from 'node:assert/strict'
import test from 'node:test'

const loadAatralModule = async () => {
  try {
    return await import('../../scraper/aatral/script.js')
  } catch {
    assert.fail('Expected Aatral scraper module at ../../scraper/aatral/script.js')
  }
}

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Aatral | Enterprise XR, VR and AR Solutions</title>
    <meta
      name="description"
      content="Aatral builds enterprise XR, VR and AR solutions for immersive training, smart guidance, simulation, inspection, digital twins, and industrial workforce performance."
    />
    <link rel="canonical" href="https://aatral.io/" />
    <script type="application/ld+json">
      [{"@context":"https://schema.org","@type":"Organization","name":"Aatral","sameAs":["https://www.linkedin.com/company/aatral-io"]}]
    </script>
  </head>
  <body>
    <header class="site-header">
      <nav id="primary-nav">
        <a href="/careers/">Careers</a>
        <a href="/about/">About</a>
        <a href="/contact/">Contact</a>
      </nav>
    </header>
    <main>
      <h1>Aatral</h1>
      <p>Aatral builds enterprise XR, VR and AR solutions.</p>
      <a href="/products/safetizen/">Safetizen</a>
      <a href="/products/kriyater-360/">Kriyater 360</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers at Aatral | Aatral</title>
    <meta
      name="description"
      content="Explore careers and opportunities at Aatral across enterprise XR, VR, AR, AI, simulators, experience centers and inspection platforms."
    />
    <link rel="canonical" href="https://aatral.io/careers/" />
  </head>
  <body>
    <main class="page-shell">
      <header class="article-header">
        <p class="eyebrow">Join Aatral</p>
        <h1>Careers in enterprise XR, VR and AR</h1>
        <p>Help build practical immersive technology for industrial, defence, aerospace, safety, and enterprise operations.</p>
      </header>
      <section class="career-grid" aria-label="Open careers">
        <article class="career-card">
          <h2>Build Enterprise XR with Aatral</h2>
          <p>Share your profile with Aatral for future opportunities across XR, VR, AR, AI, simulation, product, and enterprise delivery.</p>
          <div class="career-meta">
            <span>Chennai, India</span>
            <span>General application</span>
          </div>
          <div class="cta-row">
            <a class="button" href="/careers/general-application/">View opportunity</a>
            <a class="button primary" href="mailto:hr@aatral.io?subject=Application%3A%20Build%20Enterprise%20XR%20with%20Aatral">Send resume</a>
          </div>
        </article>
      </section>
    </main>
  </body>
</html>
`

const detailHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Build Enterprise XR with Aatral | Aatral</title>
    <meta
      name="description"
      content="Share your profile with Aatral for future opportunities across XR, VR, AR, AI, simulation, product, and enterprise delivery."
    />
    <link rel="canonical" href="https://aatral.io/careers/general-application/" />
  </head>
  <body>
    <main class="page-shell">
      <article class="career-detail">
        <header class="article-header">
          <p class="eyebrow">Career opportunity</p>
          <h1>Build Enterprise XR with Aatral</h1>
          <p>Share your profile with Aatral for future opportunities across XR, VR, AR, AI, simulation, product, and enterprise delivery.</p>
          <div class="career-meta">
            <span>Chennai, India</span>
            <span>General application</span>
            <time dateTime="2026-06-07">Published: 7 June 2026</time>
          </div>
        </header>
        <section class="content-section rich-content">
          <h2>Work with Aatral</h2>
          <p>We welcome profiles from people interested in building practical immersive technology for industrial, defence, aerospace, safety, and enterprise operations.</p>
        </section>
        <a class="button primary" href="mailto:hr@aatral.io?subject=Application%3A%20Build%20Enterprise%20XR%20with%20Aatral">Email resume to hr@aatral.io</a>
      </article>
    </main>
  </body>
</html>
`

test('Aatral scraper pins the verified homepage, careers page, and first-party opportunity detail', async () => {
  const aatral = await loadAatralModule()

  assert.equal(aatral.SOURCE, 'aatral')
  assert.equal(aatral.COMPANY, 'Aatral')
  assert.equal(aatral.VERIFIED_AT, '2026-07-14')
  assert.equal(aatral.HOMEPAGE_URL, 'https://aatral.io/')
  assert.equal(aatral.CAREERS_URL, 'https://aatral.io/careers/')
  assert.equal(aatral.GENERAL_APPLICATION_URL, 'https://aatral.io/careers/general-application/')

  assert.equal(aatral.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aatral.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(aatral.hasOfficialOpportunityPageSignal(detailHtml), true)
  assert.deepEqual(aatral.extractCareerCards(careersHtml), [
    {
      title: 'Build Enterprise XR with Aatral',
      summary:
        'Share your profile with Aatral for future opportunities across XR, VR, AR, AI, simulation, product, and enterprise delivery.',
      location: 'Chennai, India',
      opportunityType: 'General application',
      sourceUrl: 'https://aatral.io/careers/general-application/',
      applyUrl: 'mailto:hr@aatral.io?subject=Application%3A%20Build%20Enterprise%20XR%20with%20Aatral',
      jobId: 'general-application',
    },
  ])
  assert.deepEqual(aatral.extractOpportunityDetail(detailHtml), {
    title: 'Build Enterprise XR with Aatral',
    summary:
      'Share your profile with Aatral for future opportunities across XR, VR, AR, AI, simulation, product, and enterprise delivery.',
    location: 'Chennai, India',
    opportunityType: 'General application',
    postingDate: '2026-06-07',
    description:
      'Work with Aatral We welcome profiles from people interested in building practical immersive technology for industrial, defence, aerospace, safety, and enterprise operations.',
    applyUrl: 'mailto:hr@aatral.io?subject=Application%3A%20Build%20Enterprise%20XR%20with%20Aatral',
  })
})

test('Aatral run returns normalized India jobs from the official first-party careers surface', async () => {
  const aatral = await loadAatralModule()
  const requestedUrls = []

  const jobs = await aatral.createAatralScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aatral.HOMEPAGE_URL) return homepageHtml
      if (url === aatral.CAREERS_URL) return careersHtml
      if (url === aatral.GENERAL_APPLICATION_URL) return detailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aatral.HOMEPAGE_URL,
    aatral.CAREERS_URL,
    aatral.GENERAL_APPLICATION_URL,
  ])
  assert.deepEqual(jobs, [
    {
      jobId: 'general-application',
      requisitionId: 'general-application',
      title: 'Build Enterprise XR with Aatral',
      company: 'Aatral',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      link: 'https://aatral.io/careers/general-application/',
      applyUrl: 'mailto:hr@aatral.io?subject=Application%3A%20Build%20Enterprise%20XR%20with%20Aatral',
      sourceUrl: 'https://aatral.io/careers/general-application/',
      source: 'aatral',
      employmentType: null,
      experienceRequired: null,
      jobDescription:
        'Work with Aatral We welcome profiles from people interested in building practical immersive technology for industrial, defence, aerospace, safety, and enterprise operations.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-07',
      closingDate: null,
      scrapedAt: '2026-07-14T00:00:00.000Z',
    },
  ])
})

test('Aatral fails closed when the homepage, careers page, or opportunity detail drifts', async () => {
  const aatral = await loadAatralModule()

  await assert.rejects(
    aatral.createAatralScraper().run({
      fetchText: async (url) => {
        if (url === aatral.HOMEPAGE_URL) {
          return '<html><head><title>Aatral</title></head><body><h1>Home</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aatral.createAatralScraper().run({
      fetchText: async (url) => {
        if (url === aatral.HOMEPAGE_URL) return homepageHtml
        if (url === aatral.CAREERS_URL) {
          return '<html><head><title>Careers</title></head><body><h1>Jobs</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    aatral.createAatralScraper().run({
      fetchText: async (url) => {
        if (url === aatral.HOMEPAGE_URL) return homepageHtml
        if (url === aatral.CAREERS_URL) return careersHtml
        if (url === aatral.GENERAL_APPLICATION_URL) {
          return '<html><head><title>Build Enterprise XR with Aatral | Aatral</title></head><body><h1>Build Enterprise XR with Aatral</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified opportunity detail/i,
  )
})
