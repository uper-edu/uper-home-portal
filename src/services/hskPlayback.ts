/** One source segment already contains two readings and the final answer pause. */
export type PlaybackStatus =
  "loading" | "playing" | "paused" | "blocked" | "error";
export class HskPlayback {
  private generation = 0;
  private request = 0;
  private paused = false;
  constructor(
    private media: HTMLAudioElement,
    private callbacks: {
      status: (status: PlaybackStatus) => void;
      time: (seconds: number) => void;
      started: () => void;
      ended: () => void;
      failed: () => void;
    },
  ) {}
  load(src: string, position = 0, auto = true) {
    this.stop();
    const generation = this.generation;
    let ended = false;
    const current = () => generation === this.generation;
    this.media.preload = "auto";
    this.media.src = src;
    this.media.onloadedmetadata = () => {
      if (current())
        this.media.currentTime = Math.min(
          position,
          Math.max(0, this.media.duration - 0.05),
        );
    };
    this.media.ontimeupdate = () => {
      if (current()) this.callbacks.time(this.media.currentTime);
    };
    this.media.onplaying = () => {
      if (!current()) return;
      if (this.paused) {
        this.media.pause();
        return;
      }
      this.callbacks.status("playing");
      this.callbacks.started();
    };
    this.media.onwaiting = () => {
      if (current() && !this.paused) this.callbacks.status("loading");
    };
    this.media.onended = () => {
      if (current() && !this.paused && !ended) {
        ended = true;
        this.callbacks.ended();
      }
    };
    this.media.onerror = () => {
      if (current()) {
        this.callbacks.status("error");
        this.callbacks.failed();
      }
    };
    if (auto) this.resume();
    else {
      this.paused = true;
      this.callbacks.status("paused");
    }
  }
  resume() {
    this.paused = false;
    const generation = this.generation,
      request = ++this.request;
    this.callbacks.status("loading");
    this.media.play().catch((error) => {
      if (
        generation !== this.generation ||
        request !== this.request ||
        this.paused
      )
        return;
      if (error.name === "NotAllowedError") this.callbacks.status("blocked");
      else {
        this.callbacks.status("error");
        this.callbacks.failed();
      }
    });
  }
  pause() {
    this.paused = true;
    ++this.request;
    this.media.pause();
    this.callbacks.status("paused");
  }
  retry() {
    this.load(this.media.src, this.position, true);
  }
  stop() {
    ++this.generation;
    ++this.request;
    this.media.onended =
      this.media.onplaying =
      this.media.onwaiting =
      this.media.onerror =
      this.media.ontimeupdate =
      this.media.onloadedmetadata =
        null;
    this.media.pause();
  }
  get position() {
    return this.media.currentTime || 0;
  }
}
