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
 * Detect real human faces from a video or image element
 * Returns [] (empty array) if no face is present (e.g. pointing at a wall or door).
 */
export async function detectClassroomFaces(
  source: HTMLVideoElement | HTMLImageElement
): Promise<DetectedFace[]> {
  const width = 'videoWidth' in source ? source.videoWidth : source.naturalWidth;
  const height = 'videoHeight' in source ? source.videoHeight : source.naturalHeight;

  if (!width || !height || width <= 10 || height <= 10) return [];

  // 1. Try Native FaceDetector API (standard in Chrome / Android Chrome)
  if ('FaceDetector' in window) {
    try {
      const FaceDetectorClass = (window as unknown as {
        FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (s: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
        };
      }).FaceDetector;

      const detector = new FaceDetectorClass({ fastMode: false, maxDetectedFaces: 60 });
      const faces = await detector.detect(source);

      // If FaceDetector exists and returned results (or 0 faces), trust it directly!
      return faces.map((f, idx) => {
        const bb = f.boundingBox;
        return {
          id: idx + 1,
          x: Math.max(0, Math.min(95, (bb.x / width) * 100)),
          y: Math.max(0, Math.min(95, (bb.y / height) * 100)),
          width: Math.max(5, Math.min(30, (bb.width / width) * 100)),
          height: Math.max(5, Math.min(35, (bb.height / height) * 100)),
          called: false,
        };
      });
    } catch (err) {
      console.warn('Native FaceDetector error, using Pico:', err);
    }
  }

  // 2. Use Pico Face Classifier (100% offline, zero-false-positive on plain walls)
  const classifier = await initPicoClassifier();
  if (!classifier) {
    // If no detector is available and not a real face, return empty (NEVER guess fake boxes!)
    return [];
  }

  const canvas = document.createElement('canvas');
  // Target a comfortable resolution for detection
  const maxDim = 480;
  const scale = maxDim / Math.max(width, height);
  const sw = Math.floor(width * scale);
  const sh = Math.floor(height * scale);
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  try {
    ctx.drawImage(source, 0, 0, sw, sh);
    const imgData = ctx.getImageData(0, 0, sw, sh);
    const grayPixels = rgbaToGrayscale(imgData.data, sh, sw);

    const imageObj = {
      pixels: grayPixels,
      nrows: sh,
      ncols: sw,
      ldim: sw,
    };

    const params = {
      shiftfactor: 0.1, // shift window by 10%
      minsize: 24, // minimum face size in pixels
      maxsize: Math.min(sw, sh), // maximum face size
      scalefactor: 1.15, // scale step
    };

    let rawDetections = runCascade(imageObj, classifier, params);
    // Cluster overlapping detections
    rawDetections = clusterDetections(rawDetections, 0.2);

    // Keep only high-confidence face detections (score threshold >= 5.0)
    const validFaces = rawDetections.filter((det) => det[3] >= 5.0);

    return validFaces.map((det, idx) => {
      const row = det[0];
      const col = det[1];
      const size = det[2];

      const x = Math.max(0, ((col - size / 2) / sw) * 100);
      const y = Math.max(0, ((row - size / 2) / sh) * 100);
      const w = Math.min(100 - x, (size / sw) * 100);
      const h = Math.min(100 - y, (size / sh) * 100);

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
