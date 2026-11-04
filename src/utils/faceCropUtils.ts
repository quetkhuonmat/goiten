/**
 * High-Precision Face Cropping & Portrait Enhancement Utilities
 * Provides clear, balanced student portraits without blurry pixelation
 */

import { DetectedFace } from '../types';

export interface CroppedPortraitResult {
  facePhotoUrl: string;
  classroomOverviewUrl: string | null;
  cropWidth: number;
  cropHeight: number;
}

/**
 * Applies a gentle unsharp mask to crisp up facial features (eyes, eyebrows, mouth)
 * Prevents blurriness when magnifying student faces from classroom wide shots.
 */
function applyUnsharpClarityFilter(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number = 0.35) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);

    // 3x3 sharpening kernel
    // [  0,  -1,   0 ]
    // [ -1, 4+1/a, -1 ]
    // [  0,  -1,   0 ]
    const w = width;
    const h = height;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;

        for (let c = 0; c < 3; c++) {
          const center = copy[idx + c];
          const top = copy[((y - 1) * w + x) * 4 + c];
          const bottom = copy[((y + 1) * w + x) * 4 + c];
          const left = copy[(y * w + (x - 1)) * 4 + c];
          const right = copy[(y * w + (x + 1)) * 4 + c];

          const edge = center * 4 - top - bottom - left - right;
          const enhanced = center + edge * amount;
          data[idx + c] = Math.max(0, Math.min(255, Math.round(enhanced)));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    // If getImageData fails due to security or memory, keep original image
    console.warn('Clarity filter skipped:', err);
  }
}

/**
 * Extracts a high-resolution, moderately magnified portrait of the student.
 * Captures head, hair, ears, and collar with balanced proportions (không bị vỡ hạt).
 */
export function cropStudentFacePortrait(
  source: HTMLVideoElement | HTMLImageElement,
  face: DetectedFace
): CroppedPortraitResult | null {
  try {
    const srcW = 'videoWidth' in source ? source.videoWidth : source.naturalWidth;
    const srcH = 'videoHeight' in source ? source.videoHeight : source.naturalHeight;

    if (!srcW || !srcH || srcW < 30 || srcH < 30) return null;

    // Convert percentage coordinates to raw source pixels
    const facePxX = (face.x / 100) * srcW;
    const facePxY = (face.y / 100) * srcH;
    const facePxW = (face.width / 100) * srcW;
    const facePxH = (face.height / 100) * srcH;

    // Face center point
    const cx = facePxX + facePxW / 2;
    // Eye line is slightly above the vertical center
    const cy = facePxY + facePxH * 0.45;

    // Balanced contextual framing: 1.6x of face dimension
    // Captures full head, hairstyle, face, neck, and upper school uniform
    const portraitDim = Math.max(facePxW, facePxH) * 1.60;

    let sx = cx - portraitDim / 2;
    // Position eyes at the golden upper third (0.42 from top)
    let sy = cy - portraitDim * 0.42;
    let sw = portraitDim;
    let sh = portraitDim;

    // Boundary clamp within raw image frame
    if (sx < 0) {
      sx = 0;
    }
    if (sy < 0) {
      sy = 0;
    }
    if (sx + sw > srcW) {
      sw = srcW - sx;
    }
    if (sy + sh > srcH) {
      sh = srcH - sy;
    }

    const cropBoxSize = Math.max(20, Math.min(sw, sh));

    // Target canvas dimensions: 420x420 ensures high DPI clarity without over-zoomed pixelation
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 420;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // High quality bicubic sampling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw the cropped region
    ctx.drawImage(
      source,
      Math.round(sx),
      Math.round(sy),
      Math.round(cropBoxSize),
      Math.round(cropBoxSize),
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Apply clarity sharpening filter if the face was captured from medium/far distance
    const isDistantFace = cropBoxSize < 160;
    const clarityStrength = isDistantFace ? 0.38 : 0.22;
    applyUnsharpClarityFilter(ctx, canvas.width, canvas.height, clarityStrength);

    const facePhotoUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Also generate a Full Classroom Overview with target highlighter
    let classroomOverviewUrl: string | null = null;
    try {
      const overviewCanvas = document.createElement('canvas');
      const maxOverviewW = 800;
      overviewCanvas.width = maxOverviewW;
      overviewCanvas.height = Math.round((srcH / srcW) * maxOverviewW);
      const oCtx = overviewCanvas.getContext('2d');

      if (oCtx) {
        oCtx.imageSmoothingEnabled = true;
        oCtx.imageSmoothingQuality = 'high';
        oCtx.drawImage(source, 0, 0, overviewCanvas.width, overviewCanvas.height);

        // Highlight the selected student in the whole class
        const oX = (face.x / 100) * overviewCanvas.width;
        const oY = (face.y / 100) * overviewCanvas.height;
        const oW = (face.width / 100) * overviewCanvas.width;
        const oH = (face.height / 100) * overviewCanvas.height;

        // Dim background slightly to emphasize target
        oCtx.fillStyle = 'rgba(2, 6, 23, 0.35)';
        oCtx.fillRect(0, 0, overviewCanvas.width, overviewCanvas.height);

        // Clear hole for student
        oCtx.clearRect(oX, oY, oW, oH);
        oCtx.drawImage(source, (face.x / 100) * srcW, (face.y / 100) * srcH, (face.width / 100) * srcW, (face.height / 100) * srcH, oX, oY, oW, oH);

        // Glowing target box
        oCtx.strokeStyle = '#fbbf24';
        oCtx.lineWidth = 3;
        oCtx.strokeRect(oX, oY, oW, oH);

        // Target tag
        oCtx.fillStyle = '#fbbf24';
        oCtx.fillRect(oX, Math.max(0, oY - 20), Math.min(130, oW + 40), 20);
        oCtx.fillStyle = '#020617';
        oCtx.font = 'bold 11px sans-serif';
        oCtx.fillText(`★ HỌC SINH #${face.id}`, oX + 4, Math.max(14, oY - 6));

        classroomOverviewUrl = overviewCanvas.toDataURL('image/jpeg', 0.88);
      }
    } catch (e) {
      console.warn('Overview generation skipped:', e);
    }

    return {
      facePhotoUrl,
      classroomOverviewUrl,
      cropWidth: cropBoxSize,
      cropHeight: cropBoxSize,
    };
  } catch (err) {
    console.error('cropStudentFacePortrait error:', err);
    return null;
  }
}
