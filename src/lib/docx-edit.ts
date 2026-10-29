import "server-only";
import JSZip from "jszip";
import { insertTextBoxes, type Placement } from "@/lib/docx-form";

/**
 * Sửa trực tiếp file Word theo yêu cầu chat: đổi chữ / field, dời, xóa, thêm text box, đổi cỡ chữ.
 * Text box được nhận diện cả dạng DrawingML (wps) lẫn VML; một text box Word lưu kèm bản dự phòng
 * (mc:AlternateContent) được coi là MỘT ô và sửa đồng thời cả hai bản.
 */

const EMU_PER_PT = 12700;
const round = (n: number) => Math.round(n * 10) / 10;

export type DocxBox = {
  id: string;
  text: string;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  fontSize: number | null;
};

export type DocxEdit =
  | { type: "replace_text"; find: string; replace: string }
  | { type: "move_box"; boxId: string; x: number | null; y: number | null; w: number | null; h: number | null }
  | { type: "delete_box"; boxId: string }
  | { type: "set_font_size"; boxId: string; fontSize: number }
  | { type: "add_box"; placement: Placement };

type BoxUnit = { start: number; end: number; xml: string };

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textOf(xml: string): string {
  // Chỉ lấy bản đầu tiên của nội dung text box (bản dự phòng VML trùng nội dung)
  const content = xml.match(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/)?.[0] ?? xml;
  return content
    .split(/<\/w:p>/)
    .map((p) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((t) => unescapeXml(t[1])).join(""))
    .filter((line) => line.trim())
    .join("\n");
}

/** Các ô (text box) trong file, theo thứ tự xuất hiện. Ô nằm trong mc:AlternateContent tính là một. */
function findBoxUnits(xml: string): BoxUnit[] {
  const units: BoxUnit[] = [];
  const covered: [number, number][] = [];
  const inside = (i: number) => covered.some(([s, e]) => i >= s && i < e);

  for (const m of xml.matchAll(/<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g)) {
    const start = m.index;
    const end = start + m[0].length;
    covered.push([start, end]);
    if (m[0].includes("<w:txbxContent>")) units.push({ start, end, xml: m[0] });
  }
  for (const m of xml.matchAll(/<w:drawing>[\s\S]*?<\/w:drawing>|<w:pict>[\s\S]*?<\/w:pict>/g)) {
    if (inside(m.index) || !m[0].includes("<w:txbxContent>")) continue;
    units.push({ start: m.index, end: m.index + m[0].length, xml: m[0] });
  }
  return units.sort((a, b) => a.start - b.start);
}

function boxGeometry(unit: string): Pick<DocxBox, "x" | "y" | "w" | "h"> {
  const relH = unit.match(/<wp:positionH relativeFrom="(\w+)"/)?.[1];
  const relV = unit.match(/<wp:positionV relativeFrom="(\w+)"/)?.[1];
  if (relH === "page" && relV === "page") {
    const extent = unit.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
    return {
      x: round(Number(unit.match(/<wp:positionH[\s\S]*?<wp:posOffset>(-?\d+)/)?.[1] ?? 0) / EMU_PER_PT),
      y: round(Number(unit.match(/<wp:positionV[\s\S]*?<wp:posOffset>(-?\d+)/)?.[1] ?? 0) / EMU_PER_PT),
      w: extent ? round(Number(extent[1]) / EMU_PER_PT) : null,
      h: extent ? round(Number(extent[2]) / EMU_PER_PT) : null,
    };
  }
  const style = unit.match(/<v:shape\b[^>]*style="([^"]*)"/)?.[1] ?? "";
  if (/horizontal-relative:page/.test(style) && /vertical-relative:page/.test(style)) {
    const num = (key: string) => {
      const v = style.match(new RegExp(`${key}:(-?[\\d.]+)pt`))?.[1];
      return v ? round(Number(v)) : null;
    };
    return { x: num("margin-left"), y: num("margin-top"), w: num("width"), h: num("height") };
  }
  return { x: null, y: null, w: null, h: null };
}

async function loadDocument(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return { zip, xml };
}

/** Danh sách ô kèm chữ và toạ độ (pt), cùng các field ${...} xuất hiện trong file */
export async function readDocxBoxes(buffer: Buffer): Promise<{ boxes: DocxBox[]; fields: string[] }> {
  const { xml } = await loadDocument(buffer);
  const boxes = findBoxUnits(xml).map((unit, i) => ({
    id: `B${i + 1}`,
    text: textOf(unit.xml),
    ...boxGeometry(unit.xml),
    fontSize: (() => {
      const sz = unit.xml.match(/<w:sz w:val="(\d+)"/)?.[1];
      return sz ? Number(sz) / 2 : null;
    })(),
  }));
  const allText = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((t) => unescapeXml(t[1])).join("");
  const fields = [...new Set(allText.match(/\$?\{[^{}\s]{1,80}\}/g) ?? [])];
  return { boxes: boxes.filter((b) => b.text.trim()), fields };
}

/**
 * Thay chữ trong toàn bộ file. Field thường bị Word tách thành nhiều đoạn (VD: "${" "InWords" "}"),
 * nên ghép chữ của các thẻ <w:t> liền nhau để tìm, rồi ghi phần thay vào thẻ đầu tiên của đoạn khớp.
 */
function replaceText(xml: string, find: string, replace: string): { xml: string; count: number } {
  if (!find) return { xml, count: 0 };
  const nodes = [...xml.matchAll(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    open: m[1],
    text: unescapeXml(m[2]),
  }));
  const joined = nodes.map((n) => n.text).join("");
  const offsets: number[] = [];
  let acc = 0;
  for (const n of nodes) {
    offsets.push(acc);
    acc += n.text.length;
  }
  const texts = nodes.map((n) => n.text);
  const matches: number[] = [];
  for (let i = joined.indexOf(find); i !== -1; i = joined.indexOf(find, i + find.length)) matches.push(i);
  if (matches.length === 0) return { xml, count: 0 };

  const nodeAt = (pos: number) => {
    let lo = 0;
    while (lo + 1 < offsets.length && offsets[lo + 1] <= pos) lo++;
    return lo;
  };
  // Thay từ cuối lên đầu để vị trí của các lần khớp trước không bị lệch
  for (const pos of matches.reverse()) {
    const first = nodeAt(pos);
    const last = nodeAt(pos + find.length - 1);
    const startIn = pos - offsets[first];
    const endIn = pos + find.length - offsets[last];
    if (first === last) {
      texts[first] = texts[first].slice(0, startIn) + replace + texts[first].slice(endIn);
    } else {
      texts[first] = texts[first].slice(0, startIn) + replace;
      for (let k = first + 1; k < last; k++) texts[k] = "";
      texts[last] = texts[last].slice(endIn);
    }
  }

  let out = "";
  let cursor = 0;
  nodes.forEach((n, i) => {
    if (texts[i] === n.text) return;
    const open = n.open.includes("xml:space") ? n.open : n.open.replace("<w:t", '<w:t xml:space="preserve"');
    out += xml.slice(cursor, n.start) + `${open}${escapeXml(texts[i])}</w:t>`;
    cursor = n.end;
  });
  return { xml: out + xml.slice(cursor), count: matches.length };
}

function moveUnit(unit: string, edit: Extract<DocxEdit, { type: "move_box" }>, current: DocxBox): string {
  const x = edit.x ?? current.x ?? 0;
  const y = edit.y ?? current.y ?? 0;
  const w = edit.w ?? current.w;
  const h = edit.h ?? current.h;
  const emu = (pt: number) => Math.round(pt * EMU_PER_PT);
  let out = unit
    .replace(/<wp:positionH relativeFrom="\w+">[\s\S]*?<\/wp:positionH>/, `<wp:positionH relativeFrom="page"><wp:posOffset>${emu(x)}</wp:posOffset></wp:positionH>`)
    .replace(/<wp:positionV relativeFrom="\w+">[\s\S]*?<\/wp:positionV>/, `<wp:positionV relativeFrom="page"><wp:posOffset>${emu(y)}</wp:posOffset></wp:positionV>`);
  if (w != null && h != null) {
    out = out
      .replace(/<wp:extent cx="\d+" cy="\d+"\/>/, `<wp:extent cx="${emu(w)}" cy="${emu(h)}"/>`)
      .replace(/(<wps:spPr><a:xfrm>[\s\S]*?)<a:ext cx="\d+" cy="\d+"\/>/, `$1<a:ext cx="${emu(w)}" cy="${emu(h)}"/>`);
  }
  // Bản VML: sửa margin / kích thước, chuyển sang neo theo trang
  return out.replace(/(<v:shape\b[^>]*style=")([^"]*)(")/, (_, a: string, style: string, c: string) => {
    let s = style
      .replace(/margin-left:[^;]*;?/, "")
      .replace(/margin-top:[^;]*;?/, "")
      .replace(/mso-position-horizontal-relative:[^;]*;?/, "")
      .replace(/mso-position-vertical-relative:[^;]*;?/, "");
    if (w != null) s = s.replace(/(^|;)width:[^;]*/, `$1width:${w}pt`);
    if (h != null) s = s.replace(/(^|;)height:[^;]*/, `$1height:${h}pt`);
    s = `${s.replace(/;$/, "")};margin-left:${x}pt;margin-top:${y}pt;mso-position-horizontal-relative:page;mso-position-vertical-relative:page`;
    return a + s.replace(/^;/, "") + c;
  });
}

/** Các thẻ đứng SAU w:sz trong w:rPr (Word yêu cầu đúng thứ tự) */
const AFTER_SZ = /<w:(highlight|u|effect|bdr|shd|fitText|vertAlign|rtl|cs|em|lang|eastAsianLayout|specVanish|oMath)\b/;

function setFontSize(unit: string, fontSize: number): string {
  const half = Math.round(fontSize * 2);
  const sz = `<w:sz w:val="${half}"/><w:szCs w:val="${half}"/>`;
  // Đặt cỡ chữ cho từng đoạn chữ (w:r có w:t) trong ô
  return unit.replace(/<w:r(\s[^>]*)?>([\s\S]*?)<\/w:r>/g, (run, attrs: string | undefined, inner: string) => {
    if (!inner.includes("<w:t")) return run;
    const rPr = inner.match(/^<w:rPr>([\s\S]*?)<\/w:rPr>/);
    if (!rPr) return `<w:r${attrs ?? ""}><w:rPr>${sz}</w:rPr>${inner}</w:r>`;
    const props = rPr[1].replace(/<w:sz w:val="\d+"\/>/, "").replace(/<w:szCs w:val="\d+"\/>/, "");
    const at = props.search(AFTER_SZ);
    const merged = at === -1 ? props + sz : props.slice(0, at) + sz + props.slice(at);
    return `<w:r${attrs ?? ""}><w:rPr>${merged}</w:rPr>${inner.slice(rPr[0].length)}</w:r>`;
  });
}

/** Áp danh sách thao tác lên file Word, trả về file mới và mô tả thao tác nào không áp được */
export async function applyDocxEdits(
  buffer: Buffer,
  edits: DocxEdit[],
): Promise<{ buffer: Buffer; skipped: string[] }> {
  const loaded = await loadDocument(buffer);
  const zip = loaded.zip;
  let xml = loaded.xml;
  const skipped: string[] = [];
  const before = await readDocxBoxes(buffer);

  // Thao tác theo ô dùng id của lúc đọc ban đầu; ô bị xóa / dời được xử lý trước, rồi mới thay chữ và thêm ô
  const boxEdits = edits.filter((e) => e.type === "move_box" || e.type === "delete_box" || e.type === "set_font_size");
  if (boxEdits.length > 0) {
    const units = findBoxUnits(xml).filter((u) => textOf(u.xml).trim());
    const replacements = new Map<number, string>();
    for (const edit of boxEdits as Exclude<DocxEdit, { type: "replace_text" | "add_box" }>[]) {
      const index = Number(edit.boxId.replace(/^B/i, "")) - 1;
      const unit = units[index];
      const box = before.boxes[index];
      if (!unit || !box) {
        skipped.push(`Không tìm thấy ô ${edit.boxId}`);
        continue;
      }
      const current = replacements.get(index) ?? unit.xml;
      if (current === "") continue;
      if (edit.type === "delete_box") replacements.set(index, "");
      else if (edit.type === "move_box") replacements.set(index, moveUnit(current, edit, box));
      else replacements.set(index, setFontSize(current, edit.fontSize));
    }
    // Ghi từ cuối lên đầu để vị trí các ô phía trước không bị lệch
    for (const [index, replacement] of [...replacements.entries()].sort((a, b) => b[0] - a[0])) {
      const unit = units[index];
      xml = xml.slice(0, unit.start) + replacement + xml.slice(unit.end);
    }
  }

  for (const edit of edits) {
    if (edit.type !== "replace_text") continue;
    const result = replaceText(xml, edit.find, edit.replace);
    if (result.count === 0) skipped.push(`Không tìm thấy "${edit.find}" trong file`);
    xml = result.xml;
  }

  const added = edits.filter((e): e is Extract<DocxEdit, { type: "add_box" }> => e.type === "add_box").map((e) => e.placement);
  if (added.length > 0) xml = insertTextBoxes(xml, added);

  zip.file("word/document.xml", xml);
  return { buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), skipped };
}
