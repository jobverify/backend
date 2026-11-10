// Recruitment observations already contain sanitized failure messages. Keep a
// bounded summary and strip URL queries before handing it to runner artifacts.
export const publicRecruitmentPath = value => {
  try {
    const url = new URL(value)
    return /^https?:$/.test(url.protocol) ? (url.origin + url.pathname).slice(0, 240) : null
  } catch { return null }
}

export const summarizeRecruitmentRecoveryAudit = audit => ({
  requestCount: Number.isSafeInteger(audit?.requestCount) ? audit.requestCount : 0,
  nativeRecords: Number.isSafeInteger(audit?.nativeRecords) ? audit.nativeRecords : 0,
  unresolved: (audit?.unresolved || []).slice(0, 8).filter(value => typeof value === 'string').map(value => value.slice(0, 180)),
  failures: (audit?.failures || []).slice(0, 8).map(failure => ({
    stage: failure.stage, status: failure.status, code: failure.code,
    message: String(failure.message || '').slice(0, 180), requestUrl: publicRecruitmentPath(failure.requestUrl),
  })),
  receipts: (audit?.receipts || []).slice(0, 16).map(receipt => ({
    requestedURL: publicRecruitmentPath(receipt.requestedURL), finalURL: publicRecruitmentPath(receipt.finalURL),
    status: receipt.status, bodyBytes: receipt.bodyBytes, bodySHA256: receipt.bodySHA256,
  })),
})
