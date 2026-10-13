// Progress files, stop files, and time limits for the long balance tools (sim, duel, meta, usage).
// --progress=<path> sets the progress file (default Notes/<tool>-progress.txt), --stop=<path> the stop file (default
// dist-tools/<tool>.stop), and --minutes=N a time limit. A run that sees its stop file or passes its limit finishes the
// battle in hand and reports what it has done, marked partial.
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

export interface RunCtl {
  tool: string;
  /** The progress file the parent keeps current. */
  progress: string;
  /** A file whose appearance ends the run early. */
  stop: string;
  /** When the run must end, from --minutes, or Infinity. */
  deadline: number;
  /** When the whole run started, shared with its workers. */
  started: number;
  /** This worker's number, or -1 in a parent or a run with no workers. */
  part: number;
  /** True once the stop file exists or the time limit has passed. Checked between battles. */
  halted(): boolean;
}

export function runCtl(args: string[], tool: string): RunCtl {
  const arg = (n: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const started = Number(arg('started') || Date.now());
  const minutes = Number(arg('minutes') || 0);
  let checked = 0, stopped = false;
  return {
    tool,
    progress: arg('progress') || `Notes/${tool}-progress.txt`,
    stop: arg('stop') || `dist-tools/${tool}.stop`,
    deadline: minutes > 0 ? started + minutes * 60000 : Infinity,
    started,
    part: Number(arg('partid') ?? -1),
    halted() {
      if (stopped) return true;
      const now = Date.now();
      if (now >= this.deadline) return (stopped = true);
      // The stop file is looked for at most once a second.
      if (now - checked >= 1000) { checked = now; if (existsSync(this.stop)) stopped = true; }
      return stopped;
    },
  };
}

/** The flags a worker needs to share its parent's clock, stop file, limit, and progress file. */
export function workerArgs(ctl: RunCtl, k: number): string[] {
  return [`--partid=${k}`, `--started=${ctl.started}`, `--stop=${ctl.stop}`, `--progress=${ctl.progress}`, ...(ctl.deadline < Infinity ? [`--minutes=${(ctl.deadline - ctl.started) / 60000}`] : [])];
}

/** Drops the flags the parent hands each worker itself, so they are not passed twice. */
export const ownFlags = (args: string[]): string[] => args.filter(a => !/^--(partid|started|stop|progress|minutes|out)=/.test(a));

export const partFile = (ctl: RunCtl, k: number): string => `${ctl.progress}.part${k}`;

/** Writes text to a file, making its folder first. */
export function writeText(path: string, text: string): void {
  const cut = path.lastIndexOf('/');
  if (cut > 0) mkdirSync(path.slice(0, cut), { recursive: true });
  writeFileSync(path, text);
}

/** A worker's latest progress from its part file, or null before it writes one. */
export function readPart<T>(ctl: RunCtl, k: number): T | null {
  try { return JSON.parse(readFileSync(partFile(ctl, k), 'utf8')) as T; } catch { return null; }
}

export function clearParts(ctl: RunCtl, n: number): void {
  for (let k = 0; k < n; k++) { try { unlinkSync(partFile(ctl, k)); } catch { /* already gone */ } }
}

/** Removes a stop file left by an earlier run, so it cannot end this one at once. */
export function clearStop(ctl: RunCtl): void { try { unlinkSync(ctl.stop); } catch { /* none there */ } }

export function clock(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const hhmm = (t: number): string => new Date(t).toLocaleTimeString('en-US', { hour12: false });

/** The head of a progress file: state, battles done of total, elapsed time, an ETA, and how to stop early. */
export function progressHead(ctl: RunCtl, done: number, total: number, state: string, unit = 'battles'): string {
  const el = Date.now() - ctl.started;
  const eta = done > 0 && done < total && state === 'running' ? clock(el * (total - done) / done) : '-';
  return [
    `${ctl.tool}: ${state}, ${done} of ${total} ${unit} (${total ? (100 * done / total).toFixed(1) : '0.0'}%)`,
    `started ${hhmm(ctl.started)}, elapsed ${clock(el)}, ETA ${eta}, updated ${hhmm(Date.now())}`,
    `to stop early: create ${ctl.stop}${ctl.deadline < Infinity ? `, or wait for the time limit at ${hhmm(ctl.deadline)}` : ''}`,
  ].join('\n');
}
