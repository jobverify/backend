import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BOARD_URL = 'https://careers.smartrecruiters.com/AppliedCloudComputing'
export const LISTING_API_URL =
  'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings'
export const DETAIL_API_URL_TEMPLATE =
  'https://api.smartrecruiters.com/v1/companies/AppliedCloudComputing/postings/{{jobId}}'

export const APPLIED_CLOUD_COMPUTING_CATALOG = {
  source: 'appliedcloudcomputing',
  companyName: 'Applied Cloud Computing',
  officialBrandName: 'Applied Cloud Computing',
  adapter: 'script',
  homepageUrl: 'https://www.appliedcloudcomputing.com/',
  companyCareerPage: BOARD_URL,
  boardUrl: BOARD_URL,
  companyDomain: 'appliedcloudcomputing.com',
  atsPlatform: 'smartrecruiters',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-smartrecruiters-board-plus-api',
  extractionStrategy:
    'verified-exact-name-smartrecruiters-board+official-homepage-link+smartrecruiters-jobs-api+detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://careers.smartrecruiters.com/AppliedCloudComputing is still the exact-name public Applied Cloud Computing careers board, that it links back to the official https://www.appliedcloudcomputing.com/ homepage, and that the current branded shell still exposes the Careers at Applied Cloud Computing title and Jobs at Applied Cloud Computing heading even though the legacy sample titles are no longer rendered in the board HTML. The public SmartRecruiters jobs API returned 4 India postings, including Cloud Network Security Engineer, OCI Cloud and Network Engineer, Network Security Compliance Check & Remediation Engineer, and L2 CDN & Edge Security Engineer.',
  config: {
    request: {
      method: 'GET',
      query: {
        limit: '100',
        country: 'in',
      },
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: 100,
      offsetParam: 'offset',
      limitParam: 'limit',
      resultsPath: 'content',
      totalCountPath: 'totalFound',
    },
    mapping: {
      title: 'name',
      location: 'location.fullLocation',
      jobId: 'id',
      requisitionId: 'refNumber',
      sourceUrl: 'postingUrl',
      applyUrl: 'applyUrl',
      department: 'department.label',
      employmentType: 'typeOfEmployment.label',
      experienceLevel: 'experienceLevel.label',
      postingDate: 'releasedDate',
    },
    detail: {
      enabled: true,
      urlTemplate: DETAIL_API_URL_TEMPLATE,
      method: 'GET',
      mapping: {
        jobDescription: 'jobAd.sections.jobDescription.text',
        minimumQualification: 'jobAd.sections.qualifications.text',
        preferredQualification: 'jobAd.sections.additionalInformation.text',
      },
    },
    resultFilter: {
      include: [
        {
          field: 'location',
          pattern: '\\bIndia\\b',
        },
      ],
    },
    discovery: {
      listingApiUrl: LISTING_API_URL,
    },
  },
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'appliedcloudcomputing/jobs.json',
}

export default APPLIED_CLOUD_COMPUTING_CATALOG
