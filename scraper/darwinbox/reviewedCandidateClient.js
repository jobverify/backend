import {readFileSync} from 'node:fs'

const current = JSON.parse(readFileSync(new URL('./reviewedCandidateReleases.json', import.meta.url), 'utf8'))

// Retain each source's previous reviewed release. New release support is scoped
// to the exact employer origins with fresh corporate and candidate receipts.
// A known client in a changed shell still leaves scope incomplete in the caller.
export function selectReviewedCandidateClient(spec, scripts) {
  const releases = [spec.review]
  if (current.sources[spec.source] === spec.origin) releases.push({
    clientUrl: spec.origin + current.clientPath,
    clientSha256: current.clientSha256,
    rendererSha256: current.rendererSha256,
  })
  return releases.find(release => scripts.includes(release.clientUrl))
}
