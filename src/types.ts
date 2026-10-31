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
  score: number;
}
