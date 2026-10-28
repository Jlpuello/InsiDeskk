export interface SecurityStatus {
  twoFactorEnabled: boolean;
  // true si el rol exige 2FA (admin) y todavía no lo activó.
  twoFactorRequired: boolean;
  recentFailedAttempts: { razon: string; createdAt: string }[];
}

export interface TwoFactorSetupResult {
  otpauthUrl: string;
  qrCodeDataUrl: string;
}
