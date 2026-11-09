import assert from 'node:assert/strict'
import test from 'node:test'

const loadNinestarsModule = async () => {
  try {
    return await import('../../scraper/ninestarsinformationtechnologiespvtltd/script.js')
  } catch {
    assert.fail(
      'Expected Ninestars Information Technologies Pvt Ltd scraper module at ../../scraper/ninestarsinformationtechnologiespvtltd/script.js',
    )
  }
}

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Ninestars Global | AI-Powered Automation for Life Sciences &amp; Enterprise | 27 Years</title>
    <meta
      name="description"
      content="Leading provider of intelligent automation solutions. 27 years of excellence delivering high-impact, end-to-end transformation with Automation 4.0 technology."
    />
    <meta name="author" content="Ninestars" />
    <script type="module" crossorigin src="/assets/index-9ujXVa_6.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const verifiedCareersHandoffHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title></title>
  </head>
  <body></body>
  <script>
    window.location.href = "https://www.ninestarsglobal.com/career";
  </script>
</html>
`

const verifiedBundleJs = `
var pg=[{
  id:"engineer-data-science-rd",
  title:"Engineer - Data Science/R&D",
  experience:"Freshers (0 to 1 Year, 2024/25 batch)",
  location:"Bengaluru",
  positions:10,
  publishedOn:"08-Nov",
  education:"ME/MTech specialized in (Computer Science/Information Technology/Information Science/Data Science/Artificial Intelligence/Machine Learning/Deep Learning Engineering - 1st Division)",
  skills:"Python with Artificial Intelligence, Deep Learning and Machine Learning framework, Data Structures & Algorithms, Computer vision, and NLP (Natural Language Processing)",
  description:[
    "Hands-on Coding: Demonstrate solid programming fundamentals in Python",
    "Problem Solving: Utilize strong analytical and problem-solving skills with a deep understanding of algorithms and data structures",
    "AI/ML/DL Frameworks: Leverage exposure to Artificial Intelligence, Machine Learning, Large Language and Deep Learning frameworks to develop innovative solutions"
  ],
  skillsList:[
    "Python",
    "Artificial Intelligence",
    "Deep Learning",
    "Machine Learning",
    "Data Structures & Algorithms",
    "Computer Vision",
    "NLP (Natural Language Processing)"
  ],
  benifits:[],
  responsibilities:[]
},{
  id:"junior-associate-media-analyst",
  title:"Junior Associate / Media Analyst",
  experience:"0 to 3 Year (Freshers can also apply)",
  location:"Chennai",
  positions:50,
  publishedOn:"02-Jul",
  education:"Any Degree / Diploma",
  skills:"",
  description:[
    "Analyzes and carries out Tagging, Copy editing, Technical Editing / Style Editing according to customer specifications and standards."
  ],
  skillsList:[
    "Language skills – working and professional proficiency in English",
    "Analytical skills and critical thinking",
    "Extreme attention to detail with relentlessly high quality standards",
    "Willing to Work in Shift & Weekends (Week-off will be provided)"
  ],
  benifits:["Competitive salary","Paid time off","Health insurance"],
  responsibilities:[]
},{
  id:"associate-sr-associate-xml-proof-reading",
  title:"Associate/ Sr. Associate - XML & Proof Reading",
  experience:"0 to 7 years (Freshers can also apply)",
  location:"Chennai",
  positions:10,
  publishedOn:"02-Jul",
  education:"Any Degree / Diploma",
  skills:"",
  description:[
    "Responsible for converting Doc files to XML format",
    "To test XML tagging and pass the file to the next process",
    "To deliver a file with error-free output",
    "Proofread rendered copy at various stages of development to attain 100% accuracy",
    "Confirm that relevant, appropriate and factually correct content is released for final delivery"
  ],
  skillsList:[
    "Experience in Publishing XML, HTML, Math Coding, Epub 2 & 3, Mobi",
    "Knowledge in CSS & CSS3, XSL"
  ],
  benifits:["Competitive salary","Paid time off","Health insurance"],
  responsibilities:[]
}],jF=()=>{};
var routes=[
  {path:"/career"},
  {path:"/careers",to:"https://career.ninestarsglobal.com/"},
  {path:"/careers/*",to:"https://career.ninestarsglobal.com/"}
];
var headings=["Open Positions","Apply now"];
`

test('Ninestars scraper pins the verified homepage, careers handoff shell, and bundle-backed public jobs data', async () => {
  const ninestars = await loadNinestarsModule()

  assert.equal(ninestars.SOURCE, 'ninestarsinformationtechnologiespvtltd')
  assert.equal(ninestars.COMPANY, 'Ninestars Information Technologies Pvt Ltd')
  assert.equal(ninestars.HOMEPAGE_URL, 'https://www.ninestarsglobal.com/')
  assert.equal(ninestars.CAREERS_HANDOFF_URL, 'https://career.ninestarsglobal.com/')
  assert.equal(ninestars.CAREER_ROUTE_URL, 'https://www.ninestarsglobal.com/career')
  assert.equal(ninestars.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(
    ninestars.extractBundleAssetUrl(verifiedHomepageHtml),
    'https://www.ninestarsglobal.com/assets/index-9ujXVa_6.js',
  )
  assert.equal(ninestars.hasOfficialCareersHandoffSignal(verifiedCareersHandoffHtml), true)
  assert.equal(ninestars.hasVerifiedCareerBundleSignal(verifiedBundleJs), true)

  assert.deepEqual(ninestars.extractBundleJobs(verifiedBundleJs), [
    {
      id: 'engineer-data-science-rd',
      title: 'Engineer - Data Science/R&D',
      experience: 'Freshers (0 to 1 Year, 2024/25 batch)',
      location: 'Bengaluru',
      positions: 10,
      publishedOn: '08-Nov',
      education:
        'ME/MTech specialized in (Computer Science/Information Technology/Information Science/Data Science/Artificial Intelligence/Machine Learning/Deep Learning Engineering - 1st Division)',
      skills:
        'Python with Artificial Intelligence, Deep Learning and Machine Learning framework, Data Structures & Algorithms, Computer vision, and NLP (Natural Language Processing)',
      description: [
        'Hands-on Coding: Demonstrate solid programming fundamentals in Python',
        'Problem Solving: Utilize strong analytical and problem-solving skills with a deep understanding of algorithms and data structures',
        'AI/ML/DL Frameworks: Leverage exposure to Artificial Intelligence, Machine Learning, Large Language and Deep Learning frameworks to develop innovative solutions',
      ],
      skillsList: [
        'Python',
        'Artificial Intelligence',
        'Deep Learning',
        'Machine Learning',
        'Data Structures & Algorithms',
        'Computer Vision',
        'NLP (Natural Language Processing)',
      ],
      benifits: [],
      responsibilities: [],
    },
    {
      id: 'junior-associate-media-analyst',
      title: 'Junior Associate / Media Analyst',
      experience: '0 to 3 Year (Freshers can also apply)',
      location: 'Chennai',
      positions: 50,
      publishedOn: '02-Jul',
      education: 'Any Degree / Diploma',
      skills: '',
      description: [
        'Analyzes and carries out Tagging, Copy editing, Technical Editing / Style Editing according to customer specifications and standards.',
      ],
      skillsList: [
        'Language skills – working and professional proficiency in English',
        'Analytical skills and critical thinking',
        'Extreme attention to detail with relentlessly high quality standards',
        'Willing to Work in Shift & Weekends (Week-off will be provided)',
      ],
      benifits: ['Competitive salary', 'Paid time off', 'Health insurance'],
      responsibilities: [],
    },
    {
      id: 'associate-sr-associate-xml-proof-reading',
      title: 'Associate/ Sr. Associate - XML & Proof Reading',
      experience: '0 to 7 years (Freshers can also apply)',
      location: 'Chennai',
      positions: 10,
      publishedOn: '02-Jul',
      education: 'Any Degree / Diploma',
      skills: '',
      description: [
        'Responsible for converting Doc files to XML format',
        'To test XML tagging and pass the file to the next process',
        'To deliver a file with error-free output',
        'Proofread rendered copy at various stages of development to attain 100% accuracy',
        'Confirm that relevant, appropriate and factually correct content is released for final delivery',
      ],
      skillsList: [
        'Experience in Publishing XML, HTML, Math Coding, Epub 2 & 3, Mobi',
        'Knowledge in CSS & CSS3, XSL',
      ],
      benifits: ['Competitive salary', 'Paid time off', 'Health insurance'],
      responsibilities: [],
    },
  ])
})

test('Ninestars scraper fetches the verified homepage, careers handoff shell, and client bundle then normalizes jobs', async () => {
  const ninestars = await loadNinestarsModule()
  const requestedUrls = []

  const jobs = await ninestars.createNinestarsInformationTechnologiesPvtLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === ninestars.HOMEPAGE_URL) {
        return verifiedHomepageHtml
      }

      if (url === ninestars.CAREERS_HANDOFF_URL) {
        return verifiedCareersHandoffHtml
      }

      if (url === 'https://www.ninestarsglobal.com/assets/index-9ujXVa_6.js') {
        return verifiedBundleJs
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    ninestars.HOMEPAGE_URL,
    ninestars.CAREERS_HANDOFF_URL,
    'https://www.ninestarsglobal.com/assets/index-9ujXVa_6.js',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'ninestarsinformationtechnologiespvtltd')
  assert.equal(jobs[0].company, 'Ninestars Information Technologies Pvt Ltd')
  assert.equal(jobs[0].companyCareerPage, 'https://career.ninestarsglobal.com')
  assert.equal(jobs[0].companyDomain, 'ninestarsglobal.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].jobType, 'Full-time Fresher')
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].sourceUrl, 'https://career.ninestarsglobal.com')
  assert.deepEqual(jobs[0].requiredSkills.slice(0, 3), [
    'Python',
    'Artificial Intelligence',
    'Deep Learning',
  ])
  assert.equal(jobs[1].location, 'Chennai')
  assert.equal(jobs[1].jobType, 'Full-time Fresher')
  assert.equal(jobs[1].experienceRequired, '0 to 3 Year (Freshers can also apply)')
  assert.equal(jobs[1].experienceLevel, 'Entry Level')
  assert.equal(jobs[1].experienceProfile.minimumYears, 0)
  assert.equal(jobs[2].experienceRequired, '0 to 7 years (Freshers can also apply)')
  // Maximum-range loss is a separate RED regression, never an accepted0 upper bound.
  assert.equal(jobs[2].minimumQualification, 'Any Degree / Diploma')
  assert.match(jobs[2].jobDescription, /Responsible for converting Doc files to XML format/i)
  assert.match(jobs[2].jobDescription, /Competitive salary/i)
})

test('Ninestars scraper fails closed when the verified homepage, careers handoff shell, or bundle drift', async () => {
  const ninestars = await loadNinestarsModule()

  await assert.rejects(
    ninestars.createNinestarsInformationTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === ninestars.HOMEPAGE_URL) {
          return '<html><head><title>Placeholder</title></head><body>Welcome</body></html>'
        }

        if (url === ninestars.CAREERS_HANDOFF_URL) return verifiedCareersHandoffHtml
        return verifiedBundleJs
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    ninestars.createNinestarsInformationTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === ninestars.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === ninestars.CAREERS_HANDOFF_URL) {
          return verifiedCareersHandoffHtml.replace(
            'https://www.ninestarsglobal.com/career',
            'https://www.ninestarsglobal.com/jobs',
          )
        }

        return verifiedBundleJs
      },
    }),
    /verified first-party careers handoff/i,
  )

  await assert.rejects(
    ninestars.createNinestarsInformationTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === ninestars.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === ninestars.CAREERS_HANDOFF_URL) return verifiedCareersHandoffHtml

        return verifiedBundleJs
          .replace('path:"/career"', 'path:"/roles"')
          .replace('Open Positions', 'Career Opportunities')
      },
    }),
    /verified first-party career bundle/i,
  )
})
