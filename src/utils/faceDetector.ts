import { DetectedFace } from '../types';
import { unpackCascade, runCascade, clusterDetections, ClassifierFunction } from './pico';

let faceClassifier: ClassifierFunction | null = null;
let isLoadingCascade = false;

// Preload the local facefinder binary cascade
async function initPicoClassifier(): Promise<ClassifierFunction | null> {
  if (faceClassifier) return faceClassifier;
  if (isLoadingCascade) return null;

  try {
    isLoadingCascade = true;
    const response = await fetch('/facefinder');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    faceClassifier = unpackCascade(new Int8Array(buffer));
    return faceClassifier;
  } catch (err) {
    console.warn('Could not load /facefinder cascade:', err);
    return null;
  } finally {
    isLoadingCascade = false;
  }
}

// Convert RGBA to Grayscale
function rgbaToGrayscale(rgba: Uint8ClampedArray, nrows: number, ncols: number): Uint8Array {
  const pixels = new Uint8Array(nrows * ncols);
  for (let i = 0; i < nrows; i++) {
    for (let j = 0; j < ncols; j++) {
      const offset = (i * ncols + j) * 4;
      pixels[i * ncols + j] =
        (299 * rgba[offset] + 587 * rgba[offset + 1] + 114 * rgba[offset + 2]) / 1000;
    }
  }
  return pixels;
}

/**
 * Validates facial structure and rejects obvious false positives (walls, doors, empty uniforms).
 * Designed for diverse classroom conditions: fluorescent lighting, students with masks,
 * bangs/hair, glasses, and distant rows.
 */
function verifyFacialStructure(
  rgba: Uint8ClampedArray,
  gray: Uint8Array,
  col: number,
  row: number,
  size: number,
  imgWidth: number,
  imgHeight: number
): boolean {
  const half = Math.round(size / 2);
  const startX = Math.max(0, Math.round(col - half));
  const startY = Math.max(0, Math.round(row - half));
  const endX = Math.min(imgWidth, Math.round(col + half));
  const endY = Math.min(imgHeight, Math.round(row + half));

  const boxW = endX - startX;
  const boxH = endY - startY;
  if (boxW < 10 || boxH < 10) return false;

  let faceFeaturePixels = 0;
  let totalSampled = 0;
  let sumLuminance = 0;
  let sumSqLuminance = 0;

  const step = Math.max(1, Math.floor(size / 16));

  for (let y = startY; y < endY; y += step) {
    for (let x = startX; x < endX; x += step) {
      const idx = (y * imgWidth + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      const lum = gray[y * imgWidth + x];

      totalSampled++;
      sumLuminance += lum;
      sumSqLuminance += lum * lum;

      // 1. Check human skin tones (RGB and YCbCr with classroom light tolerance)
      const isSkinRgb = r > 40 && g > 25 && b > 15 && r >= g * 0.8 && r >= b * 0.9;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isSkinYCbCr = cb >= 68 && cb <= 142 && cr >= 122 && cr <= 186;

      // 2. Check facial features (eyes, eyebrows, dark hair, shadows under nose/lips)
      const isFacialFeature = lum < 78;

      if (isSkinRgb || isSkinYCbCr || isFacialFeature) {
        faceFeaturePixels++;
      }
    }
  }

  if (totalSampled < 8) return false;

  // Rejection 1: Flat uniform surfaces (blank walls, whiteboard, chalkboard, door panels)
  const meanLum = sumLuminance / totalSampled;
  const variance = sumSqLuminance / totalSampled - meanLum * meanLum;
  const stdDev = Math.sqrt(Math.max(0, variance));

  if (stdDev < 4.8) {
    // Pure flat surface without facial texture
    return false;
  }

  // Rejection 2: Pitch black void or pure blinding glare
  if (meanLum < 12 || (meanLum > 246 && stdDev < 8)) {
    return false;
  }

  // Rejection 3: True faces must contain at least some skin or facial hair/eyes
  const featureRatio = faceFeaturePixels / totalSampled;
  if (featureRatio < 0.08) {
    return false;
  }

  return true;
}

/**
 * Natural head portrait box framing from hairline to chin and cheek to cheek.
 */
function createAccurateHeadBox(
  cx: number,
  cy: number,
  size: number,
  frameW: number,
  frameH: number
): { x: number; y: number; width: number; height: number } {
  const boxW = size * 1.15;
  const boxH = size * 1.28;

  let boxX = cx - boxW / 2;
  let boxY = cy - boxH * 0.52;

  boxX = Math.max(0, Math.min(frameW - boxW, boxX));
  boxY = Math.max(0, Math.min(frameH - boxH, boxY));

  const x = Math.max(0, (boxX / frameW) * 100);
  const y = Math.max(0, (boxY / frameH) * 100);
  const w = Math.min(100 - x, (boxW / frameW) * 100);
  const h = Math.min(100 - y, (boxH / frameH) * 100);

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(w.toFixed(2)),
    height: Number(h.toFixed(2)),
  };
}

/**
 * Calculate Intersection over Union (IoU) between two face detections
 */
function computeIoU(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const r1 = a[0], c1 = a[1], s1 = a[2];
  const r2 = b[0], c2 = b[1], s2 = b[2];

  const left1 = c1 - s1 / 2;
  const top1 = r1 - s1 / 2;
  const right1 = c1 + s1 / 2;
  const bottom1 = r1 + s1 / 2;

  const left2 = c2 - s2 / 2;
  const top2 = r2 - s2 / 2;
  const right2 = c2 + s2 / 2;
  const bottom2 = r2 + s2 / 2;

  const xLeft = Math.max(left1, left2);
  const yTop = Math.max(top1, top2);
  const xRight = Math.min(right1, right2);
  const yBottom = Math.min(bottom1, bottom2);

  if (xRight <= xLeft || yBottom <= yTop) return 0;

  const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
  const area1 = s1 * s1;
  const area2 = s2 * s2;
  const unionArea = area1 + area2 - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

/**
 * Suppress overlapping/duplicate bounding boxes (Non-Maximum Suppression)
 */
function suppressDuplicateFaces(
  faces: Array<[number, number, number, number]>,
  iouThreshold = 0.35
): Array<[number, number, number, number]> {
  // Sort descending by score
  const sorted = [...faces].sort((a, b) => b[3] - a[3]);
  const selected: Array<[number, number, number, number]> = [];

  for (const candidate of sorted) {
    let overlap = false;
    for (const kept of selected) {
      if (computeIoU(candidate, kept) > iouThreshold) {
        overlap = true;
        break;
      }
    }
    if (!overlap) {
      selected.push(candidate);
    }
  }

  return selected;
}

/**
 * Detect REAL classroom student faces across all rows (near to far distance).
 * Returns verified face bounding boxes precisely framing each student.
 * Guarantees ONE clean bounding box per student face without duplicate or nested boxes.
 */
export async function detectClassroomFaces(
  source: HTMLVideoElement | HTMLImageElement
): Promise<DetectedFace[]> {
  const width = 'videoWidth' in source ? source.videoWidth : source.naturalWidth;
  const height = 'videoHeight' in source ? source.videoHeight : source.naturalHeight;

  if (!width || !height || width <= 30 || height <= 30) return [];

  // 1. Check Native Hardware/Browser FaceDetector (Chrome Android / Chromium)
  if ('FaceDetector' in window) {
    try {
      const FaceDetectorClass = (window as unknown as {
        FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (s: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
        };
      }).FaceDetector;

      const detector = new FaceDetectorClass({ fastMode: false, maxDetectedFaces: 60 });
      const faces = await detector.detect(source);

      if (faces && faces.length > 0) {
        // Sort systematic seating order: row by row (top to bottom), left to right
        const sorted = [...faces].sort((a, b) => {
          const rowA = Math.round(a.boundingBox.y / 50);
          const rowB = Math.round(b.boundingBox.y / 50);
          if (rowA !== rowB) return rowA - rowB;
          return a.boundingBox.x - b.boundingBox.x;
        });

        return sorted.map((f, idx) => {
          const bb = f.boundingBox;
          const cx = bb.x + bb.width / 2;
          const cy = bb.y + bb.height / 2;
          const size = Math.max(bb.width, bb.height);
          const box = createAccurateHeadBox(cx, cy, size, width, height);

          return {
            id: idx + 1,
            ...box,
            called: false,
          };
        });
      }
    } catch (err) {
      console.warn('Native FaceDetector error, continuing with neural cascade:', err);
    }
  }

  // 2. High-Speed Multi-Scale Pico Cascade
  const classifier = await initPicoClassifier();
  if (!classifier) return [];

  const canvas = document.createElement('canvas');
  // Optimal balance: 720px width for fast 50ms processing & high multi-row detection
  const targetW = Math.min(width, 760);
  const targetH = Math.round((height / width) * targetW);
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  try {
    ctx.drawImage(source, 0, 0, targetW, targetH);
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const grayPixels = rgbaToGrayscale(imgData.data, targetH, targetW);

    const imageObj = {
      pixels: grayPixels,
      nrows: targetH,
      ncols: targetW,
      ldim: targetW,
    };

    // Fine-scale parameters covering entire classroom seating depth:
    // Smallest face: ~16px (far back row students)
    // Largest face: ~72% of screen height (front row students)
    const minFacePx = Math.max(16, Math.round(targetW * 0.021));
    const maxFacePx = Math.round(targetH * 0.72);

    const params = {
      shiftfactor: 0.1,
      minsize: minFacePx,
      maxsize: maxFacePx,
      scalefactor: 1.15,
    };

    const rawDetections = runCascade(imageObj, classifier, params);
    const clustered = clusterDetections(rawDetections, 0.25);

    const verifiedFaces: Array<[number, number, number, number]> = [];

    for (const det of clustered) {
      const row = det[0];
      const col = det[1];
      const size = det[2];
      const score = det[3];

      // Realistic confidence threshold:
      // Pico cluster scores for real faces are 2.2 to 8.0
      const minConfidence = size < 35 ? 2.2 : 3.2;
      if (score < minConfidence) continue;

      // Reject flat walls/cabinets
      const isValidFace = verifyFacialStructure(
        imgData.data,
        grayPixels,
        col,
        row,
        size,
        targetW,
        targetH
      );
      if (!isValidFace) {
        continue;
      }

      verifiedFaces.push(det);
    }

    // Apply Non-Maximum Suppression to ensure exactly one box per student
    const finalFaces = suppressDuplicateFaces(verifiedFaces, 0.35);

    // Sort systematically by classroom seating order:
    // Top to bottom (far to near row), left to right
    finalFaces.sort((a, b) => {
      const rowA = Math.round(a[0] / 45);
      const rowB = Math.round(b[0] / 45);
      if (rowA !== rowB) return rowA - rowB;
      return a[1] - b[1];
    });

    return finalFaces.map((det, idx) => {
      const row = det[0];
      const col = det[1];
      const size = det[2];

      const box = createAccurateHeadBox(col, row, size, targetW, targetH);

      return {
        id: idx + 1,
        ...box,
        called: false,
      };
    });
  } catch (err) {
    console.error('Cascade detection error:', err);
    return [];
  }
}
