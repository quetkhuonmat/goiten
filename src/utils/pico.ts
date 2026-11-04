/**
 * Pico.js Face Detection Engine
 * High-speed, lightweight client-side face detector with zero external cloud dependencies.
 * MIT License - Nenad Markuš
 */

export type ClassifierFunction = (r: number, c: number, s: number, pixels: Uint8Array, ldim: number) => number;

export function unpackCascade(bytes: Int8Array): ClassifierFunction {
  const dview = new DataView(new ArrayBuffer(4));
  let p = 8; // skip version bytes

  dview.setUint8(0, bytes[p + 0]);
  dview.setUint8(1, bytes[p + 1]);
  dview.setUint8(2, bytes[p + 2]);
  dview.setUint8(3, bytes[p + 3]);
  const tdepth = dview.getInt32(0, true);
  p += 4;

  dview.setUint8(0, bytes[p + 0]);
  dview.setUint8(1, bytes[p + 1]);
  dview.setUint8(2, bytes[p + 2]);
  dview.setUint8(3, bytes[p + 3]);
  const ntrees = dview.getInt32(0, true);
  p += 4;

  const tcodes_ls: number[] = [];
  const tpreds_ls: number[] = [];
  const thresh_ls: number[] = [];

  for (let t = 0; t < ntrees; ++t) {
    tcodes_ls.push(0, 0, 0, 0);
    const treeBytes = bytes.slice(p, p + 4 * Math.pow(2, tdepth) - 4);
    for (let b = 0; b < treeBytes.length; b++) {
      tcodes_ls.push(treeBytes[b]);
    }
    p += 4 * Math.pow(2, tdepth) - 4;

    for (let i = 0; i < Math.pow(2, tdepth); ++i) {
      dview.setUint8(0, bytes[p + 0]);
      dview.setUint8(1, bytes[p + 1]);
      dview.setUint8(2, bytes[p + 2]);
      dview.setUint8(3, bytes[p + 3]);
      tpreds_ls.push(dview.getFloat32(0, true));
      p += 4;
    }

    dview.setUint8(0, bytes[p + 0]);
    dview.setUint8(1, bytes[p + 1]);
    dview.setUint8(2, bytes[p + 2]);
    dview.setUint8(3, bytes[p + 3]);
    thresh_ls.push(dview.getFloat32(0, true));
    p += 4;
  }

  const tcodes = new Int8Array(tcodes_ls);
  const tpreds = new Float32Array(tpreds_ls);
  const thresh = new Float32Array(thresh_ls);

  return function classifyRegion(r: number, c: number, s: number, pixels: Uint8Array, ldim: number): number {
    r = 256 * r;
    c = 256 * c;
    let root = 0;
    let o = 0.0;
    const pow2tdepth = Math.pow(2, tdepth) >> 0;

    for (let i = 0; i < ntrees; ++i) {
      let idx = 1;
      for (let j = 0; j < tdepth; ++j) {
        idx =
          2 * idx +
          (pixels[
            (((r + tcodes[root + 4 * idx + 0] * s) >> 8) * ldim +
              ((c + tcodes[root + 4 * idx + 1] * s) >> 8))
          ] <=
          pixels[
            (((r + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim +
              ((c + tcodes[root + 4 * idx + 3] * s) >> 8))
          ]
            ? 1
            : 0);
      }
      o += tpreds[pow2tdepth * i + idx - pow2tdepth];
      if (o <= thresh[i]) return -1;
      root += 4 * pow2tdepth;
    }
    return o - thresh[ntrees - 1];
  };
}

export function runCascade(
  image: { pixels: Uint8Array; nrows: number; ncols: number; ldim: number },
  classifyRegion: ClassifierFunction,
  params: { shiftfactor: number; minsize: number; maxsize: number; scalefactor: number }
): Array<[number, number, number, number]> {
  const { pixels, nrows, ncols, ldim } = image;
  const { shiftfactor, minsize, maxsize, scalefactor } = params;
  let scale = minsize;
  const detections: Array<[number, number, number, number]> = [];

  while (scale <= maxsize) {
    const step = Math.max(shiftfactor * scale, 1) >> 0;
    const offset = (scale / 2 + 1) >> 0;

    for (let r = offset; r <= nrows - offset; r += step) {
      for (let c = offset; c <= ncols - offset; c += step) {
        const q = classifyRegion(r, c, scale, pixels, ldim);
        if (q > 0.0) {
          detections.push([r, c, scale, q]);
        }
      }
    }
    scale *= scalefactor;
  }
  return detections;
}

export function clusterDetections(
  dets: Array<[number, number, number, number]>,
  iouthreshold: number = 0.2
): Array<[number, number, number, number]> {
  if (dets.length === 0) return [];
  // Sort descending by detection confidence score
  dets = dets.sort((a, b) => b[3] - a[3]);

  function calculateIou(det1: [number, number, number, number], det2: [number, number, number, number]) {
    const r1 = det1[0], c1 = det1[1], s1 = det1[2];
    const r2 = det2[0], c2 = det2[1], s2 = det2[2];
    const half1 = s1 / 2;
    const half2 = s2 / 2;
    const overr = Math.max(0, Math.min(r1 + half1, r2 + half2) - Math.max(r1 - half1, r2 - half2));
    const overc = Math.max(0, Math.min(c1 + half1, c2 + half2) - Math.max(c1 - half1, c2 - half2));
    const inter = overr * overc;
    if (inter <= 0) return 0;
    const union = s1 * s1 + s2 * s2 - inter;
    return union > 0 ? inter / union : 0;
  }

  const assignments = new Uint8Array(dets.length);
  const clusters: Array<[number, number, number, number]> = [];

  for (let i = 0; i < dets.length; ++i) {
    if (assignments[i] === 1) continue;
    assignments[i] = 1;

    let r = dets[i][0];
    let c = dets[i][1];
    let s = dets[i][2];
    let q = dets[i][3];
    let n = 1;

    for (let j = i + 1; j < dets.length; ++j) {
      if (assignments[j] === 1) continue;
      const iou = calculateIou(dets[i], dets[j]);
      const dist = Math.hypot(dets[i][0] - dets[j][0], dets[i][1] - dets[j][1]);
      const minS = Math.min(dets[i][2], dets[j][2]);

      // Merge if IoU is high OR centers are tightly clustered within the smaller box
      if (iou > iouthreshold || dist < minS * 0.35) {
        assignments[j] = 1;
        r += dets[j][0];
        c += dets[j][1];
        s += dets[j][2];
        q += dets[j][3];
        n += 1;
      }
    }
    // Record cluster: [average row, average col, average size, accumulated score]
    clusters.push([r / n, c / n, s / n, q]);
  }

  // SECOND PASS: Strict Cross-Scale Non-Maximum Suppression (NMS)
  // Ensures ONE clean bounding box per student face across all scales (near to far)
  return suppressOverlappingFaces(clusters);
}

/**
 * Cross-scale Non-Maximum Suppression (NMS)
 * Merges duplicate or nested boxes covering the same student head.
 */
export function suppressOverlappingFaces(
  boxes: Array<[number, number, number, number]>
): Array<[number, number, number, number]> {
  if (boxes.length <= 1) return boxes;
  // Sort descending by score
  const sorted = [...boxes].sort((a, b) => b[3] - a[3]);
  const kept: Array<[number, number, number, number]> = [];

  for (const box of sorted) {
    const [r, c, s, q] = box;
    const half = s / 2;

    let isDuplicate = false;
    for (let k = 0; k < kept.length; k++) {
      const [kr, kc, ks, kq] = kept[k];
      const kHalf = ks / 2;

      // Center distance
      const centerDist = Math.hypot(r - kr, c - kc);
      const minS = Math.min(s, ks);
      const maxS = Math.max(s, ks);

      // Check center containment: is one center inside the other box?
      const insideK = Math.abs(r - kr) < kHalf && Math.abs(c - kc) < kHalf;
      const insideBox = Math.abs(kr - r) < half && Math.abs(kc - c) < half;

      // Check IoU
      const overr = Math.max(0, Math.min(r + half, kr + kHalf) - Math.max(r - half, kr - kHalf));
      const overc = Math.max(0, Math.min(c + half, kc + kHalf) - Math.max(c - half, kc - kHalf));
      const inter = overr * overc;
      const union = s * s + ks * ks - inter;
      const iou = union > 0 ? inter / union : 0;

      // Conditions for being the same student:
      // 1. Center distance is less than 50% of the larger box
      // 2. Either center is inside the other box
      // 3. IoU > 0.18
      if (centerDist < maxS * 0.50 || centerDist < minS * 0.70 || insideK || insideBox || iou > 0.18) {
        isDuplicate = true;
        // Reinforce confidence score of the kept face
        kept[k][3] = Math.max(kq, q) + Math.min(kq, q) * 0.3;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push([r, c, s, q]);
    }
  }

  return kept;
}

