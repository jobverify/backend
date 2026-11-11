import {
  createUserSuggestion,
  UserSuggestionDailyLimitError,
} from "../services/userSuggestionService.js";
import UserSuggestion from "../models/UserSuggestion.js";
import { respondWithInternalError } from "../utils/respondWithInternalError.js";

export const submitUserSuggestion = async (req, res) => {
  try {
    const { suggestion, remainingToday } = await createUserSuggestion({
      userId: req.user._id,
      message: req.body.message,
    });

    return res.status(201).json({
      code: 201,
      success: true,
      message: "Thanks—your suggestion has been sent.",
      data: {
        id: suggestion.id ?? suggestion._id,
        message: suggestion.message,
        createdAt: suggestion.createdAt,
        remainingToday,
      },
    });
  } catch (error) {
    if (error instanceof UserSuggestionDailyLimitError) {
      return res.status(429).json({
        code: 429,
        success: false,
        message: error.message,
      });
    }

    return respondWithInternalError(res, error, {
      logLabel: "Failed to submit user suggestion:",
    });
  }
};

export const getUserSuggestions = async (req, res) => {
  try {
    const page = Math.min(
      2000,
      Math.max(1, Number.parseInt(req.query.page, 10) || 1),
    );
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );

    const total = await UserSuggestion.countDocuments({});
    const rows = await UserSuggestion.find({})
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "user", select: "email profile.name" })
      .lean()
      .exec();

    const data = rows.map((row) => ({
      id: row._id,
      message: row.message,
      createdAt: row.createdAt,
      resolved: row.resolved === true,
      user: row.user
        ? {
            id: row.user._id,
            email: row.user.email,
            profile: { name: row.user.profile?.name ?? "" },
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      data,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return respondWithInternalError(res, error, {
      logLabel: "Failed to list user suggestions:",
    });
  }
};

export const resolveUserSuggestion = async (req, res) => {
  try {
    const suggestion = await UserSuggestion.findByIdAndUpdate(
      req.params.id,
      { $set: { resolved: true } },
      { new: true, runValidators: true },
    );
    if (!suggestion) return res.status(404).json({ success: false, message: "Suggestion not found." });
    return res.json({ success: true, data: { id: suggestion._id, resolved: suggestion.resolved } });
  } catch (error) {
    return respondWithInternalError(res, error, { logLabel: "Failed to resolve user suggestion:" });
  }
};

export const deleteUserSuggestion = async (req, res) => {
  try {
    const suggestion = await UserSuggestion.findByIdAndDelete(req.params.id);
    if (!suggestion) return res.status(404).json({ success: false, message: "Suggestion not found." });
    return res.json({ success: true, data: { id: suggestion._id } });
  } catch (error) {
    return respondWithInternalError(res, error, { logLabel: "Failed to delete user suggestion:" });
  }
};
