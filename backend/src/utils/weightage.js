// NEET chapter weightage — how many questions each NCERT chapter is worth in
// an average NEET paper. Powers the Chapter Priority map (/weightage) and the
// weightage-based study plan.
//
// BASELINE below = approximate average questions per paper from recent NEET
// papers. Chapter names match frontend/src/utils/curriculum.js exactly.
// The numbers are normalised per subject so they add up to the real paper
// (Physics 45, Chemistry 45, Biology 90). When the question bank holds enough
// tagged PYQs, weightageController blends in the bank's own counts.

const SUBJECT_TOTAL = { Physics: 45, Chemistry: 45, Biology: 90 };

const BASELINE = {
  "11th": {
    Physics: {
      "Physical World and Measurement": 1.5,
      "Kinematics": 2.5,
      "Laws of Motion": 2,
      "Work, Energy and Power": 2,
      "System of Particles and Rotational Motion": 2.5,
      "Gravitation": 2,
      "Mechanical Properties of Solids": 1,
      "Mechanical Properties of Fluids": 1.5,
      "Thermal Properties of Matter": 1.5,
      "Thermodynamics": 2,
      "Kinetic Theory": 1.5,
      "Oscillations": 1.5,
      "Waves": 1.5,
    },
    Chemistry: {
      "Some Basic Concepts of Chemistry": 2,
      "Structure of Atom": 2,
      "Classification of Elements and Periodicity in Properties": 1.5,
      "Chemical Bonding and Molecular Structure": 4,
      "States of Matter": 1,
      "Thermodynamics": 2,
      "Equilibrium": 3,
      "Redox Reactions": 1,
      "Hydrogen": 0.5,
      "The s-Block Elements": 1,
      "The p-Block Elements (Group 13 & 14)": 1,
      "Organic Chemistry — Some Basic Principles and Techniques": 3,
      "Hydrocarbons": 2,
    },
    Biology: {
      "The Living World": 1,
      "Biological Classification": 2.5,
      "Plant Kingdom": 3,
      "Animal Kingdom": 4,
      "Morphology of Flowering Plants": 3,
      "Anatomy of Flowering Plants": 2.5,
      "Structural Organisation in Animals": 2.5,
      "Cell — The Unit of Life": 3,
      "Biomolecules": 2.5,
      "Cell Cycle and Cell Division": 2.5,
      "Transport in Plants": 0.5,
      "Mineral Nutrition": 0.5,
      "Photosynthesis in Higher Plants": 2.5,
      "Respiration in Plants": 2,
      "Plant Growth and Development": 2,
      "Digestion and Absorption": 0.5,
      "Breathing and Exchange of Gases": 2,
      "Body Fluids and Circulation": 2.5,
      "Excretory Products and Their Elimination": 2,
      "Locomotion and Movement": 2.5,
      "Neural Control and Coordination": 2.5,
      "Chemical Coordination and Integration": 2.5,
    },
  },
  "12th": {
    Physics: {
      "Electric Charges and Fields": 2,
      "Electrostatic Potential and Capacitance": 2,
      "Current Electricity": 3,
      "Moving Charges and Magnetism": 2.5,
      "Magnetism and Matter": 1,
      "Electromagnetic Induction": 1.5,
      "Alternating Current": 1.5,
      "Electromagnetic Waves": 1,
      "Ray Optics and Optical Instruments": 3,
      "Wave Optics": 1.5,
      "Dual Nature of Radiation and Matter": 2,
      "Atoms": 1.5,
      "Nuclei": 1.5,
      "Semiconductor Electronics": 3,
    },
    Chemistry: {
      "Solid State": 0.5,
      "Solutions": 2,
      "Electrochemistry": 2,
      "Chemical Kinetics": 2,
      "Surface Chemistry": 0.5,
      "General Principles and Processes of Isolation of Elements": 0.5,
      "The p-Block Elements (Group 15–18)": 2.5,
      "The d- and f-Block Elements": 2,
      "Coordination Compounds": 3,
      "Haloalkanes and Haloarenes": 1.5,
      "Alcohols, Phenols and Ethers": 2,
      "Aldehydes, Ketones and Carboxylic Acids": 2.5,
      "Amines": 1.5,
      "Biomolecules": 1.5,
      "Polymers": 0.5,
      "Chemistry in Everyday Life": 0.5,
    },
    Biology: {
      "Sexual Reproduction in Flowering Plants": 3.5,
      "Human Reproduction": 3,
      "Reproductive Health": 2.5,
      "Principles of Inheritance and Variation": 5,
      "Molecular Basis of Inheritance": 5,
      "Evolution": 2.5,
      "Human Health and Disease": 3,
      "Strategies for Enhancement in Food Production": 1,
      "Microbes in Human Welfare": 2,
      "Biotechnology — Principles and Processes": 3,
      "Biotechnology and Its Applications": 3,
      "Organisms and Populations": 3,
      "Ecosystem": 3,
      "Biodiversity and Conservation": 2.5,
    },
  },
};

// Loose key so "Cell: The Unit of Life" in the bank matches "Cell — The Unit of Life".
const keyOf = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

// Flat list of every NEET chapter with its normalised expected questions per paper.
function baselineChapters() {
  const out = [];
  for (const subject of Object.keys(SUBJECT_TOTAL)) {
    const raw = [];
    for (const classLevel of ["11th", "12th"]) {
      for (const [chapter, q] of Object.entries(BASELINE[classLevel][subject])) raw.push({ classLevel, subject, chapter, raw: q });
    }
    const sum = raw.reduce((a, r) => a + r.raw, 0);
    for (const r of raw) out.push({ classLevel: r.classLevel, subject, chapter: r.chapter, key: keyOf(r.chapter), baseline: (r.raw / sum) * SUBJECT_TOTAL[subject] });
  }
  return out;
}

// Which chapters a student's map covers. Class 11 → 11th, Class 12 → 12th,
// Dropper → the full syllabus. Class 6–10 get no map (not NEET syllabus yet).
function scopeClasses(studentClass) {
  if (studentClass === "11th") return ["11th"];
  if (studentClass === "12th") return ["12th"];
  if (studentClass === "Dropper") return ["11th", "12th"];
  return [];
}

module.exports = { SUBJECT_TOTAL, baselineChapters, scopeClasses, keyOf };
