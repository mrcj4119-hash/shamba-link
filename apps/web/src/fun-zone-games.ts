export interface FunZoneQuestion {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface FunZonePair {
  left: string;
  right: string;
}

export interface FunZoneScramble {
  word: string;
  clue: string;
}

interface QuizGame {
  id: string;
  title: string;
  description: string;
  kind: "quiz";
  questions: FunZoneQuestion[];
}

interface MemoryGame {
  id: string;
  title: string;
  description: string;
  kind: "memory";
  pairs: FunZonePair[];
}

interface ScrambleGame {
  id: string;
  title: string;
  description: string;
  kind: "scramble";
  words: FunZoneScramble[];
}

export type FunZoneGame = QuizGame | MemoryGame | ScrambleGame;

const quizGames: QuizGame[] = [
  {
    id: "garden-detective",
    title: "Garden Detective",
    description: "Follow the clues to discover what plants need to thrive.",
    kind: "quiz",
    questions: [
      { prompt: "Which plant part takes in most of the water?", options: ["Roots", "Flowers", "Fruit"], answer: "Roots", explanation: "Roots take up water and nutrients and help anchor a plant." },
      { prompt: "What do seeds need to begin sprouting?", options: ["Water, air and the right warmth", "Paint and music", "Only bright lights"], answer: "Water, air and the right warmth", explanation: "Many seeds sprout when they have moisture, oxygen and suitable warmth." },
      { prompt: "What do leaves use sunlight to help make?", options: ["Food for the plant", "More soil", "Rain clouds"], answer: "Food for the plant", explanation: "Leaves use sunlight, air and water to make food for the plant." },
    ],
  },
  {
    id: "soil-superpowers",
    title: "Soil Superpowers",
    description: "Explore the living world beneath your feet.",
    kind: "quiz",
    questions: [
      { prompt: "Which tiny helpers can improve soil by breaking down old leaves?", options: ["Earthworms and microbes", "Plastic pieces", "Pebbles alone"], answer: "Earthworms and microbes", explanation: "Earthworms and microbes help turn organic matter into useful soil nutrients." },
      { prompt: "What can compost add to a garden?", options: ["Organic matter", "More plastic", "Salt water"], answer: "Organic matter", explanation: "Compost adds organic matter that supports healthy soil." },
      { prompt: "Which cover helps protect soil from washing away?", options: ["Plants or mulch", "Bare ground", "A smooth plastic sheet"], answer: "Plants or mulch", explanation: "Plant cover and mulch help shield soil from wind and heavy rain." },
    ],
  },
  {
    id: "water-wise",
    title: "Water-Wise Choices",
    description: "Make smart choices to help every drop go further.",
    kind: "quiz",
    questions: [
      { prompt: "When is watering often gentler on plants and less wasteful?", options: ["Early morning", "The hottest part of the day", "Only during strong wind"], answer: "Early morning", explanation: "Early watering gives plants time to take up water before the heat of the day." },
      { prompt: "What can a layer of mulch help a garden do?", options: ["Keep moisture in the soil", "Make rain stop", "Turn soil into stone"], answer: "Keep moisture in the soil", explanation: "Mulch can slow evaporation and protect the soil surface." },
      { prompt: "What is a sensible way to water a small garden?", options: ["Water near the roots when needed", "Leave a tap running all day", "Pour water onto the path"], answer: "Water near the roots when needed", explanation: "Targeted watering helps water reach the plants that need it." },
    ],
  },
  {
    id: "pollinator-patrol",
    title: "Pollinator Patrol",
    description: "Spot the helpful visitors that support flowering plants.",
    kind: "quiz",
    questions: [
      { prompt: "What do bees often carry between flowers?", options: ["Pollen", "Pebbles", "Seeds of grass"], answer: "Pollen", explanation: "Bees can carry pollen from flower to flower as they visit for nectar." },
      { prompt: "Why are pollinators helpful to many farms?", options: ["They help some plants make fruits and seeds", "They water every field", "They make the soil disappear"], answer: "They help some plants make fruits and seeds", explanation: "Pollination helps many flowering plants produce fruits and seeds." },
      { prompt: "Which is a kind way to support pollinators?", options: ["Grow a variety of flowers", "Remove every flowering plant", "Disturb nests for fun"], answer: "Grow a variety of flowers", explanation: "A range of flowers can provide food for different pollinators." },
    ],
  },
  {
    id: "seed-to-sprout",
    title: "Seed-to-Sprout",
    description: "Put your plant-growing knowledge to the test.",
    kind: "quiz",
    questions: [
      { prompt: "What is the first small root from a sprouting seed called?", options: ["Radicle", "Petal", "Fruit"], answer: "Radicle", explanation: "The radicle is the first root to emerge from a germinating seed." },
      { prompt: "Why should seeds be planted at a suitable depth?", options: ["So seedlings can emerge and access moisture", "So they never receive water", "To keep them away from soil"], answer: "So seedlings can emerge and access moisture", explanation: "Planting depth affects access to moisture and a seedling's ability to emerge." },
      { prompt: "What does a young seedling need as it grows?", options: ["Light, water and room", "Candy and a hat", "A sealed dark box"], answer: "Light, water and room", explanation: "Seedlings need suitable light, water and space to grow." },
    ],
  },
  {
    id: "weather-watch",
    title: "Weather Watch",
    description: "Read the sky and think ahead about farm weather.",
    kind: "quiz",
    questions: [
      { prompt: "What can a rain gauge help you measure?", options: ["Rainfall", "Wind direction", "Soil color"], answer: "Rainfall", explanation: "A rain gauge collects and measures how much rain has fallen." },
      { prompt: "What is a sensible step before a very hot day?", options: ["Check plants and plan water use", "Ignore wilting plants", "Remove all shade"], answer: "Check plants and plan water use", explanation: "Planning can help protect plants and use available water wisely." },
      { prompt: "What does a weather forecast help people do?", options: ["Plan ahead", "Control the clouds", "Guarantee every harvest"], answer: "Plan ahead", explanation: "Forecasts help people prepare, even though weather can still change." },
    ],
  },
  {
    id: "friendly-pest-spotter",
    title: "Friendly Pest Spotter",
    description: "Practice noticing crop changes before choosing what to do.",
    kind: "quiz",
    questions: [
      { prompt: "You spot holes in a few leaves. What is a good first step?", options: ["Look closely and record what you see", "Mix several sprays straight away", "Pull up every nearby plant"], answer: "Look closely and record what you see", explanation: "Careful observation helps identify a problem before choosing a response." },
      { prompt: "Why can helpful insects be welcome in a garden?", options: ["Some eat pests or pollinate flowers", "They all damage every crop", "They replace sunlight"], answer: "Some eat pests or pollinate flowers", explanation: "Many insects play useful roles, including pollination and pest control." },
      { prompt: "What can crop rotation help with?", options: ["Breaking some pest cycles", "Making crops grow overnight", "Removing the need for soil"], answer: "Breaking some pest cycles", explanation: "Rotating crops can reduce the build-up of some crop-specific pests." },
    ],
  },
  {
    id: "healthy-harvest",
    title: "Healthy Harvest",
    description: "Celebrate the colors, crops and care behind good food.",
    kind: "quiz",
    questions: [
      { prompt: "Which of these is a leafy vegetable?", options: ["Kale", "Maize", "Cassava"], answer: "Kale", explanation: "Kale, also called sukuma wiki, is grown for its nutritious leaves." },
      { prompt: "Which crop is a protein-rich legume?", options: ["Beans", "Mango", "Wheat"], answer: "Beans", explanation: "Beans are legumes and provide plant-based protein." },
      { prompt: "Why wash fresh produce before eating it?", options: ["To remove dirt and help keep it clean", "To make it grow bigger", "To change its color"], answer: "To remove dirt and help keep it clean", explanation: "Rinsing produce with clean water helps remove soil and debris." },
    ],
  },
  {
    id: "animal-care",
    title: "Farm Animal Care",
    description: "Choose kind, thoughtful ways to care for farm animals.",
    kind: "quiz",
    questions: [
      { prompt: "What should animals always have access to?", options: ["Clean water", "Sugary drinks", "A noisy space"], answer: "Clean water", explanation: "Clean, fresh water is essential for animals." },
      { prompt: "What is a good way to notice if an animal may be unwell?", options: ["Watch for changes in behavior or appetite", "Ignore changes", "Give random medicine"], answer: "Watch for changes in behavior or appetite", explanation: "Noticing and recording changes helps an owner seek appropriate advice." },
      { prompt: "Who can help when a farm animal seems ill?", options: ["A veterinarian or animal-health worker", "A random internet guess", "No one"], answer: "A veterinarian or animal-health worker", explanation: "Animal-health professionals can assess an animal and advise on care." },
    ],
  },
  {
    id: "farm-facts",
    title: "Farm Facts Challenge",
    description: "A little bit of everything for curious minds of every age.",
    kind: "quiz",
    questions: [
      { prompt: "Which is a cereal crop?", options: ["Maize", "Bean", "Mango"], answer: "Maize", explanation: "Maize is a cereal grain and an important staple food." },
      { prompt: "What is crop rotation?", options: ["Growing different crops in a planned sequence", "Spinning a seed in your hand", "Watering only one plant"], answer: "Growing different crops in a planned sequence", explanation: "Crop rotation changes what is grown in a field over time." },
      { prompt: "Which crop is a root crop?", options: ["Cassava", "Coffee", "Cotton"], answer: "Cassava", explanation: "Cassava is grown for its edible roots." },
    ],
  },
];

const memoryGames: MemoryGame[] = [
  {
    id: "crop-pair-up",
    title: "Crop Pair-Up",
    description: "Find crops and the foods or materials they give us.",
    kind: "memory",
    pairs: [{ left: "Maize", right: "Staple grain" }, { left: "Beans", right: "Protein-rich legume" }, { left: "Cassava", right: "Edible root" }, { left: "Cotton", right: "Textile fibre" }],
  },
  {
    id: "tool-time-match",
    title: "Tool Time Match",
    description: "Pair familiar garden tools with the jobs they help us do.",
    kind: "memory",
    pairs: [{ left: "Watering can", right: "Water plants" }, { left: "Hoe", right: "Loosen soil" }, { left: "Rake", right: "Gather leaves" }, { left: "Trowel", right: "Dig small holes" }],
  },
  {
    id: "farm-friends",
    title: "Farm Friends",
    description: "Match farm animals with the things they provide or do.",
    kind: "memory",
    pairs: [{ left: "Hen", right: "Lays eggs" }, { left: "Bee", right: "Pollinates flowers" }, { left: "Cow", right: "Provides milk" }, { left: "Earthworm", right: "Helps soil" }],
  },
  {
    id: "fruit-and-veg-match",
    title: "Fruit & Veg Match",
    description: "Pair colorful produce with its plant part.",
    kind: "memory",
    pairs: [{ left: "Carrot", right: "Root" }, { left: "Kale", right: "Leaf" }, { left: "Mango", right: "Fruit" }, { left: "Cauliflower", right: "Flower" }],
  },
  {
    id: "nature-match",
    title: "Nature Match",
    description: "Match nature's helpers with the jobs they do.",
    kind: "memory",
    pairs: [{ left: "Sunlight", right: "Helps plants make food" }, { left: "Roots", right: "Take up water" }, { left: "Mulch", right: "Keeps soil moist" }, { left: "Compost", right: "Adds organic matter" }],
  },
];

const scrambleGames: ScrambleGame[] = [
  {
    id: "crop-word-mix",
    title: "Crop Word Mix",
    description: "Unscramble everyday crop names with a helpful clue.",
    kind: "scramble",
    words: [{ word: "MAIZE", clue: "A familiar staple cereal" }, { word: "BEANS", clue: "A protein-rich legume" }, { word: "KALE", clue: "A leafy vegetable also called sukuma wiki" }],
  },
  {
    id: "fruit-scramble",
    title: "Fruit Scramble",
    description: "Rearrange the letters to reveal tasty fruit.",
    kind: "scramble",
    words: [{ word: "MANGO", clue: "A sweet tropical fruit" }, { word: "GUAVA", clue: "A fragrant fruit with many small seeds" }, { word: "PAPAYA", clue: "An orange-fleshed tropical fruit" }],
  },
  {
    id: "garden-word-mix",
    title: "Garden Word Mix",
    description: "Untangle the words you'll find in a garden.",
    kind: "scramble",
    words: [{ word: "SEED", clue: "A tiny start for a new plant" }, { word: "SOIL", clue: "Plants grow in this" }, { word: "ROOT", clue: "The plant part that takes up water" }],
  },
  {
    id: "green-farm-words",
    title: "Green Farm Words",
    description: "Solve a few nature-friendly words at your own pace.",
    kind: "scramble",
    words: [{ word: "WATER", clue: "Plants need this to grow" }, { word: "LEAF", clue: "A green plant part" }, { word: "BLOOM", clue: "Another word for a flower" }],
  },
  {
    id: "harvest-anagrams",
    title: "Harvest Anagrams",
    description: "Can you put these harvest words back together?",
    kind: "scramble",
    words: [{ word: "WHEAT", clue: "A grain used to make flour" }, { word: "RICE", clue: "A grain enjoyed in many meals" }, { word: "FRUIT", clue: "A sweet plant food that often contains seeds" }],
  },
];

export const funZoneGames: FunZoneGame[] = [
  ...quizGames,
  ...memoryGames,
  ...scrambleGames,
];
