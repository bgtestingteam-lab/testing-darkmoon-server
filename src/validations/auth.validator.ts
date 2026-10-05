import { body } from "express-validator";

export const validationCheckUser = [
  body("phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required")
    .isMobilePhone("any")
    .withMessage("Invalid phone number format"),
];

export const validationResetPassword = [
  body("phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required")
    .isMobilePhone("any")
    .withMessage("Invalid phone number format"),

  body("newPassword")
    .notEmpty()
    .withMessage("New Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("firebaseIdToken")
    .optional(),
];

export const validationUserCreate = [
  body("phoneNumber")
    .optional()
    .isString(),

  body("email")
    .optional()
    .isString(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("firebaseIdToken")
    .optional(),

  body("age")
    .optional(),
];

export const validationUserLogin = [
  body("identifier")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Login identifier must be a valid string"),

  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email address"),

  body("phoneNumber")
    .optional()
    .isString()
    .withMessage("Invalid phone number or user identifier format"),

  body("userId")
    .optional()
    .isString()
    .trim()
    .withMessage("User ID must be a valid string"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body().custom((value) => {
    if (!value?.identifier && !value?.email && !value?.phoneNumber && !value?.userId) {
      throw new Error("Email, phone number, or User ID is required");
    }
    return true;
  }),
];

export const validationGoogleAuth = [
  body("googleIdToken")
    .notEmpty()
    .withMessage("Google ID token is required")
    .isString()
    .withMessage("Google ID token must be a string"),

  // You might optionally want to validate deviceId if you always expect it
  body("deviceId")
    .optional()
    .isString()
    .withMessage("Device ID must be a string"),

  body("age")
    .optional()
    .isInt({ min: 18, max: 120 })
    .withMessage("You must be at least 18 years old to register on Dark Moon"),
];
