// Fixed policy text is safe for repair feedback and content-free Actions logs.
export const RESUME_LATEX_PACKAGES = Object.freeze([
  'geometry', 'fontenc', 'lmodern', 'titlesec', 'enumitem', 'tabularx', 'array', 'multicol', 'xcolor', 'hyperref', 'fancyhdr',
  'latexsym', 'fullpage', 'babel', 'fontawesome5',
]);

export const RESUME_LATEX_REASONS = Object.freeze({
  size_or_encoding: 'document size or encoding. Return a UTF-8 document within 256 KiB without control characters',
  document_structure: 'a complete self-contained article is required. Return exactly one document from \\documentclass[11pt]{article} through \\end{document}, with one \\begin{document} and no surrounding prose or Markdown',
  template_mismatch: 'the selected Abey template is required. Copy its exact supplied preamble through \\begin{document}, keep its centered contact header and ruled sections, and fill its resume macros with candidate facts. Use at least one \\resumeSubheading, \\resumeProjectHeading or \\resumeItem in the body. Do not change the template definitions, margins or packages',
  font_size: 'all text must be at least 10pt. Use an article class of 10pt, 11pt or 12pt; remove \\tiny and \\scriptsize. Use \\small only with an 11pt or 12pt class and \\footnotesize only with a 12pt class. Use braced numeric sizes of at least 10 with \\fontsize',
  unsupported_command: 'unsupported commands or external dependencies. Remove file access, shell commands, font loading, pdfTeX-only commands (including \\pdfgentounicode), TeX primitives and scaling commands; use portable LaTeX formatting',
  tex_escape_hatch: 'unsupported TeX escape hatch. Remove internal commands containing @, \\makeatletter, \\ExplSyntaxOn and TeX primitive changes; use standard LaTeX commands',
  unsupported_package: `unsupported package. Remove all packages outside this cached allowlist: ${RESUME_LATEX_PACKAGES.join(', ')}. Do not add inputenc, fontspec or other dependencies; use only the template's cached icon font`,
  unsafe_link: 'unsafe link destination. Use only source-supported http:, https:, mailto: or tel: destinations with no encoded nulls or newlines',
  link_placement: 'put useful links inline with their contact, project, activity or certification. Remove standalone Links sections and generic Original link labels; unused annotation-only references may be omitted',
});
