import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NIRMAL_BANG_CATALOG = {
  source: 'nirmalbang',
  companyName: 'Nirmal Bang',
  officialBrandName: 'Nirmal Bang',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.nirmalbang.com/',
  companyCareerPage: 'https://www.nirmalbang.com/static/career.aspx',
  officialCareersLandingUrl: 'https://www.nirmalbang.com/static/career.aspx',
  jobListingsAjaxUrl: 'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareers.aspx?pg=0',
  jobDetailsBaseUrl: 'https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=',
  atsPlatform: 'nirmalbang-first-party-ajax',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-public-ajax-listings-until-empty-page',
  extractionStrategy: 'verified-first-party-careers-page+ajax-fillcareers-list+ajax-fillcareerspop-detail',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'nirmalbang.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.nirmalbang.com/static/career.aspx is the live first-party Nirmal Bang careers page, that it renders live public opening cards through https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareers.aspx?pg=0, and that public detail payloads such as https://www.nirmalbang.com/Ajaxpages/Ajax_fillcareerspop.aspx?Cid=1216 expose real role metadata for openings including Administration Manager, Commodity Dealer, IT Senior Executive, and Risk Management Executive.',
  dryRunFile: 'nirmalbang/jobs.json',
}

export default NIRMAL_BANG_CATALOG
