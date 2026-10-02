// Comprehensive NCERT-aligned chapter curriculum for YNeet content generation.
// Covers every class level the app supports (6th–12th + Dropper) across the
// three NEET subjects. Classes 6–10 follow the single NCERT "Science" book,
// so topics are bucketed into Physics / Chemistry / Biology by subject matter.
// Classes 11–12 use the real separate NCERT Physics/Chemistry/Biology books.
// Dropper = full NEET syllabus = Class 11 + Class 12 chapters combined
// (this is what repeater/dropper batches actually re-cover).

export const CLASS_LEVELS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th", "Dropper"];
export const SUBJECTS = ["Physics", "Chemistry", "Biology"];

export const CURRICULUM = {
  "6th": {
    Physics: [
      "Motion and Measurement of Distances",
      "Light, Shadows and Reflections",
      "Electricity and Circuits",
      "Fun with Magnets",
    ],
    Chemistry: [
      "Components of Food",
      "Sorting Materials into Groups",
      "Separation of Substances",
      "Changes Around Us",
    ],
    Biology: [
      "Getting to Know Plants",
      "Body Movements",
      "The Living Organisms and Their Surroundings",
      "Air Around Us",
      "Water",
      "Garbage In, Garbage Out",
    ],
  },
  "7th": {
    Physics: [
      "Heat",
      "Motion and Time",
      "Electric Current and Its Effects",
      "Light",
      "Water: A Precious Resource",
    ],
    Chemistry: [
      "Acids, Bases and Salts",
      "Physical and Chemical Changes",
      "Fibre to Fabric",
    ],
    Biology: [
      "Nutrition in Plants",
      "Nutrition in Animals",
      "Weather, Climate and Adaptations of Animals to Climate",
      "Respiration in Organisms",
      "Transportation in Animals and Plants",
      "Reproduction in Plants",
      "Forests: Our Lifeline",
      "Wastewater Story",
    ],
  },
  "8th": {
    Physics: [
      "Force and Pressure",
      "Friction",
      "Sound",
      "Chemical Effects of Electric Current",
      "Some Natural Phenomena",
      "Light",
      "Stars and the Solar System",
    ],
    Chemistry: [
      "Synthetic Fibres and Plastics",
      "Metals and Non-Metals",
      "Coal and Petroleum",
      "Combustion and Flame",
      "Pollution of Air and Water",
    ],
    Biology: [
      "Crop Production and Management",
      "Microorganisms: Friend and Foe",
      "Conservation of Plants and Animals",
      "Cell — Structure and Functions",
      "Reproduction in Animals",
      "Reaching the Age of Adolescence",
    ],
  },
  "9th": {
    Physics: [
      "Motion",
      "Force and Laws of Motion",
      "Gravitation",
      "Work and Energy",
      "Sound",
    ],
    Chemistry: [
      "Matter in Our Surroundings",
      "Is Matter Around Us Pure",
      "Atoms and Molecules",
      "Structure of the Atom",
    ],
    Biology: [
      "The Fundamental Unit of Life",
      "Tissues",
      "Diversity in Living Organisms",
      "Why Do We Fall Ill",
      "Natural Resources",
      "Improvement in Food Resources",
    ],
  },
  "10th": {
    Physics: [
      "Light — Reflection and Refraction",
      "The Human Eye and the Colourful World",
      "Electricity",
      "Magnetic Effects of Electric Current",
      "Sources of Energy",
    ],
    Chemistry: [
      "Chemical Reactions and Equations",
      "Acids, Bases and Salts",
      "Metals and Non-metals",
      "Carbon and Its Compounds",
      "Periodic Classification of Elements",
    ],
    Biology: [
      "Life Processes",
      "Control and Coordination",
      "How do Organisms Reproduce?",
      "Heredity and Evolution",
      "Our Environment",
      "Management of Natural Resources",
    ],
  },
  "11th": {
    Physics: [
      "Physical World and Measurement",
      "Kinematics",
      "Laws of Motion",
      "Work, Energy and Power",
      "System of Particles and Rotational Motion",
      "Gravitation",
      "Mechanical Properties of Solids",
      "Mechanical Properties of Fluids",
      "Thermal Properties of Matter",
      "Thermodynamics",
      "Kinetic Theory",
      "Oscillations",
      "Waves",
    ],
    Chemistry: [
      "Some Basic Concepts of Chemistry",
      "Structure of Atom",
      "Classification of Elements and Periodicity in Properties",
      "Chemical Bonding and Molecular Structure",
      "States of Matter",
      "Thermodynamics",
      "Equilibrium",
      "Redox Reactions",
      "Hydrogen",
      "The s-Block Elements",
      "The p-Block Elements (Group 13 & 14)",
      "Organic Chemistry — Some Basic Principles and Techniques",
      "Hydrocarbons",
    ],
    Biology: [
      "The Living World",
      "Biological Classification",
      "Plant Kingdom",
      "Animal Kingdom",
      "Morphology of Flowering Plants",
      "Anatomy of Flowering Plants",
      "Structural Organisation in Animals",
      "Cell — The Unit of Life",
      "Biomolecules",
      "Cell Cycle and Cell Division",
      "Transport in Plants",
      "Mineral Nutrition",
      "Photosynthesis in Higher Plants",
      "Respiration in Plants",
      "Plant Growth and Development",
      "Digestion and Absorption",
      "Breathing and Exchange of Gases",
      "Body Fluids and Circulation",
      "Excretory Products and Their Elimination",
      "Locomotion and Movement",
      "Neural Control and Coordination",
      "Chemical Coordination and Integration",
    ],
  },
  "12th": {
    Physics: [
      "Electric Charges and Fields",
      "Electrostatic Potential and Capacitance",
      "Current Electricity",
      "Moving Charges and Magnetism",
      "Magnetism and Matter",
      "Electromagnetic Induction",
      "Alternating Current",
      "Electromagnetic Waves",
      "Ray Optics and Optical Instruments",
      "Wave Optics",
      "Dual Nature of Radiation and Matter",
      "Atoms",
      "Nuclei",
      "Semiconductor Electronics",
    ],
    Chemistry: [
      "Solid State",
      "Solutions",
      "Electrochemistry",
      "Chemical Kinetics",
      "Surface Chemistry",
      "General Principles and Processes of Isolation of Elements",
      "The p-Block Elements (Group 15–18)",
      "The d- and f-Block Elements",
      "Coordination Compounds",
      "Haloalkanes and Haloarenes",
      "Alcohols, Phenols and Ethers",
      "Aldehydes, Ketones and Carboxylic Acids",
      "Amines",
      "Biomolecules",
      "Polymers",
      "Chemistry in Everyday Life",
    ],
    Biology: [
      "Sexual Reproduction in Flowering Plants",
      "Human Reproduction",
      "Reproductive Health",
      "Principles of Inheritance and Variation",
      "Molecular Basis of Inheritance",
      "Evolution",
      "Human Health and Disease",
      "Strategies for Enhancement in Food Production",
      "Microbes in Human Welfare",
      "Biotechnology — Principles and Processes",
      "Biotechnology and Its Applications",
      "Organisms and Populations",
      "Ecosystem",
      "Biodiversity and Conservation",
    ],
  },
};

// Dropper repeats the complete NEET syllabus — Class 11 + Class 12 chapters.
CURRICULUM["Dropper"] = {
  Physics: [...CURRICULUM["11th"].Physics, ...CURRICULUM["12th"].Physics],
  Chemistry: [...CURRICULUM["11th"].Chemistry, ...CURRICULUM["12th"].Chemistry],
  Biology: [...CURRICULUM["11th"].Biology, ...CURRICULUM["12th"].Biology],
};

// Flat list of every {classLevel, subject, chapter} combination — the master
// worklist the Bulk Generator UI walks through.
export function getAllChapterEntries() {
  const entries = [];
  for (const classLevel of CLASS_LEVELS) {
    for (const subject of SUBJECTS) {
      const chapters = CURRICULUM[classLevel]?.[subject] || [];
      for (const chapter of chapters) {
        entries.push({ classLevel, subject, chapter });
      }
    }
  }
  return entries;
}

// Suggested minimum content targets per chapter, used to flag coverage gaps.
// NEET-style prep needs real depth per chapter, not a token handful.
export const TARGETS_PER_CHAPTER = {
  question: 25,
  flashcard: 10,
  formula: 8, // only meaningful for Physics/Chemistry; Biology chapters can skip formulas
};
