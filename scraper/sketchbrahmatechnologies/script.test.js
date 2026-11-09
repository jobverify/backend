import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Sketch Brahma: UI UX Design Company | Front-end Web Development | Mobile App Development</title>
    <script src="/_next/static/BUILD123/_buildManifest.js" defer=""></script>
  </head>
  <body>
    <nav>
      <a href="/careers/">Careers</a>
    </nav>
    <a href="https://www.linkedin.com/company/sketchbrahma">LinkedIn</a>
    <footer>© 2026 Sketch Brahma Technologies Pvt Ltd</footer>
  </body>
</html>
`

const BUILD_MANIFEST_JS = `
self.__BUILD_MANIFEST=function(){
  return {
    "/careers":[
      "static/chunks/4507-f330f37e2c05d905.js",
      "static/css/79c7a53c87a96f72.css",
      "static/chunks/pages/careers-b57c76d71d4a2bdf.js"
    ]
  }
}();
`

const CAREERS_BUNDLE_JS = `
let k=[
  {id:1,role:"Design",Openings:"1 openings"},
  {id:2,role:"Development",Openings:"2 openings"},
  {id:3,role:"Quality Analyst",Openings:"1 openings"},
  {id:4,role:"Sales/Business",Openings:"1 openings"},
  {id:5,role:"IT Recruiter",Openings:"1 openings"}
],w=[
  {
    role:"UI/UX Designer",
    location:"Bangalore",
    experience:"2 - 5",
    responsibilities:[
      "Set design requirements based on information from internal and external teams and user research.",
      "Present product design ideas to cross-functional teams and senior leadership."
    ],
    requirement:[
      "Must have at least 1+ years experience in web and mobile application design.",
      "Creative problem-solving skills."
    ],
    skills:[
      "Proficiency in Sketch, Figma, Adobe XD, Illustrator or any Visual design tools.",
      "Excellent communication skills and the ability to clearly articulate design decisions."
    ],
    linkTo:"https://labs.sketchbrahma.com/apply.php?t=2e9d89585f65604d7e81600ab1babef0a2aa240a039b67759c77fb6bdd37b6df"
  }
],S=[
  {
    role:"React Js Developer",
    location:"Bangalore",
    experience:"2+",
    responsibilities:[
      "Develop high quality Javascript (ES6) code for our React applications.",
      "Coordinate with backend engineers to establish JSON-based APIs."
    ],
    requirement:[
      "Must have 2+ years of experience in web application development.",
      "Strong experience in React, JavaScript, ES6, CSS3."
    ],
    linkTo:"https://labs.sketchbrahma.com/apply.php?t=1d251aa0868a2acdc1c5d51778e3353139e22295bb74e668d2efe9acdef171e4"
  },
  {
    role:"Node Js Developer",
    location:"Bangalore",
    experience:"2+",
    responsibilities:[
      "Develop high quality Javascript (ES6) code for our Node.js applications.",
      "Coordinate with the engineering team to accomplish tasks on agile processes."
    ],
    requirement:[
      "Must have 2+ years of experience in web application development",
      "Excellent working knowledge of JavaScript including depth understanding of Node.JS, Express.JS."
    ],
    linkTo:"https://labs.sketchbrahma.com/apply.php?t=52776cc36e57d91feeea9d13740fca42320fcd43edaa818dda8e6d5f5d682f2f"
  }
],N=[
  {
    role:"Sales Representative",
    location:"Bangalore",
    experience:"2+",
    responsibilities:[
      "Min 2+ years in sales of Software Products and Services.",
      "Good understanding such as Linkedin Sales Navigator, CRM Tools, Apollo.ai"
    ],
    requirement:[
      "Excellent written and verbal communication."
    ],
    linkTo:"https://labs.sketchbrahma.com/apply.php?t=bacc12dd252ea7a93a4a6cf97b9451f57f9abd4c903b1b458ec4a13ac51fb5ed"
  }
],_=[
  {
    role:"IT Recruiter",
    location:"Bangalore",
    experience:"1 - 3",
    responsibilities:[
      "Candidates must have minimum 1+ years experience in IT Recruitment.",
      "Review and understand technical job requirements."
    ],
    linkTo:"https://labs.sketchbrahma.com/apply.php?t=32e8bbe132c772f2c613ada2541e56d0e661a88c090c485f00f9677607401128"
  }
],C=[
  {
    role:"Quality Analyst",
    location:"Bangalore",
    experience:"1.5+",
    responsibilities:[
      "Test Planning and Execution: Develop comprehensive test plans and strategies based on project requirements and specifications.",
      "Defect Management: Identify, document, and track software defects using the designated bug tracking system."
    ],
    skills:[
      "Knowledge & project exposure on POSTMAN API, Automation Testing, Cucumber framework, rest assured, Manual testing",
      "Strong understanding of software development life cycle (SDLC) and software testing methodologies."
    ],
    linkTo:"https://labs.sketchbrahma.com/apply.php?t=837c89fd5aaa0f2e3f5d22388b47f7ed86114b1f49245a5bf3b3931c204aebe8"
  }
];
"Available opportunities";
"Sketch Brahma: Career | UI UX Jobs| Front-end jobs | Back-end Jobs | Mobile App Jobs";
JSON.stringify({
  "@context":"https://schema.org",
  "@type":"Organization",
  name:"Sketch Brahma Technologies",
  url:"https://sketchbrahma.com/"
});
`

const loadModule = async () => {
  try {
    return await import('../sketchbrahmatechnologies/script.js')
  } catch {
    assert.fail('Expected Sketch Brahma Technologies scraper module at ../sketchbrahmatechnologies/script.js')
  }
}

test('Sketch Brahma Technologies validates the official homepage shell and careers bundle contract', async () => {
  const sketchBrahma = await loadModule()

  assert.equal(sketchBrahma.SOURCE, 'sketchbrahmatechnologies')
  assert.equal(sketchBrahma.COMPANY, 'Sketch Brahma Technologies')
  assert.equal(sketchBrahma.HOMEPAGE_URL, 'https://www.sketchbrahma.com/')
  assert.equal(sketchBrahma.CAREERS_URL, 'https://www.sketchbrahma.com/careers')

  assert.equal(sketchBrahma.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(
    sketchBrahma.extractBuildManifestUrlFromHomepage(HOMEPAGE_HTML),
    'https://www.sketchbrahma.com/_next/static/BUILD123/_buildManifest.js',
  )
  assert.equal(
    sketchBrahma.extractCareersBundleUrlFromManifest(BUILD_MANIFEST_JS),
    'https://www.sketchbrahma.com/_next/static/chunks/pages/careers-b57c76d71d4a2bdf.js',
  )
  assert.equal(sketchBrahma.hasOfficialCareersBundleSignal(CAREERS_BUNDLE_JS), true)
})

test('Sketch Brahma Technologies extracts current first-party jobs from the careers bundle', async () => {
  const sketchBrahma = await loadModule()

  const jobs = sketchBrahma.extractJobsFromCareersBundle(CAREERS_BUNDLE_JS)

  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'UI/UX Designer',
    company: 'Sketch Brahma Technologies',
    department: 'Design',
    location: 'Bangalore',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'sketchbrahmatechnologies-2e9d89585f65604d7e81600ab1babef0a2aa240a039b67759c77fb6bdd37b6df',
    requisitionId: '2e9d89585f65604d7e81600ab1babef0a2aa240a039b67759c77fb6bdd37b6df',
    sourceUrl: 'https://labs.sketchbrahma.com/apply.php?t=2e9d89585f65604d7e81600ab1babef0a2aa240a039b67759c77fb6bdd37b6df',
    applyUrl: 'https://labs.sketchbrahma.com/apply.php?t=2e9d89585f65604d7e81600ab1babef0a2aa240a039b67759c77fb6bdd37b6df',
    employmentType: 'Full-time',
    experienceRequired: '2 - 5 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Proficiency in Sketch, Figma, Adobe XD, Illustrator or any Visual design tools.',
      'Excellent communication skills and the ability to clearly articulate design decisions.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Location: Bangalore',
      'Experience: 2 - 5 Years',
      '',
      'Job Responsibilities:',
      '- Set design requirements based on information from internal and external teams and user research.',
      '- Present product design ideas to cross-functional teams and senior leadership.',
      '',
      'Requirements:',
      '- Must have at least 1+ years experience in web and mobile application design.',
      '- Creative problem-solving skills.',
      '',
      'Skills:',
      '- Proficiency in Sketch, Figma, Adobe XD, Illustrator or any Visual design tools.',
      '- Excellent communication skills and the ability to clearly articulate design decisions.',
    ].join('\n'),
    remoteStatus: 'On-site',
  })

  assert.equal(jobs[1].title, 'React Js Developer')
  assert.equal(jobs[1].department, 'Development')
  assert.equal(
    jobs[1].applyUrl,
    'https://labs.sketchbrahma.com/apply.php?t=1d251aa0868a2acdc1c5d51778e3353139e22295bb74e668d2efe9acdef171e4',
  )
  assert.equal(jobs[2].title, 'Node Js Developer')
  assert.equal(jobs[3].title, 'Sales Representative')
  assert.equal(jobs[4].title, 'IT Recruiter')
  assert.equal(jobs[5].title, 'Quality Analyst')
  assert.equal(jobs[5].requiredSkills.length, 2)
})

test('Sketch Brahma Technologies run validates the first-party shell, manifest, and careers bundle before normalizing jobs', async () => {
  const sketchBrahma = await loadModule()
  const requestedUrls = []

  const jobs = await sketchBrahma.createSketchBrahmaTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sketchBrahma.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === 'https://www.sketchbrahma.com/_next/static/BUILD123/_buildManifest.js') {
        return BUILD_MANIFEST_JS
      }
      if (url === 'https://www.sketchbrahma.com/_next/static/chunks/pages/careers-b57c76d71d4a2bdf.js') {
        return CAREERS_BUNDLE_JS
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    sketchBrahma.HOMEPAGE_URL,
    'https://www.sketchbrahma.com/_next/static/BUILD123/_buildManifest.js',
    'https://www.sketchbrahma.com/_next/static/chunks/pages/careers-b57c76d71d4a2bdf.js',
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'sketchbrahmatechnologies')
  assert.equal(jobs[0].company, 'Sketch Brahma Technologies')
  assert.equal(jobs[0].companyCareerPage, 'https://www.sketchbrahma.com/careers')
  assert.equal(jobs[0].companyDomain, 'sketchbrahma.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].jobType, 'Full-time Experienced')
  assert.equal(
    jobs[0].link,
    'https://labs.sketchbrahma.com/apply.php?t=2e9d89585f65604d7e81600ab1babef0a2aa240a039b67759c77fb6bdd37b6df',
  )
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[4].jobType, 'Full-time Experienced')
})

test('Sketch Brahma Technologies fails closed when the homepage, manifest, or bundle contract drifts', async () => {
  const sketchBrahma = await loadModule()

  await assert.rejects(
    sketchBrahma.createSketchBrahmaTechnologiesScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body>No official company markers.</body></html>',
    }),
    /official homepage/i,
  )

  await assert.rejects(
    sketchBrahma.createSketchBrahmaTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === sketchBrahma.HOMEPAGE_URL) return HOMEPAGE_HTML
        return 'self.__BUILD_MANIFEST=function(){return {"/about-us":["static/chunks/pages/about-us.js"]}}();'
      },
    }),
    /careers bundle/i,
  )

  await assert.rejects(
    sketchBrahma.createSketchBrahmaTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === sketchBrahma.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === 'https://www.sketchbrahma.com/_next/static/BUILD123/_buildManifest.js') {
          return BUILD_MANIFEST_JS
        }

        return CAREERS_BUNDLE_JS.replace('Available opportunities', 'Career opportunities')
      },
    }),
    /careers bundle/i,
  )

  await assert.rejects(
    sketchBrahma.createSketchBrahmaTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === sketchBrahma.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === 'https://www.sketchbrahma.com/_next/static/BUILD123/_buildManifest.js') {
          return BUILD_MANIFEST_JS
        }

        return CAREERS_BUNDLE_JS.replace('Openings:"2 openings"', 'Openings:"9 openings"')
      },
    }),
    /count mismatch|verified public jobs/i,
  )
})
