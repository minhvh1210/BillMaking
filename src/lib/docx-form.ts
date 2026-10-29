import "server-only";
import JSZip from "jszip";

/**
 * Form Word (thường chuyển từ PDF) có nhãn là ảnh và đường kẻ là shape đặt ở toạ độ cố định.
 * Module này đọc toạ độ các phần tử đó và chèn text box ${Field} vào đúng vị trí,
 * giữ nguyên toàn bộ phần còn lại của file.
 *
 * Đơn vị dùng chung: point (pt), gốc toạ độ ở góc trên trái trang.
 */

const EMU_PER_PT = 12700;

export type FormItem = {
  id: string;
  /** Đường dẫn ảnh trong file .docx (VD: word/media/image3.png) */
  media: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FormLayout = {
  page: { w: number; h: number };
  items: FormItem[];
  /** Đoạn văn bản thường (không có toạ độ cố định), để AI biết vùng nào đã có chữ */
  flowText: string;
};

export type Placement = {
  field: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
};

const round = (n: number) => Math.round(n * 10) / 10;

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/** Đọc style VML dạng "margin-left:22pt;width:550pt" thành số (pt hoặc đơn vị toạ độ nhóm) */
function vmlStyle(style: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of style.split(";")) {
    const [key, raw] = part.split(":").map((s) => s?.trim());
    if (!key || !raw) continue;
    const num = parseFloat(raw);
    if (Number.isNaN(num)) continue;
    out[key] = raw.endsWith("in") ? num * 72 : num;
  }
  return out;
}

async function relationships(zip: JSZip): Promise<Map<string, string>> {
  const xml = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) map.set(id, target.startsWith("/") ? target.slice(1) : `word/${target}`);
  }
  return map;
}

/** Đọc toạ độ các ảnh (nhãn, logo, đường kẻ dạng ảnh) có vị trí cố định theo trang */
export async function readFormLayout(buffer: Buffer): Promise<FormLayout> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const rels = await relationships(zip);
  const items: FormItem[] = [];
  const seen = new Set<string>();
  const push = (rId: string | null, x: number, y: number, w: number, h: number) => {
    const media = rId ? rels.get(rId) : undefined;
    if (!media || !/\.(png|jpe?g|gif|bmp|emf|wmf|svg)$/i.test(media)) return;
    // Word lưu mỗi hình 2 lần (DrawingML + bản VML dự phòng): bỏ bản trùng
    const key = `${media}|${Math.round(x)}|${Math.round(y)}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id: "", media, x: round(x), y: round(y), w: round(w), h: round(h) });
  };

  const pgSz = xml.match(/<w:pgSz\b[^>]*>/)?.[0] ?? "";
  const page = { w: Number(attr(pgSz, "w:w") ?? 11906) / 20, h: Number(attr(pgSz, "w:h") ?? 16838) / 20 };

  // DrawingML: ảnh đơn lẻ hoặc nhóm ảnh neo theo trang
  for (const m of xml.matchAll(/<wp:anchor\b[\s\S]*?<\/wp:anchor>/g)) {
    const block = m[0];
    const relH = block.match(/<wp:positionH relativeFrom="(\w+)"/)?.[1];
    const relV = block.match(/<wp:positionV relativeFrom="(\w+)"/)?.[1];
    if (relH !== "page" || relV !== "page") continue;
    const ox = Number(block.match(/<wp:positionH[\s\S]*?<wp:posOffset>(-?\d+)/)?.[1] ?? 0) / EMU_PER_PT;
    const oy = Number(block.match(/<wp:positionV[\s\S]*?<wp:posOffset>(-?\d+)/)?.[1] ?? 0) / EMU_PER_PT;
    const extent = block.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
    const ew = Number(extent?.[1] ?? 0) / EMU_PER_PT;
    const eh = Number(extent?.[2] ?? 0) / EMU_PER_PT;

    if (block.includes("<wpg:wgp>")) {
      const grp = block.match(/<wpg:grpSpPr>[\s\S]*?<\/wpg:grpSpPr>/)?.[0] ?? "";
      const chOff = grp.match(/<a:chOff x="(-?\d+)" y="(-?\d+)"/);
      const chExt = grp.match(/<a:chExt cx="(\d+)" cy="(\d+)"/);
      const cx0 = Number(chOff?.[1] ?? 0);
      const cy0 = Number(chOff?.[2] ?? 0);
      const sx = chExt ? ew / (Number(chExt[1]) / EMU_PER_PT) : 1;
      const sy = chExt ? eh / (Number(chExt[2]) / EMU_PER_PT) : 1;
      for (const p of block.matchAll(/<pic:pic>[\s\S]*?<\/pic:pic>/g)) {
        const off = p[0].match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
        const ext = p[0].match(/<a:ext cx="(\d+)" cy="(\d+)"/);
        if (!off || !ext) continue;
        push(
          p[0].match(/r:embed="([^"]+)"/)?.[1] ?? null,
          ox + ((Number(off[1]) - cx0) / EMU_PER_PT) * sx,
          oy + ((Number(off[2]) - cy0) / EMU_PER_PT) * sy,
          (Number(ext[1]) / EMU_PER_PT) * sx,
          (Number(ext[2]) / EMU_PER_PT) * sy,
        );
      }
    } else {
      push(block.match(/r:embed="([^"]+)"/)?.[1] ?? null, ox, oy, ew, eh);
    }
  }

  // VML: nhóm shape (coordorigin / coordsize) neo theo trang
  for (const m of xml.matchAll(/<v:group\b([^>]*)>([\s\S]*?)<\/v:group>/g)) {
    const style = vmlStyle(attr(m[1], "style") ?? "");
    if (!/relative:page/.test(attr(m[1], "style") ?? "")) continue;
    const [ox0, oy0] = (attr(m[1], "coordorigin") ?? "0,0").split(",").map(Number);
    const [cw, ch] = (attr(m[1], "coordsize") ?? "1000,1000").split(",").map(Number);
    const gx = style["margin-left"] ?? 0;
    const gy = style["margin-top"] ?? 0;
    const sx = (style.width ?? cw) / cw;
    const sy = (style.height ?? ch) / ch;
    for (const s of m[2].matchAll(/<v:shape\b([^>]*)>([\s\S]*?)<\/v:shape>/g)) {
      const st = vmlStyle(attr(s[1], "style") ?? "");
      const rId = s[2].match(/<v:imagedata\b[^>]*r:id="([^"]+)"/)?.[1] ?? null;
      push(
        rId,
        gx + ((st.left ?? 0) - (ox0 || 0)) * sx,
        gy + ((st.top ?? 0) - (oy0 || 0)) * sy,
        (st.width ?? 0) * sx,
        (st.height ?? 0) * sy,
      );
    }
  }

  const flowText = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
    .map((t) => t[1])
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  items.sort((a, b) => a.y - b.y || a.x - b.x);
  items.forEach((item, i) => (item.id = `L${i + 1}`));
  return { page, items, flowText };
}

/** Lấy file ảnh của từng phần tử để gửi cho AI đọc nội dung nhãn */
export async function readFormImages(buffer: Buffer, items: FormItem[]): Promise<Map<string, Buffer>> {
  const zip = await JSZip.loadAsync(buffer);
  const out = new Map<string, Buffer>();
  for (const item of items) {
    const file = zip.file(item.media);
    if (file) out.set(item.id, await file.async("nodebuffer"));
  }
  return out;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Text box không viền, không nền, neo theo trang tại (x, y); tự giãn chiều cao khi chữ dài hơn ô.
 * Ghi cả bản DrawingML lẫn bản VML dự phòng (giống cách Word tự lưu): file ở chế độ
 * tương thích (thường gặp ở form chuyển từ PDF) chỉ dùng bản VML khi in / xuất PDF.
 */
function textBoxXml(p: Placement, id: number): string {
  const emu = (pt: number) => Math.max(0, Math.round(pt * EMU_PER_PT));
  const size = Math.round(p.fontSize * 2);
  const content = `<w:txbxContent>${p.text
    .split(/\r?\n/)
    .map(
      (line) =>
        `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`,
    )
    .join("")}</w:txbxContent>`;
  const vml =
    `<w:pict><v:shape id="bm_${id}" o:spid="_x0000_s${id}" type="#_x0000_t202" filled="f" stroked="f" ` +
    `style="position:absolute;margin-left:${p.x}pt;margin-top:${p.y}pt;width:${p.w}pt;height:${p.h}pt;z-index:${251700000 + id};` +
    `mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-fit-shape-to-text:t">` +
    `<v:textbox inset="0,0,0,0" style="mso-fit-shape-to-text:t">${content}</v:textbox><w10:wrap anchorx="page" anchory="page"/></v:shape></w:pict>`;
  return (
    `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251700000 + id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/>` +
    `<wp:positionH relativeFrom="page"><wp:posOffset>${emu(p.x)}</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>${emu(p.y)}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${emu(p.w)}" cy="${emu(p.h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${id}" name="BM ${escapeXml(p.field)}"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/>` +
    `<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(p.w)}" cy="${emu(p.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr>` +
    `<wps:txbx>${content}</wps:txbx>` +
    `<wps:bodyPr rot="0" vert="horz" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t" anchorCtr="0"><a:spAutoFit/></wps:bodyPr>` +
    `</wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>` +
    `<mc:Fallback>${vml}</mc:Fallback></mc:AlternateContent></w:r>`
  );
}

/** Định nghĩa kiểu shape text box cho bản VML, chỉ cần một lần trong file */
const VML_TEXTBOX_TYPE =
  `<w:r><w:pict><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">` +
  `<v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype></w:pict></w:r>`;

/** Chèn các field vào form, trả về file .docx mới (file gốc giữ nguyên) */
export async function fillForm(buffer: Buffer, placements: Placement[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const path = "word/document.xml";
  const xml = (await zip.file(path)?.async("string")) ?? "";
  zip.file(path, insertTextBoxes(xml, placements));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Chèn text box vào nội dung word/document.xml */
export function insertTextBoxes(source: string, placements: Placement[]): string {
  let xml = source;
  for (const [prefix, uri] of [
    ["xmlns:wps", "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"],
    ["xmlns:wp", "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"],
    ["xmlns:a", "http://schemas.openxmlformats.org/drawingml/2006/main"],
    ["xmlns:mc", "http://schemas.openxmlformats.org/markup-compatibility/2006"],
    ["xmlns:v", "urn:schemas-microsoft-com:vml"],
    ["xmlns:o", "urn:schemas-microsoft-com:office:office"],
    ["xmlns:w10", "urn:schemas-microsoft-com:office:word"],
  ]) {
    if (!xml.includes(`${prefix}=`)) xml = xml.replace("<w:document ", `<w:document ${prefix}="${uri}" `);
  }
  const maxId = Math.max(1024, ...[...xml.matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => Number(m[1])));
  const boxes =
    (xml.includes('id="_x0000_t202"') ? "" : VML_TEXTBOX_TYPE) +
    placements.map((p, i) => textBoxXml(p, maxId + 1 + i)).join("");
  // Neo tất cả text box vào đầu đoạn văn đầu tiên của trang (vị trí tính theo trang nên không phụ thuộc đoạn).
  // Chèn ngay sau <w:pPr> của đoạn đó, tránh lọt vào text box có sẵn bên trong đoạn.
  const firstParagraph = xml.slice(xml.indexOf("<w:body>")).search(/<w:p[ >]/);
  if (firstParagraph === -1) throw new Error("File Word không có nội dung để chèn field.");
  const start = xml.indexOf("<w:body>") + firstParagraph;
  const openEnd = xml.indexOf(">", start) + 1;
  const pPrEnd = xml.startsWith("<w:pPr", openEnd) ? xml.indexOf("</w:pPr>", openEnd) + "</w:pPr>".length : openEnd;
  return xml.slice(0, pPrEnd) + boxes + xml.slice(pPrEnd);
}
