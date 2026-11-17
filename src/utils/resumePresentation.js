export const MAX_RESUME_PAGES = 2;

// PDF page counts come from the parser; DOCX can also carry a saved page count.
// Page counts are ceilings: never stretch a short resume to match an upload.
export function resumePageBudget(source) {
  const originalPageCount = Number.isSafeInteger(source?.pageCount) && source.pageCount > 0 ? source.pageCount : null;
  return { originalPageCount, targetPages: originalPageCount === null ? MAX_RESUME_PAGES : Math.min(originalPageCount, MAX_RESUME_PAGES),
    exact: originalPageCount === 1 };
}
