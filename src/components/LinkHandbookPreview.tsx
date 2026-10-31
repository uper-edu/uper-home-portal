import { useEffect, useRef, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
/** Render the original PDF locally: no third-party document viewer or iframe plugin. */
export default function LinkHandbookPreview({
  url,
  errorText,
}: {
  url: string;
  errorText: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false,
      observer: IntersectionObserver | undefined,
      loading: any;
    const tasks = new Set<any>();
    const root = ref.current!;
    setFailed(false);
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      loading = pdfjs.getDocument({ url });
      const pdf = await loading.promise;
      if (disposed) return;
      const first = await pdf.getPage(1),
        viewport = first.getViewport({ scale: 1 });
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer!.unobserve(entry.target);
            const canvas = entry.target.querySelector("canvas")!;
            (async () => {
              const page = await pdf.getPage(Number(canvas.dataset.page));
              if (disposed) return;
              const width = Math.max(200, root.clientWidth - 24);
              const natural = page.getViewport({ scale: 1 });
              const v = page.getViewport({
                scale:
                  (width / natural.width) *
                  Math.min(window.devicePixelRatio || 1, 1.5),
              });
              canvas.width = v.width;
              canvas.height = v.height;
              const task = page.render({
                canvasContext: canvas.getContext("2d")!,
                canvas,
                viewport: v,
              });
              tasks.add(task);
              try {
                await task.promise;
              } finally {
                tasks.delete(task);
              }
              page.cleanup();
            })().catch(() => {
              if (!disposed) setFailed(true);
            });
          }
        },
        { root, rootMargin: "500px" },
      );
      for (let n = 1; n <= pdf.numPages; n++) {
        const frame = document.createElement("div");
        frame.className = "linkhub-pdf-page";
        const canvas = document.createElement("canvas");
        canvas.dataset.page = String(n);
        canvas.setAttribute("role", "img");
        canvas.setAttribute(
          "aria-label",
          `Handbook 2026 · ${n} / ${pdf.numPages}`,
        );
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        const label = document.createElement("span");
        label.textContent = `${n} / ${pdf.numPages}`;
        frame.append(canvas, label);
        root.append(frame);
        observer.observe(frame);
      }
    })().catch(() => {
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      for (const task of tasks) task.cancel();
      void loading?.destroy();
      root.replaceChildren();
    };
  }, [url]);
  return (
    <>
      <div
        ref={ref}
        className="linkhub-pdf-preview"
        aria-label="Handbook 2026 PDF"
        tabIndex={0}
      />
      {failed && (
        <p role="status" className="linkhub-document-summary">
          {errorText}
        </p>
      )}
    </>
  );
}
