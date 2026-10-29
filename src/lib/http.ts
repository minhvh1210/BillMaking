import "server-only";

/** Header cho HTML do người dùng upload / AI sinh: chặn script, cô lập origin */
export const SANDBOXED_HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:",
  "X-Content-Type-Options": "nosniff",
};

export function fileResponse(body: Buffer | string, mimeType: string, fileName: string, inline: boolean) {
  const disposition = inline ? "inline" : "attachment";
  // Bản tên không dấu cho trình duyệt cũ, bản UTF-8 đầy đủ đi kèm trong filename*
  const asciiName = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/"/g, "");
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export function notFoundResponse(message = "Không tìm thấy") {
  return new Response(message, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
