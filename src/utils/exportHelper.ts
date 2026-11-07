import { MindMapLayoutResult, resolveNodePalette } from './layoutEngine';
import { ThemeMode } from '../types/mindmap';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapSvgLines(text: string, maxVisualUnits: number): string[] {
  const lines: string[] = [];
  let cur = '';
  let units = 0;
  for (const ch of text) {
    const w = ch.charCodeAt(0) > 255 ? 2 : 1;
    if (units + w > maxVisualUnits && cur.length > 0) {
      lines.push(cur);
      cur = ch;
      units = w;
    } else {
      cur += ch;
      units += w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [''];
}

/**
 * 將當前畫布排版匯出為 100% 純向量 SVG 字串（不使用 foreignObject，確保瀏覽器轉 PNG 不掉字、不污染 Canvas）
 */
export function buildStandaloneSvg(
  layout: MindMapLayoutResult,
  theme: ThemeMode
): { svgString: string; width: number; height: number } {
  const pad = 56;
  const width = Math.ceil(layout.bounds.width + pad * 2);
  const height = Math.ceil(layout.bounds.height + pad * 2);
  const offsetX = -layout.bounds.minX + pad;
  const offsetY = -layout.bounds.minY + pad;

  const bgFill = theme === 'dark' ? '#020617' : '#f8fafc';
  const cardFill = theme === 'dark' ? '#0f172a' : '#ffffff';
  const textFill = theme === 'dark' ? '#f1f5f9' : '#0f172a';
  const noteFill = theme === 'dark' ? '#94a3b8' : '#64748b';

  const edgeElements = layout.edges
    .map((e) => {
      const dummyNode = layout.nodes.find((n) => `edge_${n.node.id}` !== e.id && e.id.endsWith(`_${n.node.id}`));
      const stroke = dummyNode ? resolveNodePalette(dummyNode.node).hex : '#6366f1';
      return `<path d="${e.path}" fill="none" stroke="${stroke}" stroke-width="${
        e.depth === 1 ? 2.6 : 1.9
      }" stroke-opacity="0.8" stroke-linecap="round" />`;
    })
    .join('\n');

  const nodeElements = layout.nodes
    .map((item) => {
      const { node, x, y, width: w, height: h } = item;
      const palette = resolveNodePalette(node);
      const isRoot = node.depth === 0;
      const prefixCheck =
        node.checked === true ? '☑ ' : node.checked === false ? '☐ ' : '';
      const displayLabel = prefixCheck + node.text;
      const maxUnits = Math.max(14, Math.floor((w - 32) / 7.5));
      const wrapped = wrapSvgLines(displayLabel, maxUnits);

      const textSvg = wrapped
        .map((line, idx) => {
          const lineY = y + 24 + idx * 20;
          return `<text x="${x + 16}" y="${lineY}" fill="${
            isRoot ? '#ffffff' : textFill
          }" font-family="Inter, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif" font-size="${
            isRoot ? 14 : 12.5
          }" font-weight="${isRoot || node.depth === 1 ? '700' : '500'}">${escapeXml(
            line
          )}</text>`;
        })
        .join('\n');

      const tagsY = y + 22 + wrapped.length * 20;
      const tagsSvg =
        node.tags.length > 0
          ? `<text x="${x + 16}" y="${tagsY}" fill="${palette.hex}" font-family="Inter, sans-serif" font-size="10.5" font-weight="600">${escapeXml(
              node.tags.map((t) => `#${t}`).join('  ')
            )}</text>`
          : '';

      const noteY = tagsY + (node.tags.length > 0 ? 18 : 2);
      const noteSvg = node.note
        ? `<text x="${x + 16}" y="${noteY}" fill="${noteFill}" font-family="Inter, sans-serif" font-size="10.5">${escapeXml(
            node.note.length > 26 ? node.note.slice(0, 26) + '…' : node.note
          )}</text>`
        : '';

      return `<g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${
        isRoot ? '#1e1b4b' : cardFill
      }" stroke="${palette.hex}" stroke-width="${isRoot ? 2 : 1.4}" stroke-opacity="0.85" />
        ${
          !isRoot
            ? `<rect x="${x}" y="${y + 8}" width="4" height="${Math.max(
                12,
                h - 16
              )}" rx="2" fill="${palette.hex}" />`
            : ''
        }
        ${textSvg}
        ${tagsSvg}
        ${noteSvg}
      </g>`;
    })
    .join('\n');

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${bgFill}" />
  <g transform="translate(${offsetX}, ${offsetY})">
    ${edgeElements}
    ${nodeElements}
  </g>
</svg>`;

  return { svgString, width, height };
}

export function downloadTextFile(filename: string, content: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsSvgFile(
  layout: MindMapLayoutResult,
  theme: ThemeMode,
  title: string
) {
  const { svgString } = buildStandaloneSvg(layout, theme);
  downloadTextFile(`${title || 'typemindmap'}.svg`, svgString, 'image/svg+xml;charset=utf-8');
}

export async function exportAsPngFile(
  layout: MindMapLayoutResult,
  theme: ThemeMode,
  title: string
): Promise<void> {
  const { svgString, width, height } = buildStandaloneSvg(layout, theme);
  const scale = 2; // 2x Retina PNG
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('無法建立 Canvas 繪圖環境'));
          return;
        }
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            reject(new Error('PNG 轉換失敗'));
            return;
          }
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${title || 'typemindmap'}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          resolve();
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('載入 SVG 影像失敗'));
    };
    img.src = url;
  });
}
