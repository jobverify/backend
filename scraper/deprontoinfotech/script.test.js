import assert from 'node:assert/strict'
import test from 'node:test'

const loadDeProntoModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected DePronto InfoTech scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
    <link href="https://fonts.cdnfonts.com/css/metropolis-2" rel="stylesheet" />
    <title>DePronto Infotech</title>
    <link rel="manifest" href="./manifest.json" />
    <script defer="defer" src="./static/js/main.f833c8ff.js"></script>
    <link href="./static/css/main.67f5e015.css" rel="stylesheet">
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`

const bundleText = `
  to:"#/home"
  to:"#/about"
  to:"#/careers"
  to:"#/contact"
  children:"Careers at DePronto Infotech"
  children:"Our team is the best around. Think you can make it even better? We\\u2019re always looking for the best talent \\u2013 if that\\u2019s you, get in touch today."
  children:"Career Opportunities"
  children:"Start your career journey at DePronto"
  children:"If you think you\\u2019re the right fit for DePronto, email us your resume today at hr@depronto.co.uk."
  children:"DePronto Infotech"
  children:"Surat | Mumbai"
  children:"India"
  {cardheading:"Solution Architect",Caedcontain:"Are you the expert we need to effectively lead teams developing new web applications for a varied range of international clients? Do you have the vision required to solve challenging problems and produce practical solutions? We want to hear from the best solution architects around \\u2013 is that you?"},
  {cardheading:"Designer",Caedcontain:"Have you got an eye for design? Do you love creating attractive yet functional websites that enhance the user experience? And are you looking to work with international businesses demanding only the best from their software designers? We\\u2019re always looking for talented designers with a creative spark to join our team."},
  {cardheading:"QA Engineer",Caedcontain:"If you\\u2019ve got an unflinching desire for perfection and an unerring need to make the best even better, you could be the QA engineer we\\u2019re looking for. Join us to work on a wide range of projects, designing testing mechanisms to ensure only the highest quality software is delivered to our many demanding clients."},
  {cardheading:"Data Engineer",Caedcontain:"Are you an experienced data expert with a desire to work with other top talents? Do you know the ins and outs of SQL? And do you love working with data architecture, data systems, and data processing? If so, you\\u2019re exactly the type of data engineer we\\u2019re looking for, so send us your CV today."},
  {cardheading:"Project Manager",Caedcontain:"Multi-faceted software development projects require strong leadership and organisation from skilled project managers. If you\\u2019ve got experience managing the scope, quality, and schedule of complex software development projects, you\\u2019re exactly the type of project manager we need, so get in touch today."},
  {cardheading:"Software Engineer",Caedcontain:"We\\u2019re always looking for talented software engineers to work on a wide variety of projects, with clients from around the world. If you love nothing better than designing top-notch software for businesses in a diverse range of industries and niches, we\\u2019re looking for you, so get in touch with us today!"},
  {cardheading:"Solution Architect",Caedcontain:"Are you the expert we need to effectively lead teams developing new web applications for a varied range of international clients? Do you have the vision required to solve challenging problems and produce practical solutions? We want to hear from the best solution architects around \\u2013 is that you?"},
  {cardheading:"Designer",Caedcontain:"Have you got an eye for design? Do you love creating attractive yet functional websites that enhance the user experience? And are you looking to work with international businesses demanding only the best from their software designers? We\\u2019re always looking for talented designers with a creative spark to join our team."}
`

test('DePronto InfoTech helpers stay pinned to the verified homepage shell and bundled careers cards', async () => {
  const depronto = await loadDeProntoModule()

  assert.equal(depronto.SOURCE, 'deprontoinfotech')
  assert.equal(depronto.COMPANY, 'DePronto InfoTech')
  assert.equal(depronto.HOMEPAGE_URL, 'https://deprontoinfotech.com/')
  assert.equal(depronto.CAREERS_URL, 'https://deprontoinfotech.com/#/careers')
  assert.equal(depronto.APPLICATION_EMAIL, 'hr@depronto.co.uk')
  assert.equal(depronto.APPLICATION_URL, 'mailto:hr@depronto.co.uk')
  assert.equal(depronto.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(depronto.extractBundleAssetPath(homepageHtml), './static/js/main.f833c8ff.js')
  assert.equal(depronto.hasVerifiedBundleSignal(bundleText), true)
  assert.deepEqual(
    depronto.extractCareerCards(bundleText),
    [
      {
        title: 'Solution Architect',
        jobDescription: 'Are you the expert we need to effectively lead teams developing new web applications for a varied range of international clients? Do you have the vision required to solve challenging problems and produce practical solutions? We want to hear from the best solution architects around - is that you?',
      },
      {
        title: 'Designer',
        jobDescription: 'Have you got an eye for design? Do you love creating attractive yet functional websites that enhance the user experience? And are you looking to work with international businesses demanding only the best from their software designers? We\'re always looking for talented designers with a creative spark to join our team.',
      },
      {
        title: 'QA Engineer',
        jobDescription: 'If you\'ve got an unflinching desire for perfection and an unerring need to make the best even better, you could be the QA engineer we\'re looking for. Join us to work on a wide range of projects, designing testing mechanisms to ensure only the highest quality software is delivered to our many demanding clients.',
      },
      {
        title: 'Data Engineer',
        jobDescription: 'Are you an experienced data expert with a desire to work with other top talents? Do you know the ins and outs of SQL? And do you love working with data architecture, data systems, and data processing? If so, you\'re exactly the type of data engineer we\'re looking for, so send us your CV today.',
      },
      {
        title: 'Project Manager',
        jobDescription: 'Multi-faceted software development projects require strong leadership and organisation from skilled project managers. If you\'ve got experience managing the scope, quality, and schedule of complex software development projects, you\'re exactly the type of project manager we need, so get in touch today.',
      },
      {
        title: 'Software Engineer',
        jobDescription: 'We\'re always looking for talented software engineers to work on a wide variety of projects, with clients from around the world. If you love nothing better than designing top-notch software for businesses in a diverse range of industries and niches, we\'re looking for you, so get in touch with us today!',
      },
    ],
  )
})

test('DePronto InfoTech run validates the verified homepage shell and bundle, then decorates six public role cards', async () => {
  const depronto = await loadDeProntoModule()
  const requestedUrls = []

  const jobs = await depronto.createDeProntoInfoTechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === depronto.HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === 'https://deprontoinfotech.com/static/js/main.f833c8ff.js') {
        return bundleText
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://deprontoinfotech.com/',
    'https://deprontoinfotech.com/static/js/main.f833c8ff.js',
  ])
  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      country: job.country,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      link: job.link,
      scrapedAt: job.scrapedAt,
      publicExperienceChecked: job.publicExperienceChecked,
    })),
    [
      {
        title: 'Solution Architect',
        company: 'DePronto InfoTech',
        country: 'India',
        jobId: 'deprontoinfotech-solution-architect',
        sourceUrl: 'https://deprontoinfotech.com/#/careers',
        applyUrl: 'mailto:hr@depronto.co.uk',
        link: 'mailto:hr@depronto.co.uk',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        publicExperienceChecked: true,
      },
      {
        title: 'Designer',
        company: 'DePronto InfoTech',
        country: 'India',
        jobId: 'deprontoinfotech-designer',
        sourceUrl: 'https://deprontoinfotech.com/#/careers',
        applyUrl: 'mailto:hr@depronto.co.uk',
        link: 'mailto:hr@depronto.co.uk',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        publicExperienceChecked: true,
      },
      {
        title: 'QA Engineer',
        company: 'DePronto InfoTech',
        country: 'India',
        jobId: 'deprontoinfotech-qa-engineer',
        sourceUrl: 'https://deprontoinfotech.com/#/careers',
        applyUrl: 'mailto:hr@depronto.co.uk',
        link: 'mailto:hr@depronto.co.uk',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        publicExperienceChecked: true,
      },
      {
        title: 'Data Engineer',
        company: 'DePronto InfoTech',
        country: 'India',
        jobId: 'deprontoinfotech-data-engineer',
        sourceUrl: 'https://deprontoinfotech.com/#/careers',
        applyUrl: 'mailto:hr@depronto.co.uk',
        link: 'mailto:hr@depronto.co.uk',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        publicExperienceChecked: true,
      },
      {
        title: 'Project Manager',
        company: 'DePronto InfoTech',
        country: 'India',
        jobId: 'deprontoinfotech-project-manager',
        sourceUrl: 'https://deprontoinfotech.com/#/careers',
        applyUrl: 'mailto:hr@depronto.co.uk',
        link: 'mailto:hr@depronto.co.uk',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        publicExperienceChecked: true,
      },
      {
        title: 'Software Engineer',
        company: 'DePronto InfoTech',
        country: 'India',
        jobId: 'deprontoinfotech-software-engineer',
        sourceUrl: 'https://deprontoinfotech.com/#/careers',
        applyUrl: 'mailto:hr@depronto.co.uk',
        link: 'mailto:hr@depronto.co.uk',
        scrapedAt: '2026-07-11T00:00:00.000Z',
        publicExperienceChecked: true,
      },
    ],
  )
  assert.match(jobs[3].jobDescription, /ins and outs of SQL/i)
  assert.equal(jobs[0].location, 'India')
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].remoteStatus, null)
})

test('DePronto InfoTech run fails closed when the verified homepage shell, client bundle, or role-card set drifts', async () => {
  const depronto = await loadDeProntoModule()

  await assert.rejects(
    depronto.createDeProntoInfoTechScraper().run({
      fetchText: async (url) => {
        if (url === depronto.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    depronto.createDeProntoInfoTechScraper().run({
      fetchText: async (url) => {
        if (url === depronto.HOMEPAGE_URL) {
          return homepageHtml
        }

        if (url === 'https://deprontoinfotech.com/static/js/main.f833c8ff.js') {
          return 'to:"#/home"'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers bundle/i,
  )

  await assert.rejects(
    depronto.createDeProntoInfoTechScraper().run({
      fetchText: async (url) => {
        if (url === depronto.HOMEPAGE_URL) {
          return homepageHtml
        }

        if (url === 'https://deprontoinfotech.com/static/js/main.f833c8ff.js') {
          return bundleText.replace('{cardheading:"Software Engineer"', '{cardheading:"DevOps Engineer"')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public role cards/i,
  )
})
