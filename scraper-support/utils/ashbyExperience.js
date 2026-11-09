import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

export const extractAshbyExperienceRequired = ({ title, jobDescription }) =>
  extractJobFilterSignals({
    title,
    jobDescription,
    experienceRequired: null,
  }).experienceProfile?.evidence || null
