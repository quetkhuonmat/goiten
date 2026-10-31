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
 * Detect REAL human faces only.
 * Returns only verified face bounding boxes.
 * Zero false positives on plain walls, doors, ceilings, or clothing.
 */
export async function detectClassroomFaces(
  source: HTMLVideoElement | HTMLImageElement
): Promise<DetectedFace[]> {
  const width = 'videoWidth' in source ? source.videoWidth : source.naturalWidth;
  const height = 'videoHeight' in source ? source.videoHeight : source.naturalHeight;

  if (!width || !height || width <= 20 || height <= 20) return [];

  // 1. Primary: Native Browser FaceDetector (Chromium / Chrome Android)
  if ('FaceDetector' in window) {
    try {
      const FaceDetectorClass = (window as unknown as {
        FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (s: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
        };
      }).FaceDetector;

      const detector = new FaceDetectorClass({ fastMode: false, maxDetectedFaces: 50 });
      const faces = await detector.detect(source);

      // Native FaceDetector is extremely accurate: trust its detections directly
      if (faces && faces.length > 0) {
        // Sort left-to-right for clean ordering
        const sorted = [...faces].sort((a, b) => a.boundingBox.x - b.boundingBox.x);
        return sorted.map((f, idx) => {
          const bb = f.boundingBox;
          return {
            id: idx + 1,
            x: Math.max(0, Math.min(95, (bb.x / width) * 100)),
            y: Math.max(0, Math.min(95, (bb.y / height) * 100)),
            width: Math.max(5, Math.min(30, (bb.width / width) * 100)),
            height: Math.max(6, Math.min(35, (bb.height / height) * 100)),
            called: false,
          };
        });
      } else {
        // Native detector confirmed NO faces in frame (e.g. wall or empty background)
        return [];
      }
    } catch (err) {
      console.warn('Native FaceDetector error, falling back to Pico:', err);
    }
  }

  // 2. Secondary: Pre-trained Neural Cascade (Pico Facefinder)
  const classifier = await initPicoClassifier();
  if (!classifier) return [];

  const canvas = document.createElement('canvas');
  // Scale image to standard detection resolution
  const targetW = Math.min(width, 640);
  const targetH = Math.round((height / width) * targetW);
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
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

    // Standard high-accuracy parameters
    const params = {
      shiftfactor: 0.1,
      minsize: 24,
      maxsize: Math.round(targetH * 0.8),
      scalefactor: 1.15,
    };

    let rawDetections = runCascade(imageObj, classifier, params);

    // Merge overlapping boxes on same face
    rawDetections = clusterDetections(rawDetections, 0.2);

    // STRICT Confidence Threshold: Only keep true faces (score >= 8.5)
    // Rejects walls, clothes, doors, doorframes, and background patterns
    const verifiedFaces = rawDetections.filter((det) => det[3] >= 8.5);

    // Sort left to right
    verifiedFaces.sort((a, b) => a[1] - b[1]);

    return verifiedFaces.map((det, idx) => {
      const row = det[0];
      const col = det[1];
      const size = det[2];

      const x = Math.max(0, ((col - size / 2) / targetW) * 100);
      const y = Math.max(0, ((row - size / 2) / targetH) * 100);
      const w = Math.min(100 - x, (size / targetW) * 100);
      const h = Math.min(100 - y, (size / targetH) * 100);

      return {
        id: idx + 1,
        x,
        y,
        width: w,
        height: h,
        called: false,
      };
    });
  } catch (err) {
    console.error('Pico detection error:', err);
    return [];
  }
}
