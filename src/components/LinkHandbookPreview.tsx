import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
/** Render the original PDF locally: no third-party document viewer or iframe plugin. */
export default function LinkHandbookPreview({
  url,
  loadingText,
  errorText,
}: {
  url: string;
  loadingText: string;
  errorText: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    let disposed = false,
      observer: IntersectionObserver | undefined,
      resize: ResizeObserver | undefined,
      resizeFrame = 0,
      loading: PDFDocumentLoadingTask | undefined;
    const tasks = new Map<HTMLCanvasElement, RenderTask>();
    const rendered = new WeakMap<HTMLCanvasElement, number>();
    const pending = new WeakSet<HTMLCanvasElement>();
    const nearby = new Set<HTMLCanvasElement>();
    const root = ref.current!;
    const release = (canvas: HTMLCanvasElement) => {
      rendered.delete(canvas);
      canvas.width = 0;
      canvas.height = 0;
    };
    let removeScroll = () => {};
    setStatus('loading');
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      // Preview only the pages being read. PDF.js uses the full response if
      // the server does not support byte ranges.
      loading = pdfjs.getDocument({ url, disableStream: true, disableAutoFetch: true });
      const pdf = await loading.promise;
      if (disposed) return;
      const first = await pdf.getPage(1);
      if (disposed) return;
      const viewport = first.getViewport({ scale: 1 });
      const draw = async (canvas: HTMLCanvasElement) => {
        if (pending.has(canvas) || disposed || !nearby.has(canvas)) return;
        const width = Math.max(1, root.clientWidth - 24);
        if (rendered.get(canvas) === width) return;
        pending.add(canvas);
        let completed = false;
        let cancelled = false;
        try {
          const page = await pdf.getPage(Number(canvas.dataset.page));
          if (disposed || !nearby.has(canvas)) return;
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
          tasks.set(canvas, task);
          try {
            await task.promise;
          } finally {
            tasks.delete(canvas);
          }
          rendered.set(canvas, width);
          completed = true;
          if (!disposed) setStatus(current => current === 'loading' ? 'ready' : current);
        } catch (error) {
          cancelled = (error as Error).name === "RenderingCancelledException";
          if (!disposed && !cancelled) setStatus('failed');
        } finally {
          pending.delete(canvas);
          const visible = !disposed && nearby.has(canvas);
          if (cancelled || !visible) release(canvas);
          if (visible && (cancelled || (completed && rendered.get(canvas) !== Math.max(1, root.clientWidth - 24)))) {
            // A page can return to view before its cancellation settles.
            void draw(canvas);
          }
        }
      };
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const canvas = entry.target.querySelector("canvas")!;
            if (entry.isIntersecting) {
              nearby.add(canvas);
              void draw(canvas);
            } else {
              nearby.delete(canvas);
              tasks.get(canvas)?.cancel();
              if (!pending.has(canvas) && canvas.width) release(canvas);
            }
          }
        },
        { root, rootMargin: "160px 0px" },
      );
      let previousWidth = root.clientWidth;
      let anchorPage = 0,
        anchorFraction = 0;
      const frames: HTMLElement[] = [];
      const remember = () => {
        const top = root.getBoundingClientRect().top + root.clientTop;
        // Frames are stacked in page order. Locate the first visible page without measuring every preceding page.
        let start = 0;
        let end = frames.length;
        while (start < end) {
          const mid = Math.floor((start + end) / 2);
          if (frames[mid].getBoundingClientRect().bottom > top) end = mid;
          else start = mid + 1;
        }
        if (start < frames.length) {
          anchorPage = start;
          const rect = frames[start].getBoundingClientRect();
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
          for (const canvas of nearby) void draw(canvas);
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
        // The CSS aspect ratio preserves the page position with no bitmap.
        canvas.width = 0;
        canvas.height = 0;
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
      if (!disposed) setStatus('failed');
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(resizeFrame);
      removeScroll();
      for (const task of tasks.values()) task.cancel();
      void loading?.destroy().catch(() => {});
      root.replaceChildren();
    };
  }, [url]);
  return (
    <>
      <div className="linkhub-pdf-frame">
        <div ref={ref} className="linkhub-pdf-preview" aria-label="Handbook 2026 PDF"
          aria-busy={status === 'loading'} tabIndex={0}/>
        {status === 'loading' && <p role="status" className="linkhub-pdf-loading">{loadingText}</p>}
      </div>
      {status === 'failed' && (
        <p role="status" className="linkhub-document-summary">
          {errorText}
        </p>
      )}
    </>
  );
}
