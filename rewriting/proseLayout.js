import { recoverDescriptionLayout } from '../src/utils/jobDescriptionLayout.js';

/** Source-only layout recovery is separate from accepted model wording changes. */
export const formatProseLayout = source => {
  const { text, paragraphBreaks } = recoverDescriptionLayout(source);
  return { text, paragraphBreaks };
};
