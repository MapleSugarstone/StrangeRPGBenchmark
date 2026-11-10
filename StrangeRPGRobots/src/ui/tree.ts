// The skill tree screen: three branches of six nodes, a description panel, and learning with tree points.
import { rect, blitUI, hline, vline, frame } from '../engine/gfx';
import { drawText, textWidth, LINE_H } from '../engine/font';
import { C } from '../engine/palette';
import { pressed, repeat, consume, MOUSE, mouseActive } from '../engine/input';
import { W, H } from '../engine/screen';
import { G, type Member } from '../game/state';
import { CLASSES, TREE_LEVELS, nodeInfo } from '../rules/data';
import { nodeState, learnNode, pointsLeft, type NodeState } from '../rules/stats';
import { abilityIcon } from '../art/abilityIcons';
import { panel, drawWrapped } from './widgets';
import { sfx } from '../audio/sfx';

const COLS = [58, 112, 166];
const ROW0 = 30, PITCH = 16, BOX = 14;
const DESC_Y = 129;

const REASON: Record<NodeState, string> = { learned: 'Learned', learnable: '', level: '', order: 'Learn above first', points: 'No points' };

export class TreeScreen {
  done = false;
  b: number;
  t: number;
  constructor(public m: Member) {
    const k = G.menu[`tree_${m.id}`] ?? this.firstOpen();
    this.b = Math.floor(k / 6) % 3;
    this.t = k % 6;
  }
  /** With no remembered node, start on the first one the member can learn. */
  firstOpen(): number {
    for (let b = 0; b < 3; b++) for (let t = 0; t < 6; t++) if (nodeState(this.m, b, t) === 'learnable') return b * 6 + t;
    return 0;
  }
  remember() { G.menu[`tree_${this.m.id}`] = this.b * 6 + this.t; }
  boxAt(b: number, t: number): [number, number] { return [COLS[b] - BOX / 2, ROW0 + t * PITCH]; }
  learn() {
    if (learnNode(this.m, this.b, this.t)) { sfx('levelup'); this.remember(); }
    else sfx('error');
  }
  update() {
    if (pressed('b')) { consume(); this.done = true; sfx('cancel'); return; }
    const ob = this.b, ot = this.t;
    if (repeat('left')) this.b = (this.b + 2) % 3;
    if (repeat('right')) this.b = (this.b + 1) % 3;
    if (repeat('up')) this.t = (this.t + 5) % 6;
    if (repeat('down')) this.t = (this.t + 1) % 6;
    let click = false;
    if (mouseActive()) {
      for (let b = 0; b < 3; b++) for (let t = 0; t < 6; t++) {
        const [x, y] = this.boxAt(b, t);
        if (MOUSE.x >= x - 1 && MOUSE.x < x + BOX + 1 && MOUSE.y >= y - 1 && MOUSE.y < y + BOX + 1) {
          if (MOUSE.moved || MOUSE.left) { this.b = b; this.t = t; }
          if (MOUSE.left) click = true;
        }
      }
    }
    if (this.b !== ob || this.t !== ot) { sfx('cursor'); this.remember(); }
    if (pressed('a') || click) { consume(); this.learn(); }
  }
  render() {
    const m = this.m;
    const c = CLASSES[m.cls];
    panel(4, 4, W - 8, H - 8);
    const who = `${m.id === 'hero' ? G.heroName : m.cls === 'port' ? G.port.name : m.name}, ${c.name} ${m.level}`;
    drawText(who, 10, 8, C.white, W - 70);
    const pts = pointsLeft(m);
    const pl = `${pts} ${pts === 1 ? 'point' : 'points'}`;
    drawText(pl, W - 10 - textWidth(pl), 8, pts ? C.amb3 : C.gray);
    hline(6, 17, W - 12, C.night);
    c.tree.forEach((br, b) => {
      drawText(br.name, COLS[b] - Math.floor(textWidth(br.name) / 2), 19, b === this.b ? C.amb3 : C.gray);
      for (let t = 0; t < 6; t++) {
        const [x, y] = this.boxAt(b, t);
        const st = nodeState(m, b, t);
        if (t < 5) vline(COLS[b], y + BOX, PITCH - BOX, st === 'learned' && nodeState(m, b, t + 1) === 'learned' ? C.cyan3 : C.night);
        const border = st === 'learned' ? C.cyan3 : st === 'learnable' ? C.amb3 : st === 'points' ? C.gray : st === 'order' ? C.slate : C.night;
        rect(x, y, BOX, BOX, border);
        rect(x + 1, y + 1, BOX - 2, BOX - 2, st === 'learned' ? C.cyan2 : C.ink);
        blitUI(abilityIcon(nodeInfo(br.nodes[t]).icon, st === 'level' || st === 'order'), x + 2, y + 2);
        if (b === this.b && t === this.t) frame(x - 2, y - 2, BOX + 4, BOX + 4, C.white);
      }
    });
    for (let t = 0; t < 6; t++) drawText(`Lv ${TREE_LEVELS[t]}`, 10, ROW0 + t * PITCH + 3, m.level >= TREE_LEVELS[t] ? C.gray : C.slate);
    hline(6, DESC_Y - 2, W - 12, C.night);
    const id = c.tree[this.b].nodes[this.t];
    const info = nodeInfo(id);
    const st = nodeState(m, this.b, this.t);
    const kind = info.active ? 'Active' : 'Passive';
    const right = `${kind}, Lv ${TREE_LEVELS[this.t]}`;
    drawText(info.name, 10, DESC_Y, st === 'learnable' ? C.amb3 : st === 'learned' ? C.cyan3 : C.white, W - 24 - textWidth(right));
    drawText(right, W - 10 - textWidth(right), DESC_Y, C.gray);
    drawWrapped(info.desc, 10, DESC_Y + LINE_H, W - 20, C.pale, 5);
    const hint = st === 'learnable' ? 'Z: learn  X: back' : 'X: back';
    drawText(hint, 10, H - 15, C.slate);
    const why = st === 'level' ? `Needs Lv ${TREE_LEVELS[this.t]}` : REASON[st];
    if (why) drawText(why, W - 10 - textWidth(why), H - 15, st === 'learned' ? C.cyan3 : C.slate);
  }
}
