// Claude-painted set layers are shown through <img>/canvas (where scripts never run), but strip anything
// active or external anyway so a layer can never load outside content.
export function sanitizeSvg(svg) {
  let s = String(svg || '');
  s = s.replace(/<\?xml[^>]*>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  s = s.replace(/<(script|foreignObject|iframe|image|style)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<(script|foreignObject|iframe|image|style)\b[^>]*\/?>/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\s(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
  s = s.replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, 'none');
  if (!/^\s*<svg\b/i.test(s)) s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">${s}</svg>`;
  if (!/xmlns=/.test(s)) s = s.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return s;
}
