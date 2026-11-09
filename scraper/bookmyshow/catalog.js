import path from 'node:path'
import { fileURLToPath } from 'node:url'
import CURRENT_NATIVE_METADATA from '../../scraper-support/providers/providerExtensions/zz-052-bookmyshow.json' with { type: 'json' }

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY = CURRENT_NATIVE_METADATA.verifiedSurfaceSummary

export const BOOK_MY_SHOW_CATALOG = {
  ...CURRENT_NATIVE_METADATA,
  homepageUrl: "https://in.bookmyshow.com/",
  jobListingUrl: "https://in.bookmyshow.com/careers/job-listing",
  modulePath: path.join(currentDir, 'script.js'),
}

export default BOOK_MY_SHOW_CATALOG
