import { DetectedFace } from '../types';

/**
 * Detect faces from a live video or image element
 */
export async function detectClassroomFaces(
  source: HTMLVideoElement | HTMLImageElement
): Promise<DetectedFace[]> {
  const width = 'videoWidth' in source ? source.videoWidth : source.naturalWidth;
  const height = 'videoHeight' in source ? source.videoHeight : source.naturalHeight;

  if (!width || !height || width <= 10 || height <= 10) return [];

  // 1. Try Native FaceDetector API (available in Chrome Android and Chromium)
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
        return faces.map((f, idx) => {
          const bb = f.boundingBox;
          return {
            id: idx + 1,
            x: Math.max(0, Math.min(95, (bb.x / width) * 100)),
            y: Math.max(0, Math.min(95, (bb.y / height) * 100)),
            width: Math.max(6, Math.min(30, (bb.width / width) * 100)),
            height: Math.max(6, Math.min(35, (bb.height / height) * 100)),
            called: false,
          };
        });
      }
    } catch (err) {
      console.warn('Native FaceDetector failed, falling back to vision detection:', err);
    }
  }

  // 2. Vision analysis: detect skin-tone and contrast regions in the classroom
  return analyzeClassroomRegions(source, width, height);
}

/**
 * Intelligent classroom facial region cluster detector
 */
function analyzeClassroomRegions(
  source: CanvasImageSource,
  width: number,
  height: number
): DetectedFace[] {
  const canvas = document.createElement('canvas');
  const scale = 320 / Math.max(width, height);
  const sw = Math.floor(width * scale);
  const sh = Math.floor(height * scale);
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  try {
    ctx.drawImage(source, 0, 0, sw, sh);
    const imgData = ctx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // Scan for face/skin clusters
    const candidates: { x: number; y: number }[] = [];
    const step = 6;

    for (let y = Math.floor(sh * 0.15); y < Math.floor(sh * 0.9); y += step) {
      for (let x = Math.floor(sw * 0.08); x < Math.floor(sw * 0.92); x += step) {
        const idx = (y * sw + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Skin chrominance rule
        const isSkin =
          r > 90 &&
          g > 40 &&
          b > 20 &&
          r > g &&
          r > b &&
          r - g > 15 &&
          Math.abs(r - g) > 15;

        if (isSkin) {
          candidates.push({ x: (x / sw) * 100, y: (y / sh) * 100 });
        }
      }
    }

    // Cluster candidates
    const clustered: DetectedFace[] = [];
    const minDist = 11; // minimum distance between student faces

    for (const c of candidates) {
      const exists = clustered.some(
        (f) => Math.hypot(f.x - c.x, f.y - c.y) < minDist
      );
      if (!exists && clustered.length < 35) {
        clustered.push({
          id: clustered.length + 1,
          x: Math.max(2, c.x - 6),
          y: Math.max(2, c.y - 8),
          width: 12,
          height: 18,
          called: false,
        });
      }
    }

    return clustered;
  } catch (e) {
    console.error('Vision analysis error:', e);
    return [];
  }
}
