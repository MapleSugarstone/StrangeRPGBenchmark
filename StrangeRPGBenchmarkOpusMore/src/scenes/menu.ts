import { Gfx, W } from '../core/gfx';
import { textWidth, wrap } from '../core/font';
import type { Game, Scene } from '../game/game';
import { MEMBERS, xpNext, callingOf } from '../data/members';
import { QUESTS, DONE, PAGES } from '../data/quests';
import { TALKS, TalkDef } from '../data/talk';
import type { Ctx } from '../game/ctx';
import type { GameState } from '../game/state';
import { ITEMS } from '../data/items';
import { ENEMIES } from '../data/enemies';
import { SKILLS, describeSkill } from '../data/skills';
import { SLIPS } from '../data/slips';
import { VERB_NAME } from '../battle/types';
import { addItem, learned, memberStats, slipLevel, slipText, MemberState } from '../game/state';
import { heroSprite } from '../game/speakers';
import { LetterScene } from './letters';
import { goal } from '../game/goals';

const TABS = ['Party', 'Items', 'Calls', 'Kept', 'Book', 'Slip', 'Opts'];

export function nextTalk(s: GameState): TalkDef | undefined {
  return TALKS.find((t) => t.maps.includes(s.map) && t.need.every((id) => s.party.includes(id)) && (!t.flag || s.flags[t.flag]) && (!t.not || !s.flags[t.not]) && !s.flags['talk_' + t.id]);
}

interface Row { label: string; right?: string; color?: string; desc?: string; act?: () => void; sprite?: boolean; mid?: string; }
interface Mode { title: string; rows: () => Row[]; idx: number; scroll: number; info?: () => string[]; }

export class MenuScene implements Scene {
  overlay = false;
  tab = 0;
  modes: Mode[] = [];
  idx = 0;
  scroll = 0;
  toast = '';
  toastT = 0;

  constructor(private game: Game) {
    game.audio.sfx('ok');
  }

  get s() { return this.game.state!; }

  close() {
    this.game.audio.sfx('back');
    this.game.pop(this);
    this.game.input.clearAll();
  }

  say(t: string) { this.toast = t; this.toastT = 100; }

  // ---- page rows ----
  pageRows(): Row[] {
    const s = this.s;
    switch (TABS[this.tab]) {
      case 'Party': {
        const ids = [...s.party, ...Object.keys(s.roster).filter((k) => !s.party.includes(k))];
        const talk = nextTalk(s);
        const talkRow: Row[] = talk ? [{ label: 'Talk', right: 'new', color: 'mint', desc: 'The party has something to say. It is short.', act: () => this.playTalk(talk) }] : [];
        return [...talkRow, ...ids.map((id) => {
          const m = s.roster[id];
          const st = memberStats(m);
          const active = s.party.includes(id);
          return {
            label: MEMBERS[id].name, mid: `Lv${m.lvl}`, right: `${m.hp}/${st.hp}`, color: active ? 'paper' : 'grey', sprite: true,
            desc: `${MEMBERS[id].cls}. ${active ? 'In the party.' : 'On the bench (gets 60 percent XP).'} ${xpNext(m.lvl) - m.xp} XP to next level.`,
            act: () => this.memberMenu(id),
          };
        })];
      }
      case 'Items': {
        const ids = Object.keys(s.inv).filter((k) => s.inv[k] > 0 && ITEMS[k]);
        ids.sort((a, b) => (ITEMS[a].kind === 'key' ? 1 : 0) - (ITEMS[b].kind === 'key' ? 1 : 0));
        if (!ids.length) return [{ label: 'Nothing.', color: 'grey' }];
        return ids.map((id) => {
          const it = ITEMS[id];
          return {
            label: it.name, right: it.kind === 'key' ? '' : 'x' + s.inv[id], color: it.kind === 'key' ? 'plea' : it.field ? 'paper' : 'grey',
            desc: it.id === 'wishslip' ? `Your slip: "${slipText(s.wish, slipLevel(s))}"` : it.desc,
            act: it.field ? () => this.useItem(id) : undefined,
          };
        });
      }
      case 'Calls': {
        const ids = Object.keys(QUESTS).filter((id) => Number(s.flags['q_' + id] ?? 0) > 0);
        if (!ids.length) return [{ label: 'No calls yet.', color: 'grey', desc: 'People in the Silt ask for things. When someone asks you, the call shows up here.' }];
        const open = ids.filter((id) => Number(s.flags['q_' + id]) < DONE).sort((a, b) => QUESTS[b].chapter - QUESTS[a].chapter);
        const done = ids.filter((id) => Number(s.flags['q_' + id]) >= DONE);
        return [
          ...open.map((id) => {
            const q = QUESTS[id];
            const step = Math.min(q.steps.length, Number(s.flags['q_' + id]));
            return { label: q.title, right: q.steps.length > 1 ? `${step}/${q.steps.length}` : '', color: 'paper', desc: `${q.from}: ${q.steps[step - 1]}` };
          }),
          ...done.map((id) => ({ label: QUESTS[id].title, right: 'Done', color: 'grey', desc: `${QUESTS[id].from}. Closed.` })),
        ];
      }
      case 'Kept': {
        if (!s.kept.length) return [{ label: 'No kept prayers yet.', color: 'grey', desc: s.flags.mech_answer ? 'Answer a feral to keep its prayer. Kept prayers can be worn as charms.' : 'Some things can be answered instead of beaten. You will learn how.' }];
        return s.kept.map((id) => {
          const e = ENEMIES[id];
          const k = e.kept!;
          const who = Object.values(s.roster).find((m) => m.charms.includes('kept:' + id));
          return { label: k.name, right: who ? MEMBERS[who.id].name.split(' ')[0] : '', desc: `From ${e.name}: "${e.prayer}" ${k.desc} Calls: ${SKILLS[k.skill ?? '']?.name ?? 'nothing'}.` };
        });
      }
      case 'Book': {
        const rows: Row[] = [{ label: `Ferals seen: ${s.seen.length}`, color: 'gold' }];
        for (const id of s.seen) {
          const e = ENEMIES[id];
          if (!e) continue;
          const known = s.kept.includes(id);
          rows.push({ label: e.name, right: known ? VERB_NAME[e.ask] : '', color: known ? 'mint' : 'paper', desc: `"${e.prayer}" ${e.desc ?? ''}` });
        }
        rows.push({ label: `Slips found: ${s.slips.length}`, color: 'gold' });
        for (const id of s.slips) {
          const sl = SLIPS[id];
          if (sl) rows.push({ label: sl.from, color: 'plea', desc: `"${sl.text}"` });
        }
        const pages = PAGES.map((p, i) => ({ p, i })).filter(({ i }) => s.flags['page_' + (i + 1)]);
        if (pages.length) {
          rows.push({ label: `Ledger pages: ${pages.length}/${PAGES.length}`, color: 'gold', desc: 'LINEMAN 0411. DELIVERIES.' });
          for (const { p, i } of pages) rows.push({ label: `Page ${i + 1}`, color: 'bone', desc: `${p.names} Margin: "${p.note}"` });
        }
        return rows;
      }
      case 'Slip': return [];
      case 'Opts': {
        const sp = ['Slow', 'Normal', 'Fast', 'Instant'];
        const rows: Row[] = [
          { label: 'Text speed', right: sp[s.textSpeed], act: () => { s.textSpeed = (s.textSpeed + 1) % 4; } },
          { label: 'Foes', right: s.flags.gentle ? 'Gentle' : 'Normal', desc: 'Gentle: foes have a quarter less health and hit a fifth softer. Rewards stay the same. Change it any time.', act: () => { s.flags.gentle = s.flags.gentle ? 0 : 1; } },
          { label: 'Timed presses', right: s.timed ? 'On' : 'Off', desc: 'Press confirm as the ring closes for a clean hit, and when ! flashes to brace.', act: () => { s.timed = !s.timed; } },
          { label: 'Players', right: this.game.input.twoPlayer ? '2' : '1', desc: 'Two players: player 1 uses WASD, F, and G. Player 2 uses the arrows, Enter, and right Shift. Party members alternate between players. Player 2 steers a cursor in the field that reveals buried slips and freezes ferals.', act: () => { this.game.input.twoPlayer = !this.game.input.twoPlayer; } },
          { label: 'Sound', right: this.game.audio.muted ? 'Off' : 'On', act: () => { this.game.audio.toggleMute(); } },
          {
            label: 'Screen', right: document.body.classList.contains('scan') ? 'Scanlines' : 'Clean', desc: 'Scanlines draw a dark line between each row of pixels, like an old television.',
            act: () => { const on = document.body.classList.toggle('scan'); try { localStorage.setItem('pleasehold.scan', on ? '1' : '0'); } catch { /* storage may be unavailable */ } },
          },
        ];
        if (s.flags.mech_stakes) {
          const names = ['None', 'Double', 'All in'];
          rows.splice(2, 0, { label: 'Stakes', right: names[s.stakes], desc: 'Raise the stakes: foes are tougher, rewards are doubled or tripled.', act: () => { s.stakes = (s.stakes + 1) % 3; } });
        }
        rows.push({ label: 'Write a letter', desc: 'Write a short letter as a code. A friend can open it in their game.', act: () => this.game.push(new LetterScene(this.game, 'write')) });
        rows.push({ label: 'Open a letter', desc: 'Type in a code someone gave you.', act: () => this.game.push(new LetterScene(this.game, 'read')) });
        rows.push({ label: 'Quit to title', desc: 'Unsaved progress since the last payphone is lost.', act: () => { this.game.toTitle(); } });
        return rows;
      }
    }
    return [];
  }

  memberMenu(id: string) {
    const s = this.s;
    this.modes.push({
      title: MEMBERS[id].name, idx: 0, scroll: 0,
      rows: () => {
        const active = s.party.includes(id);
        const rows: Row[] = [{ label: 'Details', act: () => this.details(id) }, { label: 'Equip', right: ITEMS[s.roster[id].weapon]?.name ?? '', act: () => this.equipMenu(id) }];
        if (active && s.party.indexOf(id) > 0) rows.push({ label: 'Move up', act: () => { const i = s.party.indexOf(id); [s.party[i - 1], s.party[i]] = [s.party[i], s.party[i - 1]]; } });
        if (active && id !== 'hello' && s.party.length > 1) rows.push({ label: 'Move to bench', act: () => { s.party = s.party.filter((p) => p !== id); this.modes.pop(); } });
        if (!active) rows.push({ label: s.party.length < 4 ? 'Join party' : 'Party is full', color: s.party.length < 4 ? 'paper' : 'slate', act: () => { if (s.party.length < 4) { s.party.push(id); this.modes.pop(); } } });
        return rows;
      },
    });
  }

  details(id: string) {
    const s = this.s;
    const m = s.roster[id];
    const d = MEMBERS[id];
    const skills = [...learned(id, m.lvl, false, m.calling), ...learned(id, m.lvl, true, m.calling)];
    this.modes.push({
      title: d.name, idx: 0, scroll: 0,
      info: () => {
        const st = memberStats(m);
        const k = callingOf(id, m.calling);
        return [
          `${d.cls}${k ? ' / ' + k.name : ''}  Lv ${m.lvl}  XP ${xpNext(m.lvl) - m.xp}`,
          `HP ${m.hp}/${st.hp}  VP ${m.vp}/${st.vp}`,
          `POW ${st.pow}  WIT ${st.wit}  GRD ${st.grd}  SPD ${st.spd}`,
          st.resist.length ? `Resists ${st.resist.join(', ')}` : '',
        ];
      },
      rows: () => skills.map((sk) => ({ label: SKILLS[sk].name, right: SKILLS[sk].cost ? String(SKILLS[sk].cost) : '', desc: describeSkill(SKILLS[sk]) + (SKILLS[sk].voice ? ' (Spoken.)' : '') })).concat([{ label: 'Slip', right: '', desc: id === 'hello' ? `"${slipText(s.wish, slipLevel(s))}"` : `"${d.prayer}" ${d.bio}` }]),
    });
  }

  playTalk(t: TalkDef) {
    this.s.flags['talk_' + t.id] = 1;
    this.close();
    const field = this.game.stack[0] as unknown as { run: (fn: (c: Ctx) => Promise<void>) => void };
    field.run(async (c) => { for (const [who, text] of t.lines) await c.say(who, text); });
  }

  useItem(id: string) {
    const s = this.s;
    const it = ITEMS[id];
    this.modes.push({
      title: `Use ${it.name} on`, idx: 0, scroll: 0,
      rows: () => s.party.map((pid) => {
        const m = s.roster[pid];
        const st = memberStats(m);
        return {
          label: MEMBERS[pid].name, sprite: true, right: `${m.hp}/${st.hp}`, act: () => {
            if (!(s.inv[id] > 0)) { this.modes.pop(); return; }
            let used = false;
            if (it.revive) { if (m.hp <= 0) { m.hp = Math.max(1, Math.round(st.hp * it.revive)); used = true; } }
            else if (m.hp > 0) {
              if (it.heal || it.healPct) {
                const targets = it.tgt === 'allies' ? s.party.map((p) => s.roster[p]) : [m];
                for (const t of targets) { const ts = memberStats(t); if (t.hp > 0 && t.hp < ts.hp) { t.hp = Math.min(ts.hp, t.hp + (it.heal ?? 0) + Math.round(ts.hp * (it.healPct ?? 0))); used = true; } }
              }
              if (it.vp && m.vp < st.vp) { m.vp = Math.min(st.vp, m.vp + it.vp); used = true; }
              if (it.cure) used = true;
            }
            if (used) { addItem(s, id, -1); this.game.audio.sfx('heal'); if (!(s.inv[id] > 0)) this.modes.pop(); }
            else { this.game.audio.sfx('buzz'); this.say('It would not do anything.'); }
          },
        };
      }),
    });
  }

  equipMenu(id: string) {
    const s = this.s;
    const m = s.roster[id];
    const slotName = ['Weapon', 'Coat', 'Charm', 'Charm'];
    this.modes.push({
      title: `Equip ${MEMBERS[id].name}`, idx: 0, scroll: 0,
      info: () => { const st = memberStats(m); return [`POW ${st.pow}  WIT ${st.wit}  GRD ${st.grd}  SPD ${st.spd}  HP ${st.hp}  VP ${st.vp}`]; },
      rows: () => [0, 1, 2, 3].map((slot) => {
        const cur = slot === 0 ? m.weapon : slot === 1 ? m.coat : m.charms[slot - 2];
        return { label: slotName[slot], right: this.gearName(cur), act: () => this.pickGear(m, slot) };
      }),
    });
  }

  gearName(id: string | null): string {
    if (!id) return '(none)';
    if (id.startsWith('kept:')) return ENEMIES[id.slice(5)]?.kept?.name ?? '?';
    return ITEMS[id]?.name ?? id;
  }

  pickGear(m: MemberState, slot: number) {
    const s = this.s;
    const cands = (): (string | null)[] => {
      if (slot === 0) return Object.keys(s.inv).filter((k) => s.inv[k] > 0 && ITEMS[k]?.kind === 'weapon' && ITEMS[k].who === m.id);
      if (slot === 1) return Object.keys(s.inv).filter((k) => s.inv[k] > 0 && ITEMS[k]?.kind === 'coat');
      const used = new Set(Object.values(s.roster).flatMap((r) => r.charms).filter(Boolean));
      return [null, ...Object.keys(s.inv).filter((k) => s.inv[k] > 0 && ITEMS[k]?.kind === 'charm'), ...s.kept.map((k) => 'kept:' + k).filter((k) => !used.has(k))];
    };
    this.modes.push({
      title: 'Choose', idx: 0, scroll: 0,
      rows: () => {
        const list = cands();
        if (!list.length) return [{ label: 'Nothing to equip.', color: 'grey' }];
        return list.map((c) => ({
          label: this.gearName(c), desc: c ? (c.startsWith('kept:') ? ENEMIES[c.slice(5)]?.kept?.desc : ITEMS[c]?.desc) : 'Take it off.',
          act: () => {
            if (slot === 0 && c) { addItem(s, m.weapon); addItem(s, c, -1); m.weapon = c; }
            else if (slot === 1 && c) { addItem(s, m.coat); addItem(s, c, -1); m.coat = c; }
            else if (slot >= 2) {
              const old = m.charms[slot - 2];
              if (old && !old.startsWith('kept:')) addItem(s, old);
              if (c && !c.startsWith('kept:')) addItem(s, c, -1);
              m.charms[slot - 2] = c;
            }
            const st = memberStats(m);
            m.hp = Math.min(m.hp, st.hp); m.vp = Math.min(m.vp, st.vp);
            this.game.audio.sfx('ok');
            this.modes.pop();
          },
        }));
      },
    });
  }

  // ---- input ----
  update() {
    const inp = this.game.input;
    if (this.toastT > 0) this.toastT--;
    const mode = this.modes[this.modes.length - 1];
    if (!mode) {
      if (inp.pressed('left')) { this.tab = (this.tab + TABS.length - 1) % TABS.length; this.idx = 0; this.scroll = 0; this.game.audio.sfx('move'); }
      if (inp.pressed('right')) { this.tab = (this.tab + 1) % TABS.length; this.idx = 0; this.scroll = 0; this.game.audio.sfx('move'); }
    }
    if (inp.pressed('back') || inp.pressed('menu')) {
      if (this.modes.length) { this.modes.pop(); this.game.audio.sfx('back'); }
      else this.close();
      return;
    }
    const rows = mode ? mode.rows() : this.pageRows();
    const n = rows.length;
    if (!n) return;
    let idx = mode ? mode.idx : this.idx;
    if (inp.pressed('up')) { idx = (idx + n - 1) % n; this.game.audio.sfx('move'); }
    if (inp.pressed('down')) { idx = (idx + 1) % n; this.game.audio.sfx('move'); }
    if (idx >= n) idx = n - 1;
    if (mode) mode.idx = idx; else this.idx = idx;
    const vis = this.visibleRows(!!mode?.info);
    let scroll = mode ? mode.scroll : this.scroll;
    if (idx < scroll) scroll = idx;
    if (idx >= scroll + vis) scroll = idx - vis + 1;
    if (mode) mode.scroll = scroll; else this.scroll = scroll;
    if (inp.pressed('ok')) {
      const r = rows[idx];
      if (r?.act) { this.game.audio.sfx('ok'); r.act(); }
    }
  }

  visibleRows(info: boolean): number { return info ? 6 : 10; }

  // ---- drawing ----
  draw(g: Gfx) {
    g.clear('ink');
    let x = 2;
    TABS.forEach((t, i) => {
      const w = textWidth(t) + 6;
      if (i === this.tab) g.rect(x, 1, w, 11, this.modes.length ? 'slate' : 'gold');
      g.text(t, x + 3, 3, i === this.tab ? 'ink' : 'grey');
      x += w + 1;
    });
    g.textR(`${this.s.pleas}\u0007`, 190, 14, 'plea');
    const mode = this.modes[this.modes.length - 1];
    if (TABS[this.tab] === 'Slip' && !mode) { this.drawSlip(g); return; }
    let y = 15;
    if (mode) {
      g.text(mode.title, 6, y, 'gold');
      y += 11;
      if (mode.info) {
        for (const l of mode.info()) { if (l) g.text(l, 6, y, 'sky'); y += 10; }
      }
    } else {
      g.text(this.pageTitle(), 6, y, 'gold');
      y += 11;
    }
    const rows = mode ? mode.rows() : this.pageRows();
    const idx = mode ? mode.idx : this.idx;
    const scroll = mode ? mode.scroll : this.scroll;
    const vis = this.visibleRows(!!mode?.info);
    rows.slice(scroll, scroll + vis).forEach((r, i) => {
      const k = scroll + i;
      const yy = y + i * 11;
      const sel = k === idx;
      let tx = 16;
      if (r.sprite) {
        const id = this.memberIdByName(r.label);
        if (id) g.sprite(id === 'hello' ? heroSprite() : MEMBERS[id].sprite, 14, yy - 1, 8, 0);
        tx = 26;
      }
      g.text(r.label, tx, yy, sel ? 'gold' : r.color ?? 'paper');
      if (r.mid) g.text(r.mid, 96, yy, 'grey');
      if (r.right) g.textR(r.right, 188, yy, sel ? 'cream' : 'grey');
      if (sel) g.cursor(6, yy);
    });
    if (scroll > 0) g.text('\u0006', 182, y - 8, 'grey');
    if (scroll + vis < rows.length) g.text('\u0005', 182, y + vis * 11 - 4, 'grey');
    const cur = rows[idx];
    const desc = this.toastT > 0 ? this.toast : cur?.desc;
    if (desc) {
      g.box(0, 140, W, 52, 'grey');
      // Long descriptions turn to their next four lines every few seconds.
      const lines = wrap(desc, 178);
      const pages = Math.ceil(lines.length / 4);
      const p = Math.floor(g.t / 200) % pages;
      lines.slice(p * 4, p * 4 + 4).forEach((l, i) => g.text(l, 7, 145 + i * 11, this.toastT > 0 ? 'gold' : 'cream'));
      if (pages > 1) for (let k = 0; k < pages; k++) g.rect(186 - (pages - k) * 4, 139, 3, 3, k === p ? 'gold' : 'slate');
    }
  }

  memberIdByName(name: string): string | null {
    for (const m of Object.values(MEMBERS)) if (m.name === name) return m.id;
    return null;
  }

  pageTitle(): string {
    const s = this.s;
    switch (TABS[this.tab]) {
      case 'Party': return `Party  (${Math.floor(s.playtime / 3600)}h ${Math.floor(s.playtime / 60) % 60}m)`;
      case 'Items': return 'Items';
      case 'Calls': return 'Calls';
      case 'Kept': return `Kept prayers: ${s.kept.length}`;
      case 'Book': return 'The Book';
      case 'Opts': return 'Options';
    }
    return '';
  }

  drawSlip(g: Gfx) {
    const s = this.s;
    g.box(16, 24, 160, 110, 'plea', 'cream');
    g.textC("Hello's slip", 96, 30, 'brown');
    const lines = wrap(slipText(s.wish, slipLevel(s)), 140);
    lines.slice(0, 6).forEach((l, i) => g.textC(l, 96, 50 + i * 11, 'ink'));
    const notes = [
      'Someday says some slips take their time.',
      'It whispers sometimes, but never the whole thing.',
      'More of it comes in every time I look.',
      'I think I know some of these words.',
      'Somebody is still writing this.',
      'It sounds like someone I have not met yet.',
      'Amen said the asker is still there.',
      'Someday would have read it for me.',
      'I know who this is now.',
    ];
    wrap(notes[Math.min(8, s.chapter - 1)], 176).forEach((l, i) => g.text(l, 8, 140 + i * 10, 'grey'));
    wrap('Goal: ' + goal(s), 176).slice(0, 3).forEach((l, i) => g.text(l, 8, 162 + i * 10, 'gold'));
  }
}
