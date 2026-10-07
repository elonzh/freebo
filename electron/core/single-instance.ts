interface InstanceApp {
  requestSingleInstanceLock(): boolean;
  on(event: "activate" | "second-instance", listener: () => void): unknown;
}

export class SingleInstance {
  readonly primary: boolean;
  private ready = false;
  private pending = false;

  constructor(
    app: InstanceApp,
    private readonly restoreWindow: () => void,
  ) {
    this.primary = app.requestSingleInstanceLock();
    if (!this.primary) return;
    const activate = () => {
      if (this.ready) this.restoreWindow();
      else this.pending = true;
    };
    app.on("activate", activate);
    app.on("second-instance", activate);
  }

  windowReady(): void {
    if (!this.primary || this.ready) return;
    this.ready = true;
    if (this.pending) {
      this.pending = false;
      this.restoreWindow();
    }
  }
}
