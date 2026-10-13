import type { Express } from "express";
import images from "../src/data/hskPdfImages.json" with { type: "json" };
import audio from "../src/data/hskSequentialAudioManifest.json" with { type: "json" };
/** Reviewed assets are immutable to learners. No request value becomes a filesystem path. */
export function mountHskAssets(app: Express) {
  for (const route of [
    "/api/upload-hsk-extracted-images",
    "/api/upload-hsk-audio",
  ])
    app.post(route, (_req, res) =>
      res
        .status(410)
        .json({
          error:
            "Learner uploads disabled; use reviewed versioned source assets",
        }),
    );
  app.get("/api/hsk-images-status", (_req, res) =>
    res.json({
      sourceSha256: images.sourceSha256,
      total: Object.keys(images.assets).length,
      availableKeys: Object.keys(images.assets),
    }),
  );
  app.get("/api/hsk-audio-status", (_req, res) =>
    res.json({
      kind: audio.kind,
      total: Object.keys(audio.assets).length,
      sourceSha256: audio.sourceAudioSha256,
    }),
  );
}
