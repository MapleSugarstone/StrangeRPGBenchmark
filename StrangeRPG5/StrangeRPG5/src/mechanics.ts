// Chapter mechanics! New game mechanics introduced each chapter!
// Shadow Step, Dream Weaving, Reality Warp, Sleep Magic, Gravity, Remembering!

export class MechanicManager {
  mechanics: { chapter: number; name: string; description: string }[] = [];

  constructor() {
    // Chapter 1: Shadow Step!
    this.mechanics.push({ 
      chapter: 1, 
      name: 'Shadow Step', 
      description: 'Step through shadows to teleport short distances. Avoid traps. Escape enemies. Get to places you\'re not supposed to reach yet.' 
    });

    // Chapter 2: Dream Weaving!
    this.mechanics.push({ 
      chapter: 2, 
      name: 'Dream Weaving', 
      description: 'Weave dreams to create temporary allies. Dream soldiers fight for you. Dream monsters hurt you. Dreams are dangerous here.' 
    });

    // Chapter 3: Reality Warp!
    this.mechanics.push({ 
      chapter: 3, 
      name: 'Reality Warp', 
      description: 'Warp reality to change the battlefield. Turn walls into bridges. Turn bridges into walls. Turn enemies into... not enemies?' 
    });

    // Chapter 4: Sleep Magic!
    this.mechanics.push({ 
      chapter: 4, 
      name: 'Sleep Magic', 
      description: 'Make people dream. Hurt people by making them dream too hard. Wake them up wrong. Sleep is a weapon here.' 
    });

    // Chapter 5: Gravity!
    this.mechanics.push({ 
      chapter: 5, 
      name: 'Gravity', 
      description: 'Bend space. Bend yourself. Pull enemies toward you. Push yourself away from danger. Fall up. Fall down. Fall sideways into tomorrow.' 
    });

    // Chapter 6: Remembering!
    this.mechanics.push({ 
      chapter: 6, 
      name: 'Remembering', 
      description: 'Remember things that never happened but should have. Remember who you were. Remember who you\'re supposed to be. Memory is the final power. Memory is the final boss.' 
    });
  }
}