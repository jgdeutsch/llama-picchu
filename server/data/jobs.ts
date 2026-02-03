// Jobs Data for FROBARK
// Jobs are how players earn gold in Gamehenge. Each job has requirements
// and pays based on completed tasks.

export interface JobDefinition {
  id: number;
  name: string;
  employerNpcId: number | null;  // NPC who offers it (null = general labor)
  location: string;              // Room where work is done
  description: string;
  payPerTask: number;            // Gold earned per task
  skillRequired: string | null;  // Skill type needed (null = unskilled)
  skillMinLevel: number;         // Minimum skill level
  reputationRequired: number;    // Social capital needed with employer
  taskDuration: number;          // Game ticks to complete one task
  taskDescription: string;       // What the player sees while working
  completionMessage: string;     // What they see when task is done
}

export const jobDefinitions: JobDefinition[] = [
  // === UNSKILLED LABOR ===
  // Anyone can do these jobs - great for newcomers
  {
    id: 1,
    name: 'Street Sweeper',
    employerNpcId: 112, // Village Elder Moondog
    location: 'village_square',
    description: 'Keep the village square clean. Sweep the cobblestones, collect trash, make the place presentable.',
    payPerTask: 3,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: -20, // Even strangers can do this
    taskDuration: 3,
    taskDescription: 'sweeping the cobblestones',
    completionMessage: 'The village square looks a bit cleaner now.',
  },
  {
    id: 2,
    name: 'Farm Hand',
    employerNpcId: 10, // Farmer Rutherford
    location: 'farmlands',
    description: 'Help Farmer Rutherford with the harvest. Pull weeds, carry baskets, tend the crops.',
    payPerTask: 5,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: 0, // Need to be on neutral terms at least
    taskDuration: 4,
    taskDescription: 'tending the crops',
    completionMessage: 'Rutherford nods approvingly at your work.',
  },
  {
    id: 3,
    name: 'Stable Hand',
    employerNpcId: 114, // Innkeeper Antelope
    location: 'the_inn',
    description: 'Care for the inn\'s animals. Clean stalls, feed livestock, brush the horses.',
    payPerTask: 4,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: 0,
    taskDuration: 3,
    taskDescription: 'mucking out the stables',
    completionMessage: 'The animals seem happier for your care.',
  },
  {
    id: 4,
    name: 'Messenger',
    employerNpcId: 112, // Village Elder Moondog
    location: 'village_square',
    description: 'Deliver messages between villagers. Fast legs and good memory required.',
    payPerTask: 8,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: 10, // Need to be known/trusted slightly
    taskDuration: 5,
    taskDescription: 'running messages across the village',
    completionMessage: 'Message delivered successfully!',
  },
  {
    id: 5,
    name: 'Water Carrier',
    employerNpcId: null, // General labor
    location: 'river_crossing',
    description: 'Carry water from the river to villagers who need it. Simple but honest work.',
    payPerTask: 3,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: -50, // Even hated people can do this
    taskDuration: 2,
    taskDescription: 'hauling water from the river',
    completionMessage: 'Another load of fresh water delivered.',
  },

  // === SKILLED LABOR ===
  // These require either training or natural talent
  {
    id: 10,
    name: 'Baker\'s Assistant',
    employerNpcId: 113, // Baker Possum
    location: 'market_district',
    description: 'Help the baker knead dough, mind the ovens, and serve customers.',
    payPerTask: 8,
    skillRequired: 'cooking',
    skillMinLevel: 5,
    reputationRequired: 10,
    taskDuration: 4,
    taskDescription: 'helping in the bakery',
    completionMessage: 'The smell of fresh bread fills the air.',
  },
  {
    id: 11,
    name: 'Smith\'s Helper',
    employerNpcId: 115, // Blacksmith Gordo
    location: 'blacksmith_forge',
    description: 'Work the bellows, fetch materials, and learn the basics of smithing.',
    payPerTask: 10,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: 15,
    taskDuration: 5,
    taskDescription: 'working the forge bellows',
    completionMessage: 'Gordo grunts in approval. The metal glows hot.',
  },
  {
    id: 12,
    name: 'Inn Server',
    employerNpcId: 114, // Innkeeper Antelope
    location: 'the_inn',
    description: 'Serve food and drink to guests. Tips possible from satisfied customers!',
    payPerTask: 6,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: 10,
    taskDuration: 2,
    taskDescription: 'serving the inn\'s customers',
    completionMessage: 'Plates cleared, mugs refilled. The customers seem satisfied.',
  },
  {
    id: 13,
    name: 'Healer\'s Apprentice',
    employerNpcId: 121, // Healer Esther
    location: 'market_district',
    description: 'Gather herbs, prepare poultices, and learn the healing arts.',
    payPerTask: 7,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: 20,
    taskDuration: 4,
    taskDescription: 'preparing herbal remedies',
    completionMessage: 'Another batch of healing salve prepared.',
  },

  // === SPECIALIZED JOBS ===
  // High requirements, high pay
  {
    id: 20,
    name: 'Fisherman\'s Mate',
    employerNpcId: 120, // Fisherman Harpua
    location: 'river_crossing',
    description: 'Learn to fish the rivers of Gamehenge. Patience is key.',
    payPerTask: 10,
    skillRequired: 'fishing',
    skillMinLevel: 10,
    reputationRequired: 25,
    taskDuration: 6,
    taskDescription: 'fishing with Harpua',
    completionMessage: 'A good catch today! Harpua tells another tall tale.',
  },
  {
    id: 21,
    name: 'Guard Patrol',
    employerNpcId: 108, // Guard Captain Sloth
    location: 'guard_barracks',
    description: 'Walk patrol routes, watch for trouble. Working for Wilson\'s guard...',
    payPerTask: 20,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: -10, // Wilson's guards aren't picky
    taskDuration: 8,
    taskDescription: 'walking patrol routes',
    completionMessage: 'Another uneventful patrol. Is that good or bad?',
  },
  {
    id: 22,
    name: 'Resistance Courier',
    employerNpcId: 3, // Tela
    location: 'tela_cottage',
    description: 'Carry secret messages for the resistance. Dangerous but vital work.',
    payPerTask: 25,
    skillRequired: null,
    skillMinLevel: 0,
    reputationRequired: 50, // Must be trusted by Tela
    taskDuration: 10,
    taskDescription: 'delivering secret resistance messages',
    completionMessage: 'The message reaches its destination safely. The resistance grows stronger.',
  },
];

// Helper to get job by ID
export function getJobById(id: number): JobDefinition | undefined {
  return jobDefinitions.find(j => j.id === id);
}

// Get jobs available at a location
export function getJobsAtLocation(roomId: string): JobDefinition[] {
  return jobDefinitions.filter(j => j.location === roomId);
}

// Get jobs offered by an NPC
export function getJobsByEmployer(npcId: number): JobDefinition[] {
  return jobDefinitions.filter(j => j.employerNpcId === npcId);
}
