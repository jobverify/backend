import assert from 'node:assert/strict'
import test from 'node:test'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { createHash } from 'node:crypto'


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


// All HTML/JS role fixtures above are byte-identical to the existing Ninestars test.
// They are parsed inertly through existing source code; no native HTTP or JS runs.
for (const maximum of [3, 7]) for (const labelled of [false, true]) test(`native0-${maximum}year upper bound survives${labelled ? ' with identical labeled JD' : ' explicit field alone'}`, () => {
  const experienceRequired = `0 to ${maximum} years (Freshers can also apply)`
  const job = { experienceRequired, ...(labelled ? { jobDescription: 'Experience: ' + experienceRequired } : {}) }
  const profile = extractJobFilterSignals(job).experienceProfile
  assert.equal(profile.minimumYears, 0);assert.equal(profile.maximumYears, maximum)
  assert.equal(profile.rawText, experienceRequired)
})
for (const [name, job, minimum, maximum] of [
  ['bare year range', { jobDescription: 'Experience: 0 - 3 years' }, 0, 3],
  ['abbreviated year range', { jobDescription: 'Exp: 0 to 7 yrs' }, 0, 7],
  ['decimal endpoints are not numeric prefixes', { jobDescription: 'Experience: 1.5 to 3.5 years' }, 1.5, 3.5],
  ['normalized dash', { jobDescription: 'Experience: 0–3 years' }, 0, 3],
  ['canonical field keeps existing precedence', { experienceRequired: '2 - 4 years', jobDescription: 'Experience: 0 to 7 years' }, 2, 4],
  ['same label wins over a different noncanonical range', { experienceRequired: '0 to 7 years (Freshers can also apply)', jobDescription: 'Experience: 2 to 3 years' }, 2, 3],
  ['bare exact label keeps existing precedence', { experienceRequired: '0 to 7 years (Freshers can also apply)', jobDescription: 'Experience: 5 years' }, 5, 5],
  ['another sentence range cannot change an exact label', { jobDescription: 'Experience: 3 years. Another role allows 0 to 7 years.' }, 3, 3],
  ['bare exact value', { jobDescription: 'Experience: 3' }, 3, 3],
  ['month interval remains fractional', { jobDescription: 'Experience: 0 to 18 months' }, 0, 1.5],
  ['reversed month interval remains unknown', { jobDescription: 'Experience: 18 to 0 months' }, null, null],
]) test(name, () => {
  const untouched = structuredClone(job), profile = extractJobFilterSignals(job).experienceProfile
  assert.equal(profile.minimumYears, minimum);assert.equal(profile.maximumYears, maximum)
  assert.deepEqual(job, untouched)
})
test('minimum label retains its existing precedence over a separate bare range', () => {
  const profile = extractJobFilterSignals({ jobDescription: 'Experience: 0 to 7 years. Minimum experience: 3 years' }).experienceProfile
  assert.equal(profile.minimumYears, 3)
})
test('original Ninestars pipeline preserves0-3/0-7 maxima and all raw role inputs', async () => {
  const ninestars = await loadNinestarsModule(), raw = ninestars.extractBundleJobs(verifiedBundleJs)
  const rawHash = createHash('sha256').update(JSON.stringify(raw)).digest('hex'), requested = []
  const jobs = await ninestars.createNinestarsInformationTechnologiesPvtLtdScraper().run({
    fetchText: async url => {
      requested.push(url)
      if (url === ninestars.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === ninestars.CAREERS_HANDOFF_URL) return verifiedCareersHandoffHtml
      if (url === 'https://www.ninestarsglobal.com/assets/index-9ujXVa_6.js') return verifiedBundleJs
      assert.fail('Unmocked native URL: ' + url)
    }, now: () => '2026-07-11T00:00:00.000Z',
  })
  assert.deepEqual(requested, [ninestars.HOMEPAGE_URL, ninestars.CAREERS_HANDOFF_URL, 'https://www.ninestarsglobal.com/assets/index-9ujXVa_6.js'])
  assert.equal(jobs.length, 3)
  for (const [index, maximum] of [1, 3, 7].entries()) {
    assert.equal(jobs[index].experienceRequired, raw[index].experience)
    assert.equal(jobs[index].experienceProfile.minimumYears, 0)
    assert.equal(jobs[index].experienceProfile.maximumYears, maximum)
    assert.equal(jobs[index].jobType, 'Full-time Fresher')
    assert.equal(jobs[index].scrapedTimestamp.toISOString(), '2026-07-11T00:00:00.000Z')
  }
  assert.equal(createHash('sha256').update(JSON.stringify(raw)).digest('hex'), rawHash)
})
