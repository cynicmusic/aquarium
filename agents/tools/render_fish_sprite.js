#!/usr/bin/env node
/**
 * render_fish_sprite.js — Renders a fish silhouette/textured sprite to PNG.
 * Uses Canvas 2D (no Three.js dependency) for fast headless iteration.
 *
 * Usage:
 *   node agents/tools/render_fish_sprite.js --species clownfish --mode silhouette --out output/sprites/geometry/geom_001_clownfish.png
 *   node agents/tools/render_fish_sprite.js --species clownfish --mode textured --texture output/sprites/textures/tex_005.png --out output/sprites/combined/fish_001_clownfish.png
 *   node agents/tools/render_fish_sprite.js --profile '{"top":[...], "bottom":[...]}' --mode silhouette --out output/sprites/geometry/geom_custom.png
 *   node agents/tools/render_fish_sprite.js --all --mode silhouette --outdir output/sprites/geometry/  (all species)
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZE = 512;
const PADDING = 50;

// ── Cubic Catmull-Rom spline interpolation ──

function catmullRomPoint(p0, p1, p2, p3, t, tension = 0.5) {
  const t2 = t * t, t3 = t2 * t;
  const s = (1 - tension) / 2;

  return {
    x: s * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: s * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

function interpolateSpline(points, segmentsPerSpan = 20, tension = 0.5) {
  if (points.length < 2) return points;

  const result = [];
  // Pad start and end for Catmull-Rom (reflect first/last segment)
  const pts = [
    { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y },
    ...points,
    { x: 2 * points[points.length - 1].x - points[points.length - 2].x,
      y: 2 * points[points.length - 1].y - points[points.length - 2].y }
  ];

  for (let i = 1; i < pts.length - 2; i++) {
    for (let j = 0; j < segmentsPerSpan; j++) {
      const t = j / segmentsPerSpan;
      result.push(catmullRomPoint(pts[i - 1], pts[i], pts[i + 1], pts[i + 2], t, tension));
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

// ── Fish profiles — IMPROVED with more control points, rounder bodies ──
// Each fish now has:
//   top/bottom: body outline (15-20+ control points for smooth curves)
//   dorsalFin: separate fin shape (connected to body at attachment points)
//   analFin: ventral fin
//   caudalFin: tail fin (proper shape, not 3 line segments)
//   pectoralFin: side fin
//   eye: position and size

// ── IMPROVED PROFILES v2 ──
// Key fixes: thicker caudal peduncle, species-distinctive shapes, wider tail connections
// Body x=0..1, tail starts at x=1. Peduncle y should be ±0.06 to ±0.10, NOT ±0.01-0.02

const PROFILES = {
  clownfish: {
    // Stocky, oval body — stays fat until near the tail
    top: [
      {x:0.00, y:0.02}, {x:0.04, y:0.10}, {x:0.10, y:0.20}, {x:0.17, y:0.28},
      {x:0.25, y:0.33}, {x:0.35, y:0.36}, {x:0.45, y:0.36}, {x:0.55, y:0.34},
      {x:0.65, y:0.30}, {x:0.73, y:0.25}, {x:0.80, y:0.20}, {x:0.86, y:0.16},
      {x:0.91, y:0.13}, {x:0.95, y:0.10}, {x:0.98, y:0.08}, {x:1.00, y:0.07}
    ],
    bottom: [
      {x:0.00, y:-0.02}, {x:0.04, y:-0.08}, {x:0.10, y:-0.17}, {x:0.17, y:-0.25},
      {x:0.25, y:-0.30}, {x:0.35, y:-0.33}, {x:0.45, y:-0.34}, {x:0.55, y:-0.32},
      {x:0.65, y:-0.28}, {x:0.73, y:-0.23}, {x:0.80, y:-0.18}, {x:0.86, y:-0.14},
      {x:0.91, y:-0.11}, {x:0.95, y:-0.09}, {x:0.98, y:-0.07}, {x:1.00, y:-0.06}
    ],
    dorsalFin: {
      outline: [
        {x:0.22, y:0.32}, {x:0.26, y:0.40}, {x:0.33, y:0.45}, {x:0.42, y:0.47},
        {x:0.52, y:0.46}, {x:0.60, y:0.42}, {x:0.66, y:0.36}, {x:0.70, y:0.28}
      ]
    },
    caudalFin: [
      {x:1.00, y:0.07}, {x:1.02, y:0.10}, {x:1.05, y:0.16}, {x:1.08, y:0.20},
      {x:1.07, y:0.14}, {x:1.04, y:0.06}, {x:1.03, y:0.00},
      {x:1.04, y:-0.06}, {x:1.07, y:-0.14}, {x:1.08, y:-0.20},
      {x:1.05, y:-0.16}, {x:1.02, y:-0.10}, {x:1.00, y:-0.06}
    ],
    analFin: [
      {x:0.52, y:-0.33}, {x:0.54, y:-0.40}, {x:0.60, y:-0.43},
      {x:0.66, y:-0.40}, {x:0.70, y:-0.34}, {x:0.68, y:-0.28}
    ],
    pectoralFin: [
      {x:0.24, y:0.00}, {x:0.22, y:-0.08}, {x:0.25, y:-0.14},
      {x:0.31, y:-0.12}, {x:0.33, y:-0.05}, {x:0.29, y:0.00}
    ],
    eye: { x: 0.13, y: 0.07, r: 0.030 },
  },

  angelfish: {
    // Tall, laterally compressed disc — very tall dorsal/anal, narrow peduncle OK for this species
    top: [
      {x:0.00, y:0.02}, {x:0.03, y:0.10}, {x:0.07, y:0.20}, {x:0.12, y:0.30},
      {x:0.18, y:0.38}, {x:0.26, y:0.44}, {x:0.35, y:0.47}, {x:0.45, y:0.48},
      {x:0.55, y:0.46}, {x:0.64, y:0.42}, {x:0.72, y:0.35}, {x:0.79, y:0.27},
      {x:0.85, y:0.19}, {x:0.90, y:0.13}, {x:0.95, y:0.08}, {x:1.00, y:0.05}
    ],
    bottom: [
      {x:0.00, y:-0.02}, {x:0.03, y:-0.08}, {x:0.07, y:-0.16}, {x:0.12, y:-0.25},
      {x:0.18, y:-0.33}, {x:0.26, y:-0.39}, {x:0.35, y:-0.43}, {x:0.45, y:-0.44},
      {x:0.55, y:-0.42}, {x:0.64, y:-0.38}, {x:0.72, y:-0.31}, {x:0.79, y:-0.23},
      {x:0.85, y:-0.16}, {x:0.90, y:-0.11}, {x:0.95, y:-0.07}, {x:1.00, y:-0.04}
    ],
    dorsalFin: {
      outline: [
        {x:0.15, y:0.36}, {x:0.17, y:0.50}, {x:0.22, y:0.62}, {x:0.30, y:0.70},
        {x:0.40, y:0.72}, {x:0.50, y:0.68}, {x:0.58, y:0.58}, {x:0.64, y:0.46},
        {x:0.68, y:0.38}
      ]
    },
    caudalFin: [
      {x:1.00, y:0.05}, {x:1.03, y:0.10}, {x:1.06, y:0.18}, {x:1.09, y:0.24},
      {x:1.08, y:0.16}, {x:1.05, y:0.06}, {x:1.04, y:0.00},
      {x:1.05, y:-0.06}, {x:1.08, y:-0.16}, {x:1.09, y:-0.24},
      {x:1.06, y:-0.18}, {x:1.03, y:-0.10}, {x:1.00, y:-0.04}
    ],
    analFin: [
      {x:0.22, y:-0.38}, {x:0.20, y:-0.52}, {x:0.25, y:-0.62},
      {x:0.34, y:-0.66}, {x:0.44, y:-0.62}, {x:0.52, y:-0.54},
      {x:0.58, y:-0.44}, {x:0.62, y:-0.34}
    ],
    pectoralFin: [
      {x:0.18, y:0.00}, {x:0.16, y:-0.10}, {x:0.19, y:-0.16},
      {x:0.25, y:-0.14}, {x:0.27, y:-0.06}, {x:0.23, y:0.00}
    ],
    eye: { x: 0.10, y: 0.08, r: 0.026 },
  },

  tang: {
    // Oval, laterally compressed — like a stretched discus. Prominent dorsal spine at tail
    top: [
      {x:0.00, y:0.01}, {x:0.04, y:0.08}, {x:0.09, y:0.17}, {x:0.15, y:0.25},
      {x:0.22, y:0.31}, {x:0.31, y:0.35}, {x:0.41, y:0.37}, {x:0.51, y:0.37},
      {x:0.61, y:0.35}, {x:0.70, y:0.31}, {x:0.78, y:0.26}, {x:0.84, y:0.20},
      {x:0.89, y:0.15}, {x:0.93, y:0.11}, {x:0.97, y:0.08}, {x:1.00, y:0.06}
    ],
    bottom: [
      {x:0.00, y:-0.01}, {x:0.04, y:-0.07}, {x:0.09, y:-0.14}, {x:0.15, y:-0.21},
      {x:0.22, y:-0.27}, {x:0.31, y:-0.31}, {x:0.41, y:-0.33}, {x:0.51, y:-0.33},
      {x:0.61, y:-0.31}, {x:0.70, y:-0.27}, {x:0.78, y:-0.22}, {x:0.84, y:-0.17},
      {x:0.89, y:-0.13}, {x:0.93, y:-0.10}, {x:0.97, y:-0.07}, {x:1.00, y:-0.05}
    ],
    dorsalFin: {
      outline: [
        {x:0.15, y:0.25}, {x:0.18, y:0.38}, {x:0.25, y:0.46}, {x:0.35, y:0.50},
        {x:0.46, y:0.51}, {x:0.57, y:0.49}, {x:0.66, y:0.44}, {x:0.73, y:0.36},
        {x:0.78, y:0.26}
      ]
    },
    caudalFin: [
      {x:1.00, y:0.06}, {x:1.03, y:0.10}, {x:1.06, y:0.16}, {x:1.09, y:0.22},
      {x:1.08, y:0.14}, {x:1.05, y:0.05}, {x:1.04, y:0.00},
      {x:1.05, y:-0.05}, {x:1.08, y:-0.14}, {x:1.09, y:-0.22},
      {x:1.06, y:-0.16}, {x:1.03, y:-0.10}, {x:1.00, y:-0.05}
    ],
    analFin: [
      {x:0.42, y:-0.33}, {x:0.44, y:-0.40}, {x:0.50, y:-0.44},
      {x:0.58, y:-0.42}, {x:0.64, y:-0.37}, {x:0.67, y:-0.29}
    ],
    pectoralFin: [
      {x:0.20, y:-0.02}, {x:0.18, y:-0.10}, {x:0.21, y:-0.15},
      {x:0.27, y:-0.13}, {x:0.28, y:-0.06}, {x:0.24, y:-0.02}
    ],
    eye: { x: 0.09, y: 0.06, r: 0.024 },
  },

  betta: {
    // Small sleek body, MASSIVE flowing fins — body is only ~40% of total fish area
    top: [
      {x:0.00, y:0.01}, {x:0.04, y:0.06}, {x:0.09, y:0.13}, {x:0.15, y:0.18},
      {x:0.22, y:0.22}, {x:0.30, y:0.24}, {x:0.38, y:0.25}, {x:0.46, y:0.24},
      {x:0.54, y:0.22}, {x:0.61, y:0.19}, {x:0.68, y:0.15}, {x:0.74, y:0.12},
      {x:0.80, y:0.09}, {x:0.86, y:0.07}, {x:0.93, y:0.05}, {x:1.00, y:0.04}
    ],
    bottom: [
      {x:0.00, y:-0.01}, {x:0.04, y:-0.05}, {x:0.09, y:-0.11}, {x:0.15, y:-0.16},
      {x:0.22, y:-0.20}, {x:0.30, y:-0.22}, {x:0.38, y:-0.22}, {x:0.46, y:-0.21},
      {x:0.54, y:-0.19}, {x:0.61, y:-0.16}, {x:0.68, y:-0.13}, {x:0.74, y:-0.10},
      {x:0.80, y:-0.08}, {x:0.86, y:-0.06}, {x:0.93, y:-0.04}, {x:1.00, y:-0.03}
    ],
    dorsalFin: {
      outline: [
        {x:0.18, y:0.21}, {x:0.20, y:0.34}, {x:0.26, y:0.46}, {x:0.34, y:0.54},
        {x:0.44, y:0.56}, {x:0.54, y:0.52}, {x:0.64, y:0.44}, {x:0.72, y:0.34},
        {x:0.78, y:0.22}, {x:0.82, y:0.10}
      ]
    },
    caudalFin: [
      // Betta: HUGE flowing tail, nearly as tall as body is long
      {x:1.00, y:0.04}, {x:1.04, y:0.10}, {x:1.10, y:0.22}, {x:1.16, y:0.34},
      {x:1.22, y:0.42}, {x:1.26, y:0.44}, {x:1.28, y:0.38},
      {x:1.26, y:0.24}, {x:1.22, y:0.10}, {x:1.18, y:0.00},
      {x:1.22, y:-0.10}, {x:1.26, y:-0.24}, {x:1.28, y:-0.38},
      {x:1.26, y:-0.44}, {x:1.22, y:-0.42}, {x:1.16, y:-0.34},
      {x:1.10, y:-0.22}, {x:1.04, y:-0.10}, {x:1.00, y:-0.03}
    ],
    analFin: [
      {x:0.32, y:-0.22}, {x:0.30, y:-0.34}, {x:0.35, y:-0.44},
      {x:0.43, y:-0.50}, {x:0.52, y:-0.48}, {x:0.62, y:-0.42},
      {x:0.70, y:-0.32}, {x:0.76, y:-0.20}, {x:0.80, y:-0.08}
    ],
    pectoralFin: [
      {x:0.20, y:-0.02}, {x:0.17, y:-0.10}, {x:0.20, y:-0.16},
      {x:0.26, y:-0.14}, {x:0.28, y:-0.07}, {x:0.24, y:-0.02}
    ],
    eye: { x: 0.10, y: 0.05, r: 0.020 },
  },

  discus: {
    // Near-perfect disc shape — almost circular body
    top: [
      {x:0.00, y:0.02}, {x:0.03, y:0.12}, {x:0.07, y:0.24}, {x:0.12, y:0.34},
      {x:0.18, y:0.42}, {x:0.26, y:0.48}, {x:0.35, y:0.52}, {x:0.45, y:0.53},
      {x:0.55, y:0.52}, {x:0.65, y:0.48}, {x:0.73, y:0.42}, {x:0.80, y:0.34},
      {x:0.86, y:0.25}, {x:0.91, y:0.17}, {x:0.95, y:0.10}, {x:1.00, y:0.05}
    ],
    bottom: [
      {x:0.00, y:-0.02}, {x:0.03, y:-0.11}, {x:0.07, y:-0.22}, {x:0.12, y:-0.32},
      {x:0.18, y:-0.40}, {x:0.26, y:-0.46}, {x:0.35, y:-0.50}, {x:0.45, y:-0.51},
      {x:0.55, y:-0.50}, {x:0.65, y:-0.46}, {x:0.73, y:-0.40}, {x:0.80, y:-0.32},
      {x:0.86, y:-0.23}, {x:0.91, y:-0.15}, {x:0.95, y:-0.09}, {x:1.00, y:-0.04}
    ],
    dorsalFin: {
      outline: [
        {x:0.14, y:0.40}, {x:0.18, y:0.52}, {x:0.26, y:0.60}, {x:0.36, y:0.64},
        {x:0.48, y:0.65}, {x:0.60, y:0.62}, {x:0.70, y:0.55}, {x:0.78, y:0.44},
        {x:0.82, y:0.36}
      ]
    },
    caudalFin: [
      {x:1.00, y:0.05}, {x:1.02, y:0.08}, {x:1.04, y:0.13}, {x:1.06, y:0.16},
      {x:1.05, y:0.10}, {x:1.03, y:0.04}, {x:1.02, y:0.00},
      {x:1.03, y:-0.04}, {x:1.05, y:-0.10}, {x:1.06, y:-0.16},
      {x:1.04, y:-0.13}, {x:1.02, y:-0.08}, {x:1.00, y:-0.04}
    ],
    analFin: [
      {x:0.18, y:-0.42}, {x:0.20, y:-0.54}, {x:0.28, y:-0.62},
      {x:0.38, y:-0.64}, {x:0.50, y:-0.62}, {x:0.60, y:-0.56},
      {x:0.70, y:-0.46}, {x:0.76, y:-0.36}
    ],
    pectoralFin: [
      {x:0.16, y:0.00}, {x:0.13, y:-0.08}, {x:0.16, y:-0.15},
      {x:0.22, y:-0.13}, {x:0.24, y:-0.06}, {x:0.20, y:0.00}
    ],
    eye: { x: 0.10, y: 0.08, r: 0.025 },
  },

  lionfish: {
    // Elongated, slightly compressed — distinctive spiny dorsal, large fan pectorals
    top: [
      {x:0.00, y:0.02}, {x:0.04, y:0.08}, {x:0.09, y:0.15}, {x:0.15, y:0.20},
      {x:0.22, y:0.24}, {x:0.30, y:0.26}, {x:0.40, y:0.27}, {x:0.50, y:0.27},
      {x:0.60, y:0.25}, {x:0.68, y:0.22}, {x:0.75, y:0.18}, {x:0.81, y:0.14},
      {x:0.87, y:0.11}, {x:0.92, y:0.09}, {x:0.96, y:0.07}, {x:1.00, y:0.06}
    ],
    bottom: [
      {x:0.00, y:-0.02}, {x:0.04, y:-0.07}, {x:0.09, y:-0.13}, {x:0.15, y:-0.19},
      {x:0.22, y:-0.24}, {x:0.30, y:-0.27}, {x:0.40, y:-0.28}, {x:0.50, y:-0.27},
      {x:0.60, y:-0.25}, {x:0.68, y:-0.21}, {x:0.75, y:-0.17}, {x:0.81, y:-0.13},
      {x:0.87, y:-0.10}, {x:0.92, y:-0.08}, {x:0.96, y:-0.06}, {x:1.00, y:-0.05}
    ],
    dorsalFin: {
      outline: [
        // Lionfish: tall separated venomous spines — use low-tension spline
        {x:0.05, y:0.12}, {x:0.06, y:0.42}, {x:0.10, y:0.48},
        {x:0.14, y:0.28}, {x:0.16, y:0.50}, {x:0.20, y:0.53},
        {x:0.24, y:0.30}, {x:0.26, y:0.52}, {x:0.30, y:0.54},
        {x:0.34, y:0.31}, {x:0.36, y:0.48}, {x:0.40, y:0.46},
        {x:0.44, y:0.28}, {x:0.48, y:0.42}, {x:0.52, y:0.38},
        {x:0.56, y:0.26}, {x:0.60, y:0.33}, {x:0.65, y:0.25},
        {x:0.70, y:0.20}
      ]
    },
    caudalFin: [
      {x:1.00, y:0.06}, {x:1.03, y:0.10}, {x:1.06, y:0.16}, {x:1.09, y:0.22},
      {x:1.08, y:0.16}, {x:1.05, y:0.06}, {x:1.04, y:0.00},
      {x:1.05, y:-0.06}, {x:1.08, y:-0.16}, {x:1.09, y:-0.22},
      {x:1.06, y:-0.16}, {x:1.03, y:-0.10}, {x:1.00, y:-0.05}
    ],
    analFin: [
      {x:0.52, y:-0.26}, {x:0.50, y:-0.36}, {x:0.54, y:-0.42},
      {x:0.60, y:-0.40}, {x:0.64, y:-0.34}, {x:0.66, y:-0.24}
    ],
    pectoralFin: [
      // Lionfish: large fan-like pectorals — distinctive feature
      {x:0.22, y:0.00}, {x:0.16, y:-0.12}, {x:0.13, y:-0.26},
      {x:0.16, y:-0.38}, {x:0.24, y:-0.42}, {x:0.32, y:-0.38},
      {x:0.36, y:-0.28}, {x:0.35, y:-0.16}, {x:0.30, y:-0.06}
    ],
    eye: { x: 0.08, y: 0.06, r: 0.020 },
  },

  moorishIdol: {
    // Compressed disc with extremely long dorsal pennant — pointed snout
    top: [
      {x:0.00, y:0.00}, {x:0.02, y:0.04}, {x:0.05, y:0.12}, {x:0.09, y:0.22},
      {x:0.14, y:0.32}, {x:0.20, y:0.40}, {x:0.28, y:0.46}, {x:0.37, y:0.49},
      {x:0.47, y:0.48}, {x:0.56, y:0.44}, {x:0.64, y:0.37}, {x:0.71, y:0.28},
      {x:0.78, y:0.20}, {x:0.84, y:0.14}, {x:0.90, y:0.09}, {x:0.95, y:0.06},
      {x:1.00, y:0.04}
    ],
    bottom: [
      {x:0.00, y:0.00}, {x:0.02, y:-0.03}, {x:0.05, y:-0.09}, {x:0.09, y:-0.18},
      {x:0.14, y:-0.26}, {x:0.20, y:-0.33}, {x:0.28, y:-0.38}, {x:0.37, y:-0.40},
      {x:0.47, y:-0.39}, {x:0.56, y:-0.35}, {x:0.64, y:-0.28}, {x:0.71, y:-0.21},
      {x:0.78, y:-0.15}, {x:0.84, y:-0.10}, {x:0.90, y:-0.07}, {x:0.95, y:-0.05},
      {x:1.00, y:-0.03}
    ],
    dorsalFin: {
      outline: [
        // Extremely tall pennant — the signature feature
        {x:0.10, y:0.28}, {x:0.11, y:0.48}, {x:0.13, y:0.68}, {x:0.16, y:0.84},
        {x:0.20, y:0.94}, {x:0.26, y:0.96}, {x:0.33, y:0.88}, {x:0.38, y:0.74},
        {x:0.42, y:0.60}, {x:0.46, y:0.50}, {x:0.50, y:0.46}
      ]
    },
    caudalFin: [
      {x:1.00, y:0.04}, {x:1.02, y:0.07}, {x:1.04, y:0.12}, {x:1.06, y:0.15},
      {x:1.05, y:0.10}, {x:1.03, y:0.04}, {x:1.02, y:0.00},
      {x:1.03, y:-0.04}, {x:1.05, y:-0.10}, {x:1.06, y:-0.15},
      {x:1.04, y:-0.12}, {x:1.02, y:-0.07}, {x:1.00, y:-0.03}
    ],
    analFin: [
      {x:0.22, y:-0.34}, {x:0.20, y:-0.44}, {x:0.24, y:-0.50},
      {x:0.32, y:-0.48}, {x:0.38, y:-0.42}, {x:0.42, y:-0.34}
    ],
    pectoralFin: [
      {x:0.16, y:-0.02}, {x:0.14, y:-0.10}, {x:0.17, y:-0.16},
      {x:0.23, y:-0.14}, {x:0.24, y:-0.07}, {x:0.20, y:-0.02}
    ],
    eye: { x: 0.08, y: 0.09, r: 0.024 },
  },

  butterflyfish: {
    // Rounded disc, slightly elongated. Pointed snout, eyespot near tail
    top: [
      {x:0.00, y:0.01}, {x:0.03, y:0.06}, {x:0.06, y:0.14}, {x:0.10, y:0.22},
      {x:0.16, y:0.30}, {x:0.24, y:0.36}, {x:0.33, y:0.40}, {x:0.43, y:0.42},
      {x:0.53, y:0.41}, {x:0.62, y:0.38}, {x:0.70, y:0.32}, {x:0.77, y:0.25},
      {x:0.83, y:0.18}, {x:0.88, y:0.13}, {x:0.93, y:0.09}, {x:0.97, y:0.06},
      {x:1.00, y:0.05}
    ],
    bottom: [
      {x:0.00, y:-0.01}, {x:0.03, y:-0.05}, {x:0.06, y:-0.11}, {x:0.10, y:-0.18},
      {x:0.16, y:-0.25}, {x:0.24, y:-0.31}, {x:0.33, y:-0.35}, {x:0.43, y:-0.37},
      {x:0.53, y:-0.36}, {x:0.62, y:-0.33}, {x:0.70, y:-0.28}, {x:0.77, y:-0.21},
      {x:0.83, y:-0.15}, {x:0.88, y:-0.11}, {x:0.93, y:-0.08}, {x:0.97, y:-0.05},
      {x:1.00, y:-0.04}
    ],
    dorsalFin: {
      outline: [
        {x:0.18, y:0.32}, {x:0.22, y:0.44}, {x:0.30, y:0.52}, {x:0.40, y:0.55},
        {x:0.50, y:0.54}, {x:0.58, y:0.49}, {x:0.65, y:0.42}, {x:0.70, y:0.32}
      ]
    },
    caudalFin: [
      {x:1.00, y:0.05}, {x:1.02, y:0.08}, {x:1.04, y:0.13}, {x:1.06, y:0.16},
      {x:1.05, y:0.10}, {x:1.03, y:0.04}, {x:1.02, y:0.00},
      {x:1.03, y:-0.04}, {x:1.05, y:-0.10}, {x:1.06, y:-0.16},
      {x:1.04, y:-0.13}, {x:1.02, y:-0.08}, {x:1.00, y:-0.04}
    ],
    analFin: [
      {x:0.40, y:-0.36}, {x:0.42, y:-0.44}, {x:0.48, y:-0.48},
      {x:0.55, y:-0.46}, {x:0.60, y:-0.40}, {x:0.63, y:-0.32}
    ],
    pectoralFin: [
      {x:0.18, y:0.00}, {x:0.16, y:-0.08}, {x:0.19, y:-0.13},
      {x:0.25, y:-0.11}, {x:0.26, y:-0.04}, {x:0.22, y:0.00}
    ],
    eye: { x: 0.08, y: 0.07, r: 0.024 },
  },
};

// ── Rendering ──

function profileToCanvas(profile, mode = 'silhouette', textureImg = null, label = '') {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // Dark background for visibility
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Gather ALL points for bounds calculation
  const allPts = [
    ...profile.top, ...profile.bottom,
    ...(profile.dorsalFin?.outline || profile.dorsal || []),
    ...(profile.caudalFin || []),
    ...(profile.analFin || []),
    ...(profile.pectoralFin || [])
  ];
  const minX = Math.min(...allPts.map(p => p.x));
  const maxX = Math.max(...allPts.map(p => p.x));
  const minY = Math.min(...allPts.map(p => p.y));
  const maxY = Math.max(...allPts.map(p => p.y));

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const drawArea = SIZE - PADDING * 2;
  const scale = drawArea / Math.max(rangeX, rangeY * 1.1); // slight extra vertical room
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const offsetX = SIZE / 2 - centerX * scale;
  const offsetY = SIZE / 2 + centerY * scale; // flip Y

  const toScreen = (p) => ({ x: p.x * scale + offsetX, y: -p.y * scale + offsetY });

  // Interpolate all curves with cubic splines
  const topSmooth = interpolateSpline(profile.top, 20, 0.5);
  const bottomSmooth = interpolateSpline(profile.bottom, 20, 0.5);

  // ── Helper: draw a filled spline shape ──
  function drawFilledShape(points, fillColor, strokeColor, lineWidth = 1.5, useSpline = true) {
    if (!points || points.length < 3) return;
    const smooth = useSpline ? interpolateSpline(points, 12, 0.5) : points;
    const screen = smooth.map(toScreen);
    ctx.beginPath();
    ctx.moveTo(screen[0].x, screen[0].y);
    for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i].x, screen[i].y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  // Helper: draw a fin with rays
  function drawFinWithRays(points, fillColor, strokeColor, rayColor, useSpline = true, rayCount = 6) {
    if (!points || points.length < 3) return;
    const smooth = useSpline ? interpolateSpline(points, 10, 0.5) : points;
    const screen = smooth.map(toScreen);

    // Fill shape
    ctx.beginPath();
    ctx.moveTo(screen[0].x, screen[0].y);
    for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i].x, screen[i].y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw fin rays from base edge to outer edge
    if (rayColor) {
      ctx.strokeStyle = rayColor;
      ctx.lineWidth = 0.6;
      // Base is a line between first and last point
      const base0 = screen[0];
      const baseN = screen[screen.length - 1];
      const halfLen = Math.floor(screen.length / 2);
      for (let r = 1; r <= rayCount; r++) {
        const t = r / (rayCount + 1);
        // Base point interpolated along the base edge
        const bx = base0.x + (baseN.x - base0.x) * t;
        const by = base0.y + (baseN.y - base0.y) * t;
        // Tip point from the outer curve
        const tipIdx = Math.min(Math.floor(t * screen.length), screen.length - 1);
        // Find the point farthest from the base line at this t
        let farIdx = tipIdx;
        let maxDist = 0;
        const searchStart = Math.max(1, tipIdx - 5);
        const searchEnd = Math.min(screen.length - 2, tipIdx + 5);
        for (let si = searchStart; si <= searchEnd; si++) {
          const dx = screen[si].x - bx;
          const dy = screen[si].y - by;
          const d = dx * dx + dy * dy;
          if (d > maxDist) { maxDist = d; farIdx = si; }
        }
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(screen[farIdx].x, screen[farIdx].y);
        ctx.stroke();
      }
    }
  }

  // ── Draw fins BEHIND body ──

  // Caudal (tail) fin — NO spline to preserve fork shape
  if (profile.caudalFin) {
    const finColor = mode === 'silhouette' ? 'rgba(180,180,200,0.7)' : 'rgba(255,120,60,0.5)';
    const strokeCol = mode === 'silhouette' ? 'rgba(140,140,160,0.8)' : 'rgba(200,80,40,0.6)';
    const rayCol = mode === 'silhouette' ? 'rgba(100,100,120,0.3)' : null;
    drawFinWithRays(profile.caudalFin, finColor, strokeCol, rayCol, false, 8);
  }

  // Anal fin
  if (profile.analFin) {
    const finColor = mode === 'silhouette' ? 'rgba(170,170,190,0.6)' : 'rgba(255,110,50,0.4)';
    const strokeCol = mode === 'silhouette' ? 'rgba(130,130,150,0.7)' : 'rgba(180,70,30,0.5)';
    const rayCol = mode === 'silhouette' ? 'rgba(100,100,120,0.25)' : null;
    drawFinWithRays(profile.analFin, finColor, strokeCol, rayCol, true, 5);
  }

  // Dorsal fin
  const dorsalPoints = profile.dorsalFin?.outline || profile.dorsal;
  if (dorsalPoints) {
    const finColor = mode === 'silhouette' ? 'rgba(170,170,190,0.6)' : 'rgba(255,110,50,0.4)';
    const strokeCol = mode === 'silhouette' ? 'rgba(130,130,150,0.7)' : 'rgba(180,70,30,0.5)';
    const rayCol = mode === 'silhouette' ? 'rgba(100,100,120,0.25)' : null;
    drawFinWithRays(dorsalPoints, finColor, strokeCol, rayCol, true, 8);
  }

  // Pectoral fin
  if (profile.pectoralFin) {
    const finColor = mode === 'silhouette' ? 'rgba(160,160,180,0.5)' : 'rgba(255,100,40,0.35)';
    const strokeCol = mode === 'silhouette' ? 'rgba(120,120,140,0.6)' : 'rgba(160,60,20,0.4)';
    const rayCol = mode === 'silhouette' ? 'rgba(100,100,120,0.2)' : null;
    drawFinWithRays(profile.pectoralFin, finColor, strokeCol, rayCol, true, 4);
  }

  // ── Draw body (on top of fins) ──
  ctx.beginPath();
  const topScreen = topSmooth.map(toScreen);
  const botScreen = [...bottomSmooth].reverse().map(toScreen);

  ctx.moveTo(topScreen[0].x, topScreen[0].y);
  for (const p of topScreen) ctx.lineTo(p.x, p.y);
  for (const p of botScreen) ctx.lineTo(p.x, p.y);
  ctx.closePath();

  if (mode === 'silhouette') {
    // Gradient fill for body
    const bodyBounds = topScreen.concat(botScreen);
    const bMinY = Math.min(...bodyBounds.map(p => p.y));
    const bMaxY = Math.max(...bodyBounds.map(p => p.y));
    const grad = ctx.createLinearGradient(0, bMinY, 0, bMaxY);
    grad.addColorStop(0, '#e8e0d8');
    grad.addColorStop(0.3, '#f0ebe6');
    grad.addColorStop(0.7, '#f5f0ea');
    grad.addColorStop(1, '#ddd5cc');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#aaa49c';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (mode === 'textured' && textureImg) {
    ctx.save();
    ctx.clip();
    const bodyBounds = topScreen.concat(botScreen);
    const bMinX = Math.min(...bodyBounds.map(p => p.x));
    const bMaxX = Math.max(...bodyBounds.map(p => p.x));
    const bMinY = Math.min(...bodyBounds.map(p => p.y));
    const bMaxY = Math.max(...bodyBounds.map(p => p.y));
    ctx.drawImage(textureImg, bMinX, bMinY, bMaxX - bMinX, bMaxY - bMinY);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ff6b35';
    ctx.fill();
    ctx.strokeStyle = '#cc5522';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ── Eye ──
  if (profile.eye) {
    const eyeScreen = toScreen(profile.eye);
    const eyeR = profile.eye.r * scale;
    // Sclera
    ctx.beginPath();
    ctx.arc(eyeScreen.x, eyeScreen.y, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Iris
    ctx.beginPath();
    ctx.arc(eyeScreen.x + eyeR * 0.1, eyeScreen.y, eyeR * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(eyeScreen.x - eyeR * 0.2, eyeScreen.y - eyeR * 0.2, eyeR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // ── Control points overlay (geometry debug) ──
  if (mode === 'silhouette') {
    const dotR = 2.5;
    const drawDots = (points, color) => {
      ctx.fillStyle = color;
      for (const p of points) {
        const s = toScreen(p);
        ctx.beginPath();
        ctx.arc(s.x, s.y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawDots(profile.top, '#ff4444');
    drawDots(profile.bottom, '#4488ff');
    if (dorsalPoints) drawDots(dorsalPoints, '#44cc44');
    if (profile.caudalFin) drawDots(profile.caudalFin, '#ffaa44');
    if (profile.analFin) drawDots(profile.analFin, '#cc44cc');
    if (profile.pectoralFin) drawDots(profile.pectoralFin, '#44cccc');
  }

  // ── Label ──
  if (label) {
    ctx.fillStyle = '#888888';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(label, 10, SIZE - 10);
  }

  return canvas;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        parsed[key] = args[i + 1];
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs();
  const mode = args.mode || 'silhouette';

  // Render all species
  if (args.all) {
    const outDir = args.outdir || 'output/sprites/geometry/';
    fs.mkdirSync(outDir, { recursive: true });
    let idx = 1;
    for (const [name, profile] of Object.entries(PROFILES)) {
      const num = String(idx).padStart(3, '0');
      const canvas = profileToCanvas(profile, mode, null, `${name} (${profile.top.length} ctrl pts)`);
      const outPath = path.join(outDir, `geom_${num}_${name}.png`);
      fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
      fs.writeFileSync(outPath.replace('.png', '.json'), JSON.stringify({
        species: name, mode,
        controlPoints: {
          top: profile.top.length, bottom: profile.bottom.length,
          dorsal: (profile.dorsalFin?.outline || profile.dorsal || []).length,
          caudal: (profile.caudalFin || []).length,
          anal: (profile.analFin || []).length,
          pectoral: (profile.pectoralFin || []).length,
        }
      }, null, 2));
      console.log(`  ✓ ${outPath}`);
      idx++;
    }

    // Also generate a contact sheet
    const sheetCols = 4;
    const sheetTile = 256;
    const species = Object.entries(PROFILES);
    const sheetRows = Math.ceil(species.length / sheetCols);
    const sheet = createCanvas(sheetCols * sheetTile, sheetRows * (sheetTile + 20));
    const sheetCtx = sheet.getContext('2d');
    sheetCtx.fillStyle = '#0a0a1a';
    sheetCtx.fillRect(0, 0, sheet.width, sheet.height);

    let si = 0;
    for (const [name, profile] of species) {
      const col = si % sheetCols;
      const row = Math.floor(si / sheetCols);
      const tile = profileToCanvas(profile, mode, null, name);
      sheetCtx.drawImage(tile, col * sheetTile, row * (sheetTile + 20), sheetTile, sheetTile);
      sheetCtx.fillStyle = '#888';
      sheetCtx.font = 'bold 11px monospace';
      sheetCtx.fillText(name, col * sheetTile + 4, row * (sheetTile + 20) + sheetTile + 14);
      si++;
    }
    const sheetPath = path.join(outDir, '../sheets/sheet_001_all_silhouettes.png');
    fs.mkdirSync(path.dirname(sheetPath), { recursive: true });
    fs.writeFileSync(sheetPath, sheet.toBuffer('image/png'));
    console.log(`  ✓ ${sheetPath} (contact sheet)`);
    return;
  }

  // Single species
  let profile;
  const species = args.species || 'clownfish';
  if (args.profile) {
    profile = JSON.parse(args.profile);
  } else {
    profile = PROFILES[species];
    if (!profile) {
      console.error(`Unknown species: ${species}. Available: ${Object.keys(PROFILES).join(', ')}`);
      process.exit(1);
    }
  }

  let textureImg = null;
  if (args.texture) {
    textureImg = await loadImage(args.texture);
  }

  const canvas = profileToCanvas(profile, mode, textureImg, species);
  const outPath = args.out || `output/sprites/geometry/geom_${species}.png`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`Fish sprite saved to ${outPath}`);
}

main().catch(console.error);
