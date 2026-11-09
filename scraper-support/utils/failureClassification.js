import { isMongoOperationalError } from '../../src/utils/mongoOperationalError.js'

const getErrorText = (error = {}) => {
  const parts = [], seen = new Set()
  for (let current = error; current && typeof current === 'object' && !seen.has(current) && seen.size < 8; current = current.cause) {
    seen.add(current)
    parts.push(current.message, current.code)
    const status = current.status ?? current.statusCode ?? current.response?.status
    if (/^[1-5]\d\d$/.test(String(status))) parts.push(`HTTP ${status}`)
  }
  return parts.filter(value => value != null && value !== '').join(' ')
}

const BLOCKED_OR_ACCESS_DENIED_PATTERN =
  /http[\s_:-]*(?:401|402|403|406|407|429|451)\b|http[\s_:-]*405\b.*icims\.com|\b403\b|forbidden|blocked html|blocked response|captcha|challenge|human verification|please enable cookies|verify (?:you are )?human|unauthorized|access denied|too many requests|authorizationtoken/i

const NETWORK_OR_TIMEOUT_PATTERN =
  /workday is currently unavailable|http[\s_:-]*5\d\d\b|timeout|timed out|etimedout|(?:this|the) operation was aborted|targetclose|target closed|execution context was destroyed|socket|econn|enotfound|eai_again|fetch failed|net::err_[a-z_]+|\bnetwork\b|tls|ssl\/tls|unable to verify .*certificate|certificate (?:has expired|verification|chain|mismatch|altname|alt-name)|self-signed certificate|certificate's altnames|err_tls_cert|depth_zero_self_signed_cert|unable_to_verify_leaf_signature|und_err_connect_timeout/i

const SURFACE_DRIFT_OR_FAIL_CLOSED_PATTERN =
  /http[\s_:-]*3\d\d\b|http[\s_:-]*404\b|no longer|changed|drift|verified|re-verify|before trusting \[\]|no-jobs contract|no jobs contract|does not match|no longer matches|no longer exposes|now appears|now exposes|publicly enumerable|needs a structured scraper|no structured public job cards|emerged|reachable again|must be revalidated|validation failed|unable to validate|unable to find .* context|unable to resolve .* keka embed configuration/i

const PARSER_OR_CONTRACT_PATTERN =
  /http[\s_:-]*(?:400|422)\b|bad request|unprocessable|selector|parse|expected json|cannot read|undefined|not a function|not iterable/i

export const classifyScraperError = (error = {}) => {
  if (isMongoOperationalError(error, { networkCodes: false })) {
    return { softFailure: true, upstreamOutage: false, failureKind: 'database_unavailable' }
  }
  if (error.localTimeout === true) {
    return {
      softFailure: false,
      upstreamOutage: false,
      failureKind: error.failureKind || 'runner_timeout',
    }
  }

  if (error.softFailure === true) {
    return {
      softFailure: true,
      upstreamOutage: error.upstreamOutage === true,
      failureKind: error.failureKind || (error.upstreamOutage === true ? 'upstream_outage' : 'soft_failure'),
    }
  }

  if (error.failureType === 'upstream_unavailable') {
    return {
      softFailure: true,
      upstreamOutage: error.upstreamOutage === true,
      failureKind: 'upstream_unavailable',
    }
  }

  // A validated hard contract failure is more precise than words appearing
  // incidentally in its role URL or original JSON parser cause.
  if (error.failureKind === 'parser_or_contract_error') {
    return { softFailure: false, upstreamOutage: false, failureKind: 'parser_or_contract_error' }
  }

  const text = getErrorText(error)

  if (BLOCKED_OR_ACCESS_DENIED_PATTERN.test(text)) {
    return {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'blocked_or_access_denied',
    }
  }

  if (NETWORK_OR_TIMEOUT_PATTERN.test(text)) {
    return {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
    }
  }

  if (SURFACE_DRIFT_OR_FAIL_CLOSED_PATTERN.test(text)) {
    return {
      softFailure: true,
      upstreamOutage: false,
      failureKind: 'surface_drift_or_fail_closed',
    }
  }

  if (PARSER_OR_CONTRACT_PATTERN.test(text)) {
    return {
      softFailure: false,
      upstreamOutage: false,
      failureKind: 'parser_or_contract_error',
    }
  }

  return {
    softFailure: false,
    upstreamOutage: false,
    failureKind: 'hard_failure',
  }
}
