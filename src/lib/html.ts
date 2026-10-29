/**
 * Loại bỏ script và thuộc tính sự kiện khỏi HTML do AI sinh ra.
 * Chứng từ gốc có thể chứa nội dung độc hại được AI chép lại vào kết quả.
 */
export function sanitizeResultHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

/**
 * Giữ nguyên định dạng của chứng từ mẫu trong kết quả: đặt lại đúng <head> của mẫu
 * (hoặc các khối <style> nếu mẫu chỉ là một đoạn HTML), để AI không thể làm đổi CSS.
 */
export function keepTemplateStyles(result: string, template: string | null | undefined): string {
  if (!template) return result;
  const headRe = /<head[\s>][\s\S]*?<\/head>/i;
  const templateHead = template.match(headRe)?.[0];
  if (templateHead) {
    if (headRe.test(result)) return result.replace(headRe, () => templateHead);
    if (/<html[\s>]/i.test(result)) return result.replace(/<html([^>]*)>/i, (m) => `${m}${templateHead}`);
    return result;
  }
  const styles = template.match(/<style[\s\S]*?<\/style>/gi);
  if (!styles) return result;
  return styles.join("\n") + result.replace(/<style[\s\S]*?<\/style>/gi, "");
}

/** Bọc đoạn HTML thành tài liệu đầy đủ nếu AI/ người dùng chỉ trả về phần thân */
export function ensureHtmlDocument(html: string, title: string): string {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`;
}
