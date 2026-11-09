import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MYNTRA_CATALOG = {
  source: 'myntra',
  companyName: 'Myntra',
  officialBrandName: 'Myntra',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.myntra.com/',
  officialCareersLandingUrl: 'https://careers.myntra.com/',
  companyCareerPage: 'https://jobs.myntra.com/home',
  workspaceBootstrapUrl: 'https://io.spire2grow.com/ies/v1/p/workspaceId?domain=jobs.myntra.com',
  jobsCountUrl: 'https://io.spire2grow.com/ies/v1/p/requisition/_count',
  jobsSearchUrl: 'https://io.spire2grow.com/ies/v1/p/requisition/_search',
  jobsAggregationUrl: 'https://io.spire2grow.com/ies/v1/p/requisition/aggregation/_search',
  verifiedWorkspaceId: 'MYNTRA-93as3',
  atsPlatform: 'spire2grow-public-portal',
  countryFilter: 'India',
  paginationStrategy: 'public-count-plus-paginated-search-api',
  zeroResultPolicy: 'evidence-required',
  bindingEvidence: {
    verified: true,
    checkedAt: '2026-10-20T20:41:47.213Z',
    officialURL: 'https://careers.myntra.com/',
    matchedLinks: ['https://jobs.myntra.com/home'],
    evidenceOrigin: 'direct-first-party-http-html',
    httpProofFile: '../artifacts/full-catalog/myntra-native-002/002.json',
    httpProofSha256: '6fa59b55f5d636f9ebc0188d7b6112ffbe6dc370dfcaef12b6f0643f7491f670',
  },
  extractionStrategy:
    'verified-homepage-careers-link+verified-first-party-jobs-portal+public-v1-p-workspace-bootstrap+public-requisition-search',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'myntra.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.myntra.com/ links Careers to the first-party site at https://careers.myntra.com/, that its Explore Careers handoff goes to https://jobs.myntra.com/home, and that the live public jobs portal bootstraps workspace MYNTRA-93as3 from https://io.spire2grow.com/ies/v1/p/workspaceId?domain=jobs.myntra.com and exposes public requisition endpoints under /ies/v1/p/, including 70 total jobs and live India listings such as Senior Manager - Category Demand Management in Bangalore, Karnataka, India.',
  dryRunFile: 'myntra/jobs.json',
}

export default MYNTRA_CATALOG
