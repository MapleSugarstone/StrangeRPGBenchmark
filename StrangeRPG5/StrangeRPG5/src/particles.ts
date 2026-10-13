// Particle effects! Visual flair for spells, attacks, weird stuff!

export class ParticleEffects {
  particles: { x: number; y: number; dx: number; dy: number; color: string; life: number; }[] = [];

  constructor() {}

  explode(x: number, y: number, color: string, count = 20) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        dx: (Math.random() - 0.5) * 3,
        dy: (Math.random() - 0.5) * 3,
        color,
        life: 30 + Math.random() * 20,
      });
    }
  }

  update() {
    for (const p of this.particles) {
      p.x += p.dx;
      p.y += p.dy;
      p.life -= 1;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }
}
