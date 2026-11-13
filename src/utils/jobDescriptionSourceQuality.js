/** Detect captured ATS implementation data, without interpreting source instructions. */
export function assessDescriptionSource(value) {
  const source = String(value ?? '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"');
  const onboarding = /["']onboarding\s*config["']\s*:\s*\{/i.test(source);
  const switches = /["']disable\s*(?:pre\s*population|name\s*fallback\s*on\s*email)["']\s*:\s*(?:true|false)/i.test(source);
  const modes = /["'](?:view|edit)\s*mode["']\s*:\s*\{/i.test(source);
  const fields = /["'](?:field\s*label|custom\s*options)["']\s*:/i.test(source);
  if ((onboarding && switches) || (modes && fields)) return { ok: false, reason: 'non_job_source_content', kind: 'application_configuration' };
  const localization = new Set([...source.matchAll(/\b(RECRUITING_[A-Z0-9_]{4,})["']?\s*:\s*["']/g)].map(match => match[1]));
  if (localization.size >= 3) return { ok: false, reason: 'non_job_source_content', kind: 'ats_localization' };
  const formLabels = [/standard\s+job\s+title\s*\+\s*horizon/i, /sub[- ]?role\s+family/i,
    /skill\s+mapping\s*\*/i, /descriptive\s+job\s*title/i].filter(pattern => pattern.test(source));
  if (formLabels.length >= 3) return { ok: false, reason: 'non_job_source_content', kind: 'requisition_template' };
  return { ok: true };
}
