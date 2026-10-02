import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { config } from '../configs/envConfig';

export interface AgoraTokenOptions {
  channelName: string;
  uid: number;
  role?: 'publisher' | 'subscriber';
  expireSeconds?: number;
}

export interface AgoraTokenResult {
  token: string;
  channel: string;
  uid: number;
  appId: string;
  role: 'publisher' | 'subscriber';
  expiresAt: number;
}

export class AgoraService {
  private static getAppCredentials() {
    const appId = (process.env.AGORA_APP_ID || config.AGORA_APP_ID || '').trim();
    const appCertificate = (
      process.env.AGORA_APP_CERTIFICATE ||
      process.env.APP_CERTIFICATE ||
      config.AGORA_APP_CERTIFICATE ||
      ''
    ).trim();

    if (!appId) {
      throw new Error('AGORA_APP_ID is not configured in environment variables');
    }
    if (!appCertificate) {
      throw new Error('AGORA_APP_CERTIFICATE / APP_CERTIFICATE is not configured in environment variables');
    }

    return { appId, appCertificate };
  }

  /**
   * Generates a secure RTC token for voice room communication using numeric UID
   */
  public static generateRtcToken({
    channelName,
    uid,
    role = 'publisher',
    expireSeconds = 3600,
  }: AgoraTokenOptions): AgoraTokenResult {
    const { appId, appCertificate } = this.getAppCredentials();

    if (!channelName || typeof channelName !== 'string') {
      throw new Error('Valid channelName is required for Agora token generation');
    }

    // UID must be a positive 32-bit integer for Agora Voice SDK
    const numericUid = Math.abs(Math.floor(Number(uid) || 0));
    if (!numericUid) {
      throw new Error('Valid numeric UID > 0 is required for Agora token generation');
    }

    const agoraRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = currentTimestamp + Math.max(60, expireSeconds);

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      numericUid,
      agoraRole,
      privilegeExpireTs,
      privilegeExpireTs
    );

    return {
      token,
      channel: channelName,
      uid: numericUid,
      appId,
      role,
      expiresAt: privilegeExpireTs * 1000,
    };
  }

  /**
   * Validates if Agora credentials are fully loaded and operational
   */
  public static isConfigured(): boolean {
    try {
      const { appId, appCertificate } = this.getAppCredentials();
      return Boolean(appId && appCertificate);
    } catch {
      return false;
    }
  }
}
