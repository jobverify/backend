import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PIRIMID_CATALOG = {
  source: 'pirimid',
  companyName: 'Pirimid',
  officialBrandName: 'Pirimid Fintech',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'pirimid/jobs.json',
  companyCareerPage: 'https://pirimidtech.com/careers/',
  companyDomain: 'pirimidtech.com',
  officialCareersEmail: 'careers@pirimidtech.com',
  officialOpenPositionsSectionId: 'openPositions',
  officialSampleApplyAnchorId: 'apply-form-1',
  verifiedPublicJobCount: 1,
  verifiedSampleJobTitle: 'Director of Sales',
  verifiedSampleJobLocation: 'Ahmedabad [Hybrid]',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-inline-open-positions-page',
  extractionStrategy:
    'verified-first-party-careers-page+inline-accordion-role-cards+same-page-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://pirimidtech.com/careers/ is the live first-party Pirimid Fintech careers page for the exact-name backlog company Pirimid. The page exposes an Open Positions accordion on the same first-party URL with 1 public opening, Director of Sales in Ahmedabad [Hybrid], and the role expands inline with public description content plus a same-page Apply Now anchor to #apply-form-1 and the official careers email careers@pirimidtech.com.',
}

export default PIRIMID_CATALOG
