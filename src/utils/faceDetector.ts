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
 * Validates whether a candidate region has human skin color distribution
 * Rejects plain walls, chalkboards, whiteboards, doors, clothes, curtains.
 */
function isHumanFaceRegion(
  rgba: Uint8ClampedArray,
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

  if (endX <= startX || endY <= startY) return false;

  let skinPixels = 0;
  let totalSampled = 0;
  // Sample a grid of pixels inside the candidate face box
  const step = Math.max(1, Math.floor(size / 16));

  for (let y = startY; y < endY; y += step) {
    for (let x = startX; x < endX; x += step) {
      const idx = (y * imgWidth + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];

      totalSampled++;

      // YCbCr skin tone transformation
      // Y  =  0.299*R + 0.587*G + 0.114*B
      // Cb = -0.168736*R - 0.331264*G + 0.5*B + 128
      // Cr =  0.5*R - 0.418688*G - 0.081312*B + 128
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      // Human skin cluster: Cr ~ [133, 175], Cb ~ [75, 130]
      const isSkinYCbCr = cb >= 75 && cb <= 132 && cr >= 130 && cr <= 178;
      // Basic RGB skin heuristic: R > G > B, noticeable red dominance
      const isSkinRgb = r > 65 && g > 40 && b > 25 && r > g && r > b && (r - g) >= 8;

      if (isSkinYCbCr || isSkinRgb) {
        skinPixels++;
      }
    }
  }

  if (totalSampled === 0) return false;
  const skinRatio = skinPixels / totalSampled;
  // A true face box must have at least 18% skin pixels
  // Walls, doors, blackboards, uniforms typically have < 5%
  return skinRatio >= 0.18;
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
  // A standard facial cascade finds inner facial landmarks (eyes to mouth)
  // Snug head bounding box:
  // Width: 1.15x detector size (captures ears & cheeks)
  // Height: 1.30x detector size (captures hair down to chin)
  const boxW = size * 1.15;
  const boxH = size * 1.30;

  // Center horizontally, shift up slightly (0.54) so the hairline and forehead are inside
  let boxX = cx - boxW / 2;
  let boxY = cy - boxH * 0.54;

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
 * Detect REAL human faces only.
 * Returns verified face bounding boxes precisely framing students.
 * Eliminates empty rectangles on walls, doors, ceilings, or clothing.
 */
export async function detectClassroomFaces(
  source: HTMLVideoElement | HTMLImageElement
): Promise<DetectedFace[]> {
  const width = 'videoWidth' in source ? source.videoWidth : source.naturalWidth;
  const height = 'videoHeight' in source ? source.videoHeight : source.naturalHeight;

  if (!width || !height || width <= 30 || height <= 30) return [];

  // 1. Primary: Native Browser FaceDetector (Chromium / Chrome Android) if available
  if ('FaceDetector' in window) {
    try {
      const FaceDetectorClass = (window as unknown as {
        FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (s: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
        };
      }).FaceDetector;

      const detector = new FaceDetectorClass({ fastMode: false, maxDetectedFaces: 50 });
      const faces = await detector.detect(source);

      if (faces && faces.length > 0) {
        // Sort left-to-right, then top-to-bottom
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
      console.warn('Native FaceDetector error, continuing to Pico:', err);
    }
  }

  // 2. High-Precision Pico Neural Cascade with Color & Skin Verification
  const classifier = await initPicoClassifier();
  if (!classifier) return [];

  const canvas = document.createElement('canvas');
  // Scale image to good detection resolution (higher resolution captures distant classroom faces)
  const targetW = Math.min(width, 800);
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

    // Parameters optimized for classroom students (both foreground and middle/back rows)
    const params = {
      shiftfactor: 0.1,
      minsize: Math.max(20, Math.round(targetW * 0.035)), // Detect small faces in classroom
      maxsize: Math.round(targetH * 0.75),
      scalefactor: 1.14,
    };

    let rawDetections = runCascade(imageObj, classifier, params);

    // Merge overlapping boxes on same face
    rawDetections = clusterDetections(rawDetections, 0.25);

    // Filter by cascade score AND Skin Tone Verification
    // Rejects walls, clothing, doorframes, curtains, and artifacts
    const verifiedFaces: Array<[number, number, number, number]> = [];

    for (const det of rawDetections) {
      const row = det[0];
      const col = det[1];
      const size = det[2];
      const score = det[3];

      // Minimum cascade confidence
      if (score < 7.0) continue;

      // Color/Skin validation against false positives
      const isSkinFace = isHumanFaceRegion(imgData.data, col, row, size, targetW, targetH);
      if (!isSkinFace) {
        continue; // Discard empty background/walls
      }

      verifiedFaces.push(det);
    }

    // Sort faces systematically (first by row, then by left-to-right column)
    verifiedFaces.sort((a, b) => {
      const rowA = Math.round(a[0] / 60);
      const rowB = Math.round(b[0] / 60);
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
    console.error('Pico detection error:', err);
    return [];
  }
}
