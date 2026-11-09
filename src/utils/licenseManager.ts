import { TeacherLicense, LicenseKeyType } from '../types';

export const ADMIN_ZALO_PHONE = '0973834541';
export const ADMIN_DEFAULT_PIN = '0973834541';
export const FREE_TRIAL_SPINS = 20;

const SECRET_SALT = 'AIS_KEY_SALT_2026_HAITV_ZALO_0973834541';
const STORAGE_KEY = 'teacher_license_data_v1';

/**
 * Standardize Vietnamese 10-digit phone number (e.g., +84973834541 -> 0973834541)
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/\D/g, '');
  if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.substring(2);
  }
  return cleaned;
}

export function isValidPhoneNumber(phone: string): boolean {
  const norm = normalizePhoneNumber(phone);
  return /^0[3|5|7|8|9]\d{8}$/.test(norm);
}

/**
 * Simple robust hashing function to produce 6-char hex checksum
 */
function computeChecksum(str: string): string {
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  const combined = (Math.abs(hash1) * 31 + Math.abs(hash2)).toString(16).toUpperCase();
  return combined.padStart(6, '0').slice(-6);
}

/**
 * Generate a license key bound to a teacher's phone number
 * Format: AI-[PHONE]-[TYPE]-[CHECKSUM]
 * Example: AI-0973834541-UNL-8E3A1C
 */
export function generateLicenseKey(phone: string, type: LicenseKeyType = 'unlimited'): string {
  const normPhone = normalizePhoneNumber(phone);
  const typeCode = type === 'unlimited' ? 'UNL' : type;
  const rawPayload = `${normPhone}:${typeCode}:${SECRET_SALT}`;
  const checksum = computeChecksum(rawPayload);
  return `AI-${normPhone}-${typeCode}-${checksum}`;
}

/**
 * Verify license key for a given phone number
 */
export function verifyLicenseKey(
  phone: string,
  keyInput: string
): { valid: boolean; keyType?: LicenseKeyType; grantedSpins?: number; message?: string } {
  if (!keyInput || !phone) {
    return { valid: false, message: 'Vui lòng nhập đầy đủ số điện thoại và mã key.' };
  }

  const normPhone = normalizePhoneNumber(phone);
  const cleanKey = keyInput.trim().toUpperCase();

  // Format: AI-[PHONE]-[TYPE]-[CHECKSUM]
  const parts = cleanKey.split('-');
  if (parts.length !== 4 || parts[0] !== 'AI') {
    return { valid: false, message: 'Định dạng mã key không đúng (Ví dụ: AI-0973834541-UNL-XXXXXX).' };
  }

  const keyPhone = parts[1];
  const typeCode = parts[2];
  const checksum = parts[3];

  if (keyPhone !== normPhone) {
    return {
      valid: false,
      message: `Mã key này được cấp cho số điện thoại ${keyPhone}, không khớp với số ${normPhone} của Thầy/Cô.`,
    };
  }

  const expectedChecksum = computeChecksum(`${normPhone}:${typeCode}:${SECRET_SALT}`);
  if (checksum !== expectedChecksum) {
    return { valid: false, message: 'Mã key không hợp lệ hoặc đã bị thay đổi.' };
  }

  let keyType: LicenseKeyType = 'unlimited';
  let grantedSpins: number | undefined = undefined;

  if (typeCode === 'UNL') {
    keyType = 'unlimited';
  } else if (typeCode === '500') {
    keyType = '500';
    grantedSpins = 500;
  } else if (typeCode === '200') {
    keyType = '200';
    grantedSpins = 200;
  } else if (typeCode === '100') {
    keyType = '100';
    grantedSpins = 100;
  } else {
    return { valid: false, message: 'Loại gói bản quyền không xác định.' };
  }

  return {
    valid: true,
    keyType,
    grantedSpins,
    message: keyType === 'unlimited' ? 'Kích hoạt gói Vĩnh viễn thành công!' : `Kích hoạt gói ${grantedSpins} lượt thành công!`,
  };
}

/**
 * Check if the teacher has remaining spins
 */
export function checkCanSpin(license: TeacherLicense | null): {
  canSpin: boolean;
  remaining: number;
  isUnlimited: boolean;
  usedSpins: number;
  isApproved: boolean;
} {
  if (!license || !license.phone) {
    return { canSpin: false, remaining: 0, isUnlimited: false, usedSpins: 0, isApproved: false };
  }

  // If status is not approved, teacher cannot spin!
  if (license.status && license.status !== 'approved') {
    return {
      canSpin: false,
      remaining: 0,
      isUnlimited: false,
      usedSpins: license.usedSpins || 0,
      isApproved: false,
    };
  }

  const used = license.usedSpins || 0;

  if (license.isKeyActive) {
    if (license.keyType === 'unlimited') {
      return { canSpin: true, remaining: 999999, isUnlimited: true, usedSpins: used, isApproved: true };
    }
    const granted = license.grantedSpins || 500;
    const remaining = Math.max(0, granted - used);
    return {
      canSpin: remaining > 0,
      remaining,
      isUnlimited: false,
      usedSpins: used,
      isApproved: true,
    };
  }

  // Free trial
  const remaining = Math.max(0, FREE_TRIAL_SPINS - used);
  return {
    canSpin: remaining > 0,
    remaining,
    isUnlimited: false,
    usedSpins: used,
    isApproved: true,
  };
}

/**
 * Get stored license from localStorage
 */
export function getStoredLicense(): TeacherLicense | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save license to localStorage
 */
export function saveStoredLicense(license: TeacherLicense): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
  } catch (e) {
    console.warn('Failed to save license to localStorage:', e);
  }
}

export interface RegisterPhoneResult {
  success: boolean;
  isPending: boolean;
  message?: string;
  license: TeacherLicense;
}

/**
 * API: Register or retrieve phone on backend, verifying approval status
 */
export async function apiRegisterPhone(phone: string): Promise<RegisterPhoneResult> {
  const normPhone = normalizePhoneNumber(phone);

  if (normPhone === ADMIN_ZALO_PHONE) {
    return {
      success: false,
      isPending: false,
      message: 'Số điện thoại này thuộc Ban Quản Trị hệ thống. Giáo viên không thể sử dụng số này để đăng ký.',
      license: {
        phone: normPhone,
        registeredAt: Date.now(),
        usedSpins: 0,
        isKeyActive: false,
        status: 'rejected',
      },
    };
  }

  try {
    const res = await fetch('/api/license/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normPhone }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        isPending: false,
        message: data.error || 'Đăng ký không thành công.',
        license: {
          phone: normPhone,
          registeredAt: Date.now(),
          usedSpins: 0,
          isKeyActive: false,
          status: 'rejected',
        },
      };
    }

    const serverRecord: TeacherLicense = data.record;
    saveStoredLicense(serverRecord);

    if (serverRecord.status === 'approved') {
      return {
        success: true,
        isPending: false,
        license: serverRecord,
      };
    } else {
      return {
        success: false,
        isPending: true,
        message: data.message || 'Số điện thoại đang chờ Ban Quản Trị phê duyệt.',
        license: serverRecord,
      };
    }
  } catch (err) {
    console.warn('Backend license sync error:', err);
    const fallback: TeacherLicense = {
      phone: normPhone,
      registeredAt: Date.now(),
      usedSpins: 0,
      isKeyActive: false,
      status: 'pending',
    };
    saveStoredLicense(fallback);
    return {
      success: false,
      isPending: true,
      message: 'Đã gửi thông tin. Số điện thoại đang chờ Admin phê duyệt.',
      license: fallback,
    };
  }
}

/**
 * API: Check approval status for a phone
 */
export async function apiCheckTeacherStatus(phone: string): Promise<{
  isApproved: boolean;
  isPending: boolean;
  record: TeacherLicense | null;
}> {
  const norm = normalizePhoneNumber(phone);
  try {
    const res = await fetch(`/api/license/status?phone=${norm}`);
    if (res.ok) {
      const data = await res.json();
      if (data.record) {
        saveStoredLicense(data.record);
      }
      return {
        isApproved: Boolean(data.isApproved),
        isPending: Boolean(data.isPending),
        record: data.record || null,
      };
    }
  } catch (e) {
    console.warn('Status check failed:', e);
  }
  return { isApproved: false, isPending: true, record: null };
}

/**
 * API: Increment spin count
 */
export async function apiRecordSpin(phone: string): Promise<TeacherLicense> {
  const normPhone = normalizePhoneNumber(phone);
  const current: TeacherLicense = getStoredLicense() || {
    phone: normPhone,
    registeredAt: Date.now(),
    usedSpins: 0,
    isKeyActive: false,
    status: 'approved',
  };

  current.usedSpins = (current.usedSpins || 0) + 1;
  current.lastActiveAt = Date.now();
  saveStoredLicense(current);

  try {
    fetch('/api/license/spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normPhone, clientUsedSpins: current.usedSpins }),
    }).catch(() => {});
  } catch {}

  return current;
}

/**
 * API: Activate a license key for a phone number
 */
export async function apiActivateLicenseKey(
  phone: string,
  key: string
): Promise<{ success: boolean; license?: TeacherLicense; message: string }> {
  const normPhone = normalizePhoneNumber(phone);
  const verification = verifyLicenseKey(normPhone, key);

  if (!verification.valid || !verification.keyType) {
    return { success: false, message: verification.message || 'Mã key không hợp lệ.' };
  }

  const current: TeacherLicense = getStoredLicense() || {
    phone: normPhone,
    registeredAt: Date.now(),
    usedSpins: 0,
    isKeyActive: false,
    status: 'approved',
  };

  const updated: TeacherLicense = {
    ...current,
    status: 'approved',
    phone: normPhone,
    isKeyActive: true,
    keyType: verification.keyType,
    grantedSpins: verification.grantedSpins,
    activeKey: key.trim().toUpperCase(),
    activatedAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  saveStoredLicense(updated);

  // Notify backend
  try {
    await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: normPhone,
        key: key.trim().toUpperCase(),
        keyType: verification.keyType,
        grantedSpins: verification.grantedSpins,
      }),
    });
  } catch (e) {
    console.warn('Backend sync error during key activation:', e);
  }

  return {
    success: true,
    license: updated,
    message: verification.message || 'Kích hoạt bản quyền thành công!',
  };
}

export const ADMIN_AUTH_STORAGE_KEY = 'admin_session_auth_v1';

export function isStoredAdminAuth(): boolean {
  try {
    return localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setStoredAdminAuth(isAuth: boolean) {
  try {
    if (isAuth) {
      localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    }
  } catch {}
}

export function checkIsAdminQr(qrText: string): boolean {
  if (!qrText) return false;
  const clean = qrText.replace(/[\s\-_.:]/g, '');
  return (
    clean.includes(ADMIN_ZALO_PHONE) ||
    qrText.includes(`zalo.me/${ADMIN_ZALO_PHONE}`) ||
    qrText.includes('ADMIN_0973834541') ||
    clean.includes('0973834541')
  );
}

