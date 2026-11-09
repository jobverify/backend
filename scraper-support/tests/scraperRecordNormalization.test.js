import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

test('normalizeScrapedJob enriches engineering jobs into the unified scraper schema', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'SDE II',
      company: 'Example Corp',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      department: 'Platform Engineering',
      description: 'Build cloud services for developer workflows using Node.js, AWS, and PostgreSQL.',
      requiredSkills: ['Node.js', 'AWS', 'Distributed Systems'],
      link: 'https://careers.example.com/jobs/123',
      jobId: 'JR-123',
      experienceRequired: '3 to 5 years of platform engineering experience',
    },
    {
      source: 'example-source',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.originalTitle, 'SDE II')
  assert.equal(normalized.normalizedTitle, 'Software Engineer')
  assert.equal(normalized.jobCategory, 'Software Engineer')
  assert.equal(normalized.engineeringDomain, 'Software Engineering')
  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Mid Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.companyCareerPage, 'https://careers.example.com')
  assert.equal(normalized.companyDomain, 'careers.example.com')
  assert.equal(normalized.applyUrl, 'https://careers.example.com/jobs/123')
  assert.equal(normalized.sourceUrl, 'https://careers.example.com/jobs/123')
  assert.equal(normalized.atsPlatform, 'workday')
  assert.deepEqual(normalized.requiredSkills, ['Node.js', 'AWS', 'Distributed Systems'])
  assert.equal(normalized.experienceBucket, '3-5')
  assert.equal(normalized.seniority, 'Mid Level')
  assert.equal(normalized.primaryRoleDomain, 'Software Engineering')
  assert.deepEqual(normalized.requiredSkillIds, ['node-js', 'aws'])
  assert.deepEqual(normalized.skillIds, ['node-js', 'aws', 'postgresql'])
})

test('normalizeScrapedJob fills missing optional fields with null-safe defaults', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Mechanical Design Engineer',
      company: 'Machines India',
      location: 'Pune, India',
      city: 'Pune',
      link: 'https://jobs.machines.example/design-role',
    },
    {
      source: 'machines-india',
      companyCareerPage: 'https://jobs.machines.example',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.normalizedTitle, 'Mechanical Engineer')
  assert.equal(normalized.jobCategory, 'Mechanical Engineer')
  assert.equal(normalized.engineeringDomain, 'Mechanical')
  assert.equal(normalized.minimumQualification, null)
  assert.equal(normalized.preferredQualification, null)
  assert.equal(normalized.experienceRequired, null)
  assert.equal(normalized.salary, null)
  assert.equal(normalized.requisitionId, null)
  assert.ok(normalized.scrapedTimestamp instanceof Date)
})

test('normalizeScrapedJob composes full-time fresher job types from entry-level cues', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Graduate Software Engineer',
      company: 'Example',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      description: 'Campus hiring role for 2026 graduates.',
      minimumQualification: 'B.Tech in Computer Science',
      experienceRequired: '0-1 years of experience',
      link: 'https://careers.example.com/jobs/grad-role',
    },
    {
      source: 'example',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Entry Level')
  assert.equal(normalized.jobType, 'Full-time Fresher')
})

test('normalizeScrapedJob composes full-time experienced job types from non-entry cues', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Software Engineer II',
      company: 'Example',
      location: 'Pune, India',
      city: 'Pune',
      description: 'Build internal tooling for engineering systems.',
      experienceRequired: '2-4 years of software engineering experience',
      link: 'https://careers.example.com/jobs/se2-role',
    },
    {
      source: 'example',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Junior Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('normalizeScrapedJob does not treat graduate wording as fresher when explicit multi-year experience is present', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Cloud DevOps Engineer',
      company: 'Airbus',
      location: 'Bangalore Area',
      city: 'Bangalore',
      description: 'Support cloud platform and DevOps operations for Airbus teams.',
      experienceRequired: 'Experience: Graduate with 3-7 years of experience in Cloud Platform and DevOps development',
      link: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus/job/Bangalore-Area/Cloud-DevOps-Engineer_JR10427392',
    },
    {
      source: 'airbus',
      companyCareerPage: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Mid Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('normalizeScrapedJob composes internship and contract job types from apiPortal employment cues', () => {
  const internship = normalizeScrapedJob(
    {
      title: 'Software Engineering Intern',
      company: 'Razorpay',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      employmentType: 'Internship',
      link: 'https://razorpay.com/careers/job/intern-role',
    },
    {
      source: 'razorpay',
      companyCareerPage: 'https://razorpay.com/careers/',
      atsPlatform: 'greenhouse',
    },
  )

  const contract = normalizeScrapedJob(
    {
      title: 'QA Automation Engineer',
      company: 'Freshworks',
      location: 'Chennai, India',
      city: 'Chennai',
      employmentType: 'Contract',
      link: 'https://www.freshworks.com/company/careers/contract-role',
    },
    {
      source: 'freshworks',
      companyCareerPage: 'https://www.freshworks.com/company/careers/',
      atsPlatform: 'smartrecruiters',
    },
  )

  assert.equal(internship.jobType, 'Intern')
  assert.equal(contract.jobType, 'Contract')
})

test('normalizeScrapedJob captures maximum-only prior experience requirements', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Associate Analyst, Analytics & Metrics',
      company: 'Mastercard',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      description: 'All About You Upto 3 years of prior experience in roles focusing on financial controls and revenue assurance.',
      link: 'https://mastercard.wd1.myworkdayjobs.com/CorporateCareers/job/Gurgaon-India/example',
    },
    {
      source: 'mastercard.workday',
      companyCareerPage: 'https://mastercard.wd1.myworkdayjobs.com/CorporateCareers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '0-3 years')
})

test('normalizeScrapedJob captures open-ended experience when the label uses stacked punctuation', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Technical Staff - Warehouse',
      company: 'ExampleCo',
      location: 'India',
      city: 'Mumbai',
      description: 'QUALIFICATIONS: Minimum Graduate or diploma in pharmacy Experience:- More than one years in warehouse Full time',
      link: 'https://example.wd102.myworkdayjobs.com/ExternalCareers/job/India/example',
    },
    {
      source: 'example.workday',
      companyCareerPage: 'https://example.wd102.myworkdayjobs.com/ExternalCareers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '1+ years')
})

test('normalizeScrapedJob captures post-qualification experience shorthand', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Chief Manager - Finance',
      company: 'ExampleCo',
      location: 'Mumbai, India',
      city: 'Mumbai',
      description: 'Experience - CA 10 Yrs Post qualification experience Competencies - Prior experience in Financial or Management reporting',
      link: 'https://example.wd102.myworkdayjobs.com/ExternalCareers/job/Mumbai/example',
    },
    {
      source: 'example.workday',
      companyCareerPage: 'https://example.wd102.myworkdayjobs.com/ExternalCareers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '10 years')
})

test('normalizeScrapedJob ignores company-tenure and training-duration prose that is not candidate experience', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Assistant Vice President, Treasures Bancassurance Specialist',
      company: 'ExampleCo',
      location: 'Noida, India',
      city: 'Noida',
      description: 'ExampleCo has been present in India for over 30 years. Demonstrate the inputs at the Branch with an average of minimum of 3 insurance calls per day for the month. Facilitate IRDA certification of new joinees within 3 months of their joining ExampleCo.',
      link: 'https://careers.example.com/job/noida/example',
    },
    {
      source: 'example.workday',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, null)
})

test('normalizeScrapedJob suppresses unsupported part-time employment types', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Part-time Support Engineer',
      company: 'Example',
      location: 'Remote, India',
      city: 'Remote',
      employmentType: 'Part-time',
      link: 'https://careers.example.com/jobs/part-time-role',
    },
    {
      source: 'example',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'greenhouse',
    },
  )

  assert.equal(normalized.employmentType, null)
  assert.equal(normalized.jobType, 'Unspecified')
})

test('normalizeScrapedJob respects explicit experienceLevel cues for full-time apiPortal roles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Software Development Engineer',
      company: 'Example Commerce',
      location: 'Bangalore',
      city: 'Bangalore',
      employmentType: 'Full-time',
      experienceLevel: 'Entry Level',
      link: 'https://careers.example.com/#/careers/apply?src%3Dcareers%26p%3Dexample',
    },
    {
      source: 'example',
      companyCareerPage: 'https://careers.example.com/',
      atsPlatform: 'mynexthire',
    },
  )

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Entry Level')
  assert.equal(normalized.jobType, 'Full-time Fresher')
})

test('normalizeScrapedJob formats flattened role descriptions after scraping', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'V&V Designer',
      company: 'Alstom',
      location: 'Bangalore, India',
      city: 'Bangalore',
      jobDescription: 'About this role Leading societies to a low carbon future, Alstom develops and markets mobility solutions. ROLE : V&V Designer As a Validation Designer, candidate will validate Driver Machine Interface application software. RESPONSIBILITIES : 1. Define the Test strategy and Test Plan 2. Specify, design and develop the validation environment EDUCATION: Bachelor in Engineering TECHNICAL COMPETENCIES & EXPERIENCE: 1. 3-8 years of experience in Software Testing',
      link: 'https://jobsearch.alstom.com/job/example',
    },
    {
      source: 'alstom',
      companyCareerPage: 'https://jobsearch.alstom.com',
      atsPlatform: 'successfactors',
    },
  )

  assert.equal(
    normalized.jobDescription,
    'Leading societies to a low carbon future, Alstom develops and markets mobility solutions.\n\n'
      + 'ROLE:\n'
      + 'V&V Designer\n'
      + 'As a Validation Designer, candidate will validate Driver Machine Interface application software.\n\n'
      + 'RESPONSIBILITIES:\n'
      + '1. Define the Test strategy and Test Plan\n'
      + '2. Specify, design and develop the validation environment\n\n'
      + 'EDUCATION:\n'
      + 'Bachelor in Engineering\n\n'
      + 'TECHNICAL COMPETENCIES & EXPERIENCE:\n'
      + '1. 3-8 years of experience in Software Testing',
  )
})

test('normalizeScrapedJob filters generic job-link skillNames tags down to tool names for allowlisted api sources', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Software Engineer',
      company: 'AccioJob',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      requiredSkills: [
        'Node.js',
        'Research',
        'Leadership',
        'AWS Cloud & Microservices Architecture',
        'Figma',
        'Customer Support',
        'HubSpot CRM',
      ],
      link: 'https://careers.example.com/jobs/skillnames-role',
    },
    {
      source: 'acciojob',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'keka',
    },
  )

  assert.deepEqual(normalized.requiredSkills, ['Node.js', 'AWS', 'Figma', 'HubSpot'])
})

test('normalizeScrapedJob does not filter requiredSkills for non-skillNames sources', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Software Engineer',
      company: 'Example Corp',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      requiredSkills: ['Node.js', 'Research', 'Leadership'],
      link: 'https://careers.example.com/jobs/non-skillnames-role',
    },
    {
      source: 'example-source',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.deepEqual(normalized.requiredSkills, ['Node.js', 'Research', 'Leadership'])
})

test('normalizeScrapedJob prefers high-confidence experience evidence over noisy Workday prose', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Customer Service Associate III/Analyst II ( Voice Process)',
      company: 'Allstate',
      location: 'Pune, India',
      city: 'Pune',
      experienceRequired: 'And for more than 90 years, our innovative drive has kept us a step ahead of our customers evolving needs',
      jobDescription: 'At Allstate, great things happen when our people work together. Job Description RESPONSIBILITIES: Support claims workflows. Experience 1-4 years experience (Preferred).',
      link: 'https://allstate.wd5.myworkdayjobs.com/allstate_careers/job/Ind--Pune/Customer-Service-Associate-III-Analyst-II---Voice-Process-_R31706',
    },
    {
      source: 'allstate',
      companyCareerPage: 'https://www.allstate.jobs',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '1-4 years')
})

test('normalizeScrapedJob parses contextual month ranges from Workday descriptions', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Claims Operations Associate III',
      company: 'Allstate',
      location: 'Pune, India',
      city: 'Pune',
      jobDescription: 'Education and Experience • 0-18 months of related experience • Bachelor’s degree or equivalent experience.',
      link: 'https://allstate.wd5.myworkdayjobs.com/allstate_careers/job/Ind--Pune/Claims-Operations-Associate-III_R33204',
    },
    {
      source: 'allstate',
      companyCareerPage: 'https://www.allstate.jobs',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '0-18 months')
  assert.equal(normalized.experienceBucket, '0-1')
  assert.deepEqual(normalized.experienceYears, [0, 1])
})

test('normalizeScrapedJob parses repeated-unit year ranges when experience context is present', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'System Test, Manual Test & Automation with Linux and networking (Open)',
      company: 'Thales',
      location: 'Bangalore, India',
      city: 'Bangalore',
      jobDescription: 'Required Skills: 3yrs-5 years of comprehensive experience in an engineering integration, verification or validation team.',
      link: 'https://thales.wd3.myworkdayjobs.com/Careers/job/Bangalore---Indraprastha/Senior-IVV-Engineer_R0328180-2',
    },
    {
      source: 'thales',
      companyCareerPage: 'https://thales.wd3.myworkdayjobs.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '3-5 years')
  assert.equal(normalized.experienceBucket, '3-5')
  assert.deepEqual(normalized.experienceYears, [3, 4, 5])
})

test('normalizeScrapedJob parses minimum-hyphen year requirements from Oracle-style descriptions', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Executive - Facility Management',
      company: 'DP World',
      location: 'Modinagar, India',
      city: 'Modinagar',
      jobDescription: 'Qualification - Graduate / Experience - Minimum -5 years',
      link: 'https://ehpv.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/25977',
    },
    {
      source: 'dpworld',
      companyCareerPage: 'https://www.dpworld.com/en/careers',
      atsPlatform: 'oracle-cloud',
    },
  )

  assert.equal(normalized.experienceRequired, '5+ years')
  assert.equal(normalized.experienceBucket, '3-5')
  assert.equal(normalized.experienceProfile?.isOpenEnded, true)
  assert.deepEqual(normalized.experienceYears.slice(0, 3), [5, 6, 7])
})

test('normalizeScrapedJob parses year-or-more experience requirements from Oracle-style descriptions', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Executive',
      company: 'DP World',
      location: 'India',
      city: 'India',
      jobDescription: 'Qualification: Graduate. Experience: Experience in Temperature Controlled Transportation for 1 year or more.',
      link: 'https://ehpv.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/5028',
    },
    {
      source: 'dpworld',
      companyCareerPage: 'https://www.dpworld.com/en/careers',
      atsPlatform: 'oracle-cloud',
    },
  )

  assert.equal(normalized.experienceRequired, '1+ years')
  assert.equal(normalized.experienceBucket, '0-1')
  assert.equal(normalized.experienceProfile?.isOpenEnded, true)
  assert.deepEqual(normalized.experienceYears.slice(0, 3), [1, 2, 3])
})

test('normalizeScrapedJob parses requirement-cued years of hands-on configuration experience', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Workday Absence & Time Tracking Consultant',
      company: 'Jade Global',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      jobDescription: 'Qualifications - Must have 4 years of hands-on configuration experience in Workday Core HCM, Absence & Time Tracking.',
      link: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Bengaluru-Karnataka/Workday-Absence---Time-Tracking-Consultant_R-104548/apply',
    },
    {
      source: 'jadeglobal.workday',
      companyCareerPage: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '4 years')
})

test('normalizeScrapedJob upgrades bare numeric experience fields into year buckets', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'EV Engineering - Fellowship',
      company: 'RAPTEE HV',
      location: 'Chennai, India',
      city: 'Chennai',
      experienceRequired: '0 - 1',
      link: 'https://raptee.keka.com/careers/jobdetails/149468',
    },
    {
      source: 'rapteehv',
      companyCareerPage: 'https://www.rapteehv.com/careers',
      atsPlatform: 'keka',
    },
  )

  assert.equal(normalized.experienceRequired, '0-1 years')
  assert.equal(normalized.experienceBucket, '0-1')
  assert.deepEqual(normalized.experienceYears, [0, 1])
})

test('normalizeScrapedJob parses qualification-cued years-for experience phrasing', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Workday Benefit Consultant',
      company: 'Jade Global',
      location: 'Pune, India',
      city: 'Pune',
      jobDescription: 'Qualifications- Must have 4 years for Workday Implementation and configuration support experience. Extensive Experience in Workday Benefit and Compensation Modules.',
      link: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Workday-Benefit-Consultant_R-105244/apply',
    },
    {
      source: 'jadeglobal.workday',
      companyCareerPage: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '4 years')
})

test('normalizeScrapedJob parses all-about-you more-than experience bullets', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'EMC Engineer',
      company: 'Alstom',
      location: 'Bangalore, India',
      city: 'Bangalore',
      jobDescription: "All about you We value passion and attitude over experience. That's why we don't expect you to have every single skill. Instead, we've listed some that we think will help you succeed and grow in this ROLE: - Bachelor's degree in Electrical Engineering or Electronics & Communication Engineering - More than 5 years of EMI/EMC experience in sectors such as railway, military, aeronautics, or automotive - Knowledge of railway systems, specifically signalling systems.",
      link: 'https://jobsearch.alstom.com/job/Bangalore-EMC-Engineer-KA/1421229933/',
    },
    {
      source: 'alstom',
      companyCareerPage: 'https://jobsearch.alstom.com',
      atsPlatform: 'successfactors',
    },
  )

  assert.equal(normalized.experienceRequired, '5+ years')
})

test('normalizeScrapedJob parses basic-requirements years of demonstrated experience', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Business System Analyst',
      company: 'Motorola Solutions',
      location: 'Bangalore, India',
      city: 'Bangalore',
      jobDescription: 'Basic Requirements A bachelor\'s or Master\'s degree in Computer Science, or a related discipline. 5 years of demonstrated experience Oracle R12 EBS or Oracle Cloud applications supporting Billing, Collections and Revenue processes.',
      link: 'https://motorolasolutions.wd5.myworkdayjobs.com/Careers/job/Bangalore-offsite-India/Business-System-Analyst---Oracle-EBS---Cloud-Account-Receivable-Lead_R61921',
    },
    {
      source: 'motorolasolutions.workday',
      companyCareerPage: 'https://motorolasolutions.wd5.myworkdayjobs.com/Careers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, '5 years')
})

test('normalizeScrapedJob ignores company-history over-forty-years experience blurbs', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Product Applications Engineer',
      company: 'KLA',
      location: 'Chennai, India',
      city: 'Chennai',
      jobDescription: 'Group/Division With over 40 years of semiconductor process control experience, chipmakers around the globe rely on KLA to ensure that their fabs ramp next-generation devices to volume production quickly and cost-effectively.',
      link: 'https://kla.wd1.myworkdayjobs.com/Search/job/Chennai-India/Product-Applications-Engineer_2638024-1',
    },
    {
      source: 'kla.workday',
      companyCareerPage: 'https://kla.wd1.myworkdayjobs.com/Search',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.experienceRequired, null)
})

test('normalizeScrapedJob ignores roadmap month ranges that are not experience requirements', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Product Owner - Design Automation',
      company: 'SKF',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      jobDescription: 'Maintain a tactical/operational roadmap covering 3-6 months. Lead continuous product discovery initiatives in coordination with the PM.',
      link: 'https://career.skf.com/talentcommunity/apply/1393716433/?locale=en_GB',
    },
    {
      source: 'skfengineeringandlubricationindiapvtltd',
      companyCareerPage: 'https://career.skf.com',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.experienceRequired, null)
  assert.equal(normalized.experienceBucket, 'unspecified')
  assert.deepEqual(normalized.experienceYears, [])
})

test('normalizeScrapedJob ignores contract-duration month values in job titles when experience context is absent', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Technical Support Engineer- 12 Months Contract to Hire',
      company: 'Rippling',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://ats.rippling.com/rippling/jobs/e1594457-a30b-429b-b558-cf4c799b9ba6',
    },
    {
      source: 'rippling',
      companyCareerPage: 'https://www.rippling.com/careers',
      atsPlatform: 'rippling',
    },
  )

  assert.equal(normalized.experienceRequired, null)
  assert.equal(normalized.experienceBucket, 'unspecified')
  assert.deepEqual(normalized.experienceYears, [])
})

test('normalizeScrapedJob ignores internship duration ranges that follow hands-on experience prose', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Open Lap Internship',
      company: 'AETHRONE AEROSPACE',
      location: 'India',
      employmentType: 'Internship',
      jobDescription: 'At AETHRONE AEROSPACE, the open lab internship program offers hands-on experience to engineering students starting from their 6th semester onwards. The internship duration is 4 to 6 months during both sessions.',
      link: 'https://aethroneaerospace.com/contact-us',
    },
    {
      source: 'aethroneaerospace',
      companyCareerPage: 'https://aethroneaerospace.com/career',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.experienceRequired, 'No experience required')
  assert.equal(normalized.experienceBucket, '0-1')
  assert.deepEqual(normalized.experienceYears, [0])
  assert.equal(normalized.experienceProfile?.evidence || null, 'No experience required')
})

test('normalizeScrapedJob infers security engineeringDomain from cyber security titles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Cyber Security Analyst',
      company: 'Example Security',
      location: 'Gurugram, India',
      city: 'Gurugram',
      link: 'https://careers.example.com/jobs/cyber-security-analyst',
    },
    {
      source: 'example-security',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'greenhouse',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Security')
})

test('normalizeScrapedJob infers cloud engineeringDomain from infrastructure job content', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Support and Infrastructure Engineer (L1 & L2)',
      company: 'Example Infra',
      location: 'Pune, India',
      city: 'Pune',
      jobDescription: 'Monitor service desk tickets, maintain cloud infrastructure, manage Windows servers, and support VPN connectivity.',
      link: 'https://careers.example.com/jobs/support-infra-engineer',
    },
    {
      source: 'example-infra',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'zohorecruit',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Cloud')
})

test('normalizeScrapedJob maps technical primaryRoleDomain values back into engineeringDomain', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'QA Engineer',
      company: 'Example QA',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      primaryRoleDomain: 'Quality Engineering',
      link: 'https://careers.example.com/jobs/qa-engineer',
    },
    {
      source: 'example-qa',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'eightfold',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Verification')
})

test('normalizeScrapedJob normalizes hyphenated full-stack titles into software engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Senior Vice President, Full-Stack Engineer',
      company: 'Example Bank',
      location: 'Pune, India',
      city: 'Pune',
      link: 'https://careers.example.com/jobs/full-stack-engineer',
    },
    {
      source: 'example-bank',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'oracle-cloud',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Software Engineering')
})

test('normalizeScrapedJob maps gen ai roles into machine learning', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Senior Associate Gen AI D&A Advisory PAN India',
      company: 'Example Advisory',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://careers.example.com/jobs/gen-ai-advisory',
    },
    {
      source: 'example-advisory',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'darwinbox',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Machine Learning')
})

test('normalizeScrapedJob uses semiconductor source hints for generic product engineering titles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'ENGR PRIN, PRODUCT; PROD&TEST',
      company: 'onsemi India',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://careers.example.com/jobs/prod-test',
      source: 'onsemiindia',
    },
    {
      source: 'onsemiindia',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'oracle-cloud',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Semiconductor')
})

test('normalizeScrapedJob uses wipro administrator hints for cloud operations roles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'ADMINISTRATOR L0(CONTRACT)',
      company: 'Wipro Limited',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://careers.example.com/jobs/wipro-admin',
      source: 'wipro',
    },
    {
      source: 'wipro',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'successfactors',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Cloud')
})

test('normalizeScrapedJob uses fortinet source hints for systems security roles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Principal Systems Engineer - SecOps (SIEM / SOAR / XDR)',
      company: 'Fortinet',
      location: 'Pune, India',
      city: 'Pune',
      link: 'https://careers.example.com/jobs/secops-engineer',
      source: 'fortinet',
    },
    {
      source: 'fortinet',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Security')
})

test('normalizeScrapedJob uses hitachienergy power-system hints for design roles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Main Circuit Design Engineer - HVDC System Design',
      company: 'Hitachi Energy',
      location: 'Chennai, India',
      city: 'Chennai',
      link: 'https://careers.example.com/jobs/hvdc-design',
      source: 'hitachienergy',
    },
    {
      source: 'hitachienergy',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Power Systems')
})

test('normalizeScrapedJob maps ai solutions roles into machine learning', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'AI Solutions Engineer',
      company: 'Example AI',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://careers.example.com/jobs/ai-solutions-engineer',
    },
    {
      source: 'example-ai',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Machine Learning')
})

test('normalizeScrapedJob maps linux bsp roles into embedded systems', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Engineer / Senior Engineer (Linux BSP)',
      company: 'Example Embedded',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      link: 'https://careers.example.com/jobs/linux-bsp',
    },
    {
      source: 'example-embedded',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Embedded Systems')
})

test('normalizeScrapedJob maps stress analysis roles into mechanical engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Stress analysis Engineer',
      company: 'Example Mobility',
      location: 'Pune, India',
      city: 'Pune',
      link: 'https://careers.example.com/jobs/stress-analysis-engineer',
    },
    {
      source: 'example-mobility',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'sensehq',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Mechanical')
})

test('normalizeScrapedJob maps ai unit management titles into machine learning', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Unit Manager - AI Unit',
      company: 'Example Finance',
      location: 'Pune, India',
      city: 'Pune',
      link: 'https://careers.example.com/jobs/ai-unit-manager',
    },
    {
      source: 'example-finance-ai',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'peoplestrong',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Machine Learning')
})

test('normalizeScrapedJob maps sap advisory titles into software engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Senior Associate SAP FICO SAP Advisory Gurgaon',
      company: 'Example Advisory',
      location: 'Gurugram, India',
      city: 'Gurugram',
      link: 'https://careers.example.com/jobs/sap-fico-advisory',
    },
    {
      source: 'example-advisory',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Software Engineering')
})

test('normalizeScrapedJob maps d365 advisory titles into software engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Senior Associate D365 Technical MS Dynamics Advisory Bangalore',
      company: 'Example Advisory',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://careers.example.com/jobs/d365-advisory',
    },
    {
      source: 'example-advisory',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Software Engineering')
})

test('normalizeScrapedJob does not treat finance front-end labels as software engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Collections Manager - Front End',
      company: 'Example Finance',
      location: 'Indore, India',
      city: 'Indore',
      department: 'Collections',
      experienceRequired: '3-7 years',
      link: 'https://careers.example.com/jobs/collections-manager-front-end',
    },
    {
      source: 'example-finance',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'peoplestrong',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Unknown')
})

test('normalizeScrapedJob recomputes engineeringDomain when a persisted dry-run snapshot stored Unknown', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Cyber Security Analyst',
      company: 'Example Security',
      location: 'Gurugram, India',
      city: 'Gurugram',
      engineeringDomain: 'Unknown',
      link: 'https://careers.example.com/jobs/cyber-security-analyst',
    },
    {
      source: 'example-security',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'greenhouse',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Security')
})

test('normalizeScrapedJob keeps non-technical finance roles Unknown even when descriptions mention software or security standards', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Finance Associate (Payroll Accounting)',
      company: 'Example Finance',
      location: 'Gurugram, India',
      city: 'Gurugram',
      jobDescription: 'Ensure payroll accounting accuracy, partner with internal stakeholders, comply with security standards, and use SAP plus internal software systems.',
      requiredSkills: ['SAP'],
      link: 'https://careers.example.com/jobs/finance-associate',
    },
    {
      source: 'example-finance',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Unknown')
})

test('normalizeScrapedJob ignores html-heavy requiredSkills noise when inferring engineeringDomain', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Senior HR Executive',
      company: 'Example HR',
      location: 'Mumbai, India',
      city: 'Mumbai',
      requiredSkills: [
        'window.dataLayer = window.dataLayer || []; Senior HR Executive',
        'Managed Cloud Services',
        'Azure Services',
        '.Net Fullstack Developer',
        'Sharepoint',
        'FUNCTIONAL AREA Human Resources',
      ],
      link: 'https://careers.example.com/jobs/senior-hr-executive',
    },
    {
      source: 'example-hr',
      companyCareerPage: 'https://careers.example.com',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Unknown')
})

test('normalizeScrapedJob infers data engineering from data engineering leadership titles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Manager Data Engineering',
      company: 'Publicis Sapient',
      department: 'Technology and Engineering',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      link: 'https://careers.publicissapient.com/job-details/2026-144904-manager-data-engineering-gurgaon',
    },
    {
      source: 'publicissapient',
      companyCareerPage: 'https://careers.publicissapient.com',
      atsPlatform: 'icims',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Data Engineering')
})

test('normalizeScrapedJob infers machine learning from data science titles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Data Science - Associate Director',
      company: 'KPMG',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/INTG10041317',
    },
    {
      source: 'kpmg',
      companyCareerPage: 'https://kpmg.com',
      atsPlatform: 'oraclecloud',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Machine Learning')
})

test('normalizeScrapedJob infers software engineering from plural solutions architect titles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Manager Solutions Architect Application Technology Advisory Mumbai',
      company: 'Example Corp',
      location: 'Mumbai, India',
      city: 'Mumbai',
      link: 'https://example.wd3.myworkdayjobs.com/Global_Experienced_Careers/job/Airoli/IN-Manager--Solutions-Architect-Application-Technology-Advisory-Mumbai_736897WD-1/apply',
    },
    {
      source: 'example',
      companyCareerPage: 'https://example.wd3.myworkdayjobs.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Software Engineering')
})

test('normalizeScrapedJob infers security from appsec titles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Senior AppSec Engineer',
      company: 'Arctic Wolf',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://arcticwolf.wd1.myworkdayjobs.com/External/job/Bengaluru-IND/Senior-AppSec-Engineer_R26_501',
    },
    {
      source: 'arcticwolfindia.workday',
      companyCareerPage: 'https://arcticwolf.wd1.myworkdayjobs.com/External',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Security')
})

test('normalizeScrapedJob infers construction from BIM role acronyms', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'BIM',
      company: 'Hitachi Energy',
      department: 'Engineering & Science',
      location: 'Chennai, India',
      city: 'Chennai',
      link: 'https://www.hitachienergy.com/careers/open-jobs/details/JID3-208233',
    },
    {
      source: 'hitachienergy',
      companyCareerPage: 'https://www.hitachienergy.com/careers/open-jobs',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Construction')
})

test('normalizeScrapedJob infers oil and gas from offshore engineer titles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Offshore Engineer',
      company: 'KBR',
      department: 'Engineering, Technology, & Science',
      location: 'Chennai, India',
      city: 'Chennai',
      link: 'https://careers.kbr.com/us/en/job/R2126869/Offshore-Engineer',
    },
    {
      source: 'kbr',
      companyCareerPage: 'https://careers.kbr.com',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Oil & Gas')
})

test('normalizeScrapedJob applies agilent source hints to field service engineering roles', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Field Service Application Engineer',
      company: 'Agilent',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      link: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Careers/job/India-Ahmedabad/Field-Service-Application-Engineer_4037891',
    },
    {
      source: 'agilentindia.workday',
      companyCareerPage: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Careers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Electrical')
})

test('normalizeScrapedJob maps ingersoll application engineers into mechanical engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Senior Application Engineer',
      company: 'Ingersoll Rand',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      link: 'https://careers.irco.com/job/Ahmedabad-Senior-Application-Engineer-GJ-382330/1404756700/',
    },
    {
      source: 'ingersollrand',
      companyCareerPage: 'https://careers.irco.com',
      atsPlatform: 'phenom',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Mechanical')
})

test('normalizeScrapedJob maps techversant database engineering titles into cloud engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Principal Database Engineer',
      company: 'Techversant',
      location: 'Kochi, India',
      city: 'Kochi',
      link: 'https://techversantinfotech.com/jobs/principal-database-engineer/',
    },
    {
      source: 'techversantinfotech',
      companyCareerPage: 'https://techversantinfotech.com/jobs/',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Cloud')
})

test('normalizeScrapedJob strips html wrappers from titles before inferring engineering domains', () => {
  const normalized = normalizeScrapedJob(
    {
      title: '<span xml:lang="en-US">Non-Human Identities (NHI) Management Engineer</span>',
      company: 'SAP',
      department: 'Consulting and Professional Services',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://jobs.sap.com/job/Bengaluru/Non-Human-Identities-Management-Engineer/123456/',
    },
    {
      source: 'sap',
      companyCareerPage: 'https://jobs.sap.com',
      atsPlatform: 'successfactors',
    },
  )

  assert.equal(normalized.title, 'Non-Human Identities (NHI) Management Engineer')
  assert.equal(normalized.jobCategory, 'Non-Human Identities (NHI) Management Engineer')
  assert.equal(normalized.engineeringDomain, 'Security')
})

test('normalizeScrapedJob maps NOC-oriented RMS engineers into cloud engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Rms Engineer L2',
      company: 'Allied Digital Services',
      department: 'RMS - INDIA NOC',
      location: 'Mumbai, India',
      city: 'Mumbai',
      experienceRequired: '7-10 years',
      link: 'https://www.allieddigital.net/in/careers/hiring-now/',
    },
    {
      source: 'allieddigitalservices',
      companyCareerPage: 'https://www.allieddigital.net/in/careers/',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Cloud')
})

test('normalizeScrapedJob maps atkins architecture roles into construction engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Lead Architect',
      company: 'AtkinsRealis',
      description: 'Atkins Realis India is expanding its architectural team to support multidisciplinary projects, including infrastructure and buildings commissions.',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      link: 'https://slihrms.wd3.myworkdayjobs.com/Careers/job/INGurgaonDLF-Cyber-City/Lead-Architect_R-158156',
    },
    {
      source: 'atkinsrealis',
      companyCareerPage: 'https://slihrms.wd3.myworkdayjobs.com/Careers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Construction')
})

test('normalizeScrapedJob maps semiconductor services roles at tessolve into semiconductor engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Lead Engineer',
      company: 'Tessolve',
      department: 'Services (TSI_EMB_SRV)',
      description: 'Tessolve offers pre-silicon and post-silicon expertise for silicon bring-up and embedded product engineering.',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      link: 'https://tessolve.darwinbox.com/ms/candidatev2/main/careers/jobDetails/a6735d86647a1d',
    },
    {
      source: 'tessolve',
      companyCareerPage: 'https://tessolve.com/careers/',
      atsPlatform: 'darwinbox',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Semiconductor')
})

test('normalizeScrapedJob maps AI architect roles into machine learning even when the local snapshot is thin', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Senior Manager - AI (Architect)',
      company: 'Novartis',
      department: 'Marketing',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      link: 'https://www.novartis.com/careers/career-search/job/details/req-10069903-senior-manager-ai-architect',
    },
    {
      source: 'novartis',
      companyCareerPage: 'https://www.novartis.com/careers',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Machine Learning')
})

test('normalizeScrapedJob maps telecom fiber design roles into telecommunications', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Design Engineer',
      company: 'Techwave',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      link: 'https://techwave.wd108.myworkdayjobs.com/TechWave_Careers/job/GDC-HiTech/Design-Engineer_',
    },
    {
      source: 'techwaveconsulting',
      companyCareerPage: 'https://techwave.wd108.myworkdayjobs.com/TechWave_Careers',
      atsPlatform: 'workday',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Telecommunications')
})

test('normalizeScrapedJob maps machine-building design roles into mechanical engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Required Design Engineer with Good experience and knowledge',
      company: 'Criamos Engineering Pvt Ltd',
      location: 'Chennai, India',
      city: 'Chennai',
      link: 'https://www.criamose.com/index.php/careers',
    },
    {
      source: 'criamosengineeringpvtltd',
      companyCareerPage: 'https://www.criamose.com/index.php/careers',
      atsPlatform: 'official-company-careers',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Mechanical')
})

test('normalizeScrapedJob maps yamaha brake and suspension design roles into automotive engineering', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Suspension System Design Engineer',
      company: 'Yamaha',
      experienceRequired: '7-10 years',
      location: 'Chennai, India',
      city: 'Chennai',
      link: 'https://ymri.yamaha-motor-india.com/job-description.html?id=10012',
    },
    {
      source: 'yamaha',
      companyCareerPage: 'https://ymri.yamaha-motor-india.com/',
      atsPlatform: 'successfactors',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Automotive')
})

test('normalizeScrapedJob maps zoom technical account engineering into telecommunications', () => {
  const normalized = normalizeScrapedJob(
    {
      title: 'Technical Account Engineer',
      company: 'Zoom',
      department: 'Customer Services',
      location: 'India',
      description: 'Troubleshoot voice, video, UC issues using packet captures, SIP traces, and proprietary tools.',
      link: 'https://careers.zoom.us/jobs/technical-account-engineer-india',
    },
    {
      source: 'zoom',
      companyCareerPage: 'https://careers.zoom.us/jobs',
      atsPlatform: 'greenhouse',
    },
  )

  assert.equal(normalized.engineeringDomain, 'Telecommunications')
})
