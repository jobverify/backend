import { unavailable } from './unavailable.js';
// Preparation is dispatched to tailored-resumes.yml; never extract uploads in Workers.
export async function extractResumeContent() { throw unavailable('Resume document extraction'); }
