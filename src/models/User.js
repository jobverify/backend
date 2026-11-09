/**
 * @file Schema and indexes for user accounts and profile data.
 * @module models/User
 */

import { Schema, model } from "mongoose";
import { PREFERRED_JOB_TYPES } from "../constants/preferredJobTypes.js";
import { ACCESS_ROLES, PLAN_IDS } from "../constants/accessPlans.js";

const MAX_PROFILE_TEXT_LENGTH = 80;
const MAX_PROFILE_ITEMS = 20;

const boundedStringList = {
  validator: (items = []) =>
    items.length <= MAX_PROFILE_ITEMS &&
    items.every((item) => String(item).length <= MAX_PROFILE_TEXT_LENGTH),
  message: `Profile lists are limited to ${MAX_PROFILE_ITEMS} items of ${MAX_PROFILE_TEXT_LENGTH} characters each.`,
};

const boundedPreferredJobTypes = {
  validator: (items = []) =>
    items.length <= MAX_PROFILE_ITEMS &&
    items.every((item) => PREFERRED_JOB_TYPES.includes(String(item))),
  message: `Preferred job types must use one of: ${PREFERRED_JOB_TYPES.join(", ")}.`,
};

const ProfilePreferenceFiltersSchema = new Schema(
  {
    company: { type: [String], default: [], validate: boundedStringList },
    jobType: { type: [String], default: [], validate: boundedStringList },
    location: { type: [String], default: [], validate: boundedStringList },
    experienceYear: { type: String, default: "" },
    roleDomain: { type: [String], default: [], validate: boundedStringList },
    workArrangement: { type: [String], default: [], validate: boundedStringList },
    datePostedDays: { type: [String], default: [], validate: boundedStringList },
    sortBy: {
      type: String,
      enum: ["all", "popularity", "latest", "oldest"],
      default: "all",
    },
  },
  { _id: false },
);

const ProfileSchema = new Schema(
  {
    name: { type: String, maxlength: MAX_PROFILE_TEXT_LENGTH },
    graduateEducation: {
      type: String,
      enum: ["Undergraduate", "Postgraduate", "PhD", ""],
      default: "",
    },
    branch: { type: String, maxlength: MAX_PROFILE_TEXT_LENGTH },
    passingYear: { type: Number },
    preferredJobTypes: {
      type: [String],
      default: [],
      validate: boundedPreferredJobTypes,
    },
    locationPreference: { type: [String], default: [], validate: boundedStringList },
    profilePreferenceFilters: {
      type: ProfilePreferenceFiltersSchema,
      default: () => ({}),
    },
    telegramAlertFilters: {
      type: ProfilePreferenceFiltersSchema,
      default: () => ({}),
    },
    telegramAlertTemplate: { type: String, maxlength: 3000, default: null },
  },
  { _id: false },
);

const PremiumSchema = new Schema(
  {
    planId: {
      type: String,
      enum: Object.values(PLAN_IDS),
      default: PLAN_IDS.FREE,
    },
    status: {
      type: String,
      enum: ["inactive", "active", "expired", "cancelled"],
      default: "inactive",
    },
    startedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    lastPurchase: {
      type: Schema.Types.ObjectId,
      ref: "PlanPurchase",
      default: null,
    },
    telegramAlertsEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const GoogleAuthSchema = new Schema(
  {
    sub: {
      type: String,
      trim: true,
      default: null,
    },
    picture: {
      type: String,
      trim: true,
      default: null,
    },
    linkedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const TelegramSchema = new Schema(
  {
    chatId: { type: String, default: null },
    username: { type: String, default: null },
    linkedAt: { type: Date, default: null },
    optedOutAt: { type: Date, default: null },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, default: null },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    accessRole: {
      type: String,
      enum: Object.values(ACCESS_ROLES),
      default: ACCESS_ROLES.FREE,
    },
    premium: {
      type: PremiumSchema,
      default: () => ({}),
    },
    google: {
      type: GoogleAuthSchema,
      default: () => ({}),
    },
    telegram: {
      type: TelegramSchema,
      default: () => ({}),
    },
    // Administrative permission, independent of the member's delivery opt-in.
    telegramAlertsAllowed: { type: Boolean, default: true },
    profile: { type: ProfileSchema, default: () => ({}) },
    savedJobs: {
      type: [{
        type: Schema.Types.ObjectId,
        ref: "Job",
      }],
      default: [],
    },
    onboardingCompleted: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    pendingEmailChange: {
      type: new Schema({
        email: { type: String, required: true },
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        requestedAt: { type: Date, required: true },
        sessionVersion: { type: Number, required: true },
      }, { _id: false }),
      select: false,
      default: undefined,
    },
    deactivated: { type: Boolean, default: false },
    // Block new work during account cleanup while allowing the owner to
    // retry an interrupted account deletion through the existing auth flow.
    accountDeletingAt: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date, default: null },
    sessionVersion: { type: Number, default: 0 },
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    strict: true,
  },
);

// Mongoose includes hydrated defaults in an existing document's save. A stale
// legacy document must not write its absent-version default over a concurrent
// password reset. Explicit increments and defaults on new accounts still save.
UserSchema.pre('save', function preserveSessionRevocation() {
  if (!this.isNew && this.$isDefault('sessionVersion')) this.$ignore('sessionVersion');
  // Do not let an in-flight save of a legacy account persist a hydrated default
  // over an administrator's concurrent Telegram access change.
  if (!this.isNew && this.$isDefault('telegramAlertsAllowed')) this.$ignore('telegramAlertsAllowed');
});

UserSchema.index({ role: 1 });
UserSchema.index({ accessRole: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ "profile.passingYear": 1 });
UserSchema.index({ "premium.expiresAt": 1 });
UserSchema.index({ "google.sub": 1 }, { sparse: true });
UserSchema.index(
  { "telegram.chatId": 1 },
  {
    unique: true,
    partialFilterExpression: { "telegram.chatId": { $type: "string" } },
  },
);
UserSchema.index({ resetPasswordTokenHash: 1 }, { sparse: true });
UserSchema.index({ 'pendingEmailChange.tokenHash': 1 }, { sparse: true });
UserSchema.index(
  { onboardingCompleted: 1 },
  { partialFilterExpression: { onboardingCompleted: false } }
);

UserSchema.set("toJSON", {
  // Transforms database document representation for API JSON responses.
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.pendingEmailChange;
    delete ret.__v;
    if (ret._id) {
      ret.id = ret._id;
    }
    return ret;
  },
});

const User = model("User", UserSchema);

export default User;
