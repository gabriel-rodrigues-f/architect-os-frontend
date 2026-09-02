export type IdleSessionPhase = "active" | "warning" | "ended";

export class IdleSessionBudget {
  static readonly MINUTE_MS = 60_000;

  constructor(
    readonly warnAfterIdleMinutes: number,
    readonly endAfterIdleMinutes: number,
  ) {}

  static fromIdleTimeoutMinutes(endAfterIdleMinutes: number): IdleSessionBudget {
    return new IdleSessionBudget(endAfterIdleMinutes - 1, endAfterIdleMinutes);
  }

  get warnAfterMs(): number {
    return this.warnAfterIdleMinutes * IdleSessionBudget.MINUTE_MS;
  }

  get endAfterMs(): number {
    return this.endAfterIdleMinutes * IdleSessionBudget.MINUTE_MS;
  }

  get graceMs(): number {
    return this.endAfterMs - this.warnAfterMs;
  }

  phaseAfter(idleForMs: number): IdleSessionPhase {
    if (idleForMs >= this.endAfterMs) return "ended";
    if (idleForMs >= this.warnAfterMs) return "warning";
    return "active";
  }
}

export interface IdleActivitySharing {
  subscribe(listener: (at: number) => void): void;
  read(): number | null;
  publish(at: number): void;
  dispose(): void;
}

export class CrossTabIdleActivity implements IdleActivitySharing {
  static readonly STORAGE_KEY = "synapse:idle-last-activity";
  static readonly CHANNEL_NAME = "synapse:idle-session";

  private channel: BroadcastChannel | null = null;
  private listener: ((at: number) => void) | null = null;

  private readonly onBroadcast = (event: Event): void => {
    this.announce(Number((event as MessageEvent<unknown>).data));
  };

  private readonly onStorage = (event: Event): void => {
    const change = event as StorageEvent;
    if (change.key !== CrossTabIdleActivity.STORAGE_KEY) return;
    if (change.newValue === null) return;
    this.announce(Number(change.newValue));
  };

  subscribe(listener: (at: number) => void): void {
    this.listener = listener;
    if (typeof BroadcastChannel === "function") {
      try {
        this.channel = new BroadcastChannel(CrossTabIdleActivity.CHANNEL_NAME);
        this.channel.addEventListener("message", this.onBroadcast);
      } catch {
        this.channel = null;
      }
    }
    window.addEventListener("storage", this.onStorage);
  }

  read(): number | null {
    try {
      const raw = window.localStorage.getItem(CrossTabIdleActivity.STORAGE_KEY);
      if (raw === null) return null;
      const at = Number(raw);
      return Number.isFinite(at) ? at : null;
    } catch {
      return null;
    }
  }

  publish(at: number): void {
    try {
      window.localStorage.setItem(CrossTabIdleActivity.STORAGE_KEY, String(at));
    } catch {
      this.postToOtherTabs(at);
      return;
    }
    this.postToOtherTabs(at);
  }

  dispose(): void {
    if (this.channel) {
      this.channel.removeEventListener("message", this.onBroadcast);
      this.channel.close();
      this.channel = null;
    }
    window.removeEventListener("storage", this.onStorage);
    this.listener = null;
  }

  private postToOtherTabs(at: number): void {
    try {
      this.channel?.postMessage(at);
    } catch {
      return;
    }
  }

  private announce(at: number): void {
    if (Number.isFinite(at)) this.listener?.(at);
  }
}

export class IdleSessionMonitor {
  static readonly PUBLISH_INTERVAL_MS = 1_000;

  private lastActivityAt = 0;
  private lastPublishedAt = 0;
  private phase: IdleSessionPhase = "active";
  private watching = false;

  constructor(
    private readonly budget: IdleSessionBudget,
    private readonly sharing: IdleActivitySharing,
    private readonly onPhase: (phase: IdleSessionPhase) => void,
  ) {}

  private readonly onSharedActivity = (at: number): void => {
    if (!this.watching || this.phase === "ended") return;
    if (at <= this.lastActivityAt) return;
    this.lastActivityAt = at;
    this.lastPublishedAt = at;
    this.settle(Date.now());
  };

  begin(now: number): void {
    if (this.watching) return;
    this.watching = true;
    this.phase = "active";
    this.lastActivityAt = now;
    this.lastPublishedAt = now;
    this.sharing.subscribe(this.onSharedActivity);
    this.sharing.publish(now);
    this.onPhase("active");
  }

  end(): void {
    if (!this.watching) return;
    this.watching = false;
    this.sharing.dispose();
  }

  registerActivity(now: number): void {
    if (!this.watching || this.phase === "ended") return;
    if (now > this.lastActivityAt) this.lastActivityAt = now;
    if (now - this.lastPublishedAt >= IdleSessionMonitor.PUBLISH_INTERVAL_MS) {
      this.lastPublishedAt = now;
      this.sharing.publish(now);
    }
    this.settle(now);
  }

  review(now: number): void {
    if (!this.watching || this.phase === "ended") return;
    const shared = this.sharing.read();
    if (shared !== null && shared > this.lastActivityAt && shared <= now) {
      this.lastActivityAt = shared;
      this.lastPublishedAt = shared;
    }
    this.settle(now);
  }

  private settle(now: number): void {
    const next = this.budget.phaseAfter(now - this.lastActivityAt);
    if (next === this.phase) return;
    this.phase = next;
    this.onPhase(next);
  }
}

export class IdleSessionWatch {
  static readonly TICK_MS = 1_000;

  static readonly ACTIVITY_EVENTS = [
    "mousemove",
    "mousedown",
    "keydown",
    "touchstart",
    "scroll",
    "wheel",
  ];

  static readonly RETURN_EVENTS = ["focus", "pageshow"];

  private ticker: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly monitor: IdleSessionMonitor) {}

  private readonly onActivity = (): void => {
    this.monitor.registerActivity(Date.now());
  };

  private readonly onReturn = (): void => {
    const now = Date.now();
    this.monitor.review(now);
    if (document.visibilityState === "visible") this.monitor.registerActivity(now);
  };

  private readonly onTick = (): void => {
    this.monitor.review(Date.now());
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.monitor.begin(Date.now());
    for (const type of IdleSessionWatch.ACTIVITY_EVENTS) {
      document.addEventListener(type, this.onActivity, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", this.onReturn);
    for (const type of IdleSessionWatch.RETURN_EVENTS) {
      window.addEventListener(type, this.onReturn);
    }
    this.ticker = setInterval(this.onTick, IdleSessionWatch.TICK_MS);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    for (const type of IdleSessionWatch.ACTIVITY_EVENTS) {
      document.removeEventListener(type, this.onActivity, { capture: true });
    }
    document.removeEventListener("visibilitychange", this.onReturn);
    for (const type of IdleSessionWatch.RETURN_EVENTS) {
      window.removeEventListener(type, this.onReturn);
    }
    this.monitor.end();
  }
}
