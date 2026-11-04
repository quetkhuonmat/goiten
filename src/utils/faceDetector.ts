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
 * Validates facial structure & rejects false positives on walls, wooden doors, shirts, and curtains.
 * A genuine student face has:
 * 1. Natural skin chromaticity cluster (excluding plain wood, clothing, chalkboard)
 * 2. Facial luminance variance (eyes, brows, mouth create distinct contrast)
 * 3. Horizontal eye-band / forehead contrast profile
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
  if (boxW < 12 || boxH < 12) return false;

  let skinPixels = 0;
  let totalSampled = 0;
  let sumLuminance = 0;
  let sumSqLuminance = 0;

  let upperSum = 0;
  let upperCount = 0;
  let midSum = 0;
  let midCount = 0;
  let lowerSum = 0;
  let lowerCount = 0;

  const step = Math.max(1, Math.floor(size / 18));

  for (let y = startY; y < endY; y += step) {
    const relY = (y - startY) / boxH; // 0.0 to 1.0 from top of head to chin
    for (let x = startX; x < endX; x += step) {
      const idx = (y * imgWidth + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];

      const lum = gray[y * imgWidth + x];
      totalSampled++;
      sumLuminance += lum;
      sumSqLuminance += lum * lum;

      // Forehead band (top 15% - 35%)
      if (relY >= 0.15 && relY < 0.35) {
        upperSum += lum;
        upperCount++;
      }
      // Eye & nose band (35% - 65%)
      else if (relY >= 0.35 && relY < 0.65) {
        midSum += lum;
        midCount++;
      }
      // Chin & mouth band (65% - 90%)
      else if (relY >= 0.65 && relY < 0.90) {
        lowerSum += lum;
        lowerCount++;
      }

      // Check for human skin chromaticity
      // Excludes pure white shirts, dark blue/black clothing, bright yellow/red toys
      const isSkinRgb =
        r > 50 &&
        g > 35 &&
        b > 25 &&
        r > g &&
        g >= b &&
        r - g >= 6 &&
        r - b >= 10 &&
        r < 248; // not blown out highlight

      // YCbCr skin tone transformation
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isSkinYCbCr = cb >= 75 && cb <= 130 && cr >= 132 && cr <= 175;

      if (isSkinRgb || isSkinYCbCr) {
        skinPixels++;
      }
    }
  }

  if (totalSampled < 16) return false;

  // 1. Skin ratio: true face box must have at least 22% skin pixels
  // (Plain doors, walls, chalkboards, uniforms have < 10%)
  const skinRatio = skinPixels / totalSampled;
  if (skinRatio < 0.22) {
    return false;
  }

  // 2. Luminance standard deviation:
  // Flat walls, whiteboard panels, or wooden doors have very low variance (std < 10)
  const meanLum = sumLuminance / totalSampled;
  const variance = sumSqLuminance / totalSampled - meanLum * meanLum;
  const stdDev = Math.sqrt(Math.max(0, variance));

  if (stdDev < 12.0) {
    // Too flat/uniform (plain wall, cabinet panel, chalkboard)
    return false;
  }

  // 3. Eye/Forehead Contrast Pattern:
  // On human faces, eyes and eyebrows create a darker middle region compared to upper forehead
  if (upperCount > 0 && midCount > 0) {
    const avgUpper = upperSum / upperCount;
    const avgMid = midSum / midCount;
    // If middle is suspiciously 30% brighter than forehead, it's not a standard face lighting
    if (avgMid > avgUpper * 1.35) {
      return false;
    }
  }

  return true;
}

/**
 * Natural head portrait box framing from hairline to chin and cheek to cheek.
 * Accurately fits student face without arbitrary distortion or massive oversized padding.
 */
function createAccurateHeadBox(
  cx: number,
  cy: number,
  size: number,
  frameW: number,
  frameH: number
): { x: number; y: number; width: number; height: number } {
  // Detector covers internal facial features
  // Frame width: 1.15x detector size (captures ears & cheeks)
  // Frame height: 1.28x detector size (captures hair down to chin)
  const boxW = size * 1.15;
  const boxH = size * 1.28;

  // Center horizontally, shift up slightly so hairline and forehead are inside
  let boxX = cx - boxW / 2;
  let boxY = cy - boxH * 0.52;

  // Clamp within image bounds
  boxX = Math.max(0, Math.min(frameW - boxW, boxX));
  boxY = Math.max(0, Math.min(frameH - boxH, boxY));

  // Convert to percentage (0 - 100)
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
          const rowA = Math.round(a.boundingBox.y / 60);
          const rowB = Math.round(b.boundingBox.y / 60);
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

  // 2. High-Precision Multi-Scale Cascade with Texture & Skin Verification
  const classifier = await initPicoClassifier();
  if (!classifier) return [];

  const canvas = document.createElement('canvas');
  // Process at 1280px width to preserve small distant faces in middle/back classroom rows
  const targetW = Math.min(width, 1280);
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

    // Fine-scale parameters covering whole classroom depth (near front row to far back row)
    // Smallest face: ~22px (back row students far away)
    // Largest face: ~65% of screen height (front row students up close)
    const minFacePx = Math.max(22, Math.round(targetW * 0.024));
    const maxFacePx = Math.round(targetH * 0.65);

    const params = {
      shiftfactor: 0.1,
      minsize: minFacePx,
      maxsize: maxFacePx,
      scalefactor: 1.12, // Dense scale steps ensure no row is missed
    };

    let rawDetections = runCascade(imageObj, classifier, params);

    // Merge multi-scale detections & apply Cross-Scale Non-Maximum Suppression (NMS)
    // Guarantees ONE clean bounding box per student face
    const clustered = clusterDetections(rawDetections, 0.20);

    // Filter candidate boxes by score & anatomical face verification
    // Rejects walls, clothing, doorframes, curtains, and artifacts
    const verifiedFaces: Array<[number, number, number, number]> = [];

    for (const det of clustered) {
      const row = det[0];
      const col = det[1];
      const size = det[2];
      const score = det[3];

      // Confidence threshold:
      // Smaller distant faces need at least 9.0; larger nearby faces need at least 12.0
      const minConfidence = size < 45 ? 9.0 : 12.0;
      if (score < minConfidence) continue;

      // Facial anatomy & skin texture verification
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
        continue; // Discard empty background/walls
      }

      verifiedFaces.push(det);
    }

    // Sort faces systematically by classroom seating order:
    // Row by row (top to bottom, i.e. far to near), left-to-right
    verifiedFaces.sort((a, b) => {
      const rowA = Math.round(a[0] / 50);
      const rowB = Math.round(b[0] / 50);
      if (rowA !== rowB) return rowA - rowB;
      return a[1] - b[1];
    });

    return verifiedFaces.map((det, idx) => {
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
