export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  displayLabel: string;
  isRear: boolean;
  isFront: boolean;
  isUltraWide: boolean;
}

/**
 * Classifies a MediaDeviceInfo camera as Rear or Front with user-friendly Vietnamese labels.
 * Handles Android Camera2 naming conventions (camera2 0 = back, camera2 1 = front),
 * iOS naming (Back Camera, Front Camera, Back Ultra Wide Camera),
 * and standard WebRTC labels.
 */
export function classifyCameraDevice(device: MediaDeviceInfo, index: number): CameraDeviceInfo {
  const rawLabel = (device.label || '').trim();
  const lower = rawLabel.toLowerCase();

  const isFrontExplicit =
    /front|trước|truoc|selfie|face|user|facing\s*front|camera2\s*1|camera\s*1\b/i.test(lower);

  const isRearExplicit =
    /back|rear|sau|environment|main|world|wide|ultra|telephoto|macro|facing\s*back|camera2\s*0|camera\s*0\b/i.test(lower);

  const isUltraWide = /ultra|0\.5|super wide|siêu rộng|goc rong|wide-angle/i.test(lower);

  let isRear = false;
  let isFront = false;

  if (isFrontExplicit) {
    isFront = true;
    isRear = false;
  } else if (isRearExplicit) {
    isRear = true;
    isFront = false;
  } else {
    // Default heuristic: If index 0 on mobile, often Rear or Front depending on vendor.
    // Usually on Android device 0 is back, device 1 is front.
    if (index === 0) {
      isRear = true;
    } else if (index === 1) {
      isFront = true;
    } else {
      isRear = true;
    }
  }

  // Create friendly label for teachers
  let displayLabel = rawLabel;
  if (!rawLabel) {
    displayLabel = isRear ? `📷 Camera Sau (#${index + 1})` : `🤳 Camera Trước (#${index + 1})`;
  } else if (isUltraWide) {
    displayLabel = `📷 Camera Sau (Góc siêu rộng - Toàn cảnh lớp)`;
  } else if (isRear) {
    displayLabel = `📷 Camera Sau (${rawLabel.replace(/camera2\s*0/i, 'Chính').replace(/facing back/i, 'Sau')})`;
  } else if (isFront) {
    displayLabel = `🤳 Camera Trước (${rawLabel.replace(/camera2\s*1/i, 'Selfie').replace(/facing front/i, 'Trước')})`;
  }

  return {
    deviceId: device.deviceId,
    label: rawLabel || `Camera ${index + 1}`,
    displayLabel,
    isRear,
    isFront,
    isUltraWide,
  };
}

/**
 * Filter and sort camera devices so rear cameras appear first, starting with wide/main.
 */
export function getSortedCameraDevices(devices: MediaDeviceInfo[]): CameraDeviceInfo[] {
  const videoInputs = devices.filter((d) => d.kind === 'videoinput');
  const classified = videoInputs.map((d, i) => classifyCameraDevice(d, i));

  // Sort: Rear cameras first (Ultra-wide / Main first), then Front cameras
  return classified.sort((a, b) => {
    if (a.isRear && !b.isRear) return -1;
    if (!a.isRear && b.isRear) return 1;
    if (a.isUltraWide && !b.isUltraWide) return -1;
    if (!a.isUltraWide && b.isUltraWide) return 1;
    return 0;
  });
}

/**
 * Find the most suitable rear camera device ID.
 */
export function findBestRearDeviceId(classifiedDevices: CameraDeviceInfo[]): string | undefined {
  const rearDevices = classifiedDevices.filter((d) => d.isRear);
  if (rearDevices.length === 0) return undefined;

  // Prefer main wide or first rear camera
  const mainRear = rearDevices.find((d) => !d.isUltraWide) || rearDevices[0];
  return mainRear.deviceId;
}

/**
 * Request device landscape orientation with multi-browser fallbacks.
 */
export async function lockOrientationLandscape(containerEl?: HTMLElement | null): Promise<boolean> {
  try {
    // Attempt fullscreen if available, which unlocks orientation.lock on Android Chrome
    if (containerEl && !document.fullscreenElement && containerEl.requestFullscreen) {
      await containerEl.requestFullscreen().catch(() => {});
    }

    const orientation = window.screen?.orientation as any;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape').catch(() => {
        return orientation.lock('landscape-primary').catch(() => false);
      });
      return true;
    }
  } catch (err) {
    console.warn('Orientation lock landscape failed or unsupported:', err);
  }
  return false;
}

/**
 * Unlock or restore portrait orientation.
 */
export async function unlockOrientation(): Promise<void> {
  try {
    const orientation = window.screen?.orientation as any;
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock();
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen().catch(() => {});
    }
  } catch (err) {
    console.warn('Unlock orientation failed:', err);
  }
}
