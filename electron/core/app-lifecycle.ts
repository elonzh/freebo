export interface CloseEvent {
  preventDefault(): void;
}

// Both explicit quit and update installation use the same playback cleanup.
export class AppLifecycle {
  private phase: "running" | "stopping" | "ready" = "running";
  private shutdown?: Promise<void>;

  constructor(private readonly cleanup: () => Promise<void>) {}

  get isQuitting() {
    return this.phase !== "running";
  }

  close(
    event: CloseEvent,
    backgroundAvailable: boolean,
    hide: () => void,
    quit: () => void,
  ): boolean {
    if (this.phase === "ready") return true;
    event.preventDefault();
    if (this.phase === "running") {
      if (backgroundAvailable) hide();
      else quit();
    }
    return false;
  }

  prepareToQuit(): Promise<void> {
    if (!this.shutdown) {
      this.phase = "stopping";
      this.shutdown = Promise.resolve()
        .then(this.cleanup)
        .finally(() => {
          this.phase = "ready";
        });
    }
    return this.shutdown;
  }

  beforeQuit(event: CloseEvent, quit: () => void): void {
    if (this.phase === "ready") return;
    event.preventDefault();
    // Only the first request resumes app.quit() after cleanup.
    if (!this.shutdown) void this.prepareToQuit().then(quit, quit);
  }

  resumeAfterFailedUpdate(): void {
    if (this.phase !== "ready") return;
    this.shutdown = undefined;
    this.phase = "running";
  }
}
