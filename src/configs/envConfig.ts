import dotenv from "dotenv";
import path from "path";

// Load environment variables for local development without noisy logs in production
if (process.env.NODE_ENV !== 'production') {
    dotenv.config({ quiet: true });
    dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
}

// OAuth client IDs are public identifiers. Keep the Web client bundled with the
// mobile app in the allowlist so a stale process-manager environment cannot make
// a valid app token fail with "Wrong recipient" after a deployment.
export const YARO_GOOGLE_WEB_CLIENT_IDS = [
    "648050345317-t7idbl9hi9kou275jn8np45n2u2fvdt3.apps.googleusercontent.com",
    "775252509237-1us46o9umvvio0ngmbd4n1vhml8bfgdr.apps.googleusercontent.com",
    "775252509237-aeqs5cd5viou7iv4r5chq8k15ccaq7ir.apps.googleusercontent.com",
];
export const YARO_GOOGLE_WEB_CLIENT_ID = YARO_GOOGLE_WEB_CLIENT_IDS[0];

export const buildGoogleClientIdAllowlist = (...values: Array<string | undefined>): string[] =>
    Array.from(new Set(
        values
            .flatMap((value) => String(value || "").split(","))
            .map((value) => value.trim())
            .filter(Boolean)
    ));

const googleClientIds = buildGoogleClientIdAllowlist(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_IDS,
    ...YARO_GOOGLE_WEB_CLIENT_IDS
);

const isProduction = process.env.NODE_ENV === 'production';
const jwtAccessSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || (!isProduction ? '2a869de490ac2e6f065b63be7c76ffd658af4fbb4feaf3c1ced1cd3959c9cfe2' : '');
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || (!isProduction ? '812ade37d6ecfebbde7de546b9603c45a9ebb2ef174554f72a7e6d6c3d079f6a' : '');

if (isProduction && (!jwtAccessSecret || !jwtRefreshSecret)) {
    throw new Error('FATAL: JWT_SECRET (or JWT_ACCESS_SECRET) and JWT_REFRESH_SECRET must be configured in production environment variables.');
}

if (isProduction) {
    const redisUrl = (process.env.REDIS_URL || '').trim();
    if (!redisUrl) {
        throw new Error('FATAL: REDIS_URL must be configured in production environment variables. Render web service cannot fall back to localhost:6379.');
    }
    if (
        redisUrl.includes('localhost') ||
        redisUrl.includes('127.0.0.1') ||
        redisUrl.includes('::1') ||
        redisUrl.includes('[::1]')
    ) {
        throw new Error('FATAL: REDIS_URL cannot point to localhost/127.0.0.1 in production. An external hosted Redis instance is required.');
    }

    const mongoUri = (process.env.MONGODB_URI || '').trim();
    if (!mongoUri) {
        throw new Error('FATAL: MONGODB_URI must be configured in production environment variables. A production MongoDB instance is required.');
    }
    if (
        mongoUri.includes('localhost') ||
        mongoUri.includes('127.0.0.1') ||
        mongoUri.includes('::1')
    ) {
        throw new Error('FATAL: MONGODB_URI cannot point to localhost/127.0.0.1 in production. A production MongoDB instance is required.');
    }
}

export const config = {
    PORT: Number(process.env.PORT) || 5000,
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    ENCRYPTION_SECRET_KEY: process.env.ENCRYPTION_SECRET_KEY,
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_PHONE: process.env.SUPER_ADMIN_PHONE,
    SUPER_ADMIN_ROLE: process.env.SUPER_ADMIN_ROLE,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    AGORA_APP_ID: process.env.AGORA_APP_ID,
    AGORA_APP_CERTIFICATE: process.env.AGORA_APP_CERTIFICATE || process.env.APP_CERTIFICATE,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    ORIGIN: process.env.ORIGIN,
    ORIGIN1: process.env.ORIGIN1,
    WEB_HOOK_PORT: process.env.WEB_HOOK_PORT || 4000,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || YARO_GOOGLE_WEB_CLIENT_ID,
    GOOGLE_CLIENT_IDS: googleClientIds,
    REDIS_URL: process.env.REDIS_URL || (!isProduction ? 'redis://localhost:6379' : ''),
    REDIS_PREFIX: process.env.REDIS_PREFIX || 'yaroapp:',
    VERIFICATION_ENCRYPTION_KEY: process.env.VERIFICATION_ENCRYPTION_KEY,
    VERIFICATION_PRIVATE_STORAGE_PATH: process.env.VERIFICATION_PRIVATE_STORAGE_PATH,
    VERIFICATION_MAX_FILE_SIZE_MB: process.env.VERIFICATION_MAX_FILE_SIZE_MB || '5',
};
