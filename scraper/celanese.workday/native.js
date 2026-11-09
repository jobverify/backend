import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js';
import { CONFIG } from './parser.js';
const scraper = createFirstPartyHTMLScraper(CONFIG);
const region = value => typeof value === 'string' && value.trim() && !/^unavailable$/i.test(value.trim()) ? value.trim() : null;
export const collect = scraper.collect;
export async function runNative(options) {
  const jobs = await scraper.run(options);
  for (const job of jobs) {
    job.location = [...new Set(job.nativeCountryAddresses.filter(address => address.country === 'India').map(address => [address.raw.addressLocality, region(address.raw.addressRegion), 'India'].filter(Boolean).join(', ')))].join(' / ');
    job.state = job.nativeCountryAddresses.length === 1 ? region(job.nativeCountryAddresses[0].raw.addressRegion) : null;
    job.nativeListingJobLabel = job.nativeFacts.nativeListingJobLabel;
    job.nativePublicationProvenance = job.nativeFacts.nativePublicationProvenance;
  }
  return jobs;
}
