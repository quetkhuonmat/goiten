import { DetectedFace } from '../types';
import { unpackCascade, runCascade, clusterDetections, ClassifierFunction } from './pico';

let faceClassifier: ClassifierFunction | null = null;
let cascadeLoadingPromise: Promise<ClassifierFunction | null> | null = null;

// Preload the local facefinder binary cascade immediately
export async function initPicoClassifier(): Promise<ClassifierFunction | null> {
  if (faceClassifier) return faceClassifier;
  if (cascadeLoadingPromise) return cascadeLoadingPromise;

  cascadeLoadingPromise = (async () => {
    try {
      const response = await fetch('/facefinder');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      faceClassifier = unpackCascade(new Int8Array(buffer));
      return faceClassifier;
    } catch (err) {
      console.warn('Could not load /facefinder cascade:', err);
      cascadeLoadingPromise = null;
      return null;
    }
  })();

  return cascadeLoadingPromise;
}

// Trigger eager preload
if (typeof window !== 'undefined') {
  initPicoClassifier().catch(() => {});
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
 * Highly tolerant to classroom conditions: masks, bangs/hair, glasses, fluorescent lighting.
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
  if (boxW < 8 || boxH < 8) return false;

  let faceFeaturePixels = 0;
  let totalSampled = 0;
  let sumLuminance = 0;
  let sumSqLuminance = 0;

  const step = Math.max(1, Math.floor(size / 14));

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

      // 1. Human skin tones (RGB & YCbCr)
      const isSkinRgb = r > 35 && g > 20 && b > 10 && r >= g * 0.75 && r >= b * 0.8;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isSkinYCbCr = cb >= 65 && cb <= 145 && cr >= 120 && cr <= 190;

      // 2. Facial features (eyebrows, eyes, hair, shadow)
      const isFacialFeature = lum < 85;

      if (isSkinRgb || isSkinYCbCr || isFacialFeature) {
        faceFeaturePixels++;
      }
    }
  }

  if (totalSampled < 6) return false;

  // Rejection 1: Flat uniform surfaces (blank walls, whiteboard, door panels)
  const meanLum = sumLuminance / totalSampled;
  const variance = sumSqLuminance / totalSampled - meanLum * meanLum;
  const stdDev = Math.sqrt(Math.max(0, variance));

  if (stdDev < 4.2) {
    return false;
  }

  // Rejection 2: Pitch black void or blinding light bulb
  if (meanLum < 10 || (meanLum > 248 && stdDev < 6)) {
    return false;
  }

  // Rejection 3: Face region must have at least 7% skin or facial feature pixels
  const featureRatio = faceFeaturePixels / totalSampled;
  if (featureRatio < 0.07) {
    return false;
  }

  return true;
}

/**
 * Natural head portrait box framing from hairline to chin.
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
 * Calculate IoU between two detections
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
 * Suppress overlapping duplicate bounding boxes
 */
function suppressDuplicateFaces(
  faces: Array<[number, number, number, number]>,
  iouThreshold = 0.35
): Array<[number, number, number, number]> {
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
 * Detect REAL classroom student faces across all rows on both phone & laptop.
 */
export async function detectClassroomFaces(
  source: HTMLVideoElement | HTMLImageElement
): Promise<DetectedFace[]> {
  if (!source) return [];

  // Guard against unready video on mobile browsers
  if ('readyState' in source && source.readyState < 2) {
    return [];
  }

  const width = 'videoWidth' in source ? source.videoWidth : source.naturalWidth;
  const height = 'videoHeight' in source ? source.videoHeight : source.naturalHeight;

  if (!width || !height || width < 30 || height < 30) return [];

  const canvas = document.createElement('canvas');
  // High-performance 640px processing width: fast ~30ms on mobile phones, preserves multi-row seating
  const targetW = Math.min(width, 640);
  const targetH = Math.round((height / width) * targetW);
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  try {
    ctx.drawImage(source, 0, 0, targetW, targetH);
  } catch {
    return [];
  }

  // 1. Hardware/Browser Native FaceDetector (Chrome Android / Chromium)
  if ('FaceDetector' in window) {
    try {
      const FaceDetectorClass = (window as unknown as {
        FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (s: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
        };
      }).FaceDetector;

      const detector = new FaceDetectorClass({ fastMode: false, maxDetectedFaces: 60 });
      // Use canvas to prevent DOMException with video on mobile Chrome
      const nativeFaces = await detector.detect(canvas);

      if (nativeFaces && nativeFaces.length > 0) {
        const sorted = [...nativeFaces].sort((a, b) => {
          const rowA = Math.round(a.boundingBox.y / 40);
          const rowB = Math.round(b.boundingBox.y / 40);
          if (rowA !== rowB) return rowA - rowB;
          return a.boundingBox.x - b.boundingBox.x;
        });

        return sorted.map((f, idx) => {
          const bb = f.boundingBox;
          const cx = bb.x + bb.width / 2;
          const cy = bb.y + bb.height / 2;
          const size = Math.max(bb.width, bb.height);
          const box = createAccurateHeadBox(cx, cy, size, targetW, targetH);

          return {
            id: idx + 1,
            ...box,
            called: false,
          };
        });
      }
    } catch {
      // Fallback cleanly to Pico cascade
    }
  }

  // 2. High-Speed Multi-Scale Pico Cascade
  const classifier = await initPicoClassifier();
  if (!classifier) return [];

  try {
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const grayPixels = rgbaToGrayscale(imgData.data, targetH, targetW);

    const imageObj = {
      pixels: grayPixels,
      nrows: targetH,
      ncols: targetW,
      ldim: targetW,
    };

    // Fine-scale parameters covering entire classroom seating depth:
    // Smallest face: ~14px (far back row students)
    // Largest face: ~75% of screen height (front row students)
    const minFacePx = Math.max(14, Math.round(targetW * 0.02));
    const maxFacePx = Math.round(targetH * 0.75);

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

      // Balanced confidence threshold for real classrooms
      const minConfidence = size < 35 ? 2.0 : 3.0;
      if (score < minConfidence) continue;

      const isValidFace = verifyFacialStructure(
        imgData.data,
        grayPixels,
        col,
        row,
        size,
        targetW,
        targetH
      );
      if (!isValidFace) continue;

      verifiedFaces.push(det);
    }

    const finalFaces = suppressDuplicateFaces(verifiedFaces, 0.35);

    // Sort row by row (back to front), left to right
    finalFaces.sort((a, b) => {
      const rowA = Math.round(a[0] / 40);
      const rowB = Math.round(b[0] / 40);
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
    console.error('Detection error:', err);
    return [];
  }
}
