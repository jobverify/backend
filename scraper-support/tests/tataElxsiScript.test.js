import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobOpeningsPageUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
  isIndiaLocation,
} from '../../scraper/tataelxsi/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'tataelxsi',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildJobOpeningsPageUrl keeps Tata Elxsi listings on the official paginated route', () => {
  assert.equal(
    buildJobOpeningsPageUrl(),
    'https://www.tataelxsi.com/careers/job-openings',
  )
  assert.equal(
    buildJobOpeningsPageUrl(2),
    'https://www.tataelxsi.com/careers/job-openings?page=2',
  )
})

test('isIndiaLocation keeps Tata Elxsi India cities and rejects foreign location groups', () => {
  assert.equal(isIndiaLocation('Bangalore/ Pune/Trivandrum/Chennai/Hyderabad'), true)
  assert.equal(isIndiaLocation('Pune'), true)
  assert.equal(isIndiaLocation('UK / London / Coventry / Gaydon'), false)
  assert.equal(isIndiaLocation('Germany'), false)
})

test('extractSearchResults parses Tata Elxsi server-rendered job cards and filters them to India roles', () => {
  const html = readFixture('job-openings-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 5)
  assert.deepEqual(jobs[0], {
    title: 'Media & Streaming Solution Architect',
    location: 'Bangalore/ Pune/Trivandrum/Chennai/Hyderabad',
    city: 'Bangalore',
    jobId: 'RFH/06502',
    requisitionId: 'RFH/06502',
    sourceUrl: 'https://www.tataelxsi.com/careers/job-openings/media-streaming-solution-architect',
    postingDate: '26 Jun 2026',
    experienceRequired: '10 - 15 years',
    minimumQualification: 'B.E, B.Tech, MCA, M.E, M.Tech',
  })
  assert.equal(jobs.some((job) => job.sourceUrl.endsWith('/design-engineer-1')), false)
})

test('extractPaginationSummary reads Tata Elxsi page navigation from the official listings page', () => {
  const html = readFixture('job-openings-page-1.html')

  assert.deepEqual(extractPaginationSummary(html), {
    currentPage: 1,
    totalPages: 20,
  })
})

test('extractJobDetail pulls Tata Elxsi apply URL, responsibilities, and qualifications from the detail page', () => {
  const html = readFixture('job-detail-ai-ml-engineer.html')
  const detail = extractJobDetail(html, {
    title: 'AI ML Engineer',
    location: 'Bangalore/ Pune/Trivandrum/Chennai/Hyderabad',
    city: 'Bangalore',
    jobId: 'RFH/06686',
    requisitionId: 'RFH/06686',
    sourceUrl: 'https://www.tataelxsi.com/careers/job-openings/ai-ml-engineer',
    postingDate: '23 Jun 2026',
    experienceRequired: '6 - 12 years',
    minimumQualification: 'B.E, B.Tech, MCA, M.E, M.Tech',
  })

  assert.deepEqual(detail, {
    title: 'AI ML Engineer',
    location: 'Bangalore/ Pune/Trivandrum/Chennai/Hyderabad',
    city: 'Bangalore',
    jobId: 'RFH/06686',
    requisitionId: 'RFH/06686',
    employmentType: 'Full-time',
    experienceRequired: '6 - 12 years',
    jobDescription:
      "Tata Elxsi offers comprehensive services in Media and Communications, including research, strategy, design, software development, validation, and deployment. With global presence and deep expertise, we specialize in 5G services, Edge computing, and connectivity solutions. Responsibilities: Design and develop advanced backend components, data systems, pipelines, and microservices for AI-driven applications. Engineer and implement production-ready, cloud-native infrastructures (or on-premise), from databases to serverless architectures. Integrate and deploy AI models and services, including NLP, computer vision, and video processing solutions. Utilize Azure AI Services, Cognitive Services, and other cloud-native AI tools to build intelligent applications. Collaborate with cross-functional teams to deliver scalable and maintainable AI solutions. Follow best practices in software engineering, including CI/CD, testing, and documentation. Requirements: Bachelor's or Master's degree in Computer Science, Engineering, or a related field. AI/ML experience, especially in Gen AI, NLP, LLM, Computer Vision, Video Processing, Text Extraction, Dubbing, Transcription, Translation, Text to Video Generation, Recommendation System, Automated TV Subtitling is highly desirable. Proven experience as a senior software or data engineer, with a strong backend focus. Advanced proficiency in Python, demonstrated through real-world projects. Practical experience with backend technologies and frameworks. SQL, PySpark and Data engineering experience is a strong advantage. Expertise in Microsoft Azure, including Azure AI Services and Cognitive Services. Familiarity with AWS, AWS AI Services / Google Cloud Platform (GCP). Strong knowledge of CI/CD frameworks / MLOps and DevOps practices. Experience with Docker and Kubernetes for containerization and orchestration. Immediate joiner.",
    minimumQualification: "Bachelor's or Master's degree in Computer Science, Engineering, or a related field.",
    preferredQualification: null,
    requiredSkills: [
      'Design and develop advanced backend components, data systems, pipelines, and microservices for AI-driven applications.',
      'Engineer and implement production-ready, cloud-native infrastructures (or on-premise), from databases to serverless architectures.',
      'Integrate and deploy AI models and services, including NLP, computer vision, and video processing solutions.',
      'Utilize Azure AI Services, Cognitive Services, and other cloud-native AI tools to build intelligent applications.',
      'Collaborate with cross-functional teams to deliver scalable and maintainable AI solutions.',
      'Follow best practices in software engineering, including CI/CD, testing, and documentation.',
    ],
    postingDate: '23 Jun 2026',
    closingDate: null,
    applyUrl: 'https://tataelxsi.ramcoes.com/rvw/PortalBroadBeanCalling.aspx?username=candidate1&rfhno=15~RFH/06686&source=website',
    sourceUrl: 'https://www.tataelxsi.com/careers/job-openings/ai-ml-engineer',
  })
})
