import UserSuggestion from "../models/UserSuggestion.js";
import { withActiveAccountWrite } from './activeAccountWrite.js';
import {
  getIndiaDayKey,
  MAX_DAILY_SUGGESTIONS,
} from "../utils/userSuggestion.js";

export class UserSuggestionDailyLimitError extends Error {
  constructor() {
    super(
      "You’ve reached today’s limit of 5 suggestions. You can send another after midnight India time.",
    );
    this.name = "UserSuggestionDailyLimitError";
  }
}

const isQuotaSlotCollision = (error) =>
  error?.code === 11000
  && error?.keyPattern?.user === 1
  && error?.keyPattern?.submittedDay === 1
  && error?.keyPattern?.dailySlot === 1;

export async function createUserSuggestion({
  userId,
  message,
  now = new Date(),
}) {
  const normalizedMessage = message.trim();
  const submittedDay = getIndiaDayKey(now);

  for (
    let dailySlot = 1;
    dailySlot <= MAX_DAILY_SUGGESTIONS;
    dailySlot += 1
  ) {
    try {
      // A duplicate quota slot aborts its transaction. Retry the next slot in
      // a fresh transaction while retaining the existing unique-index quota.
      const [suggestion] = await withActiveAccountWrite(userId, session => UserSuggestion.create([{
        user: userId,
        message: normalizedMessage,
        submittedDay,
        dailySlot,
      }], { session }));

      return {
        suggestion,
        remainingToday: MAX_DAILY_SUGGESTIONS - dailySlot,
      };
    } catch (error) {
      if (!isQuotaSlotCollision(error)) throw error;
    }
  }

  throw new UserSuggestionDailyLimitError();
}
