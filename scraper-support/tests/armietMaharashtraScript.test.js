import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Career</h1>
    <!-- Current native adverts are bounded by WordPress role columns. -->
    <div class="wp-block-columns"><div class="wp-block-column">
    <h4>Assistant Professor (Engineering)</h4>
    <h5>Branches :</h5>
    <p>Computer | Artificial Intelligence (AIML) | Information technology(IT) | Mechanical</p>
    <p>Eligibility : Minimum Masters / Bachelor Degree with 1st Class Pass</p>
    <p>Salary Package : Negotiable (As per experience of candidate)</p>
    <p>Walk-in Interview :</p>
    <p>124, ARMIET, Vardhman Industrial Estate, Gokul Nagar, Thane (W) - 400601</p>
    <p>Teaching Location: Asangaon ARMIET, A.S. Rao Nagar, Vill-Sapgaon</p>

    </div><div class="wp-block-column"><h4>Training and Placement Officers (TPO)</h4>
    <h5>Qualification : B.E, M.B.A Preferred, MBA with TPO Industry Experience</h5>
    <p>Salary Package : Negotiable (As per experience of candidate)</p>
    <p>Job Location : Asangaon ARMIET, A.S. Rao Nagar, Vill-Sapgaon, Tal-Shahpur, Dist-Thane</p>
    <p>Walk in Interview :</p>
    <p>Head Office : 124, ARMIET, Vardhman Indl.Estate, Gokul Nagar, Thane (w), Maharashtra</p>
    <p>Job Types: Full-time</p>
    <p>Note : Candidates preferred from Thane to Kasara / Karjat</p>

    </div><div class="wp-block-column"><h4>Assistant Professor (MBA/MMS)</h4>
    <h5>Branches :</h5>
    <p>Marketing | HR | Finance | Operation | Systems</p>
    <h5>Eligibility : Minimum Master&#8217;s Degree with First Class Pass</h5>
    <h5>Walk-in Interview at ARMIET Head Office</h5>
    <p>124, ARMIET, Vardhman Industrial Estate, Gokul Nagar, Thane (W) - 400601</p>
    <h5>Teaching Location: Thane &amp; Asangoan</h5>

    </div><div class="wp-block-column"><h4>Accountant</h4>
    <p>Eligibility : Minimum 1 to 2 year hands experienced in Accountancy and Tally operation</p>
    <p>Walk-in Interview at ARMIET Head Office</p>
    <p>124, ARMIET, Vardhman Industrial Estate, Gokul Nagar, Thane (W) - 400601</p>
    <p>Time: 11:00 pm to 5:00 pm</p>
    <p>Location : Thane</p>

    </div></div>
    <a href="https://forms.gle/SAVWB6HD2V7bKv7x6">Apply Now</a>
    <p>You can send your resume on : armietdigital@gmail.com</p>
  </body>
</html>
`

const loadArmietModule = async () => {
  try {
    return await import('../../scraper/armietmaharashtra/script.js')
  } catch {
    assert.fail('Expected ARMIET Maharashtra scraper module at ../../scraper/armietmaharashtra/script.js')
  }
}

test('hasOfficialCareersSignal validates the verified ARMIET careers surface', async () => {
  const armiet = await loadArmietModule()

  assert.equal(armiet.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('extractPublicListings parses ARMIET static role sections with a shared Google Forms apply URL', async () => {
  const armiet = await loadArmietModule()

  assert.equal(armiet.CAREERS_URL, 'https://armiet.in/career/')
  assert.equal(armiet.APPLY_URL, 'https://forms.gle/SAVWB6HD2V7bKv7x6')

  const jobs = armiet.extractPublicListings(CAREERS_HTML)

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'Assistant Professor (Engineering)',
    company: 'ARMIET Maharashtra',
    department: 'Engineering',
    location: 'Asangaon ARMIET, A.S. Rao Nagar, Vill-Sapgaon',
    city: null,
    country: null,
    jobId: null,
    requisitionId: null,
    sourceUrl: 'https://armiet.in/career/',
    applyUrl: 'https://forms.gle/SAVWB6HD2V7bKv7x6',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: 'Minimum Masters / Bachelor Degree with 1st Class Pass',
    preferredQualification: null,
    requiredSkills: [
      'Computer | Artificial Intelligence (AIML) | Information technology(IT) | Mechanical',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: ['Branches :', 'Computer | Artificial Intelligence (AIML) | Information technology(IT) | Mechanical',
      'Eligibility : Minimum Masters / Bachelor Degree with 1st Class Pass', 'Salary Package : Negotiable (As per experience of candidate)',
      'Walk-in Interview :', '124, ARMIET, Vardhman Industrial Estate, Gokul Nagar, Thane (W) - 400601',
      'Teaching Location: Asangaon ARMIET, A.S. Rao Nagar, Vill-Sapgaon'].join('\n'),
    remoteStatus: null,
    sourceDetailComplete: false,
    publicExperienceChecked: false,
    sourceDetailFailureKind: 'missing-content',
  })

  assert.equal(jobs[1].title, 'Training and Placement Officers (TPO)')
  assert.equal(jobs[1].employmentType, 'Full-time')
  assert.match(jobs[1].jobDescription, /Candidates preferred from Thane to Kasara/i)
  assert.equal(jobs[2].title, 'Assistant Professor (MBA/MMS)')
  assert.equal(jobs[2].department, 'MBA/MMS')
  assert.equal(jobs[2].minimumQualification, "Minimum Master's Degree with First Class Pass")
  assert.deepEqual(jobs[2].requiredSkills, ['Marketing | HR | Finance | Operation | Systems'])
  assert.equal(jobs[2].location, 'Thane & Asangoan')
  assert.equal(jobs[3].city, null)
})

test('run fetches the ARMIET careers page and decorates runner fields', async () => {
  const armiet = await loadArmietModule()
  const requestedUrls = []

  const jobs = await armiet.createArmietMaharashtraScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return CAREERS_HTML
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://armiet.in/career/'])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'armietmaharashtra')
  assert.equal(jobs[0].link, 'https://forms.gle/SAVWB6HD2V7bKv7x6')
  assert.equal(jobs[0].scrapedAt, '2026-07-09T12:00:00.000Z')
})

test('run fails closed when the ARMIET careers surface changes', async () => {
  const armiet = await loadArmietModule()

  await assert.rejects(
    armiet.createArmietMaharashtraScraper().run({
      fetchText: async () => '<html><body>No faculty vacancies here</body></html>',
    }),
    /verified ARMIET careers surface/i,
  )
})
