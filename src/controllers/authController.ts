import { Request, Response, NextFunction } from "express";
import admin from 'firebase-admin';
import sendResponse from "../utils/reponse";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middlewares/authorize.middleware";
import { User } from "../models/user.model";
import { config } from "../configs/envConfig";
import { generateRandomName, generateToken, generateUniqueId } from "../utils/generator";
import { Logger } from "../utils/logger";
import { generateSecureHash, verifySecureHash } from "../utils/passwordHelper";
import { verifyFirebasePhoneToken } from "../utils/firebasePhoneVerification";
import { GoogleIdTokenVerificationError, verifyGoogleIdToken } from "../utils/googleIdToken";
import { APP_ACCOUNT_ROLES } from "../utils/accountScope";
import { DeviceLimit } from "../models/deviceLimit.model";
import { getCachedSettings } from "./settingsController";
import { checkAndLockDeviceRegistration } from "../services/deviceLimitService";

// ==================== RESET PASSWORD ====================
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, newPassword, firebaseIdToken } = req.body;

    if (!phoneNumber || !newPassword) {
      return sendResponse(res, 400, false, "Phone number and new password are required");
    }

    if (firebaseIdToken) {
      const firebaseVerification = await verifyFirebasePhoneToken(firebaseIdToken, phoneNumber);
      if (!firebaseVerification.success) {
        return sendResponse(res, 401, false, firebaseVerification.message);
      }
    }

    const user = await User.findOne({ phoneNumber, role: { $in: APP_ACCOUNT_ROLES }, isDeleted: false });
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.isBlocked) {
      return sendResponse(res, 403, false, "Your account is currently blocked.");
    }

    const hashedPassword = await generateSecureHash(newPassword);
    user.password = hashedPassword;
    await user.save();

    return sendResponse(res, 200, true, "Password reset successfully");
  } catch (error: any) {
    console.error("resetPassword error:", error?.message);
    return sendResponse(
      res,
      500,
      false,
      error?.message || "Internal Server Error"
    );
  }
};

// ==================== FORGOT PASSWORD ====================
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const rawPhone = req.body?.phoneNumber;

    if (!rawPhone) {
      return sendResponse(res, 400, false, "Phone number is required");
    }

    const phoneNumber = String(rawPhone).trim().replace(/\s+/g, "");
    const digitsOnly = phoneNumber.replace(/\D/g, "");
    const tenDigits = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
    const phoneRegex = new RegExp(`${tenDigits}$`);

    console.log(`[forgotPassword] Looking up phone: "${phoneNumber}" (last 10: "${tenDigits}")`);

    const user = await User.findOne({
      $or: [
        { phoneNumber },
        { phoneNumber: { $regex: phoneRegex } },
      ],
      role: { $in: APP_ACCOUNT_ROLES },
      $and: [
        { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }
      ]
    });

    console.log(`[forgotPassword] User found: ${user ? `userId=${user.userId}` : "NOT FOUND"}`);

    if (!user) {
      return sendResponse(res, 404, false, "No account found with this phone number. Please check and try again.");
    }

    if (user.isBlocked) {
      return sendResponse(res, 403, false, "Your account is currently blocked. Please contact support.");
    }

    return sendResponse(res, 200, true, "Phone number is eligible for Firebase verification.");
  } catch (error: any) {
    await Logger("forgotPassword", error);
    return sendResponse(res, 500, false, error.message || "Internal Server Error");
  }
};

// ==================== CHECK PHONE AVAILABILITY ====================
export const checkPhoneAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = req.body?.phoneNumber?.trim();
    const deviceId = req.body?.deviceId?.trim();

    if (!phone) return sendResponse(res, 400, false, "Phone number is required.");
    if (!deviceId) return sendResponse(res, 400, false, "Device ID is required.");

    const existingUser = await User.findOne({ phoneNumber: phone, role: { $in: APP_ACCOUNT_ROLES }, isDeleted: false }).lean();

    if (existingUser) {
      if (existingUser.isBlocked) {
        return sendResponse(res, 403, false, "Your account is currently blocked.");
      }

      return sendResponse(res, 400, false, "Phone number already registered.");
    }

    if (deviceId) {
      const check = await checkAndLockDeviceRegistration(deviceId, undefined, false);
      if (!check.allowed) {
        return sendResponse(
          res,
          400,
          false,
          check.message || `Registration limit reached for this device (Limit: ${check.maxAllowed || 1}). Contact Admin to increase your device registration limit.`,
          undefined,
          undefined,
          check.code || "DEVICE_REGISTRATION_LIMIT_REACHED"
        );
      }
    }

    return sendResponse(res, 200, true, "New device & phone. Send OTP for registration.");
  } catch (err) {
    await Logger("checkPhoneAvailability", err);
    return sendResponse(res, 500, false, "Something went wrong while verifying the phone number.");
  }
};

// ==================== REGISTER ====================
export const userRegister = async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, email, password, gender, deviceId, userFrom, language, country, age, firebaseIdToken } = req.body;

    const rawPhone = phoneNumber ? String(phoneNumber).trim() : "";
    const rawEmail = email ? String(email).trim().toLowerCase() : "";

    if (!rawPhone && !rawEmail) {
      return sendResponse(res, 400, false, "Phone number or email is required");
    }

    if (!password) {
      return sendResponse(res, 400, false, "Password is required");
    }

    const resolvedGender = (gender && ["male", "female", "other"].includes(gender)) ? gender : "male";
    const userAge = Number(age) || 20;

    if (rawPhone) {
      if (firebaseIdToken) {
        const firebaseVerification = await verifyFirebasePhoneToken(firebaseIdToken, rawPhone);
        if (!firebaseVerification.success) {
          return sendResponse(res, 401, false, firebaseVerification.message);
        }
      }

      const duplicatePhoneUser = await User.findOne({ phoneNumber: rawPhone, role: { $in: APP_ACCOUNT_ROLES }, isDeleted: false });
      if (duplicatePhoneUser) {
        return sendResponse(res, 400, false, "Phone number already registered");
      }
    }

    if (rawEmail) {
      const duplicateEmailUser = await User.findOne({ email: rawEmail, role: { $in: APP_ACCOUNT_ROLES }, isDeleted: false });
      if (duplicateEmailUser) {
        return sendResponse(res, 400, false, "Email already registered");
      }
    }

    if (userFrom === "app" && deviceId) {
      const check = await checkAndLockDeviceRegistration(deviceId, undefined, true);
      if (!check.allowed) {
        return sendResponse(
          res,
          400,
          false,
          check.message || `Registration limit reached for this device (Limit: ${check.maxAllowed || 1}). Contact Admin to increase your device registration limit.`,
          undefined,
          undefined,
          check.code || "DEVICE_REGISTRATION_LIMIT_REACHED"
        );
      }
    }

    const requestedUserId = req.body?.customUserId || req.body?.userId;
    const userId = requestedUserId ? Number(requestedUserId) : await generateUniqueId();
    const customMeethiId = req.body?.meethiId || req.body?.customId || String(userId);

    const name = req.body?.name || (await generateRandomName()) || `User_${userId}`;
    const hashedPassword = await generateSecureHash(password);

    let image = req.body?.image || "";
    if (!image) {
      switch (resolvedGender) {
        case "female":
          image = "https://api.darkmoon.app/uploads/avatars/female_default.webp";
          break;
        case "male":
        default:
          image = "https://api.darkmoon.app/uploads/avatars/male_default.webp";
          break;
      }
    }

    const countryObj = (typeof country === 'object' && country !== null)
      ? country
      : { name: typeof country === 'string' && country ? country : 'India', code: '+91', flag: '🇮🇳' };

    const newUser = new User({
      phoneNumber: rawPhone || undefined,
      email: rawEmail || undefined,
      password: hashedPassword,
      gender: resolvedGender,
      userId,
      meethiId: customMeethiId,
      phoneVerified: !!rawPhone,
      emailVerified: !!rawEmail,
      name,
      image,
      language: Array.isArray(language) && language.length > 0 ? language : ["English", "Hindi"],
      country: countryObj,
      authType: rawEmail ? "email" : "phone",
      age: userAge,
      device: {
        createdDeviceId: deviceId || "",
        currentDeviceId: deviceId || "",
        loggedInDeviceIds: deviceId ? [deviceId] : [],
      },
    });

    await newUser.save();

    const accessToken = await generateToken(newUser.userId.toString(), "access");
    const refreshToken = await generateToken(newUser.userId.toString(), "refresh");

    newUser.refreshToken = refreshToken;
    newUser.activeToken = accessToken;
    await newUser.save();

    return sendResponse(res, 201, true, "Registration successful", {
      accessToken,
      refreshToken,
      role: newUser.role,
      gender: newUser.gender,
      user: {
        _id: newUser._id,
        userId: newUser.userId,
        name: newUser.name,
        image: newUser.image,
        avatar: newUser.image,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        role: newUser.role,
        gender: newUser.gender,
        coins: newUser.coins || 0,
        diamonds: newUser.diamonds || 0,
        beans: newUser.beans || 0,
        level: newUser.level || 1,
      },
    });
  } catch (error: any) {
    await Logger("userRegister", error);
    return sendResponse(res, 500, false, error.message);
  }
};

// ==================== LOGIN ====================
export const userLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, userId, password, deviceId, userFrom } = req.body;

    const rawInput = (phoneNumber || userId || "").toString().trim();
    const cleanDigits = rawInput.replace(/\D/g, "");
    const last10Digits = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

    const findConditions: any[] = [];
    if (rawInput) {
      findConditions.push({ phoneNumber: rawInput });
      findConditions.push({ email: rawInput.toLowerCase() });
      findConditions.push({ meethiId: rawInput });
      findConditions.push({ userName: rawInput });
      if (!isNaN(Number(rawInput))) {
        findConditions.push({ userId: Number(rawInput) });
      }
    }
    if (last10Digits && last10Digits.length >= 7) {
      findConditions.push({ phoneNumber: new RegExp(`${last10Digits}$`) });
      if (!isNaN(Number(last10Digits))) {
        findConditions.push({ userId: Number(last10Digits) });
      }
    }

    if (findConditions.length === 0) {
      return sendResponse(res, 400, false, "Phone number or User ID is required.");
    }

    const user = await User.findOne({
      $or: findConditions,
      role: { $ne: 'owner' },
      isDeleted: false
    }).select("+password");

    if (!user) {
      return sendResponse(res, 400, false, "Account not found, please sign up.");
    }

    if (user.isBlocked) {
      return sendResponse(res, 403, false, "You are blocked due to some reason.");
    }

    if (userFrom === "app") {
      const activeDeviceId = deviceId || "APP_DEFAULT_DEVICE";

      user.device = user.device || {
        createdDeviceId: activeDeviceId,
        currentDeviceId: activeDeviceId,
        loggedInDeviceIds: [activeDeviceId],
      };

      user.device.currentDeviceId = activeDeviceId;
      if (!user.device.loggedInDeviceIds.includes(activeDeviceId)) {
        user.device.loggedInDeviceIds.push(activeDeviceId);
      }

      await user.save();
    }

    const isMatch = await verifySecureHash(password, user.password as string);
    if (!isMatch) {
      return sendResponse(res, 400, false, "Invalid credentials.");
    }

    const accessToken = await generateToken(user.userId.toString(), "access");
    const refreshToken = await generateToken(user.userId.toString(), "refresh");

    user.refreshToken = refreshToken;
    user.activeToken = accessToken;
    await user.save();

    const resolvedName = user.name || `User_${user.userId}`;
    const resolvedImage = user.image || "https://api.darkmoon.app/uploads/avatars/male_default.webp";

    return sendResponse(res, 200, true, "Login successful", {
      accessToken,
      refreshToken,
      role: user.role,
      gender: user.gender,
      user: {
        _id: user._id,
        userId: user.userId,
        name: resolvedName,
        image: resolvedImage,
        avatar: resolvedImage,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        gender: user.gender,
        coins: user.coins || 0,
        diamonds: user.diamonds || 0,
        beans: user.beans || 0,
        level: user.level || 1,
      },
    });
  } catch (error: any) {
    await Logger("login", error);
    return sendResponse(res, 500, false, error.message);
  }
};

// ==================== LOGOUT ====================
export const userLogout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.user || {};
    const { deviceId, userFrom } = req.body;

    const user = await User.findOne({ userId, isDeleted: false });
    if (!user) {
      return sendResponse(res, 400, false, "User not found.");
    }

    if (userFrom === "app") {
      if (!deviceId) {
        return sendResponse(res, 400, false, "deviceId is required for app users.");
      }

      user.device = user.device || {
        createdDeviceId: "",
        currentDeviceId: "",
        loggedInDeviceIds: [],
      };

      const isLoggedInFromDevice = user.device.loggedInDeviceIds.includes(deviceId);
      if (!isLoggedInFromDevice) {
        return sendResponse(res, 400, false, "This device is not currently logged in.");
      }

      user.device.loggedInDeviceIds = user.device.loggedInDeviceIds.filter(
        (id) => id !== deviceId
      );

      if (user.device.currentDeviceId === deviceId) {
        user.device.currentDeviceId = "";
      }

      await user.save();
    }

    user.isOnline = false;
    user.isActive = false;
    user.isBusy = false;
    user.fcmToken = "";
    user.refreshToken = "";
    user.activeToken = "";
    await user.save();

    try {
      const { invalidateHostCache } = await import('../services/user.service');
      invalidateHostCache();
    } catch (err: any) {
      console.warn('Failed to invalidate host cache on logout:', err?.message);
    }

    return sendResponse(res, 200, true, "Logout successful.");
  } catch (error: any) {
    await Logger("logout", error);
    return sendResponse(res, 500, false, error.message);
  }
};

// ==================== GOOGLE AUTH ====================
export const userGoogleAuth = async (req: Request, res: Response) => {
  try {
    const { googleIdToken, deviceId, userFrom, gender, language, country, age } = req.body;

    if (!googleIdToken) return sendResponse(res, 400, false, "Google token required");

    const ticket = await verifyGoogleIdToken(googleIdToken);

    const payload = ticket.getPayload();
    if (!payload) return sendResponse(res, 400, false, "Invalid credentials");

    const googleUserInfo = {
      email: payload.email,
      name: payload.name,
      googleId: payload.sub,
    };

    let user = await User.findOne({ googleId: googleUserInfo.googleId, role: { $in: APP_ACCOUNT_ROLES }, isDeleted: false });

    if (user) {
      if (userFrom === "app") {
        user.device = user.device || { createdDeviceId: "", currentDeviceId: "", loggedInDeviceIds: [] };
        if (!user.device.createdDeviceId) user.device.createdDeviceId = deviceId || '';
        if (deviceId && !user.device.loggedInDeviceIds.includes(deviceId)) user.device.loggedInDeviceIds.push(deviceId);
        user.device.currentDeviceId = deviceId || user.device.currentDeviceId;
        await user.save();
      }

      const accessToken = await generateToken(user.userId.toString(), "access");
      const refreshToken = await generateToken(user.userId.toString(), "refresh");
      user.refreshToken = refreshToken;
      user.activeToken = accessToken;
      await user.save();

      const resolvedName = user.name || `User_${user.userId}`;
      const resolvedImage = user.image || "https://api.darkmoon.app/uploads/avatars/male_default.webp";

      return sendResponse(res, 200, true, "Google login successful", {
        accessToken,
        refreshToken,
        role: user.role,
        gender: user.gender,
        isAccount: true,
        user: {
          _id: user._id,
          userId: user.userId,
          name: resolvedName,
          image: resolvedImage,
          avatar: resolvedImage,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          gender: user.gender,
          coins: user.coins || 0,
          diamonds: user.diamonds || 0,
          beans: user.beans || 0,
          level: user.level || 1,
        },
      });
    }

    const resolvedGender = (gender && ["male", "female", "other"].includes(gender)) ? gender : "male";
    const resolvedLanguage = Array.isArray(language) && language.length > 0 ? language : ["English", "Hindi"];
    const userCountry = (typeof country === 'string' ? { name: country } : country) || { name: 'India', code: '+91', flag: '🇮🇳' };
    const userAge = (Number(age) && !isNaN(Number(age)) && Number(age) >= 18) ? Number(age) : 20;

    const existingEmailUser = await User.findOne({ email: googleUserInfo.email, role: { $in: APP_ACCOUNT_ROLES }, isDeleted: false });
    if (existingEmailUser) {
      if (!payload.email_verified) {
        return sendResponse(res, 403, false, "Google email must be verified");
      }
      existingEmailUser.googleId = googleUserInfo.googleId;
      existingEmailUser.device = existingEmailUser.device || { createdDeviceId: "", currentDeviceId: "", loggedInDeviceIds: [] };
      if (!existingEmailUser.device.createdDeviceId) existingEmailUser.device.createdDeviceId = deviceId || '';
      if (deviceId && !existingEmailUser.device.loggedInDeviceIds.includes(deviceId)) {
        existingEmailUser.device.loggedInDeviceIds.push(deviceId);
      }
      existingEmailUser.device.currentDeviceId = deviceId || existingEmailUser.device.currentDeviceId;
      const accessToken = await generateToken(existingEmailUser.userId.toString(), "access");
      const refreshToken = await generateToken(existingEmailUser.userId.toString(), "refresh");
      existingEmailUser.refreshToken = refreshToken;
      existingEmailUser.activeToken = accessToken;
      await existingEmailUser.save();

      const resolvedName = existingEmailUser.name || googleUserInfo.name || `User_${existingEmailUser.userId}`;
      const resolvedImage = existingEmailUser.image || (payload.picture as string) || "https://api.darkmoon.app/uploads/avatars/male_default.webp";

      return sendResponse(res, 200, true, "Google account linked successfully", {
        accessToken,
        refreshToken,
        role: existingEmailUser.role,
        gender: existingEmailUser.gender,
        isAccount: true,
        user: {
          _id: existingEmailUser._id,
          userId: existingEmailUser.userId,
          name: resolvedName,
          image: resolvedImage,
          avatar: resolvedImage,
          email: existingEmailUser.email,
          phoneNumber: existingEmailUser.phoneNumber,
          role: existingEmailUser.role,
          gender: existingEmailUser.gender,
          coins: existingEmailUser.coins || 0,
          diamonds: existingEmailUser.diamonds || 0,
          beans: existingEmailUser.beans || 0,
          level: existingEmailUser.level || 1,
        },
      });
    }

    if (userFrom === "app" && deviceId) {
      const check = await checkAndLockDeviceRegistration(deviceId, undefined, true);
      if (!check.allowed) {
        return sendResponse(
          res,
          400,
          false,
          check.message || `Registration limit reached for this device (Limit: ${check.maxAllowed || 1}). Contact Admin to increase your device registration limit.`,
          undefined,
          undefined,
          check.code || "DEVICE_REGISTRATION_LIMIT_REACHED"
        );
      }
    }

    let image = (payload.picture as string) || "";
    if (!image) {
      switch (resolvedGender) {
        case "female":
          image = "https://api.darkmoon.app/uploads/avatars/female_default.webp";
          break;
        case "male":
        default:
          image = "https://api.darkmoon.app/uploads/avatars/male_default.webp";
          break;
      }
    }

    const userId = await generateUniqueId();
    const finalName = googleUserInfo.name || (await generateRandomName()) || `User_${userId}`;

    const newUser = new User({
      userId,
      name: finalName,
      email: googleUserInfo.email,
      googleId: googleUserInfo.googleId,
      gender: resolvedGender,
      image,
      authType: "google",
      emailVerified: payload.email_verified || false,
      language: resolvedLanguage,
      country: userCountry,
      age: userAge,
      device: userFrom === "app" ? { createdDeviceId: deviceId || "", currentDeviceId: deviceId || "", loggedInDeviceIds: deviceId ? [deviceId] : [] } : {},
    });

    const accessToken = await generateToken(newUser.userId.toString(), "access");
    const refreshToken = await generateToken(newUser.userId.toString(), "refresh");
    newUser.refreshToken = refreshToken;
    newUser.activeToken = accessToken;
    const userCreated = await newUser.save();

    return sendResponse(res, 201, true, "Google signup successful", {
      accessToken,
      refreshToken,
      role: userCreated.role,
      gender: userCreated.gender,
      user: {
        _id: userCreated._id,
        userId: userCreated.userId,
        name: userCreated.name,
        image: userCreated.image,
        avatar: userCreated.image,
        email: userCreated.email,
        phoneNumber: userCreated.phoneNumber,
        role: userCreated.role,
        gender: userCreated.gender,
        coins: userCreated.coins || 0,
        diamonds: userCreated.diamonds || 0,
        beans: userCreated.beans || 0,
        level: userCreated.level || 1,
      },
    });

  } catch (error: any) {
    if (error instanceof GoogleIdTokenVerificationError) {
      console.warn("[GOOGLE AUTH] Token rejected: " + error.reason + "; allowed audience count=" + config.GOOGLE_CLIENT_IDS.length);
      await Logger("googleAuth", error.originalError);
      return sendResponse(
        res,
        401,
        false,
        "Google sign-in could not be verified. Please try again.",
        undefined,
        undefined,
        "INVALID_GOOGLE_TOKEN"
      );
    }
    await Logger("googleAuth", error);
    return sendResponse(res, 500, false, error.message || "Internal Server Error");
  }
};

// ==================== REFRESH TOKEN ====================
export const userRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      return sendResponse(res as any, 400, false, "Refresh token is required");
    }

    jwt.verify(token, config.JWT_REFRESH_SECRET as string, async (err: any, decoded: any) => {
      if (err) {
        return sendResponse(res as any, 401, false, "Invalid refresh token");
      }

      const user = await User.findOne({ userId: decoded.userId, isDeleted: false });
      if (!user) {
        return sendResponse(res as any, 404, false, "Account deleted or not found");
      }

      const accessToken = generateToken(decoded.userId, "access");
      user.activeToken = accessToken;
      await user.save();

      return sendResponse(res, 200, true, "New access token generated", { accessToken });
    });
  } catch (error) {
    await Logger("refreshToken", error);
    return sendResponse(res, 500, false, "Internal Server Error");
  }
};

// ==================== LINK ACCOUNT ====================
export const linkAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user || {};
    const { googleIdToken, phoneToken, phoneNumber } = req.body;

    if (!userId) return sendResponse(res, 401, false, "Unauthorized");

    const user = await User.findOne({ userId: Number(userId), isDeleted: false });
    if (!user) return sendResponse(res, 404, false, "User not found");

    if (googleIdToken) {
      const ticket = await verifyGoogleIdToken(googleIdToken);
      const payload = ticket.getPayload();

      if (!payload) return sendResponse(res, 400, false, "Invalid Google credentials");

      const existingGoogle = await User.findOne({ googleId: payload.sub, role: { $in: APP_ACCOUNT_ROLES }, isDeleted: false });
      if (existingGoogle && existingGoogle.userId !== user.userId) {
        return sendResponse(res, 409, false, "This Google account is already linked to another user");
      }

      user.googleId = payload.sub;
      user.email = payload.email;
      user.emailVerified = payload.email_verified || false;
      await user.save();

      return sendResponse(res, 200, true, "Google account linked successfully", user);
    }

    if (phoneToken && phoneNumber) {
      const decodedToken = await admin.auth().verifyIdToken(phoneToken);
      if (!decodedToken?.phone_number) {
        return sendResponse(res, 400, false, "Invalid Firebase token");
      }

      const existingPhone = await User.findOne({ phoneNumber, role: { $in: APP_ACCOUNT_ROLES }, isDeleted: false });
      if (existingPhone && existingPhone.userId !== user.userId) {
        return sendResponse(res, 409, false, "This Phone number is already linked to another user");
      }

      user.phoneNumber = phoneNumber;
      user.phoneVerified = true;
      await user.save();

      return sendResponse(res, 200, true, "Phone number linked successfully", user);
    }

    return sendResponse(res, 400, false, "Provide either googleIdToken or phoneToken with phoneNumber");
  } catch (error: any) {
    if (error instanceof GoogleIdTokenVerificationError) {
      console.warn("[GOOGLE LINK] Token rejected: " + error.reason + "; allowed audience count=" + config.GOOGLE_CLIENT_IDS.length);
      await Logger("linkAccount", error.originalError);
      return sendResponse(
        res,
        401,
        false,
        "Google account could not be verified. Please try again.",
        undefined,
        undefined,
        "INVALID_GOOGLE_TOKEN"
      );
    }
    await Logger("linkAccount", error);
    return sendResponse(res, 500, false, error.message);
  }
};
