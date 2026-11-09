export interface DetectedFace {
  id: number;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  width: number; // percentage
  height: number; // percentage
  croppedUrl?: string;
  called?: boolean;
}

export type AppStage = 'detecting' | 'ready' | 'picking' | 'locked';

export interface CalledFaceRecord {
  id: string;
  facePhotoUrl: string;
  time: string;
  faceId: number;
  studentName?: string;
  score: number;
}

export interface StudentPhotoItem {
  id: string;
  name: string;
  photoUrl: string;
  called: boolean;
}

export type MainViewMode = 'camera' | 'album' | 'remote-camera';

export interface RemoteRoomState {
  roomId: string;
  createdAt: number;
  lastActive: number;
  phoneConnected: boolean;
  stage: AppStage;
  detectedFaces: DetectedFace[];
  lockedFace: DetectedFace | null;
  lockedFaceUrl: string | null;
  latestFrame: string | null;
  score: number;
}

export type LicenseKeyType = 'unlimited' | '500' | '200' | '100';
export type TeacherApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface TeacherLicense {
  phone: string;
  name?: string;
  registeredAt: number;
  usedSpins: number;
  isKeyActive: boolean;
  status: TeacherApprovalStatus;
  keyType?: LicenseKeyType;
  grantedSpins?: number;
  activeKey?: string;
  activatedAt?: number;
  lastActiveAt?: number;
  approvedAt?: number;
}
