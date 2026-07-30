'use client';

import type { VisualMetrics } from '@/types/interview';

/**
 * Optional webcam signals.
 *
 * This is deliberately not face detection, gaze tracking or emotion recognition. It samples
 * small greyscale frames and measures how much they change, which supports two honest
 * coaching observations: whether the camera was actually showing you, and whether you were
 * steady or restless. Video never leaves the browser and no frame is ever stored.
 */

/** Downscaled sampling grid — small enough to be free, big enough to locate movement. */
const GRID_W = 32;
const GRID_H = 24;
const SAMPLE_INTERVAL_MS = 500;

/** Mean pixel delta above this counts as movement rather than sensor noise. */
const MOVEMENT_FLOOR = 4;
/** Frames with less spread than this are a blank feed: covered lens, or no signal. */
const BLANK_VARIANCE = 6;

export class FrameSampler {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private previous: Uint8ClampedArray | null = null;

  private samples = 0;
  private liveSamples = 0;
  private movementTotal = 0;
  private movingSamples = 0;
  private centeredSamples = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = GRID_W;
    this.canvas.height = GRID_H;
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /** Samples one frame. Safe to call before the video has data. */
  sample(video: HTMLVideoElement): void {
    if (!this.context || video.readyState < 2) return;

    this.context.drawImage(video, 0, 0, GRID_W, GRID_H);
    const { data } = this.context.getImageData(0, 0, GRID_W, GRID_H);

    // Collapse RGBA to a greyscale plane.
    const grey = new Uint8ClampedArray(GRID_W * GRID_H);
    for (let i = 0; i < grey.length; i += 1) {
      const p = i * 4;
      grey[i] = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) | 0;
    }

    this.samples += 1;

    // A real image has spread; a black or covered frame does not.
    let min = 255;
    let max = 0;
    for (const value of grey) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (max - min > BLANK_VARIANCE) this.liveSamples += 1;

    if (this.previous) {
      let deltaTotal = 0;
      let weightedX = 0;
      let weightSum = 0;

      for (let i = 0; i < grey.length; i += 1) {
        const delta = Math.abs(grey[i] - this.previous[i]);
        deltaTotal += delta;
        if (delta > MOVEMENT_FLOOR) {
          weightedX += (i % GRID_W) * delta;
          weightSum += delta;
        }
      }

      const meanDelta = deltaTotal / grey.length;
      this.movementTotal += meanDelta;

      if (weightSum > 0) {
        this.movingSamples += 1;
        // Centre third of the frame, measured on the motion centroid.
        const centroidX = weightedX / weightSum;
        if (centroidX > GRID_W / 3 && centroidX < (GRID_W * 2) / 3) this.centeredSamples += 1;
      }
    }

    this.previous = grey;
  }

  /** Returns undefined when too little was sampled to say anything meaningful. */
  result(): VisualMetrics | undefined {
    if (this.samples < 4) return undefined;

    const meanMovement = this.movementTotal / Math.max(1, this.samples - 1);

    return {
      samples: this.samples,
      cameraOnPct: Math.round((this.liveSamples / this.samples) * 100),
      // ~12 mean delta is a lot of motion at this grid size; clamp to a 0-100 index.
      movementIndex: Math.max(0, Math.min(100, Math.round((meanMovement / 12) * 100))),
      framingCenteredPct:
        this.movingSamples > 0
          ? Math.round((this.centeredSamples / this.movingSamples) * 100)
          : 0,
    };
  }

  reset(): void {
    this.previous = null;
    this.samples = 0;
    this.liveSamples = 0;
    this.movementTotal = 0;
    this.movingSamples = 0;
    this.centeredSamples = 0;
  }
}

export const FRAME_SAMPLE_INTERVAL_MS = SAMPLE_INTERVAL_MS;

/** One plain-English observation. Never phrased as a judgement about the person. */
export function describePresence(metrics: VisualMetrics): string {
  if (metrics.cameraOnPct < 60) return 'Camera was mostly dark or covered.';
  if (metrics.movementIndex >= 55) return 'Lots of movement — you were shifting around a fair bit.';
  if (metrics.movementIndex <= 6) return 'Very still — almost no movement in frame.';
  if (metrics.framingCenteredPct < 40) return 'You drifted off-centre in the frame.';
  return 'Steady and well framed.';
}
