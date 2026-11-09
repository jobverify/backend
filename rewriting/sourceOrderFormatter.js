/** Experimental source-order formatter; employer wording is retained. */
const decoder = value => value.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (whole, number) => {
  const n = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
}).replace(/&(?:quot|apos|ndash|mdash|amp|nbsp|lt|gt);/g, value => ({ '&quot;': '"', '&apos;': "'", '&ndash;': '–', '&mdash;': '—', '&amp;': '&', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>' }[value]));
const escapeMarkdown = value => value.replace(/[\\`*_{}\[\]<>#]/g, '\\$&');
const heading = /^(?:company overview|department overview|(?:more )?about (?:us|you|the role|the company|the team)|(?:job |role |position |pyramid |team )?(?:overview|description|summary)|(?:key |core |main )?responsibilities|(?:basic |minimum |preferred |required |technical )?(?:requirements|qualifications|skills)|required technical skills|preferences?|behavio[u]?rs|stakeholder management|useful links[-:]?|what (?:we need to see|you(?:'|’)ll be doing|you will do|you bring)|ways to stand out from the crowd|you should have|how you succeed|travel requirements|relocation provided|position type|referral payment plan|EEO statement|equal employment opportunity|benefits)(?:\s*\([^\n]*\))?\s*:?$/i;
const listHeading = /responsibilit|requirement|qualification|skill|what we need|what you|stand out|you should have|about you|prefer|behavio|stakeholder/i;
const inlineLabels='(?:your role and responsibilities|you will be mainly accountable for|qualifications for the role|(?:minimum|basic|required|preferred) qualifications|(?:required|preferred)(?: technical)? skills|required|preferred|responsibilities|job description|role overview|benefits|use of AI in hiring|recruitment fraud warning|(?:more )?about us|about you|you should have|what we need to see|ways to stand out from the crowd)';
const inlineHeading=new RegExp('^'+inlineLabels+'$','i');
const additionalEmployerHeading=/^(?:qualifications\s*&\s*required skills|good to have)\s*:?$/i;
const inlineBoundary=new RegExp('(^|[.!?]\\s+|\\n)('+inlineLabels+')\\s*([:.])(?=\\s|$)','gi');

// Keep the employer's section names and source order. No fact is reassigned to
// a different semantic category, and no requirement or summary is generated.
export const formatEmployerSource = (raw,{recoverInlineHeadings=false,decodeEncodedMarkup=false}={}) => {
  let source=String(raw ?? '');
  // Some ATS exports encode the entire HTML body. Decode that document before
  // stripping tags, while leaving literal markup examples in ordinary prose.
  const encodedRoot=source.match(/^\s*&lt;(div|p|section|article|h[1-6]|ul|ol|table)\b/i);
  if(decodeEncodedMarkup&&encodedRoot&&new RegExp('&lt;/'+encodedRoot[1]+'\\s*&gt;\\s*$','i').test(source))source=decoder(source);
  const plain = decoder(source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<li\b[^>]*>/gi, '\n• ').replace(/<\/?(?:p|br|div|li|h[1-6]|section|ul|ol|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')).replace(/\r\n?/g, '\n');
  const originalChunks = plain.split(/\n+/).map(s => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const structuredPlain=recoverInlineHeadings?plain.replace(inlineBoundary,(whole,before,label,delimiter)=>before+'\n'+whole.slice(before.length)+'\n'):plain;
  // Verify boundary recovery changes only whitespace before treating newly
  // exposed employer list markers as formatting rather than prose content.
  const sourceLayoutPreserved=plain.replace(/\s+/g,' ').trim()===structuredPlain.replace(/\s+/g,' ').trim();
  const chunks = structuredPlain.split(/\n+/).map(s => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  let bulletSection = false, headingCount = 0, bulletCount = 0;
  const rendered = [];
  for (const chunk of chunks) {
    const isBullet = /^[-•●◦▪*]\s+/.test(chunk);
    const text = isBullet ? chunk.replace(/^[-•●◦▪*]\s+/, '') : chunk;
    if (text.length <= 120 && (heading.test(text) || /:$/.test(text) || recoverInlineHeadings&&(inlineHeading.test(text.replace(/\s*[.:]\s*$/,''))||additionalEmployerHeading.test(text)))) {
      headingCount++; bulletSection = listHeading.test(text)||recoverInlineHeadings&&additionalEmployerHeading.test(text);
      rendered.push('## ' + escapeMarkdown(text));
    } else if (isBullet || bulletSection && text.split(/\s+/).length <= 100) {
      bulletCount++; rendered.push('- ' + escapeMarkdown(text));
    } else {
      // Break a long paragraph at its existing sentence boundaries, without
      // changing words or their order. Every sentence remains in the result.
      const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
      for (let i = 0; i < sentences.length; i += 3) rendered.push(escapeMarkdown(sentences.slice(i, i + 3).join(' ')));
    }
  }
  const description = rendered.join('\n\n');
  const originalPayload = chunks.map(s => s.replace(/^[-•●◦▪*]\s+/, '')).join(' ').replace(/\s+/g, ' ');
  const preservedPayload = description.split('\n\n').map(s => s.replace(/^(?:## |- )/, '').replace(/\\([\\`*_{}\[\]<>#])/g, '$1')).join(' ').replace(/\s+/g, ' ');
  return { description, preserved: sourceLayoutPreserved&&originalPayload === preservedPayload, sourceAvailable: chunks.length > 0, headingCount, bulletCount };
};

