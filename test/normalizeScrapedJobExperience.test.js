import assert from 'node:assert/strict'
import test from 'node:test'

import {
  inferMissingExperienceRequired,
  normalizeScrapedJob,
} from '../scraper-support/utils/normalizeScrapedJob.js'

test('normalizes a high-confidence experience requirement from a description when the scraper omits it', () => {
  const normalized = normalizeScrapedJob({
    title: 'Game Designer II',
    company: 'Electronic Arts',
    location: 'Hyderabad, India',
    sourceUrl: 'https://jobs.example.com/game-designer-ii',
    description: 'What You Bring: 5+ years of game design experience.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5+ years')
})

test('preserves an experience value provided by the scraper', () => {
  const normalized = normalizeScrapedJob({
    title: 'Game Designer II',
    company: 'Electronic Arts',
    location: 'Hyderabad, India',
    sourceUrl: 'https://jobs.example.com/game-designer-ii',
    description: 'What You Bring: 5+ years of game design experience.',
    experienceRequired: '4-6 years',
  })

  assert.equal(normalized.experienceRequired, '4-6 years')
})

test('zero required experience takes priority over an Associate title and stale junior inference', () => {
  for (const experienceRequired of ['0', '0 years', '0-1 years']) {
    const normalized = normalizeScrapedJob({
      title: 'Associate System Engineer', employmentType: 'Full Time',
      experienceRequired, experienceLevel: 'Junior Level',
      description: 'Batch Required Graduate 2025. Full Time (Night Shift).',
    })
    assert.equal(normalized.jobType, 'Full-time Fresher', experienceRequired)
    assert.equal(normalized.experienceLevel, 'Entry Level', experienceRequired)
    assert.equal(normalizeScrapedJob(normalized).jobType, 'Full-time Fresher')
  }
})

test('normalizes internship roles without explicit years into a no-experience requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'QA Engineer Intern',
    company: 'Example Labs',
    location: 'Hyderabad, India',
    sourceUrl: 'https://jobs.example.com/qa-engineer-intern',
    description: 'Join our internship program and work alongside experienced QA engineers on web and mobile application testing.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, 'No experience required')
})

test('normalizes a title-only year range when the official listing title carries the requirement', () => {
  const normalized = normalizeScrapedJob({
    title: '1-10yrs Application for Cyber- Kolkata DN 57 - RDC',
    company: 'Example Corp',
    location: 'Kolkata, India',
    sourceUrl: 'https://jobs.example.com/example-cyber-role',
    description: null,
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '1-10yrs')
})

test('normalizes an exact year requirement when the description explicitly says years of experience', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Maintenance Manager',
    company: 'Example Motors',
    location: 'Pune, India',
    sourceUrl: 'https://jobs.example.com/maintenance-manager',
    description: 'Candidates must bring 10 years of experience in automotive maintenance operations.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10 years')
})

test('normalizes hyphenated minimum-year wording into an open-ended experience requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Application Engineer II',
    company: 'Emerson',
    location: 'Pune, India',
    sourceUrl: 'https://jobs.example.com/application-engineer-ii',
    description: 'For This Role, You Will Need: Minimum 2-year experience of any Engineering background.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2+ years')
})

test('normalizes experience ranges written with tilde separators after an experience label', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Manager - BIW Production',
    company: 'Example Motors',
    location: 'Pune, India',
    sourceUrl: 'https://jobs.example.com/biw-production-manager',
    description: 'Degree/diploma in Mechanical/Tool& die Experience: Around 5~8 years in production operations.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5-8 years')
})

test('normalizes label-first experience ranges when the years cue appears before the numeric span', () => {
  const normalized = normalizeScrapedJob({
    title: 'IND Consultant I Health - Actuarial',
    company: 'Aon',
    location: 'Gurgaon, India',
    sourceUrl: 'https://jobs.example.com/actuarial-role',
    description: 'Required years of experience - 2-4 year of relevant experience',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2-4 years')
})

test('normalizes years-of-experience labels that carry an exact numeric requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate',
    company: 'Example Corp',
    location: 'Gurugram, India',
    sourceUrl: 'https://jobs.example.com/example-associate',
    description: 'Mandatory Skills: Consulting Preferred Skills: Energy, Utilities & Resources Years of Experience: 1 QUALIFICATIONS: MBA/PG',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '1 year')
})

test('normalizes malformed split-digit ranges in years-of-experience labels', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate Business Development iGT - Citizen and Business Services Advisory Noida',
    company: 'Example Corp',
    location: 'Noida, India',
    sourceUrl: 'https://example.wd3.myworkdayjobs.com/Global_Experienced_Careers/job/Noida/IN-Senior-Associate-Business-Development-iGT---Citizen-and-Business-Services-Advisory-Bhopal_739604WD-1',
    description: 'Years of experience required: 10 -1 5 Education qualification: Masters Degree in Economics.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10-15 years')
})

test('preserves late experience requirements that follow learn-more company copy', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate Business Development iGT - Citizen and Business Services Advisory Noida',
    company: 'Example Corp',
    location: 'Noida, India',
    sourceUrl: 'https://example.wd3.myworkdayjobs.com/Global_Experienced_Careers/job/Noida/IN-Senior-Associate-Business-Development-iGT---Citizen-and-Business-Services-Advisory-Bhopal_739604WD-1',
    description: 'Why Example Corp At Example Corp, you will be part of a vibrant community of solvers that leads with trust and creates distinctive outcomes for our clients and communities. Learn more about us. At Example Corp, we believe in providing equal employment opportunities without discrimination. Responsibilities include supporting financial sector projects and business development activities. Years of experience required: 10 -1 5 Education qualification: Masters Degree in Economics.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10-15 years')
})

test('preserves late experience requirements that follow early our-work company narrative', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate Consultant - Government Consulting',
    company: 'Sattva',
    location: 'Mumbai, India',
    sourceUrl: 'https://jobs.example.com/sattva-associate-consultant',
    description: [
      'About Sattva We partner to deliver social impact at scale across research, advisory services, and collaborative initiatives with businesses, foundations, and governments.',
      'Our work focuses on scalable solutions for sustainable social impact across multiple geographies and stakeholder groups.',
      'Key qualifications and experiences -- 2-4 years of experience in consulting, research, project management, or stakeholder management.',
    ].join(' '),
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2-4 years')
})

test('preserves late experience requirements that follow about-company narrative blocks', () => {
  const normalized = normalizeScrapedJob({
    title: 'Java Developer',
    company: 'BNP Paribas',
    location: 'Chennai, India',
    sourceUrl: 'https://jobs.example.com/bnp-java-developer',
    description: [
      'BNP Paribas is a leading international bank with a broad payments and institutional footprint across global markets.',
      'Teams collaborate across multiple countries to maintain high-availability systems for internal and external clients.',
      'About BNP Paribas India Solutions: Commitment to Diversity and Inclusion.',
      'Responsibilities include reverse engineering legacy queues, rewriting services, and supporting production troubleshooting.',
      'Specific QUALIFICATIONS: You have a bachelor or master degree in IT and at least 8 years of experience.',
    ].join(' '),
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '8+ years')
})

test('preserves late direct-responsibility plus-valued requirements after about-company narrative blocks', () => {
  const normalized = normalizeScrapedJob({
    title: 'Python Developer',
    company: 'BNP Paribas',
    location: 'Chennai, India',
    sourceUrl: 'https://jobs.example.com/bnp-python-developer',
    description: 'About BNP Paribas India Solutions: Commitment to Diversity and Inclusion. Responsibilities Direct Responsibilities 4+ Years of experience. Develop and enhance dashboard and web applications.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '4+ years')
})

test('preserves late required-qualifications plus-valued requirements after about-us copy', () => {
  const normalized = normalizeScrapedJob({
    title: 'Data Engineer(Consultant)-3',
    company: 'CDW',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/cdw-data-engineer-consultant-3',
    description: 'At CDW, we make it happen, together. Coworkers who genuinely believe in supporting our customers and one another. About us. Summary We are seeking a consultant - Data Engineering. Required Qualifications 2+ years of experience in Data Engineering.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2+ years')
})

test('preserves late job-position experience labels after about-us navigation copy', () => {
  const normalized = normalizeScrapedJob({
    title: 'Project Lead - FPGA',
    company: 'Logic Fruit Technologies',
    location: 'Gurugram, India',
    sourceUrl: 'https://jobs.example.com/logicfruit-fpga-project-lead',
    description: 'Home / About Us / Career / Current Openings / FPGA Project Lead Job Position : Project Lead (FPGA) Experience : 6+ Years Location : Gurugram/Bengaluru. Requirements: 6+ years of experience, including successful completion of FPGA based projects.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '6 years')
})

test('preserves late mixed-unit ranges after who-we-are-looking-for sections', () => {
  const normalized = normalizeScrapedJob({
    title: 'Analyst - India Partner Network (IPN)',
    company: 'Sattva',
    location: 'Bangalore, India',
    sourceUrl: 'https://jobs.example.com/sattva-ipn-analyst',
    description: 'About Sattva We partner to deliver social impact at scale across advisory services and platform programs. Who we are looking for Must-Haves -- 6 months to 1yr of experience in program coordination, project management, or operations.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '6 months - 1 year')
})

test('normalizes candidate-cued minimum years in domain requirements even with minimum typos', () => {
  const normalized = normalizeScrapedJob({
    title: 'Software Engineer III',
    company: 'Sabre',
    location: 'Bengaluru, India',
    sourceUrl: 'https://sabre.wd1.myworkdayjobs.com/en-US/SabreJobs/job/Bengaluru-Karnataka-India/Software-Engineer-III_JR108136-1',
    description: 'Good English communication skills. Must have Miniumum 2 years in Bazel and Nix. Additional assets include experience with cloud platforms and Linux.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2+ years')
})

test('normalizes labeled minimum values when the year token is split apart', () => {
  const normalized = normalizeScrapedJob({
    title: 'Manager Carbon/Green hydrogen Decarbonization Advisory Gurgaon',
    company: 'Example Corp',
    location: 'Gurgaon, India',
    sourceUrl: 'https://example.wd3.myworkdayjobs.com/Global_Experienced_Careers/job/Gurugram-10-C/IN-Manager--Carbon-Green-hydrogen--Decarbonization-Advisory-Gurgaon_635429WD-2/apply',
    description: 'Years of experience required : Minimum 7 y ears Education qualification: B.tech + MBA',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '7 years')
})

test('normalizes bracketed single-value year requirements', () => {
  const normalized = normalizeScrapedJob({
    title: 'Director, Accounting',
    company: 'Mastercard',
    location: 'Pune, India',
    sourceUrl: 'https://mastercard.wd1.myworkdayjobs.com/CorporateCareers/job/Pune-India/Director--Accounting_R-286850-1',
    description: 'All About You: Minimum of [12] years of experience in a senior leadership role within global business services.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '12+ years')
})

test('normalizes parenthesized numeric ranges after number-word normalization', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Technical Lead-Generator Excitation Solutions',
    company: 'Emerson',
    location: 'Pune, India',
    sourceUrl: 'https://jobs.example.com/emerson-generator-lead',
    description: 'Eight (8) to sixteen (16) years of experience in generator excitation systems, power electronics, and related applications.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '8-16 years')
})

test('normalizes abbreviated minimum year values in domain contexts', () => {
  const normalized = normalizeScrapedJob({
    title: 'IMp@CT- SAP S/4 HANA Roll-out Coordinator- CO',
    company: 'Example Engineering',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/en/detail-page/job-detail/REF91920T-p-125c34f3e71aa6e6a99f64b648c07145/',
    description: 'Required Qualifications: Min. 7 yrs in SAP environment for min one relevant SAP module. Min. 3 yrs in a multinational environment.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '7 years')
})

test('normalizes bare experience labels that carry an exact numeric requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate',
    company: 'Example Consulting',
    location: 'Mumbai, India',
    sourceUrl: 'https://jobs.example.com/associate-role',
    description: 'Experience: 1 Qualification: Graduate',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '1 year')
})

test('normalizes descriptive between-and experience ranges into bounded year requirements', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Software Engineer - Android',
    company: 'Chingari',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/chingari-android-senior',
    description: 'Your Experience Across The Years in the Roles You’ve Played - Total work experience between 4 and 5 years.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '4-5 years')
})

test('normalizes greater-than experience labels into open-ended year requirements', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate General Manager-Supply Chain',
    company: 'ExampleCo',
    location: 'Pithampur, India',
    sourceUrl: 'https://jobs.example.com/supply-chain',
    description: 'Relevant Experience >12 years and shall have independently led supply chain functions.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '12+ years')
})

test('normalizes minimum experience requirement labels that provide exact year values', () => {
  const normalized = normalizeScrapedJob({
    title: 'PAT Engineer- A&U',
    company: 'Tata Motors',
    location: 'Pune, India',
    sourceUrl: 'https://jobs.example.com/tata-pat-engineer',
    description: 'Minimum experience requirement 2 Years Working knowledge requirement Expertise in Digital Ergonomics.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2 years')
})

test('normalizes open-ended year values even when bullet markers collapse into the unit token', () => {
  const normalized = normalizeScrapedJob({
    title: 'Module Lead - .Net Core , C#, WPF',
    company: 'Example Software',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/example-module-lead',
    description: 'Software development experience of 5+ yearso Strong hands-on experience on Object Oriented Design.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5+ years')
})

test('normalizes compact yearsexperience tokens when spaces collapse around the requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Java Developer',
    company: 'BNP Paribas',
    location: 'Chennai, India',
    sourceUrl: 'https://jobs.example.com/bnp-java-developer-compact',
    description: 'Minimum 5yearsexperiencein Java development, including JEE projects and cloud migration work.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5+ years')
})

test('prefers corrupted primary ranges over smaller secondary clauses when question marks replace the dash', () => {
  const normalized = normalizeScrapedJob({
    title: 'Lead Engineer - Agentic AI',
    company: 'Yubi',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/yubi-agentic-ai-lead',
    description: 'Requirements REQUIRED SKILLS & QUALIFICATIONS Technical 5?8 years of full-stack engineering experience, with at least 1-2 years in AI/LLM product development.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5-8 years')
})

test('normalizes plus-shorthand experience wording even when the unit is omitted', () => {
  const normalized = normalizeScrapedJob({
    title: 'Interoperability Software Architect',
    company: 'Philips',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/interoperability-architect',
    description: 'You are fit if: 14+ experience in Software Development, Software Design and Architecture, Testing and Quality Assurance or equivalent.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '14+ years')
})

test('normalizes atleast phrasing with apostrophized year units into open-ended requirements', () => {
  const normalized = normalizeScrapedJob({
    title: 'Data Management Associate',
    company: 'JPMorgan',
    location: 'Mumbai, India',
    sourceUrl: 'https://jobs.example.com/data-management-associate',
    description: 'Possess atleast 5 years’ experience in a Data Management role with knowledge of sales processes.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5+ years')
})

test('normalizes candidate-cued over-year phrasing into open-ended requirements', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Member Technical',
    company: 'Broadridge',
    location: 'Hyderabad, India',
    sourceUrl: 'https://jobs.example.com/senior-member-technical',
    description: 'Essential Over 4 years’ relevant software development experience Strong proficiency in .NET C# applications development.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '4+ years')
})

test('normalizes experienced-candidate phrasing into bounded year requirements', () => {
  const normalized = normalizeScrapedJob({
    title: 'Strategic Sales Business Analyst',
    company: 'AVEVA',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/strategic-sales-analyst',
    description: 'Ideal Candidate Profile MBA from a top-tier B-school 1 or 2 years experienced grads with commercial savviness.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '1-2 years')
})

test('normalizes or-more experience phrasing into open-ended year requirements', () => {
  const normalized = normalizeScrapedJob({
    title: 'Research Analyst',
    company: 'LSEG',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/research-analyst',
    description: 'Minimum 1 or more years of experience in KYC/AML. Be effective in finding data from a number of sources.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '1+ years')
})

test('normalizes word-based year ranges after number-word normalization', () => {
  const normalized = normalizeScrapedJob({
    title: 'Hardware Design Architect - DevOps R&D IT',
    company: 'NXP',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/hardware-design-architect',
    description: 'Master’s degree or equivalent practical experience in Software Engineering Ten to fifteen years of experience working in chip design industry and/or IT EDA field.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10-15 years')
})

test('normalizes HTML-encoded experience requirements from scraped descriptions', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Manager, Customer Success Operations',
    company: 'Darwinbox',
    location: 'Hyderabad, India',
    sourceUrl: 'https://jobs.example.com/customer-success-ops',
    description: '&lt;ul&gt;&lt;li&gt;3+ years of experience in leading process improvement initiatives in B2B SaaS industry&lt;/li&gt;&lt;/ul&gt;',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '3+ years')
})

test('normalizes experience ranges when the year unit is hyphenated onto the upper bound', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate Consultant - IT',
    company: 'Flex',
    location: 'Chennai, India',
    sourceUrl: 'https://jobs.example.com/flex-associate-consultant-it',
    description: 'The Experience We’re Looking to Add to Our Team: 3-5-years of experience in Windchill PDM technical, functional & support.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '3-5 years')
})

test('normalizes work-experience phrasing when the year unit trails the experience label', () => {
  const normalized = normalizeScrapedJob({
    title: 'Assistant Restaurant Manager',
    company: 'Example Hospitality',
    location: 'Mumbai, India',
    sourceUrl: 'https://careers.example.com/jobs/assistant-restaurant-manager',
    description: 'Required Qualifications 10 + 2 or Apprenticeship Certification Diploma/Graduation certification Work Experience 3 - 4 experience years. Different establishments from 4 stars to 5 stars',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '3-4 years')
})

test('normalizes Darwinbox work-experience phrasing when minimum trails a bounded range', () => {
  const normalized = normalizeScrapedJob({
    title: 'Business Development Manager - B2C',
    company: 'Polycab',
    location: 'Indore, India',
    sourceUrl: 'https://polycab.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a6d7a95b114f',
    description: 'Educational qualifications preferred Graduate Required work experience 1-3 minimum years of experience Required Competencies: Analytical thinking',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '1-3 years')
})

test('normalizes parenthesized approximate single-value experience phrasing', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Technical Lead',
    company: 'Thales',
    location: 'Noida, India',
    sourceUrl: 'https://thales.wd3.myworkdayjobs.com/Careers/job/Noida/Senior-Technical--Lead_R0330751-1',
    description: 'You are a recent graduate with a Master’s degree from an Engineering school and have some significant (around 2 years) experience (professional/internships, academic or personal projects).',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2 years')
})

test('normalizes compact hyphenated to-range experience phrasing', () => {
  const normalized = normalizeScrapedJob({
    title: 'Accounting & Reporting Analyst - Accounts Payable',
    company: 'ABB',
    location: 'Bangalore, India',
    sourceUrl: 'https://abb.wd3.myworkdayjobs.com/External_Career_Page/job/Bangalore-Karnataka-India/Accounting---Reporting-Analyst---Accounts-Payable_JR00040844',
    description: 'Qualifications for the role You are immersed engaged in you enjoy working with SAP Ability to demonstrate as 2-to-4-year experience or skills in, SAP, AP, P2P, invoice processing',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2-4 years')
})

test('preserves plain-text less-than notation so later numeric experience requirements still parse', () => {
  const normalized = normalizeScrapedJob({
    title: 'Analog IC Design Engineer',
    company: 'Texas Instruments',
    location: 'Bengaluru, India',
    sourceUrl: 'https://edbz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/25009925/',
    description: "Job Description About Ultra-Wide-Band (UWB): Ultra-Wide-Band uses short pulses <3-4ns for secure ranging and later explains architecture decisions, calibration logic, and role scope. Qualifications Minimum requirements: Bachelor's degree in Electrical Engineering 5 years of relevant experience Candidate should have gone through 1 complete design cycle of an RF transceiver. 0 --> Recruitment events Students & new grads are listed elsewhere on the site.",
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5 years')
})

test('normalizes plus wording when it trails the year unit before experience', () => {
  const normalized = normalizeScrapedJob({
    title: 'Cloud Account Executive',
    company: 'Salesforce',
    location: 'Gurgaon, India',
    sourceUrl: 'https://salesforce.wd12.myworkdayjobs.com/external_career_site/job/India---Gurgaon/Cloud-Account-Executive_JR350211',
    description: 'Required Skills/Experience: Software / Saas Solution selling to the above mentioned Industry verticals will be an added advantage. Minimum 10 years plus of experience with selling technology solutions.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10+ years')
})

test('normalizes plus-after-unit experience phrasing with embedded design qualifiers', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Electrical Engineer',
    company: 'Worley',
    location: 'Hyderabad, India',
    sourceUrl: 'https://jobs.worley.com/careers/job/1133913746023',
    description: 'About You Degree in Electrical engineering (B.E. or B. Tech). 6 years + plus design experience within the hydrocarbons.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '6+ years')
})

test('normalizes cue-based single-value experience with a domain noun between of and experience', () => {
  const normalized = normalizeScrapedJob({
    title: 'Compliance & Audit Administrator',
    company: 'ZS',
    location: 'Pune, India',
    sourceUrl: 'https://jobs.zs.com/jobs/24262?lang=en-us',
    description: 'What you’ll bring: 2 years of information systems experience with audit planning, risk assessment, and reporting/documentation.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2 years')
})

test('normalizes hyphenated at-least phrasing with a role qualifier into an open-ended requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Customs Operations FinOps Specialist',
    company: 'ExampleCo',
    location: 'Airoli, India',
    sourceUrl: 'https://careers.example.com/jobs/customs-operations-finops-specialist',
    description: 'We are looking for: Any Graduate with at-least 2 years of Customer Service experience. Background in Finance would be added advantage.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2+ years')
})

test('normalizes minimum full-time experience labels into open-ended requirements', () => {
  const normalized = normalizeScrapedJob({
    title: 'Account Manager - IOT',
    company: 'Thales',
    location: 'Noida, India',
    sourceUrl: 'https://thales.wd3.myworkdayjobs.com/Careers/job/Noida/Account-Manager-Telecom-Sales_R0322044-1',
    description: 'Education Bachelors of Engineering Post Graduate Diploma (MBA) or equivalent degree from a reputed institute in Business Management is preferred Experience in years: Minimum full time 5 years. Job Location: India - Delhi',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5+ years')
})

test('normalizes comparable-to-year experience phrasing into an exact requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Manager, Clinical Sciences',
    company: 'Novartis',
    location: 'Hyderabad, India',
    sourceUrl: 'https://www.novartis.com/careers/career-search/job/details/req-10083489-manager-clinical-sciences',
    description: 'Significant clinical research or research monitoring experience (comparable to 6 years) that provides the required knowledge, skills and abilities and experience mentoring or training others.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '6 years')
})

test('normalizes minimum-requirements involvement phrasing into an open-ended requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Study Leader',
    company: 'Novartis',
    location: 'Hyderabad, India',
    sourceUrl: 'https://www.novartis.com/careers/career-search/job/details/req-10084424-senior-study-leader',
    description: 'Minimum Requirements: 4 years of recent involvement in clinical research or drug development in an academic or industry environment spanning clinical activities in Phases I through IV of standard to high complexity and priority. 3 years of recent contribution to and accomplishment in all aspects of conducting clinical studies.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '4+ years')
})

test('normalizes double-encoded nbsp minimum experience phrasing', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate Director, Client Services',
    company: 'GroupM',
    location: 'Bengaluru, India',
    sourceUrl: 'https://job-boards.greenhouse.io/wppmedia/jobs/5199350008',
    description: 'Minimum&amp;nbsp;7&amp;nbsp;years of&amp;nbsp;experience&amp;nbsp;,&amp;nbsp;with last 1 year in a similar role',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '7+ years')
})

test('normalizes key-skills shorthand up-to experience bullet points', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Analyst-Data Science',
    company: 'WPP Media',
    location: 'Gurgaon, India',
    sourceUrl: 'https://job-boards.greenhouse.io/wppmedia/jobs/5148590008',
    jobDescription: 'Profile Summary: An aspiring and skilled Data Scientist. Key Skills: (Sr Analyst) Upto 3 yrs Strong programming skills in Python and experience using Jupyter notebooks for data analysis and visualisation.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '0-3 years')
})

test('normalizes repeated year tokens in relevant work-experience phrasing', () => {
  const normalized = normalizeScrapedJob({
    title: 'Financial Controller - PROD SUPPORT & LGR CONTROL -Associate',
    company: 'JPMorgan',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210775363',
    description: 'Required qualifications, capabilities, and skills Chartered Accountant or MBA Finance or equivalent degree from any other university 6 6 years of relevant work experience in same industry or Controllership or Accounting domain.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '6 years')
})

test('normalizes required-qualifications sections when the experience requirement appears deep in the block', () => {
  const normalized = normalizeScrapedJob({
    title: 'Financial Controller - PROD SUPPORT & LGR CONTROL -Associate',
    company: 'JPMorgan',
    location: 'Mumbai, India',
    sourceUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210775363',
    jobDescription: 'Required qualifications, capabilities, and skills • Basic experience with a financial consolidation and reporting system (i.e. SAP interface) • Bachelor\'s degree in Accounting, Finance, or related business field • Basic knowledge of industry standards and regulations for US GAAP and IFRS Standards • Chartered Accountant or MBA Finance or equivalent degree from any other university • 6 6 years of relevant work experience in same industry or Controllership or Accounting domain',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '6 years')
})

test('normalizes qualifications bullets that express years with a domain background', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Vice President, Strategy',
    company: 'WPP Media',
    location: 'Mumbai, India',
    sourceUrl: 'https://job-boards.greenhouse.io/wppmedia/jobs/4985791008',
    description: 'Qualifications: 12 years with a strategy/core planning background in a media agency or a TV broadcaster/digital publisher.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '12 years')
})

test('normalizes candidate-cued experience subjects followed by parenthesized more-than year counts', () => {
  const normalized = normalizeScrapedJob({
    title: 'Solution Architect',
    company: 'Ciklum',
    location: 'Pune, India',
    sourceUrl: 'https://jobs.example.com/solution-architect',
    description: 'Requirements: Commercial experience in software development (more than 7 years); Commercial experience in solution architecture design (more than 3 years).',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '7+ years')
})

test('normalizes plus-prefixed candidate-cued year requirements tied to selling experience', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Key Account Manager',
    company: 'Logitech',
    location: 'Mumbai, India',
    sourceUrl: 'https://jobs.example.com/senior-key-account-manager',
    description: 'Important Qualifications +8 years selling in IT or UCC solutions in the B2B customer segment.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '8+ years')
})

test('normalizes over-plus candidate-cued year requirements tied to architecting work', () => {
  const normalized = normalizeScrapedJob({
    title: 'Staff/Principal GPU/CPU Kernel Optimization Engineer',
    company: 'AMD',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/kernel-optimization-engineer',
    description: 'Required Qualifications: Over +15 years of architecting software.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '15+ years')
})

test('normalizes candidate-cued exact-year requirements tied to supporting work in a domain phrase', () => {
  const normalized = normalizeScrapedJob({
    title: 'Sourcing Lead, NPI',
    company: 'Stryker',
    location: 'Gurugram, India',
    sourceUrl: 'https://stryker.wd1.myworkdayjobs.com/StrykerCareers/job/Gurugram-India/Sourcing-Lead--NPI_R565860',
    description: 'What you will need: Required Qualification: Bachelor’s degree in Engineering, or Supply Chain Management, required. 4 years engineering or supply chain management supporting new product introductions, required.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '4 years')
})

test('normalizes candidate-cued exact-year requirements tied to managing a role', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior QA Manager',
    company: 'Example Commerce',
    location: 'Gurgaon, India',
    sourceUrl: 'https://www.example.com/current-opening.html',
    description: 'An ideal candidate will possess following: 2 years in QA Manager role managing a team of over 5 QA engineers and leads.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2 years')
})

test('normalizes candidate-cued role-history phrasing that ends with for-years experience', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Software Engineer - Full-Stack',
    company: 'Avaamo',
    location: 'Bengaluru, India',
    sourceUrl: 'https://avaamo.ai/careers-full-stack-engineer-ror/',
    description: 'Minimum qualifications: Working knowledge of Ruby on Rails. Played the role of a core engineer for 3 years in at least one project/product.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '3 years')
})

test('normalizes work-experience minimum shorthand when the requirement uses exp notation', () => {
  const normalized = normalizeScrapedJob({
    title: 'Fleet Engineer (A&C)',
    company: 'Indigo',
    location: 'India',
    sourceUrl: 'https://career-in10.hr.cloud.sap/careers?company=interglobe&career_job_req_id=10001',
    description: 'Educational Qualification 10+ 2 and AME Diploma. Work Experience -Relevant/ Total Years Min. 10 years of certifying exp. On A320/ATR.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10 years')
})

test('normalizes candidate-cued year requirements when the plus sign trails the year unit', () => {
  const normalized = normalizeScrapedJob({
    title: 'Program Management Leader- Electrical Sector Global',
    company: 'Eaton',
    location: 'Pune, India',
    sourceUrl: 'https://eaton.eightfold.ai/careers/job/687236829244',
    description: 'Qualifications: B.E. / B Tech / M Tech. 15 Years +. Skills: PMP, Advanced Excel, JIRA.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '15+ years')
})

test('normalizes who-you-are year requirements when the plus sign trails the year unit', () => {
  const normalized = normalizeScrapedJob({
    title: 'Account Executive',
    company: 'Wayground',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.lever.co/Wayground/47a2dbee-4c45-4335-8f57-c71100b31f2e/apply',
    description: 'Who you are: 2 years+ proven B2B SaaS sales professional with experience selling to the US or Europe.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2+ years')
})

test('normalizes who-you-are year requirements tied to role categories', () => {
  const normalized = normalizeScrapedJob({
    title: 'Chief Happiness Officer',
    company: 'CloudSEK',
    location: 'Bengaluru, India',
    sourceUrl: 'https://job-boards.greenhouse.io/cloudsek/jobs/5790130004',
    description: 'Who you are: 10 years in people leadership, culture, org design, or performance roles.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10 years')
})

test('normalizes candidate-cued exact years when the role uses experienced-in phrasing', () => {
  const normalized = normalizeScrapedJob({
    title: 'Lead Data Scientist',
    company: 'NielsenIQ',
    location: 'Remote',
    sourceUrl: 'https://jobs.smartrecruiters.com/NielsenIQ/744000140396789-lead-data-scientist',
    description: "WE'RE LOOKING FOR PEOPLE WHO HAVE: Bachelor's or Master's Degree or Doctorate Degree. 5 years Experienced in high-level programming languages (Python or R).",
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5 years')
})

test('normalizes academic qualification and experience shorthand when the listing pairs education with years', () => {
  const normalized = normalizeScrapedJob({
    title: 'Engineering Manager: Frontend',
    company: 'Hero Motocorp',
    location: 'Gurgaon, India',
    sourceUrl: 'https://jobs.heromotocorp.com/job/Gurgaon-Engineering-Manager-Frontend-HR-122015/1222112701/',
    description: 'Academic Qualification & Experience Engineer + 2 Years Technical Skills/Knowledge Extensive Knowledge of Javascript/ES6/ES7+, React Native, React, and Redux.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2 years')
})

test('normalizes trailing-plus years that appear after a qualifications section without an explicit experience noun', () => {
  const normalized = normalizeScrapedJob({
    title: 'Senior Manager, AI Engineering',
    company: 'Anaplan',
    location: 'Bengaluru, India',
    sourceUrl: 'https://www.anaplan.com/careers/jobs/?id=8415235002',
    description: 'Preferred Qualifications Master\'s or Ph.D. in Computer Science, AI, Machine Learning, or a related field. Experience with large-scale data processing frameworks like Spark. Familiarity with the challenges of applying AI in enterprise planning or financial domains. A portfolio of published research or contributions to open-source AI projects. 10 Years + What Makes This Role Exciting',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10+ years')
})

test('normalizes degree-prefixed experience ranges when Bosch listings place years immediately after the qualification line', () => {
  const normalized = normalizeScrapedJob({
    title: 'System Architect - ADAS',
    company: 'Bosch',
    location: 'India',
    sourceUrl: 'https://jobs.bosch.com/en/job/REF286362J-system-architect-adas',
    description: 'Analyze vehicle and system data to support engineering and validation activities. B.E 10 years - 20 years',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '10-20 years')
})

test('normalizes degree-prefixed exact years when Bosch listings collapse the requirement into a qualification line', () => {
  const normalized = normalizeScrapedJob({
    title: 'Hardware Architect',
    company: 'Bosch',
    location: 'India',
    sourceUrl: 'https://jobs.bosch.com/en/job/REF288506E-hardware-architect',
    description: 'Strong problem-solving skills. Ability to work in a fast-paced environment BE/MTech in ECE, EEE, TC, Instrumentation 9 years',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '9 years')
})

test('normalizes degree-prefixed open-ended years when Bosch listings use more-than shorthand without the experience noun', () => {
  const normalized = normalizeScrapedJob({
    title: 'Executive / Assistant Manager_Supplier Quality',
    company: 'Example Engineering',
    location: 'India',
    sourceUrl: 'https://jobs.example.com/en/job/REF276282V-supplier-quality',
    description: 'Q-focus program implementation support on cost reduction and new design concept for MPP project. B.E. Mechanical with More than 7 year in industry field; >2year quality management.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '7+ years')
})

test('normalizes experience clauses whose min-max range is tucked inside parentheses', () => {
  const normalized = normalizeScrapedJob({
    title: 'BIM - Senior Lead Designer (Water - Revit Structure)',
    company: 'AtkinsRealis',
    location: 'Bengaluru, India',
    sourceUrl: 'https://slihrms.wd3.myworkdayjobs.com/Careers/job/INBangaloreRMZ-Galleria/Senior-Lead-Designer_R-156516',
    description: 'Familiar with Common Data Environment, like ACC & Project Wise. Experience in preparing 3D modelling and 2d sheets from REVIT (Min. 5 yrs. to 10 yrs.) Experience in preparing 3D modelling and 2d GAs from Auto CAD (Min. 5 yrs. to 10 yrs.).',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '5-10 years')
})

test('normalizes explicit fresher cues without numeric requirements into no experience required', () => {
  const normalized = normalizeScrapedJob({
    title: 'CX Support Analyst Fresher 2026',
    company: 'athenahealth',
    location: 'Chennai, India',
    sourceUrl: 'https://jobs.example.com/cx-support-analyst-fresher-2026',
    description: 'The position supports workflows related to US healthcare and RCM. Fresh graduates are encouraged to apply.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, 'No experience required')
})

test('classifies full-time fresher listings with positive experience as experienced', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate Researcher',
    company: 'Aabasoft',
    location: 'Kochi, India',
    sourceUrl: 'https://jobs.example.com/associate-researcher',
    jobType: 'Full-time Fresher',
    experienceRequired: '1 year',
  })

  assert.equal(normalized.jobType, 'Full-time Experienced')
  assert.equal(normalized.experienceLevel, 'Junior Level')
})

test('classifies inferred positive experience as experienced before returning normalized jobs', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate Researcher',
    company: 'Example Labs',
    location: 'Kochi, India',
    sourceUrl: 'https://jobs.example.com/inferred-associate-researcher',
    jobType: 'Full-time Fresher',
    description: 'Requirements: 2 years of research operations experience.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, '2 years')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('classifies internship-labeled listings with positive experience as experienced', () => {
  const normalized = normalizeScrapedJob({
    title: 'Finance Intern',
    company: 'Aarav Unmanned Systems',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/finance-intern',
    employmentType: 'Internship',
    experienceRequired: '1 year',
  })

  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('does not mistake company history for a job experience requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Cloud Engineer',
    company: 'Quest Global',
    location: 'Bengaluru, India',
    sourceUrl: 'https://jobs.example.com/cloud-engineer',
    description: 'At Quest Global, with over 25 years as an engineering services provider, we believe in the power of doing things differently.',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, null)
})

test('does not mistake trailing company about sections for a job experience requirement', () => {
  const normalized = normalizeScrapedJob({
    title: 'Manager - Retail Sales',
    company: 'Dentsu Aegis',
    location: 'Mumbai, India',
    sourceUrl: 'https://dentsuaegis.wd3.myworkdayjobs.com/DAN_GLOBAL/job/Mumbai/Associate-Manager---Retail-Sales_R1116160-1',
    description: 'Key RESPONSIBILITIES: Works collaboratively with colleagues and (where appropriate) local markets across Dentsu to meet client service needs Coordinates activity ensuring projects and plans deliver against objectives and on time/budget Supports Client Manager and wider team with general client liaison and administration Connects with client to support delivery of communication and service. May research new market trends to incorporate into planning. Monitors sales data to measure plan effectiveness flagging issues where appropriate Location: Mumbai Brand: Posterscope Time Type: Full time Contract Type: Permanent Can’t find a suitable job? Sign up for job alerts tailored to your interests and be first in line for new opportunities. About dentsu For over 120 years, innovation has been a core tenet of our offering – exploring new ways to reach, engage and nurture relationships with audiences. Together we drive a multiplier effect for clients at a global scale, through the development of Integrated Growth Solutions that are underpinned by our promise to clients: innovating to impact. Be a force for good. Sustainability is a vital part of our business and an important area of focus for our clients. We’re leading the way – helping to build a more sustainable planet. Dream loud. In this moment of transformation, we need our people to be fearless, embracing change and ambiguity, driven by the love for their work and excitement for the future. Team without limits. We create opportunities for connection and collaboration between our colleagues and clients, building a sense of belonging and having some fun along the way. Find out more about us Who we are Our Social Impact Our work',
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, null)
})

test('does not infer experience from privacy retention periods or planning horizons', () => {
  const normalized = normalizeScrapedJob({
    title: 'Group Product Manager',
    company: 'Headout',
    location: 'Bengaluru, India',
    sourceUrl: 'https://boards.greenhouse.io/headoutcareers/jobs/4571036006',
    description: [
      "What Skills & Experience You Need Currently operating at Lead, Staff, Principal, or GPM level in consumer tech.",
      "Strong strategic thinking: ability to zoom out to the 6 months to a 2 year horizon while maintaining operational clarity on the next 90 days.",
      "Privacy policy Please note that once you apply for this job profile your personal data will be retained for a period of one (1) year.",
    ].join(' '),
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, null)
})

test('does not infer experience from contract-duration labels', () => {
  const normalized = normalizeScrapedJob({
    title: 'SAP SuccessFactors / LMS SMEs',
    company: 'EbizON',
    location: 'Remote',
    sourceUrl: 'https://ebizon.applytojob.com/apply/l1KXempNHZ/SAP-SuccessFactors-LMS-SMEs',
    description: [
      'Leave policies allow for 32 days of leave per year.',
      'SAP SuccessFactors / LMS SMEs Remote Contracted Experienced Share ROLE:',
      'Location: Remote contract (1 year).',
      'We are looking for senior-level professionals with experience in SuccessFactors Employee Central and LMS.',
    ].join(' '),
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, null)
})

test('does not promote non-numeric medium-confidence experience phrases into experienceRequired', () => {
  const normalized = normalizeScrapedJob({
    title: 'PB India Banking Product Manager - AVP',
    company: 'Barclays',
    location: 'Mumbai, India',
    sourceUrl: 'https://search.jobs.barclays/job/mumbai/pb-india-banking-product-manager-avp/13015/97553105744',
    description: [
      'Essential Skills / Basic Qualifications:',
      'Graduate degree.',
      'Strong understanding of Indian regulatory frameworks.',
      'Experience with governance processes such as ALCO, audit, and risk committees.',
      'Commercial acumen with a client-focused mindset.',
    ].join(' '),
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, null)
  assert.equal(normalized.experienceProfile?.evidence || null, null)
})

test('preserves a source-verified missing experience requirement when the scraper has already checked the public detail page', () => {
  const normalized = normalizeScrapedJob({
    title: 'Associate Business Development iGT - Citizen and Business Services Advisory Noida',
    company: 'Example Corp',
    location: 'Noida, India',
    sourceUrl: 'https://example.wd3.myworkdayjobs.com/Global_Experienced_Careers/job/Noida/IN-Senior-Associate-Business-Development-iGT---Citizen-and-Business-Services-Advisory-Bhopal_739604WD-1',
    publicExperienceChecked: true,
    jobDescription: `
      <p style="text-align:left"><b>Line of Service</b></p>Advisory
      <p style="text-align:left"><b>Industry/Sector</b></p>Not Applicable
      <p style="text-align:left"><b>Specialism</b></p>Operations
      <p style="text-align:left"><b>Management Level</b></p>Associate
      <p style="text-align:left"><b>Job Description &amp; Summary</b></p>
      At Example Corp, our people in data and analytics focus on leveraging data to drive insights and make informed business decisions.
      They utilise advanced analytics techniques to help clients optimise their operations and achieve their strategic goals.
      <div><u>*<span>Why</span> <span>Example Corp</span></u></div>
      <div>At <span>Example Corp</span>, you will be part of a vibrant community of solvers that leads with trust and creates distinctive outcomes for our clients and communities.</div>
      <div>Learn more <a href="https://www.example.in/about-us.html" target="_blank">about us</a>.</div>
      <div>At <span>Example Corp</span>, we believe in providing equal employment opportunities, without any discrimination on the grounds of gender, ethnic background, age, disability, marital status, sexual orientation, pregnancy, gender identity or expression, religion or other beliefs, perceived differences and status protected by law.</div>
    `,
    experienceRequired: null,
  })

  assert.equal(normalized.experienceRequired, null)
})

test('keeps valid high-confidence profile evidence after a verified public-detail check', () => {
  const inferred = inferMissingExperienceRequired(
    { publicExperienceChecked: true },
    null,
    {
      confidence: 'high',
      evidence: '4-8 years',
      minimumYears: 4,
      maximumYears: 8,
    },
  )

  assert.equal(inferred, '4-8 years')
})

test('rejects reversed high-confidence profile evidence after a verified public-detail check', () => {
  const inferred = inferMissingExperienceRequired(
    { publicExperienceChecked: true },
    null,
    {
      confidence: 'high',
      evidence: '10-1 years',
      minimumYears: 10,
      maximumYears: 1,
    },
  )

  assert.equal(inferred, null)
})
test('source description remains unchanged through display normalization', () => {
  const description = 'Freshers with post-graduation or 2 - 3 years of experience. Work with PowerPoint.';
  const first = normalizeScrapedJob({ title: 'Analyst', company: 'Example', source: 'test', jobDescription: description });
  assert.equal(first.sourceDescription, description);
  const second = normalizeScrapedJob(first);
  assert.equal(second.sourceDescription, description);
});
