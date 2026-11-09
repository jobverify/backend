import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SURYALOGIX_CATALOG = {
  "source": "suryalogix",
  "companyName": "SuryaLogix",
  "adapter": "script",
  "companyCareerPage": "https://suryalogix.com/career-opportunities/",
  "atsPlatform": "first-party-careers-application-popup",
  "countryFilter": "India",
  "paginationStrategy": "current-popup-position-selector-and-hidden-archive-discovery-only",
  "extractionStrategy": "verified-first-party-homepage+careers-hidden-archive+verified-popup63761-form63770+position-selector-association+incomplete-discovery",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "companyDomain": "suryalogix.com",
  "verifiedOn": "2026-10-09",
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Verified October 9, 2026: the official careers page contains three Pune detailed cards and September 8-12, 2026 walk-in dates hidden at every Elementor breakpoint. Their application links open first-party popup63761, with form63770 and the same three position-selector choices. These choices do not prove current vacancies or deadline applicability; active public and India counts remain unknown. The adapter returns discovery-only evidence with listingComplete:false, never an authoritative empty inventory. Malformed cards, unmatched popup/form/selector associations, mixed visible and hidden hiring content, and new external hiring handoffs fail closed.",
  "zeroResultPolicy": "discovery-only",
  modulePath: path.join(currentDir, 'script.js'),
}

export default SURYALOGIX_CATALOG
