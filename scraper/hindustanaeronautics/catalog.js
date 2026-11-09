import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HINDUSTAN_AERONAUTICS_CATALOG = {
  source: 'hindustanaeronautics',
  companyName: 'Hindustan Aeronautics',
  officialBrandName: 'Hindustan Aeronautics Limited',
  adapter: 'script',
  companyCareerPage: 'https://hal-india.co.in/career',
  companyDomain: 'hal-india.co.in',
  officialCareersApiUrl: 'https://hal-india.co.in/backend/wp-json/hal/v1/career?lang=en',
  officialCareerDetailApiUrl: 'https://hal-india.co.in/backend/wp-json/hal/v1/career_detail?lang=en',
  officialTodayCareerApiUrl: 'https://hal-india.co.in/backend/wp-json/hal/v1/today_career?lang=en',
  officialCorrigendumCareerApiUrl:
    'https://hal-india.co.in/backend/wp-json/hal/v1/corrigendum_count_career?lang=en',
  atsPlatform: 'official-company-careers-api',
  countryFilter: 'India',
  paginationStrategy: 'single-official-careers-api-list-plus-official-detail-api',
  extractionStrategy:
    'verified-first-party-careers-shell+official-wp-json-career-list+detail-api+open-notice-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on 2026-07-16 that the live first-party HAL careers shell is https://hal-india.co.in/career, that the same-origin official careers API at https://hal-india.co.in/backend/wp-json/hal/v1/career?lang=en returned five current entries, and that detail inspection via https://hal-india.co.in/backend/wp-json/hal/v1/career_detail?lang=en showed only the Barrackpore Division notice "Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961" remained a genuine open recruitment item while the other current entries were shortlist, merit-list, or allotment artifacts.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default HINDUSTAN_AERONAUTICS_CATALOG
