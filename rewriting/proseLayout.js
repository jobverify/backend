// A display-only safety net for dense plain text, including original-source
// fallback. It replaces whitespace at existing sentence ends; no word or
// punctuation is added, removed or attributed to the model.
export const formatProseLayout = source => {
  let paragraphBreaks = 0, fence = null;
  const text = source.split('\n').map(line => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length
        && /^[ \t]*$/.test(line.slice(marker[0].length))) fence = null;
      return line;
    }
    if (fence || line.length <= 600 || /^\s*(?:#{1,6}\s|[-*+\u2022\u25cf\u25aa\u00b7]\s|\d+[.)]\s|>)/.test(line)
      || /^[ \t]/.test(line) || /[`\[\]*_~|]/.test(line)) return line;
    let sentences = 0, start = 0;
    return line.replace(/([.!?])([ \t]+)(?=\p{Lu})/gu, (match, punctuation, _space, offset) => {
      sentences++;
      if (sentences < 3 && offset + 1 - start < 420) return match;
      start = offset + match.length;
      sentences = 0;
      paragraphBreaks++;
      return punctuation + '\n\n';
    });
  }).join('\n');
  return { text, paragraphBreaks };
};
