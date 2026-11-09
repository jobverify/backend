/** Link destinations are data only; no source extraction follows a link. */
export function normalizeResumeLinks(values = []) {
  const output = [];
  for (const value of values) {
    const link = String(typeof value === 'string' ? value : value?.url || value?.href || '').trim();
    if (!link || link.length > 2048 || /[\u0000-\u0020\u007f]/u.test(link)) continue;
    try {
      const parsed = new URL(link);
      if (!['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol) || parsed.username || parsed.password) continue;
      if (parsed.protocol === 'mailto:' && (!/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}$/i.test(decodeURIComponent(parsed.pathname)) || /[?&](?:bcc|cc|attach|attachment)=/i.test(link))) continue;
      if (parsed.protocol === 'tel:' && !/^\+?[\d().-]{7,}$/.test(parsed.pathname)) continue;
      if (!output.includes(link)) output.push(link);
    } catch { /* Ignore malformed and non-web document actions. */ }
  }
  return output;
}

export function resumeLinksFromText(text = '') {
  return normalizeResumeLinks([...String(text).matchAll(/(?:https?:\/\/|mailto:|tel:)\S+/gi)].map(match => match[0].replace(/[.,;)}\]>]+$/, '')));
}

export async function extractResumeSource(input) {
  const { extractResumeContent } = await import('./resumeText.js');
  return extractResumeContent(input);
}
