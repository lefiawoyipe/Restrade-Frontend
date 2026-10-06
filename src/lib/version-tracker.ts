export type RefreshScope = "marketplace" | "personal" | "admin";
export type VersionRow = { topic: string; version: number | string };
export class VersionTracker {
  private versions = new Map<string, bigint>();
  private ready = false;
  private buffered: VersionRow[] = [];
  constructor(private changed: (topic: string) => void) {}
  event(row: VersionRow) {
    if (!this.ready) this.buffered.push(row);
    else this.observe(row);
  }
  reconcile(rows: VersionRow[]) {
    if (!this.ready) {
      for (const row of rows) this.versions.set(row.topic, BigInt(row.version));
      this.ready = true;
      // Mounted queries may predate events included in the baseline read.
      const topics = new Set(this.buffered.map((row) => row.topic));
      for (const row of this.buffered) this.observe(row);
      this.buffered = [];
      for (const topic of topics) this.changed(topic);
    } else for (const row of rows) this.observe(row);
  }
  private observe(row: VersionRow) {
    const version = BigInt(row.version),
      previous = this.versions.get(row.topic);
    if (previous === undefined || version > previous) {
      this.versions.set(row.topic, version);
      this.changed(row.topic);
    }
  }
}
