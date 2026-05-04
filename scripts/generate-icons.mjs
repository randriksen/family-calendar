#!/usr/bin/env node
// Simple script to generate placeholder PWA icons
// Run: node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Generate a minimal valid PNG with a calendar icon look
// These are base64-encoded minimal PNGs for use as placeholders
// In production, replace with proper branded icons

function generateSVGIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#0ea5e9"/>
  <rect x="${size*0.15}" y="${size*0.2}" width="${size*0.7}" height="${size*0.65}" rx="${size*0.05}" fill="white"/>
  <rect x="${size*0.15}" y="${size*0.2}" width="${size*0.7}" height="${size*0.2}" rx="${size*0.05}" fill="#0284c7"/>
  <rect x="${size*0.28}" y="${size*0.12}" width="${size*0.1}" height="${size*0.16}" rx="${size*0.04}" fill="white"/>
  <rect x="${size*0.62}" y="${size*0.12}" width="${size*0.1}" height="${size*0.16}" rx="${size*0.04}" fill="white"/>
  <!-- Grid lines -->
  <line x1="${size*0.35}" y1="${size*0.45}" x2="${size*0.85}" y2="${size*0.45}" stroke="#e2e8f0" stroke-width="${size*0.02}"/>
  <line x1="${size*0.35}" y1="${size*0.58}" x2="${size*0.85}" y2="${size*0.58}" stroke="#e2e8f0" stroke-width="${size*0.02}"/>
  <line x1="${size*0.35}" y1="${size*0.71}" x2="${size*0.85}" y2="${size*0.71}" stroke="#e2e8f0" stroke-width="${size*0.02}"/>
  <!-- Colored event dots -->
  <circle cx="${size*0.42}" cy="${size*0.52}" r="${size*0.05}" fill="#22c55e"/>
  <circle cx="${size*0.56}" cy="${size*0.52}" r="${size*0.05}" fill="#f97316"/>
  <circle cx="${size*0.70}" cy="${size*0.65}" r="${size*0.05}" fill="#a855f7"/>
</svg>`;
}

const iconsDir = join(process.cwd(), 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

writeFileSync(join(iconsDir, 'icon-192.svg'), generateSVGIcon(192));
writeFileSync(join(iconsDir, 'icon-512.svg'), generateSVGIcon(512));

console.log('SVG placeholder icons generated in public/icons/');
console.log('For production, replace with proper PNG icons.');
