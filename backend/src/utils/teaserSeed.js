// The first 10 Brain Teasers (Class 6–8 NCERT Science), written and checked by
// hand, scheduled on the next 10 free Wednesdays. Runs once: a row in
// weekly.seeds marks it done, so redeploys never add them again. Edit,
// reschedule or unpublish any of them in Admin → Weekly series.
const W = require("./weekly");

const SEED_KEY = "teasers-launch-2026-11";

const TEASERS = [
  {
    title: "Who am I?", topic: "Air around us · Class 6–7",
    clues: ["I am a gas you cannot see or smell.", "You breathe me out all day.", "Plants take me in to make their food."],
    options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], answer: 1,
    explanation: "We breathe out carbon dioxide. Green plants take it in and use it, with water and sunlight, to make food by photosynthesis.",
  },
  {
    title: "Who am I?", topic: "Force and pressure · Class 8",
    clues: ["I pull everything towards the Earth.", "I make an apple fall from a tree.", "I keep the Moon going around the Earth."],
    options: ["Friction", "Magnetic force", "Gravity", "Muscular force"], answer: 2,
    explanation: "Gravity (the gravitational force) pulls objects towards the Earth. It also keeps the Moon moving around the Earth.",
  },
  {
    title: "Who am I?", topic: "Acids, bases and salts · Class 7",
    clues: ["I am a natural indicator.", "I am made from lichens.", "I turn red in acids and blue in bases."],
    options: ["Turmeric", "Litmus", "China rose", "Onion"], answer: 1,
    explanation: "Litmus is extracted from lichens. Blue litmus turns red in an acid, and red litmus turns blue in a base.",
  },
  {
    title: "What am I?", topic: "Transportation in animals · Class 7",
    clues: ["I am an organ that pumps blood.", "I beat about 72 times a minute when you rest.", "A doctor listens to me with a stethoscope."],
    options: ["Lungs", "Kidney", "Liver", "Heart"], answer: 3,
    explanation: "The heart pumps blood all around the body. A resting adult's heart beats about 72 times a minute, and a stethoscope lets a doctor hear it.",
  },
  {
    title: "What am I?", topic: "Metals and non-metals · Class 8",
    clues: ["I am a metal.", "I am liquid at room temperature.", "I was used in old thermometers."],
    options: ["Mercury", "Lead", "Aluminium", "Sodium"], answer: 0,
    explanation: "Mercury is the only metal that is liquid at room temperature. That is why it was used in thermometers.",
  },
  {
    title: "What am I?", topic: "Water / Changes around us · Class 6",
    clues: ["I change water into water vapour.", "I happen faster on a hot, windy day.", "Wet clothes dry because of me."],
    options: ["Evaporation", "Condensation", "Melting", "Freezing"], answer: 0,
    explanation: "Evaporation changes liquid water into water vapour. Heat and wind speed it up, which is why clothes dry faster on hot, windy days.",
  },
  {
    title: "What am I?", topic: "Nutrition in plants · Class 7",
    clues: ["I am a tiny pore on a leaf.", "Gases go in and out through me.", "Guard cells open and close me."],
    options: ["Chlorophyll", "Xylem", "Vein", "Stomata"], answer: 3,
    explanation: "Stomata are tiny pores on leaves. Carbon dioxide and oxygen pass through them, and guard cells open and close each pore.",
  },
  {
    title: "What am I?", topic: "Coal and petroleum · Class 8",
    clues: ["I formed from dead plants buried millions of years ago.", "I am black and hard.", "Power plants burn me to make electricity."],
    options: ["Petroleum", "Natural gas", "Wood", "Coal"], answer: 3,
    explanation: "Coal formed from plants buried deep under the earth for millions of years. It is burnt in thermal power plants to produce electricity.",
  },
  {
    title: "Who am I?", topic: "Micro-organisms · Class 8",
    clues: ["I am a tiny living thing you need a microscope to see.", "I am a bacterium.", "I turn milk into curd."],
    options: ["Yeast", "Lactobacillus", "Rhizobium", "Amoeba"], answer: 1,
    explanation: "Lactobacillus is a bacterium that turns milk into curd. Yeast is a fungus used in baking bread.",
  },
  {
    title: "What am I?", topic: "Nutrition in plants · Class 7",
    clues: ["I am a green pigment.", "I am found in the leaves of plants.", "I trap sunlight so plants can make food."],
    options: ["Haemoglobin", "Melanin", "Chlorophyll", "Keratin"], answer: 2,
    explanation: "Chlorophyll is the green pigment in leaves. It captures the energy of sunlight for photosynthesis.",
  },
];

async function seedTeasers() {
  await W.ensureTables();
  const p = W.prisma;
  await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS weekly.seeds (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const claimed = await p.$executeRaw`INSERT INTO weekly.seeds (key) VALUES (${SEED_KEY}) ON CONFLICT DO NOTHING`;
  if (!claimed) return; // already done
  const dates = [];
  for (const t of TEASERS) {
    const data = W.cleanTeaser(t);
    const date = await W.nextFreeSlot("teasers", 3, null); // next Wednesday nobody has
    await p.$executeRaw`INSERT INTO weekly.teasers (data, status, publish_on) VALUES (${JSON.stringify(data)}::jsonb, 'approved', ${date})`;
    dates.push(date);
  }
  console.log(`[weekly] seeded ${TEASERS.length} brain teasers: ${dates[0]} … ${dates[dates.length - 1]}`);
}

module.exports = { seedTeasers, TEASERS };
