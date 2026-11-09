export const identifyPublicAtsBoard = value => {
  let url
  try { url = new URL(value) } catch { return null }
  if (!['http:', 'https:'].includes(url.protocol)) return null
  const parts = url.pathname.split('/').filter(Boolean)
  let atsPlatform, boardToken, region
  if (['boards.greenhouse.io', 'job-boards.greenhouse.io', 'boards.eu.greenhouse.io', 'job-boards.eu.greenhouse.io', 'boards-api.greenhouse.io', 'api.greenhouse.io'].includes(url.hostname)) {
    atsPlatform = 'greenhouse'
    boardToken = ['boards-api.greenhouse.io', 'api.greenhouse.io'].includes(url.hostname)
      ? parts[0] === 'v1' && parts[1] === 'boards' ? parts[2] : null
      : parts[0] === 'embed' ? url.searchParams.get('for') : parts[0]
  } else if (url.hostname === 'jobs.ashbyhq.com' || url.hostname === 'api.ashbyhq.com') {
    atsPlatform = 'ashby'
    boardToken = url.hostname === 'jobs.ashbyhq.com' ? parts[0]
      : parts[0] === 'posting-api' && parts[1] === 'job-board' ? parts[2] : null
  } else if (['jobs.lever.co', 'api.lever.co', 'jobs.eu.lever.co', 'api.eu.lever.co'].includes(url.hostname)) {
    atsPlatform = 'lever'
    region = url.hostname.includes('.eu.') ? 'eu' : null
    boardToken = url.hostname.startsWith('jobs.') ? parts[0]
      : parts[0] === 'v0' && parts[1] === 'postings' ? parts[2] : null
  }
  if (atsPlatform === 'ashby') {
    // Ashby publishes board names such as "Jasper AI" as one encoded path
    // component. Decode once; separators, controls and double encoding remain
    // invalid, and API builders encode the resulting name exactly once.
    try { boardToken = decodeURIComponent(boardToken || '') } catch { return null }
    if (!/^[a-z\d][a-z\d ._-]{0,100}$/i.test(boardToken) || boardToken.trim() !== boardToken) return null
  } else if (!boardToken || !/^[a-z\d][a-z\d._-]{0,100}$/i.test(boardToken)) return null
  return { atsPlatform, boardToken, ...(region ? { region } : {}) }
}

export const hasMatchingPublicAtsBinding = provider => provider.bindingEvidence?.verified === true
  && (provider.bindingEvidence.matchedLinks || []).some(link => {
    const board = identifyPublicAtsBoard(link)
    if (board?.atsPlatform === provider.atsPlatform && board.boardToken === provider.boardToken
      && (board.atsPlatform !== 'lever' || (board.region || 'global') === (provider.leverRegion || 'global'))) return true
    // A captured canonical declaration is separate from the employer's raw
    // advertised link. Only the runtime verifier can establish that bridge now.
    const policy = provider.runtimeInventoryVerification
    const proof = provider.bindingEvidence.nativeBoardCanonicalEvidence
    if (provider.atsPlatform !== 'ashby' || board?.atsPlatform !== 'ashby'
      || policy?.mode !== 'board-handoff' || !proof || proof.field !== 'active-meta-og:url'
      || link !== policy.handoffBoardUrl || proof.handoffUrl !== link
      || proof.canonicalBoardUrl !== policy.boardUrl
      || proof.canonicalBoardUrl !== 'https://jobs.ashbyhq.com/' + encodeURIComponent(provider.boardToken)
      || link !== 'https://jobs.ashbyhq.com/' + encodeURIComponent(board.boardToken)
      || board.boardToken === provider.boardToken
      || board.boardToken.toLowerCase() !== provider.boardToken.toLowerCase()) return false
    return true
  })
