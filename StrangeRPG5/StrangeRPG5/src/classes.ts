// Classes! Character classes with unique abilities!

export class ClassManager {
  classes: { name: string; hp: number; mp: number; damage: number; speed: number; spells: number[]; description: string }[] = [];

  constructor() {
    this.classes.push({ 
      name: 'Starwalker', 
      hp: 120, 
      mp: 50, 
      damage: 10, 
      speed: 8, 
      spells: [1, 2, 3],
      description: "Wanders between worlds. Sees everything. Remembers nothing."
    });
    this.classes.push({ 
      name: 'Void Knight', 
      hp: 150, 
      mp: 30, 
      damage: 15, 
      speed: 6, 
      spells: [4, 5],
      description: "Fights things that shouldn't exist. Doesn't sleep. Doesn't dream. Doesn't forget."
    });
    this.classes.push({ 
      name: 'Dream Weaver', 
      hp: 80, 
      mp: 100, 
      damage: 5, 
      speed: 10, 
      spells: [6, 7, 8],
      description: "Weaves dreams. Weaves reality. Weaves you into the story whether you want to be or not."
    });
  }
}
