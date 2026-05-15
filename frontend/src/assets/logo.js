// Logo utility — drop logo.jpeg into src/assets/ to use real logo
// This exports a placeholder SVG as data URL if no real logo exists
export const LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="%231C1917"/><text x="100" y="85" font-family="Georgia,serif" font-size="28" font-weight="bold" fill="%23F59E0B" text-anchor="middle">SAI</text><text x="100" y="115" font-family="Georgia,serif" font-size="16" fill="%23F59E0B" text-anchor="middle">LOUNGE</text><circle cx="100" cy="145" r="6" fill="%23F59E0B"/><line x1="70" y1="145" x2="90" y2="145" stroke="%23F59E0B" stroke-width="1.5"/><line x1="110" y1="145" x2="130" y2="145" stroke="%23F59E0B" stroke-width="1.5"/></svg>`;

// To use your real logo: import logo from './assets/logo.jpeg'
// Then replace LOGO_SVG references with logo
let realLogo;
try { realLogo = require('./logo.jpeg'); } catch(e) { realLogo = null; }
export const LOGO = realLogo || LOGO_SVG;
