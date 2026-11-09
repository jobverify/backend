export const MAX_SUGGESTION_CHARACTERS = 100;
export const MAX_DAILY_SUGGESTIONS = 5;

const INDIA_OFFSET_MS = 330 * 60 * 1000;

export const countSuggestionCharacters = (value) => String(value ?? "").length;

export const getIndiaDayKey = (date = new Date()) =>
  new Date(date.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
