/**
 * @file Shared public job location filter for scraper output.
 * @module scraper/utils/indiaLocationFilter
 */

import { isJobInPublicLocationScope } from '../../src/utils/publicJobLocationScope.js'

export const isIndiaJob = (job = {}) => isJobInPublicLocationScope(job)

export const filterIndiaJobs = (jobs = []) => jobs.filter((job) => isIndiaJob(job))
