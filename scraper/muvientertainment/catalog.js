import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MUVI_ENTERTAINMENT_CATALOG = {
  "source": "muvientertainment",
  "companyName": "Muvi Entertainment",
  "officialBrandName": "Muvi",
  "adapter": "script",
  "homepageUrl": "https://www.muvi.com/",
  "companyCareerPage": "https://www.muvi.com/career/",
  "atsPlatform": "first-party-careers-pagination-plus-job-details",
  "countryFilter": "India",
  "paginationStrategy": "complete-first-party-numbered-listing-pages",
  "extractionStrategy": "verified-first-party-careers-handoff+all-listing-pages+validated-job-details+explicit-india-scope",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "companyDomain": "muvi.com",
  "verifiedOn": "2026-10-09",
  "verifiedSurfaceSummary": "Verified October 9, 2026: the official careers handoff and unfiltered /career/job-listings/ now publish three unique roles: Automation Engineer, HTML Developer and Growth Marketer (AI & Automation). Native application IDs158,151,143, titles, Remote locations and full descriptions agree; the QA, Development and Marketing category pages each expose the same one-role subset. The former Bhubaneswar onsite role is absent. All current jobs say Remote without any eligible country requirement or JobPosting country metadata. The phone form selected +91/India default is applicant input, not role-country evidence. India inventory remains unknown; the scraper correctly stays fail-closed rather than returning zero or assigning these roles to India.",
  "verifiedPublicJobCount": 3,
  "verificationDisposition": "public-remote-inventory-country-scope-unverified",
  "officialJobListingsUrl": "https://www.muvi.com/career/job-listings/",
  modulePath: path.join(currentDir, 'script.js'),
}

export default MUVI_ENTERTAINMENT_CATALOG
