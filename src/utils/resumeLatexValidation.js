// Fixed policy text is safe for repair feedback and content-free Actions logs.
export const RESUME_LATEX_PACKAGES = Object.freeze([
  'geometry', 'fontenc', 'lmodern', 'titlesec', 'enumitem', 'tabularx', 'array', 'multicol', 'xcolor', 'hyperref', 'fancyhdr',
]);

export const RESUME_LATEX_REASONS = Object.freeze({
  size_or_encoding: 'document size or encoding. Return a UTF-8 document within 256 KiB without control characters',
  document_structure: 'a complete self-contained article is required. Return exactly one document from \\documentclass[11pt]{article} through \\end{document}, with one \\begin{document} and no surrounding prose or Markdown',
  font_size: 'all text must be at least 10pt. Use an article class of 10pt, 11pt or 12pt; remove \\tiny and \\scriptsize. Use \\small only with an 11pt or 12pt class and \\footnotesize only with a 12pt class. Use braced numeric sizes of at least 10 with \\fontsize',
  unsupported_command: 'unsupported commands or external dependencies. Remove file access, shell commands, font loading, pdfTeX-only commands (including \\pdfgentounicode), TeX primitives and scaling commands; use portable LaTeX formatting',
  tex_escape_hatch: 'unsupported TeX escape hatch. Remove internal commands containing @, \\makeatletter, \\ExplSyntaxOn and TeX primitive changes; use standard LaTeX commands',
  unsupported_package: `unsupported package. Remove all packages outside this cached allowlist: ${RESUME_LATEX_PACKAGES.join(', ')}. Do not add inputenc, fontspec, icons or other dependencies`,
  unsafe_link: 'unsafe link destination. Use only source-supported http:, https:, mailto: or tel: destinations with no encoded nulls or newlines',
});
