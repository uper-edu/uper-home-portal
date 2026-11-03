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
      resize: ResizeObserver | undefined,
      resizeFrame = 0,
      loading: any;
    const tasks = new Set<any>();
    const rendered = new WeakMap<HTMLCanvasElement, number>();
    const pending = new WeakSet<HTMLCanvasElement>();
    const root = ref.current!;
    let removeScroll = () => {};
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
      const draw = async (canvas: HTMLCanvasElement) => {
        if (pending.has(canvas) || disposed) return;
        const width = Math.max(1, root.clientWidth - 24);
        if (rendered.get(canvas) === width) return;
        pending.add(canvas);
        let completed = false;
        try {
          const page = await pdf.getPage(Number(canvas.dataset.page));
          if (disposed) return;
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
          rendered.set(canvas, width);
          completed = true;
        } catch (error) {
          if (
            !disposed &&
            (error as Error).name !== "RenderingCancelledException"
          )
            setFailed(true);
        } finally {
          pending.delete(canvas);
          if (
            !disposed &&
            rendered.get(canvas) !== Math.max(1, root.clientWidth - 24)
          ) {
            // A rotation during rendering needs one more pass at the latest width.
            if (completed) void draw(canvas);
          }
        }
      };
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting)
              void draw(entry.target.querySelector("canvas")!);
          }
        },
        { root, rootMargin: "500px" },
      );
      let previousWidth = root.clientWidth;
      let anchorPage = 0,
        anchorFraction = 0;
      const frames: HTMLElement[] = [];
      const remember = () => {
        const top = root.getBoundingClientRect().top + root.clientTop;
        const index = frames.findIndex(
          (frame) => frame.getBoundingClientRect().bottom > top,
        );
        if (index >= 0) {
          anchorPage = index;
          const rect = frames[index].getBoundingClientRect();
          anchorFraction = (top - rect.top) / rect.height;
        }
      };
      root.addEventListener("scroll", remember);
      resize = new ResizeObserver(() => {
        if (previousWidth === root.clientWidth) return;
        previousWidth = root.clientWidth;
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (disposed) return;
          const frame = frames[anchorPage];
          if (frame) {
            const top = root.getBoundingClientRect().top + root.clientTop;
            root.scrollTop +=
              frame.getBoundingClientRect().top -
              top +
              anchorFraction * frame.getBoundingClientRect().height;
          }
          const bounds = root.getBoundingClientRect();
          for (const frame of frames) {
            const rect = frame.getBoundingClientRect();
            if (
              rect.bottom >= bounds.top - 500 &&
              rect.top <= bounds.bottom + 500
            )
              void draw(frame.querySelector("canvas")!);
          }
        });
      });
      resize.observe(root);
      // The listener belongs to this root and is removed when the preview closes.
      removeScroll = () => root.removeEventListener("scroll", remember);
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
        frames.push(frame);
        observer.observe(frame);
      }
    })().catch(() => {
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(resizeFrame);
      removeScroll();
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
