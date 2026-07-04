export async function exportSvgToPng(
  svg: SVGSVGElement,
  width: number,
  height: number,
  scale = 2
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Remove interactive handles (circles/rects with data-handle) and dashed selection outlines.
  clone.querySelectorAll("[data-handle]").forEach((el) => el.remove());
  clone
    .querySelectorAll("[stroke-dasharray]")
    .forEach((el) => el.getAttribute("stroke") === "#6366f1" && el.remove());

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const data = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((out) => {
        if (!out) return reject(new Error("export failed"));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(out);
        a.download = `manga-panel-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      }, "image/png");
    };
    img.onerror = reject;
    img.src = url;
  });
}
