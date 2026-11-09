import { Schema, model } from "mongoose";
import {
  countSuggestionCharacters,
  MAX_DAILY_SUGGESTIONS,
  MAX_SUGGESTION_CHARACTERS,
} from "../utils/userSuggestion.js";

const UserSuggestionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => {
          const characterCount = countSuggestionCharacters(value);
          return characterCount >= 1 && characterCount <= MAX_SUGGESTION_CHARACTERS;
        },
        message: `Suggestion must contain between 1 and ${MAX_SUGGESTION_CHARACTERS} characters.`,
      },
    },
    submittedDay: {
      type: String,
      required: true,
      immutable: true,
      match: /^\d{4}-\d{2}-\d{2}$/u,
    },
    dailySlot: {
      type: Number,
      required: true,
      immutable: true,
      min: 1,
      max: MAX_DAILY_SUGGESTIONS,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

UserSuggestionSchema.index(
  { user: 1, submittedDay: 1, dailySlot: 1 },
  { unique: true },
);
UserSuggestionSchema.index({ createdAt: -1, _id: -1 });
UserSuggestionSchema.index({ user: 1, createdAt: -1 });

UserSuggestionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    if (ret._id) ret.id = ret._id;
    return ret;
  },
});

const UserSuggestion = model("UserSuggestion", UserSuggestionSchema);

export default UserSuggestion;
