import assert from 'node:assert/strict'
import test from 'node:test'

const loadBITSILICAModule = async () => {
  try {
    return await import('../../scraper/bitsilica/script.js')
  } catch {
    return null
  }
}

const careerCategories = [
  {
    id: 53,
    name: 'Careers',
    slug: 'careers',
    count: 3,
  },
]

const careerPosts = [
  {
    id: 101,
    date: '2023-09-11T05:04:58',
    date_gmt: '2023-09-11T05:04:58',
    slug: 'accounts-manager-senior-junior-accountant',
    link: 'https://bitsilica.com/accounts-manager-senior-junior-accountant/',
    title: {
      rendered: 'Accounts Manager Senior &#038; Junior Accountant',
    },
    content: {
      rendered: '<p>We Hiring for Accounts Manager/ Senior &#038; Junior Accountant.</p><p>Location: #hyderabad</p><p>Education: M.com , MBA (finance) or CA qualified.</p><p>Experience: 6+ years of Experience in relevant field.</p><p>Also for Junior Accountant with Education: B Com, M Com, MBA (finance background), CA Inter</p><p>Interested guys plz drop the cv ramu.karnati@bitsilica.com</p>',
    },
  },
  {
    id: 102,
    date: '2023-08-25T10:12:50',
    date_gmt: '2023-08-25T10:12:50',
    slug: 'embedded-engg-cprogramming-embeddedsystems',
    link: 'https://bitsilica.com/embedded-engg-cprogramming-embeddedsystems/',
    title: {
      rendered: 'Embedded Software Engineers &#8211; C programing &#038; knowledge in Embedded Systems',
    },
    content: {
      rendered: '<p>BITSILICA Hiring Embedded Software Engineers, with Skill: C programing language, knowledge in Embedded Systems</p><p>Location: Hyderabad/Bengaluru</p><p>Availability: Immediate</p><p>Drop your CV to lakshmisatya.hemasri@bitsilica.com</p>',
    },
  },
  {
    id: 103,
    date: '2023-04-20T19:50:05',
    date_gmt: '2023-04-20T19:50:05',
    slug: 'dsp-asic-rtl-engg',
    link: 'https://bitsilica.com/dsp-asic-rtl-engg/',
    title: {
      rendered: 'DSP ASIC RTL Engineer',
    },
    content: {
      rendered: '<p>BITSILICA is #Hiring DSP ASIC RTL Engineers</p><p>Location: Bangalore</p><p>5+ years of experience.</p><p>Interested engineers can please share their CV to careers@bitsilica.com</p>',
    },
  },
]

const summarizeJob = (job) => ({
  title: job.title,
  company: job.company,
  location: job.location,
  city: job.city,
  country: job.country,
  jobId: job.jobId,
  requisitionId: job.requisitionId,
  sourceUrl: job.sourceUrl,
  applyUrl: job.applyUrl,
  experienceRequired: job.experienceRequired,
  minimumQualification: job.minimumQualification,
  requiredSkills: job.requiredSkills,
  postingDate: job.postingDate,
  source: job.source,
  link: job.link,
})

test('run loads official BITSILICA career posts from the WordPress careers category', async () => {
  const bitsilica = await loadBITSILICAModule()
  assert.ok(bitsilica)

  const requestedUrls = []
  const jobs = await bitsilica.createBITSILICAScraper().run({
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === bitsilica.CAREERS_CATEGORY_API_URL) {
        return careerCategories
      }

      if (url === bitsilica.buildCareerPostsApiUrl(53)) {
        return careerPosts
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    bitsilica.CAREERS_CATEGORY_API_URL,
    bitsilica.buildCareerPostsApiUrl(53),
  ])

  assert.deepEqual(jobs.map(summarizeJob), [
    {
      title: 'Accounts Manager Senior & Junior Accountant',
      company: 'BITSILICA',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '101',
      requisitionId: '101',
      sourceUrl: 'https://bitsilica.com/accounts-manager-senior-junior-accountant/',
      applyUrl: 'https://bitsilica.com/accounts-manager-senior-junior-accountant/',
      experienceRequired: '6+ years',
      minimumQualification: 'M.com, MBA (finance) or CA qualified. Also for Junior Accountant with Education: B Com, M Com, MBA (finance background), CA Inter',
      requiredSkills: [],
      postingDate: '2023-09-11T05:04:58.000Z',
      source: 'bitsilica',
      link: 'https://bitsilica.com/accounts-manager-senior-junior-accountant/',
    },
    {
      title: 'Embedded Software Engineers - C programing & knowledge in Embedded Systems',
      company: 'BITSILICA',
      location: 'Hyderabad/Bengaluru, India',
      city: null,
      country: 'India',
      jobId: '102',
      requisitionId: '102',
      sourceUrl: 'https://bitsilica.com/embedded-engg-cprogramming-embeddedsystems/',
      applyUrl: 'https://bitsilica.com/embedded-engg-cprogramming-embeddedsystems/',
      experienceRequired: null,
      minimumQualification: null,
      requiredSkills: [
        'C programing language',
        'knowledge in Embedded Systems',
      ],
      postingDate: '2023-08-25T10:12:50.000Z',
      source: 'bitsilica',
      link: 'https://bitsilica.com/embedded-engg-cprogramming-embeddedsystems/',
    },
    {
      title: 'DSP ASIC RTL Engineer',
      company: 'BITSILICA',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '103',
      requisitionId: '103',
      sourceUrl: 'https://bitsilica.com/dsp-asic-rtl-engg/',
      applyUrl: 'https://bitsilica.com/dsp-asic-rtl-engg/',
      experienceRequired: '5+ years',
      minimumQualification: null,
      requiredSkills: [],
      postingDate: '2023-04-20T19:50:05.000Z',
      source: 'bitsilica',
      link: 'https://bitsilica.com/dsp-asic-rtl-engg/',
    },
  ])

  assert.equal(typeof jobs[0].jobDescription, 'string')
  assert.match(jobs[0].jobDescription, /Location:/i)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
