import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const JM_BAXI_HEAVY_CATALOG = {
  "source": "jmbaxiheavy",
  "companyName": "JM Baxi Heavy",
  "companyCareerPage": "https://www.jmbaxi.com/career/",
  "homepageUrl": "https://www.jmbaxi.com/",
  "companyDomain": "jmbaxi.com",
  "atsPlatform": "official-company-careers",
  "countryFilter": "India",
  "inventoryScope": "Engineering department on the official JM Baxi careers portal",
  "paginationStrategy": "homepage-plus-careers-shell-plus-joblist-postback",
  "extractionStrategy": "verified-official-homepage+verified-first-party-careers-page+verified-job-search-shell+verified-empty-joblist-postback",
  "verificationDisposition": "verified-empty-engineering-joblist-postback",
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified October 3, 2026: the official homepage, careers page, job-search form and Engineering job-list shell remain verified. Search dropdown option text was removed, while the exact POST form and department/location controls persist. The Engineering joblist POST explicitly returns the No data found marker, totalPages 0 and no job list data. Runtime inventory evidence records this Engineering-scope zero; no global group-wide job count is claimed.",
  "adapter": "script",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "dryRunFile": "jmbaxiheavy/jobs.json",
  modulePath: path.join(currentDir, 'script.js'),
}

export default JM_BAXI_HEAVY_CATALOG
