require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const QUESTIONS = [
  // ── BIOLOGY (30 questions) ─────────────────────────────────────────────────
  {subject:"Biology",chapter:"Cell Biology",topic:"Cell Organelles",difficulty:"easy",questionText:"Which organelle is called the powerhouse of the cell?",optionA:"Nucleus",optionB:"Mitochondria",optionC:"Ribosome",optionD:"Golgi body",correctOpt:1,explanation:"Mitochondria produce ATP via cellular respiration. They have double membranes and their own DNA. Mitchondria are sites of aerobic respiration and produce most of the cell's ATP supply.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Biology",chapter:"Molecular Biology",topic:"DNA Replication",difficulty:"easy",questionText:"Meselson and Stahl experiment proved that DNA replication is:",optionA:"Conservative",optionB:"Semi-conservative",optionC:"Dispersive",optionD:"Random",correctOpt:1,explanation:"Using N15-labelled DNA in E.coli (1958), they proved semi-conservative replication — each daughter DNA retains one original strand and one newly synthesized strand.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Biology",chapter:"Genetics",topic:"Mendelian Genetics",difficulty:"easy",questionText:"Phenotypic ratio in F2 of monohybrid cross (Tt × Tt) is:",optionA:"1:2:1",optionB:"3:1",optionC:"9:3:3:1",optionD:"1:1",correctOpt:1,explanation:"F2 of Tt × Tt = TT:Tt:tt = 1:2:1 genotypically. Since T is dominant, TT and Tt appear tall. Phenotypic ratio = 3 Tall:1 Dwarf = 3:1.",isPYQ:true,isRepeated:true,pyqYear:2018},
  {subject:"Biology",chapter:"Human Physiology",topic:"Digestion",difficulty:"medium",questionText:"Which converts pepsinogen to active pepsin?",optionA:"Enterokinase",optionB:"Rennin",optionC:"HCl",optionD:"Lipase",correctOpt:2,explanation:"HCl secreted by parietal (oxyntic) cells of gastric glands converts inactive pepsinogen into active pepsin. HCl also kills bacteria and maintains acidic pH (1.5–2) optimal for pepsin.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Biology",chapter:"Reproduction",topic:"Gametogenesis",difficulty:"medium",questionText:"Corpus luteum secretes which hormone?",optionA:"Estrogen",optionB:"Progesterone",optionC:"FSH",optionD:"LH",correctOpt:1,explanation:"After ovulation, the Graafian follicle transforms into corpus luteum which secretes progesterone. Progesterone maintains endometrium for implantation during early pregnancy.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Biology",chapter:"Ecology",topic:"Food Chain",difficulty:"easy",questionText:"Which is the correct food chain?",optionA:"Grass → Frog → Insect → Snake",optionB:"Grass → Insect → Frog → Snake",optionC:"Insect → Grass → Frog → Snake",optionD:"Frog → Insect → Grass → Snake",correctOpt:1,explanation:"Food chain starts with producer (Grass). Grass→Insect (primary consumer)→Frog (secondary consumer)→Snake (tertiary consumer). Energy flows from producers to consumers.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Biology",chapter:"Evolution",topic:"Origin of Life",difficulty:"medium",questionText:"Miller-Urey experiment showed synthesis of organic molecules from:",optionA:"O2, CO2, N2, H2O",optionB:"CH4, NH3, H2, H2O",optionC:"CO2, H2, O2, N2",optionD:"CH4, CO2, O2, H2O",correctOpt:1,explanation:"Miller and Urey (1953) simulated primitive Earth using CH4, NH3, H2 and H2O with electrical sparks (lightning), producing amino acids — proving abiotic synthesis of organic molecules.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Biology",chapter:"Biotechnology",topic:"Recombinant DNA",difficulty:"hard",questionText:"Restriction enzyme EcoRI cuts at sequence:",optionA:"5'-AAGCTT-3'",optionB:"5'-GAATTC-3'",optionC:"5'-GGATCC-3'",optionD:"5'-CTCGAG-3'",correctOpt:1,explanation:"EcoRI recognizes and cuts at 5'-GAATTC-3', leaving sticky ends 5'-AATT-3'. HindIII cuts AAGCTT; BamHI cuts GGATCC. Restriction enzymes are molecular scissors for genetic engineering.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Biology",chapter:"Cell Division",topic:"Meiosis",difficulty:"easy",questionText:"Crossing over occurs during which stage of meiosis?",optionA:"Leptotene",optionB:"Zygotene",optionC:"Pachytene",optionD:"Diplotene",correctOpt:2,explanation:"Crossing over (exchange of segments between non-sister chromatids of homologous chromosomes) occurs during Pachytene stage of Prophase I of meiosis. This is a key source of genetic variation.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Biology",chapter:"Genetics",topic:"Chromosomal Disorders",difficulty:"medium",questionText:"Turner's syndrome chromosomal formula is:",optionA:"47,XXY",optionB:"45,X0",optionC:"47,XX+21",optionD:"47,XYY",correctOpt:1,explanation:"Turner's syndrome (45,X0) — female with only one X chromosome. Features: short stature, webbed neck, shield chest, infertility. Klinefelter's = 47,XXY. Down syndrome = 47+21.",isPYQ:true,isRepeated:true,pyqYear:2018},
  {subject:"Biology",chapter:"Human Physiology",topic:"Circulation",difficulty:"medium",questionText:"SA node is called pacemaker of the heart because:",optionA:"It is the largest node",optionB:"It generates impulses controlling heart rate",optionC:"It is located between atria and ventricles",optionD:"It is present in both chambers",correctOpt:1,explanation:"SA node (Sinoatrial node) in the right atrium generates electrical impulses at 70-75 beats/min that spread across the heart setting the rhythm. Hence it is the natural pacemaker.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Biology",chapter:"Ecology",topic:"Biodiversity",difficulty:"medium",questionText:"India has how many biodiversity hotspots?",optionA:"1",optionB:"2",optionC:"3",optionD:"4",correctOpt:3,explanation:"India has 4 biodiversity hotspots: (1) Himalayas, (2) Indo-Burma, (3) Western Ghats & Sri Lanka, (4) Sundaland. These regions have exceptional species richness and face threats.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Biology",chapter:"Genetics",topic:"Sex Determination",difficulty:"medium",questionText:"Sex determination in honeybee is by:",optionA:"XX-XO type",optionB:"XX-XY type",optionC:"Haplodiploidy",optionD:"ZW-ZZ type",correctOpt:2,explanation:"Honeybees show haplodiploidy: females (queen, workers) are diploid (2n=32) from fertilized eggs; males (drones) are haploid (n=16) from unfertilized eggs (parthenogenesis).",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Biology",chapter:"Genetics",topic:"Mutation",difficulty:"hard",questionText:"Sickle cell anaemia is caused by substitution of:",optionA:"Valine by Glutamic acid",optionB:"Glutamic acid by Valine",optionC:"Leucine by Valine",optionD:"Glycine by Alanine",correctOpt:1,explanation:"Glutamic acid (position 6 in beta-globin) is replaced by Valine due to a point mutation (GAG→GTG). This causes HbS (sickle haemoglobin) formation and sickling of RBCs under low O2.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Biology",chapter:"Human Physiology",topic:"Excretion",difficulty:"medium",questionText:"The functional unit of kidney is:",optionA:"Glomerulus",optionB:"Nephron",optionC:"Bowman's capsule",optionD:"Loop of Henle",correctOpt:1,explanation:"Nephron is the structural and functional unit of kidney. Each kidney has ~1 million nephrons. Components: Bowman's capsule+glomerulus (filtration)→PCT→Loop of Henle→DCT→collecting duct.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Biology",chapter:"Human Health",topic:"Immunity",difficulty:"medium",questionText:"Which cells are called 'soldiers of the body'?",optionA:"RBC",optionB:"Platelets",optionC:"WBC",optionD:"Plasma cells",correctOpt:2,explanation:"WBC (White Blood Cells/Leukocytes) are called soldiers because they protect against infection. They include neutrophils, lymphocytes, monocytes, eosinophils, basophils.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Biology",chapter:"Plant Physiology",topic:"Respiration",difficulty:"medium",questionText:"Net ATP produced per glucose molecule in aerobic respiration is:",optionA:"2",optionB:"8",optionC:"36-38",optionD:"12",correctOpt:2,explanation:"Complete aerobic oxidation of glucose yields 36-38 ATP: 2 from glycolysis, 2 from Krebs cycle, 32-34 from oxidative phosphorylation (ETC) in mitochondria.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Biology",chapter:"Biotechnology",topic:"Applications",difficulty:"medium",questionText:"Golden rice is rich in:",optionA:"Vitamin A (beta-carotene)",optionB:"Vitamin C",optionC:"Iron",optionD:"Zinc",correctOpt:0,explanation:"Golden rice is a transgenic variety engineered to produce beta-carotene (provitamin A) in the endosperm, giving it a golden colour. It addresses Vitamin A deficiency in developing countries.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Biology",chapter:"Plant Kingdom",topic:"Bryophytes",difficulty:"easy",questionText:"Bryophytes are called amphibians of plant kingdom because:",optionA:"They live in water only",optionB:"They need water for fertilization but live on land",optionC:"They photosynthesize underwater",optionD:"They have both roots and leaves",correctOpt:1,explanation:"Bryophytes (mosses, liverworts) grow on land but require water for fertilization since male gametes are motile (swim to archegonium). Similar to amphibians needing water to reproduce.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Biology",chapter:"Ecology",topic:"Population",difficulty:"medium",questionText:"Which growth model does NOT show carrying capacity?",optionA:"Logistic growth",optionB:"Exponential growth",optionC:"S-shaped curve",optionD:"Verhulst-Pearl equation",correctOpt:1,explanation:"Exponential (J-shaped) growth: dN/dt=rN has no upper limit. Logistic (S-shaped) includes K (carrying capacity): dN/dt=rN(K-N)/K. Carrying capacity = max sustainable population.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Biology",chapter:"Reproduction",topic:"Pollination",difficulty:"easy",questionText:"Which is a character of insect-pollinated flowers?",optionA:"Small inconspicuous flowers",optionB:"Light pollen grains",optionC:"Brightly coloured fragrant flowers",optionD:"Feathery stigma",correctOpt:2,explanation:"Entomophilous (insect-pollinated) flowers are brightly coloured, fragrant, produce nectar, have sticky/spiny pollen. Wind-pollinated flowers are small with light pollen and feathery stigma.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Biology",chapter:"Molecular Biology",topic:"Translation",difficulty:"hard",questionText:"Universal start codon for translation is:",optionA:"AUG only",optionB:"GUG",optionC:"UAG",optionD:"UAA",correctOpt:0,explanation:"AUG (codes for Methionine/fMet) is the universal start codon for translation in all organisms. UAA, UAG, UGA are the three stop/nonsense codons. There are 64 codons total (61 sense+3 stop).",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Biology",chapter:"Human Health",topic:"Drugs and Alcohol",difficulty:"easy",questionText:"Which drug is obtained from Papaver somniferum?",optionA:"Cocaine",optionB:"Morphine",optionC:"Cannabis",optionD:"LSD",correctOpt:1,explanation:"Morphine, heroin and codeine are obtained from latex of unripe seed pods of opium poppy (Papaver somniferum). Cocaine from Erythroxylum coca; Cannabis from Cannabis sativa; LSD synthetic.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Biology",chapter:"Animal Kingdom",topic:"Nervous System",difficulty:"medium",questionText:"Myelin sheath in PNS is produced by:",optionA:"Astrocytes",optionB:"Oligodendrocytes",optionC:"Schwann cells",optionD:"Microglia",correctOpt:2,explanation:"In PNS: Schwann cells produce myelin. In CNS: Oligodendrocytes produce myelin. Myelin increases impulse speed (saltatory conduction). Astrocytes support neurons; microglia are immune cells of brain.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Biology",chapter:"Plant Physiology",topic:"Photosynthesis",difficulty:"medium",questionText:"Which pigment is responsible for red and blue light absorption in plants?",optionA:"Carotenoids",optionB:"Chlorophyll a",optionC:"Xanthophylls",optionD:"Phycocyanin",correctOpt:1,explanation:"Chlorophyll a (primary pigment) absorbs mainly red (680nm) and blue-violet (430nm) light. It is the only pigment that directly takes part in the light reactions of photosynthesis.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Biology",chapter:"Cell Biology",topic:"Cell Membrane",difficulty:"medium",questionText:"Fluid mosaic model of cell membrane was proposed by:",optionA:"Watson and Crick",optionB:"Singer and Nicolson",optionC:"Robert Brown",optionD:"Schleiden and Schwann",correctOpt:1,explanation:"Singer and Nicolson (1972) proposed the fluid mosaic model describing the cell membrane as a fluid phospholipid bilayer with proteins embedded (mosaic pattern). This is the current accepted model.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Biology",chapter:"Ecology",topic:"Conservation",difficulty:"medium",questionText:"Project Tiger was launched in India in:",optionA:"1963",optionB:"1973",optionC:"1983",optionD:"1993",correctOpt:1,explanation:"Project Tiger was launched on April 1, 1973 under the Wildlife Protection Act 1972 to conserve Bengal Tiger (Panthera tigris tigris). India now has 53 tiger reserves.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Biology",chapter:"Genetics",topic:"Incomplete Dominance",difficulty:"medium",questionText:"Incomplete dominance is observed in:",optionA:"Pea plant height",optionB:"Snapdragon (Antirrhinum) flower colour",optionC:"ABO blood group",optionD:"Human eye colour",correctOpt:1,explanation:"In Antirrhinum (snapdragon): Red(RR) × White(rr) → Pink(Rr) in F1. F2 = 1Red:2Pink:1White. F1 shows intermediate phenotype — incomplete dominance. Neither allele is fully dominant.",isPYQ:true,isRepeated:true,pyqYear:2018},
  {subject:"Biology",chapter:"Human Physiology",topic:"Respiratory System",difficulty:"easy",questionText:"Partial pressure of O2 in alveoli is approximately:",optionA:"40 mm Hg",optionB:"104 mm Hg",optionC:"159 mm Hg",optionD:"76 mm Hg",correctOpt:1,explanation:"Alveolar pO2 ≈ 104 mmHg; Deoxygenated blood pO2 ≈ 40 mmHg. O2 moves from alveoli to blood down concentration gradient. CO2 moves opposite direction (45→40 mmHg).",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Biology",chapter:"Plant Kingdom",topic:"Classification",difficulty:"easy",questionText:"Which is NOT a gymnosperm?",optionA:"Pinus",optionB:"Cycas",optionC:"Gnetum",optionD:"Eucalyptus",correctOpt:3,explanation:"Eucalyptus is an angiosperm (dicot, family Myrtaceae). Pinus, Cycas and Gnetum are all gymnosperms (naked seed plants — seeds not enclosed in fruit). Gymnosperm: naked seed.",isPYQ:false,isRepeated:false,pyqYear:null},

  // ── PHYSICS (20 questions) ─────────────────────────────────────────────────
  {subject:"Physics",chapter:"Thermodynamics",topic:"Laws",difficulty:"medium",questionText:"For an ideal gas undergoing isothermal expansion, which remains constant?",optionA:"Pressure",optionB:"Internal Energy",optionC:"Entropy",optionD:"Volume",correctOpt:1,explanation:"In isothermal process T=constant. For ideal gas, U depends only on T (U=nCvT), so ΔU=0. First law: Q=W. All heat absorbed goes to doing work. PV=nRT=constant.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Physics",chapter:"Electrostatics",topic:"Coulomb's Law",difficulty:"medium",questionText:"Two charges of 2μC and 4μC separated by 20cm in vacuum. Force is:",optionA:"1.8 N",optionB:"18 N",optionC:"0.18 N",optionD:"180 N",correctOpt:0,explanation:"F=kq1q2/r²=(9×10⁹×2×10⁻⁶×4×10⁻⁶)/(0.20)²=72×10⁻³/0.04=1.8N",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Physics",chapter:"Optics",topic:"Lens Formula",difficulty:"easy",questionText:"Convex lens focal length 20cm, object at 40cm. Image distance is:",optionA:"20 cm",optionB:"40 cm",optionC:"60 cm",optionD:"Infinity",correctOpt:1,explanation:"1/v-1/u=1/f. u=-40cm,f=+20cm. 1/v=1/20+1/(-40)=1/40. v=40cm. Real, inverted, same size (m=-1).",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Physics",chapter:"Modern Physics",topic:"Photoelectric Effect",difficulty:"medium",questionText:"Work function 4.2eV. Threshold frequency (h=6.6×10⁻³⁴ J.s) is approximately:",optionA:"1.01×10¹⁵ Hz",optionB:"2.01×10¹⁵ Hz",optionC:"0.5×10¹⁵ Hz",optionD:"3×10¹⁵ Hz",correctOpt:0,explanation:"ν₀=W/h=(4.2×1.6×10⁻¹⁹)/(6.6×10⁻³⁴)=6.72×10⁻¹⁹/6.6×10⁻³⁴≈1.018×10¹⁵Hz≈1.01×10¹⁵Hz",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Physics",chapter:"Mechanics",topic:"Projectile Motion",difficulty:"medium",questionText:"Range of projectile is maximum at angle:",optionA:"30°",optionB:"45°",optionC:"60°",optionD:"90°",correctOpt:1,explanation:"R=u²sin2θ/g. For max R, sin2θ=1, so 2θ=90°, θ=45°. At 45° horizontal and vertical components are equal, giving max range.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Physics",chapter:"Current Electricity",topic:"Parallel Circuits",difficulty:"easy",questionText:"Three resistors 2Ω, 3Ω, 6Ω in parallel. Equivalent resistance is:",optionA:"11 Ω",optionB:"1 Ω",optionC:"2 Ω",optionD:"0.5 Ω",correctOpt:1,explanation:"1/Req=1/2+1/3+1/6=3/6+2/6+1/6=6/6=1. Req=1Ω. In parallel, reciprocals add: total resistance is less than smallest.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Physics",chapter:"SHM",topic:"Simple Pendulum",difficulty:"medium",questionText:"Time period of simple pendulum doubles when:",optionA:"Length is doubled",optionB:"Length is quadrupled",optionC:"Mass is doubled",optionD:"Amplitude is doubled",correctOpt:1,explanation:"T=2π√(L/g). For 2T: 2T=2π√(4L/g) → length must be quadrupled. T is independent of mass and amplitude (for small angles).",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Physics",chapter:"Nuclear Physics",topic:"Radioactivity",difficulty:"medium",questionText:"Half-life 30 years. After 90 years, remaining fraction is:",optionA:"1/4",optionB:"1/6",optionC:"1/8",optionD:"1/16",correctOpt:2,explanation:"n=90/30=3 half-lives. Remaining=(1/2)³=1/8. After each half-life, half atoms decay: 1→1/2→1/4→1/8.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Physics",chapter:"Thermodynamics",topic:"Carnot Engine",difficulty:"hard",questionText:"Carnot engine efficiency 40%, source temperature 500K. Sink temperature is:",optionA:"200 K",optionB:"300 K",optionC:"400 K",optionD:"250 K",correctOpt:1,explanation:"η=1-T₂/T₁. 0.4=1-T₂/500. T₂/500=0.6. T₂=300K. Carnot efficiency depends only on absolute temperatures.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Physics",chapter:"Electrostatics",topic:"Capacitor",difficulty:"medium",questionText:"Energy stored in capacitor C at voltage V is:",optionA:"CV",optionB:"CV²",optionC:"½CV²",optionD:"2CV²",correctOpt:2,explanation:"U=½CV²=½QV=Q²/2C. Energy stored in electric field between capacitor plates. Also: since Q=CV, all three forms are equivalent.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Physics",chapter:"Optics",topic:"Total Internal Reflection",difficulty:"medium",questionText:"Critical angle for glass-air (μ=√2) is:",optionA:"30°",optionB:"45°",optionC:"60°",optionD:"90°",correctOpt:1,explanation:"sinC=1/μ=1/√2. C=sin⁻¹(1/√2)=45°. TIR occurs when light travels from denser to rarer medium at angle > critical angle. Basis of optical fibres.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Physics",chapter:"Modern Physics",topic:"Bohr Model",difficulty:"medium",questionText:"In Bohr model, radius of nth orbit is proportional to:",optionA:"n",optionB:"n²",optionC:"1/n",optionD:"1/n²",correctOpt:1,explanation:"Bohr radius: rn=n²a₀ where a₀=0.529Å. So r∝n². Energy: En=-13.6/n² eV (n²∝1/En). First orbit radius=0.529Å.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Physics",chapter:"Magnetism",topic:"Circular Motion",difficulty:"medium",questionText:"Proton moving with velocity v ⊥ to field B. Radius of circular path is:",optionA:"r=mv/qB",optionB:"r=qB/mv",optionC:"r=mv/B",optionD:"r=qBv/m",correctOpt:0,explanation:"Centripetal=magnetic force: mv²/r=qvB. r=mv/qB. Larger mass, velocity → larger radius. Larger charge, field → smaller radius.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Physics",chapter:"Waves",topic:"Doppler Effect",difficulty:"hard",questionText:"Car at 10m/s towards stationary observer, horn 400Hz, sound speed 340m/s. Observed frequency:",optionA:"412 Hz",optionB:"388 Hz",optionC:"400 Hz",optionD:"424 Hz",correctOpt:0,explanation:"f'=f(v/(v-vs))=400×(340/330)=400×1.0303≈412Hz. Source approaching observer → frequency increases (blue shift).",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Physics",chapter:"Mechanics",topic:"Newton's Laws",difficulty:"easy",questionText:"A force of 10N acts on 2kg body. Acceleration produced is:",optionA:"5 m/s²",optionB:"20 m/s²",optionC:"12 m/s²",optionD:"0.2 m/s²",correctOpt:0,explanation:"F=ma. a=F/m=10/2=5m/s². Newton's 2nd law: net force = mass × acceleration. SI unit of force: Newton (N).",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Physics",chapter:"Electromagnetic Induction",topic:"Faraday's Laws",difficulty:"medium",questionText:"Induced EMF in a coil is directly proportional to:",optionA:"Magnetic field",optionB:"Rate of change of magnetic flux",optionC:"Resistance of coil",optionD:"Current in coil",correctOpt:1,explanation:"Faraday's 1st law: ε=-dΦ/dt. EMF∝rate of change of magnetic flux. Negative sign = Lenz's law (opposition). Φ=BAcosθ.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Physics",chapter:"Current Electricity",topic:"Wheatstone Bridge",difficulty:"hard",questionText:"Wheatstone bridge is balanced when:",optionA:"P/Q=R/S",optionB:"P/R=Q/S",optionC:"PQ=RS",optionD:"P+Q=R+S",correctOpt:0,explanation:"Wheatstone bridge balance condition: P/Q=R/S (no current through galvanometer). Used to find unknown resistance precisely.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Physics",chapter:"Gravitation",topic:"Escape Velocity",difficulty:"medium",questionText:"Escape velocity from Earth's surface is approximately:",optionA:"7.9 km/s",optionB:"11.2 km/s",optionC:"3.0 km/s",optionD:"16.0 km/s",correctOpt:1,explanation:"ve=√(2gR)=√(2×9.8×6.4×10⁶)≈11.2km/s. This is the minimum speed to escape Earth's gravity. Orbital velocity=7.9km/s.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Physics",chapter:"Mechanics",topic:"Rotational Motion",difficulty:"medium",questionText:"Moment of inertia of solid sphere about diameter is:",optionA:"(2/3)MR²",optionB:"(2/5)MR²",optionC:"MR²",optionD:"(1/2)MR²",correctOpt:1,explanation:"I_solid sphere=(2/5)MR². Compare: Hollow sphere=(2/3)MR². Disc=(1/2)MR². Ring=MR². Solid cylinder=(1/2)MR².",isPYQ:true,isRepeated:true,pyqYear:2018},
  {subject:"Physics",chapter:"Optics",topic:"Wave Optics",difficulty:"hard",questionText:"In Young's double slit experiment, fringe width β is:",optionA:"β=λd/D",optionB:"β=λD/d",optionC:"β=dD/λ",optionD:"β=d/λD",correctOpt:1,explanation:"β=λD/d where λ=wavelength, D=distance to screen, d=slit separation. Fringe width increases with λ and D, decreases with d.",isPYQ:true,isRepeated:true,pyqYear:2020},

  // ── CHEMISTRY (20 questions) ───────────────────────────────────────────────
  {subject:"Chemistry",chapter:"Electrochemistry",topic:"Galvanic Cells",difficulty:"medium",questionText:"Standard EMF of Zn-Cu cell (Zn²⁺/Zn=-0.76V, Cu²⁺/Cu=+0.34V) is:",optionA:"-0.42 V",optionB:"+0.42 V",optionC:"+1.10 V",optionD:"-1.10 V",correctOpt:2,explanation:"EMF=E°(cathode)-E°(anode). Cu is cathode(+0.34V), Zn is anode(-0.76V). EMF=0.34-(-0.76)=+1.10V. Positive EMF=spontaneous.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Chemistry",chapter:"Haloalkanes",topic:"Nucleophilic Substitution",difficulty:"hard",questionText:"Which compound undergoes SN1 most readily?",optionA:"CH3Cl",optionB:"(CH3)2CHCl",optionC:"(CH3)3CCl",optionD:"CH3CH2Cl",correctOpt:2,explanation:"SN1 proceeds via carbocation intermediate. Tertiary carbocation (3°) most stable (3 alkyl groups donating electrons). Order: 3°>2°>1°>methyl.",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Chemistry",chapter:"Coordination Compounds",topic:"Magnetic Properties",difficulty:"hard",questionText:"Which complex is diamagnetic?",optionA:"[Fe(H2O)6]³⁺",optionB:"[CoF6]³⁻",optionC:"[Co(NH3)6]³⁺",optionD:"[Ni(H2O)6]²⁺",correctOpt:2,explanation:"[Co(NH3)6]³⁺: Co³⁺ is d⁶, NH3 is strong field ligand → t2g⁶eg⁰, all paired → diamagnetic. [Fe(H2O)6]³⁺ d⁵ weak field=5 unpaired=paramagnetic.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Chemistry",chapter:"Chemical Kinetics",topic:"Half Life",difficulty:"medium",questionText:"Half-life of first order reaction is:",optionA:"k/0.693",optionB:"0.693/k",optionC:"1/k",optionD:"2/k",correctOpt:1,explanation:"t½=0.693/k=ln2/k for 1st order. Half-life is INDEPENDENT of initial concentration (unique to 1st order). For 0th order: t½=a/2k.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Chemistry",chapter:"Organic Chemistry",topic:"Named Reactions",difficulty:"medium",questionText:"Aldol condensation involves:",optionA:"Aldehydes/ketones with OH⁻ to give β-hydroxy carbonyl compounds",optionB:"Grignard reagent with carbonyl",optionC:"Oxidation of primary alcohols",optionD:"Reduction of aldehydes to alcohols",correctOpt:0,explanation:"Aldol: two carbonyl compounds (with α-H) + dilute NaOH → β-hydroxy carbonyl (aldol product). On heating, loses water → α,β-unsaturated carbonyl (aldol condensation).",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Chemistry",chapter:"p-Block Elements",topic:"Halogens",difficulty:"medium",questionText:"Which halogen does NOT show positive oxidation states?",optionA:"Cl",optionB:"Br",optionC:"I",optionD:"F",correctOpt:3,explanation:"Fluorine (most electronegative element) CANNOT show positive oxidation states. Cl, Br, I can show +1,+3,+5,+7 in oxyacids (HOCl, HClO3, HClO4 etc.).",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Chemistry",chapter:"Thermodynamics",topic:"Spontaneity",difficulty:"hard",questionText:"A reaction is spontaneous at ALL temperatures when:",optionA:"ΔH>0, ΔS>0",optionB:"ΔH<0, ΔS<0",optionC:"ΔH<0, ΔS>0",optionD:"ΔH>0, ΔS<0",correctOpt:2,explanation:"ΔG=ΔH-TΔS. For ΔG<0 (spontaneous): when ΔH<0(exothermic) AND ΔS>0(entropy increase), ΔG is always negative regardless of T.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Chemistry",chapter:"Solutions",topic:"Colligative Properties",difficulty:"medium",questionText:"Which property does NOT depend on nature of solute?",optionA:"Electrical conductivity",optionB:"Viscosity",optionC:"Elevation of boiling point",optionD:"Chemical reactivity",correctOpt:2,explanation:"Colligative properties (boiling point elevation, freezing point depression, osmotic pressure, vapour pressure lowering) depend only on NUMBER of solute particles, not their identity.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Chemistry",chapter:"Organic Chemistry",topic:"Isomerism",difficulty:"medium",questionText:"Which compound shows geometrical isomerism?",optionA:"CH3-CH=CH2",optionB:"CH3-CH=CH-CH3",optionC:"(CH3)2C=CH2",optionD:"CH2=CH2",correctOpt:1,explanation:"Geometrical (cis-trans) isomerism requires C=C with TWO DIFFERENT groups on each carbon. But-2-ene (CH3-CH=CH-CH3): each C has H and CH3 → shows cis-trans isomerism.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Chemistry",chapter:"Chemical Bonding",topic:"VSEPR Theory",difficulty:"medium",questionText:"Shape of NH3 molecule is:",optionA:"Triangular planar",optionB:"Trigonal pyramidal",optionC:"Tetrahedral",optionD:"Linear",correctOpt:1,explanation:"N in NH3: 3 bond pairs + 1 lone pair (sp³). VSEPR: lone pair repulsion makes bond angles 107.3° (less than 109.5°). Shape = trigonal pyramidal (electron geometry = tetrahedral).",isPYQ:true,isRepeated:true,pyqYear:2019},
  {subject:"Chemistry",chapter:"Alcohols",topic:"Tests",difficulty:"medium",questionText:"Lucas test distinguishes:",optionA:"Aldehydes from ketones",optionB:"1°, 2° and 3° alcohols",optionC:"Alcohols from phenols",optionD:"Primary from secondary amines",correctOpt:1,explanation:"Lucas test (ZnCl2+conc.HCl): 3° alcohol → turbid immediately; 2° → turbid in 5 min (warm); 1° → no turbidity at room temp. Identifies class of alcohol.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Chemistry",chapter:"Polymers",topic:"Synthetic Polymers",difficulty:"easy",questionText:"Nylon-6,6 is formed from:",optionA:"Caprolactam",optionB:"Hexamethylenediamine + Adipic acid",optionC:"Ethylene glycol + Terephthalic acid",optionD:"Formaldehyde + Phenol",correctOpt:1,explanation:"Nylon-6,6 = condensation polymer of hexamethylenediamine(6C) + adipic acid(6C). Nylon-6 from caprolactam. Dacron = ethylene glycol + terephthalic acid. Bakelite = formaldehyde + phenol.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Chemistry",chapter:"Inorganic Chemistry",topic:"Oxides",difficulty:"medium",questionText:"Which oxide is amphoteric?",optionA:"Na2O",optionB:"CO2",optionC:"Al2O3",optionD:"CaO",correctOpt:2,explanation:"Al2O3 is amphoteric: reacts with acid (Al2O3+H2SO4→Al2(SO4)3+H2O) AND base (Al2O3+NaOH→NaAlO2+H2O). Na2O,CaO are basic; CO2 is acidic oxide.",isPYQ:true,isRepeated:true,pyqYear:2022},
  {subject:"Chemistry",chapter:"Atomic Structure",topic:"Quantum Numbers",difficulty:"hard",questionText:"Maximum electrons in 3d subshell is:",optionA:"6",optionB:"8",optionC:"10",optionD:"14",correctOpt:2,explanation:"d subshell has 5 orbitals (ml=-2,-1,0,+1,+2). Each orbital holds 2e⁻. Total=5×2=10. f-subshell: 7 orbitals=14e⁻. p-subshell: 3 orbitals=6e⁻.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Chemistry",chapter:"d-Block Elements",topic:"Properties",difficulty:"medium",questionText:"Which transition metal has the highest melting point?",optionA:"Iron",optionB:"Tungsten",optionC:"Chromium",optionD:"Platinum",correctOpt:1,explanation:"Tungsten (W, 3422°C) has the highest melting point of all elements due to maximum unpaired d-electrons contributing to metallic bonding. Used in incandescent bulb filaments.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Chemistry",chapter:"Organic Chemistry",topic:"Amines",difficulty:"medium",questionText:"Diazotization reaction involves:",optionA:"NaNO2 + HCl at 0-5°C with primary aromatic amine",optionB:"NaNO2 + H2SO4 at 50°C",optionC:"HNO3 + H2SO4 at 0°C",optionD:"NaOH + Cl2",correctOpt:0,explanation:"Diazotization: ArNH2 + NaNO2 + HCl at 0-5°C → ArN2⁺Cl⁻ (diazonium salt). Temperature critical — above 5°C the salt decomposes. Diazonium salts are versatile intermediates.",isPYQ:true,isRepeated:true,pyqYear:2020},
  {subject:"Chemistry",chapter:"Surface Chemistry",topic:"Adsorption",difficulty:"medium",questionText:"Which is NOT a property of lyophilic colloids?",optionA:"High viscosity",optionB:"High solvation",optionC:"Reversible",optionD:"Lower stability than lyophobic",correctOpt:3,explanation:"Lyophilic (solvent-loving) colloids: high viscosity, good solvation, reversible, MORE stable than lyophobic (require stabilizers). Lyophobic = solvent-hating, less stable, irreversible.",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Chemistry",chapter:"Equilibrium",topic:"Le Chatelier's Principle",difficulty:"medium",questionText:"In Haber process N2+3H2⇌2NH3, yield increases by:",optionA:"High temp, low pressure",optionB:"Low temp, high pressure",optionC:"High temp, high pressure",optionD:"Low temp, low pressure",correctOpt:1,explanation:"NH3 synthesis is exothermic (decreasing T favours forward reaction) and involves decrease in moles (4→2, so high pressure favours NH3). Conditions: 450°C(compromise), 200atm, Fe catalyst.",isPYQ:true,isRepeated:true,pyqYear:2021},
  {subject:"Chemistry",chapter:"Organic Chemistry",topic:"Carbohydrates",difficulty:"easy",questionText:"Which sugar is known as 'invert sugar'?",optionA:"Sucrose",optionB:"Glucose + Fructose mixture",optionC:"Maltose",optionD:"Lactose",correctOpt:1,explanation:"Invert sugar = equimolar mixture of glucose + fructose obtained by hydrolysis of sucrose. Called invert because optical rotation changes from +66.5° (sucrose) to -39.3° (invert sugar).",isPYQ:false,isRepeated:true,pyqYear:null},
  {subject:"Chemistry",chapter:"Organic Chemistry",topic:"Proteins",difficulty:"medium",questionText:"Which bond connects amino acids in proteins?",optionA:"Hydrogen bond",optionB:"Peptide bond",optionC:"Disulfide bond",optionD:"Ionic bond",correctOpt:1,explanation:"Peptide bond (−CO−NH−) is a covalent amide linkage connecting amino acids. Formed by condensation (loss of H2O) between -COOH of one amino acid and -NH2 of next. Primary structure of protein.",isPYQ:false,isRepeated:true,pyqYear:null},
];

const MOCK_TESTS = [
  ...Array.from({length:2},(_,i)=>({ title:`YNeet Full Mock Test ${String(i+1).padStart(2,"0")}`, type:"full", totalMarks:720, totalQs:200, durationMin:200 })),
  { title:"Biology Mock Test 01", type:"subject", subject:"Biology", totalMarks:360, totalQs:90, durationMin:90 },
  { title:"Physics Mock Test 01", type:"subject", subject:"Physics", totalMarks:180, totalQs:45, durationMin:60 },
  { title:"Chemistry Mock Test 01", type:"subject", subject:"Chemistry", totalMarks:180, totalQs:45, durationMin:60 },
];
// NOTE: with ~70 total seeded questions per class, this deliberately stays small
// rather than declaring 19 tests that would mostly duplicate the same content —
// add more real questions via the admin panel first, then add more mock tests
// here (or directly through /admin) once there's enough content to make each
// test genuinely distinct.

// ── BIOLOGY FLASHCARDS — one core flashcard per NCERT chapter (Class 11 + 12 combined,
// since NEET Biology draws from both years). Organized chapter-wise as the syllabus is. ──
const FLASHCARDS_ADVANCED = [
  // Class 11 Biology
  { subject:"Biology", chapter:"The Living World", front:"What is taxonomy?", back:"The branch of biology dealing with identification, nomenclature and classification of organisms based on similarities and differences." },
  { subject:"Biology", chapter:"Biological Classification", front:"Name Whittaker's five kingdoms.", back:"Monera, Protista, Fungi, Plantae, Animalia — classified on cell structure, thallus organisation, mode of nutrition, reproduction and phylogenetic relationships." },
  { subject:"Biology", chapter:"Plant Kingdom", front:"What distinguishes Bryophytes from Pteridophytes?", back:"Bryophytes (mosses/liverworts) lack vascular tissue; Pteridophytes (ferns) have well-differentiated xylem/phloem. Both show alternation of generations." },
  { subject:"Biology", chapter:"Animal Kingdom", front:"What is the key feature separating Chordata from Non-chordata?", back:"Chordates have a notochord, dorsal hollow nerve cord, and pharyngeal gill slits at some life stage; non-chordates lack a notochord." },
  { subject:"Biology", chapter:"Morphology of Flowering Plants", front:"Differentiate tap root and fibrous root systems.", back:"Tap root: single main root growing deep (dicots). Fibrous root: cluster of roots of similar size arising from stem base (monocots)." },
  { subject:"Biology", chapter:"Anatomy of Flowering Plants", front:"What is the difference between xylem and phloem?", back:"Xylem conducts water/minerals upward, is dead at maturity (except xylem parenchyma). Phloem conducts food (sucrose), is living tissue." },
  { subject:"Biology", chapter:"Structural Organisation in Animals", front:"What are the four basic animal tissue types?", back:"Epithelial (covering/lining), Connective (support/binding), Muscular (movement), Nervous (control/coordination)." },
  { subject:"Biology", chapter:"Cell: The Unit of Life", front:"What is the powerhouse of the cell?", back:"Mitochondria — produces ATP via cellular respiration. Has a double membrane and its own circular DNA (semi-autonomous organelle)." },
  { subject:"Biology", chapter:"Biomolecules", front:"What are the four major classes of biomolecules?", back:"Carbohydrates, Proteins, Lipids, and Nucleic Acids (DNA/RNA) — each built from specific monomer units linked by characteristic bonds." },
  { subject:"Biology", chapter:"Cell Cycle and Cell Division", front:"Stages of mitosis in order?", back:"Prophase → Metaphase → Anaphase → Telophase → Cytokinesis (PMAT). Chromosomes align at the equatorial plate during Metaphase." },
  { subject:"Biology", chapter:"Transport in Plants", front:"What drives water movement up a tall tree?", back:"The transpiration pull-cohesion-tension mechanism: water evaporates from leaves, creating tension that pulls a continuous water column up through the xylem via cohesion." },
  { subject:"Biology", chapter:"Mineral Nutrition", front:"Name the criteria for an element to be essential for plants.", back:"Deficiency makes it impossible to complete the life cycle, the deficiency is specific and reversible by supplying that element, and it's directly involved in metabolism." },
  { subject:"Biology", chapter:"Photosynthesis in Higher Plants", front:"What is the difference between the light and dark reactions?", back:"Light reactions (thylakoid) capture light energy to make ATP and NADPH. Dark reactions / Calvin cycle (stroma) use that ATP/NADPH to fix CO₂ into sugar." },
  { subject:"Biology", chapter:"Respiration in Plants", front:"What is the net ATP yield of aerobic respiration per glucose?", back:"About 36-38 ATP via glycolysis, Krebs cycle and the electron transport chain — far more than the 2 ATP from fermentation alone." },
  { subject:"Biology", chapter:"Plant Growth and Development", front:"Name the five major plant hormones.", back:"Auxins, Gibberellins, Cytokinins, Ethylene, and Abscisic acid — each regulating different aspects of growth, dormancy and stress response." },
  { subject:"Biology", chapter:"Digestion and Absorption", front:"Where does most nutrient absorption occur?", back:"The small intestine — its villi and microvilli massively increase surface area for absorbing digested carbohydrates, proteins, fats, vitamins and minerals." },
  { subject:"Biology", chapter:"Breathing and Exchange of Gases", front:"What is the role of haemoglobin in gas transport?", back:"Haemoglobin binds O₂ in the lungs (forming oxyhaemoglobin) and releases it at tissues; it also helps transport CO₂ back to the lungs as carbaminohaemoglobin." },
  { subject:"Biology", chapter:"Body Fluids and Circulation", front:"Name the components of blood.", back:"Plasma (~55%) plus formed elements (~45%): RBCs (erythrocytes), WBCs (leukocytes), and platelets (thrombocytes)." },
  { subject:"Biology", chapter:"Excretory Products and their Elimination", front:"What is the functional unit of the kidney?", back:"The nephron — filters blood at the glomerulus, then selectively reabsorbs/secretes substances along the tubule to form urine." },
  { subject:"Biology", chapter:"Locomotion and Movement", front:"What is the sliding filament theory?", back:"Muscle contraction occurs when actin (thin) filaments slide over myosin (thick) filaments, shortening the sarcomere, powered by ATP." },
  { subject:"Biology", chapter:"Neural Control and Coordination", front:"What is a reflex arc?", back:"The pathway of a reflex action: receptor → sensory neuron → spinal cord (relay) → motor neuron → effector — bypassing the brain for speed." },
  { subject:"Biology", chapter:"Chemical Coordination and Integration", front:"What is the role of the pituitary gland?", back:"The 'master gland' — secretes hormones (e.g. GH, TSH, ACTH) that regulate the activity of most other endocrine glands in the body." },
  // Class 12 Biology
  { subject:"Biology", chapter:"Sexual Reproduction in Flowering Plants", front:"What is double fertilisation?", back:"Unique to angiosperms: one sperm fuses with the egg to form the zygote, the other fuses with two polar nuclei to form the triploid endosperm." },
  { subject:"Biology", chapter:"Human Reproduction", front:"What is the role of the corpus luteum?", back:"Secretes progesterone after ovulation to maintain the endometrium for implantation. If fertilisation doesn't occur, it degenerates into the corpus albicans." },
  { subject:"Biology", chapter:"Reproductive Health", front:"Name the main categories of contraceptive methods.", back:"Barrier methods, IUDs, hormonal (oral pills/injectables), surgical (tubectomy/vasectomy), and natural methods (rhythm/withdrawal)." },
  { subject:"Biology", chapter:"Principles of Inheritance and Variation", front:"Differentiate monohybrid and dihybrid crosses.", back:"Monohybrid: one trait tracked, F2 ratio 3:1. Dihybrid: two traits tracked, F2 ratio 9:3:3:1. Both follow Mendel's laws of segregation/independent assortment." },
  { subject:"Biology", chapter:"Molecular Basis of Inheritance", front:"What is the central dogma of molecular biology?", back:"DNA → RNA → Protein. Transcription converts DNA to mRNA; translation converts mRNA to protein. Reverse transcriptase can run RNA → DNA." },
  { subject:"Biology", chapter:"Evolution", front:"What did the Miller-Urey experiment demonstrate?", back:"Abiotic synthesis of amino acids from CH₄, NH₃, H₂ and H₂O under electric discharge — showing organic molecules can form without pre-existing life." },
  { subject:"Biology", chapter:"Human Health and Disease", front:"Differentiate innate and acquired immunity.", back:"Innate: non-specific, present from birth (skin, WBCs, NK cells). Acquired: specific, develops after exposure, involves antibodies and memory B/T cells." },
  { subject:"Biology", chapter:"Microbes in Human Welfare", front:"Give an example of a microbe used in industrial fermentation.", back:"Saccharomyces cerevisiae (yeast) — used to ferment sugars into ethanol in the brewing and baking industries." },
  { subject:"Biology", chapter:"Biotechnology: Principles and Processes", front:"What is a restriction enzyme?", back:"A molecular scissor that cuts DNA at specific recognition sequences — essential for constructing recombinant DNA molecules." },
  { subject:"Biology", chapter:"Biotechnology and its Applications", front:"What is Bt cotton?", back:"A genetically modified cotton expressing a toxin gene from Bacillus thuringiensis, giving built-in resistance to bollworm pests." },
  { subject:"Biology", chapter:"Organisms and Populations", front:"What is the difference between a population and a community?", back:"A population is all individuals of one species in an area; a community is all populations of different species interacting in that same area." },
  { subject:"Biology", chapter:"Ecosystem", front:"Define an ecological pyramid.", back:"A graphical representation of number, biomass, or energy at successive trophic levels. The energy pyramid is always upright; the biomass pyramid can be inverted in aquatic systems." },
  { subject:"Biology", chapter:"Biodiversity and Conservation", front:"What are keystone species?", back:"Species with a disproportionately large effect on their ecosystem relative to their abundance — e.g. sea otters maintaining kelp forests." },
  { subject:"Biology", chapter:"Environmental Issues", front:"What causes the greenhouse effect?", back:"Gases like CO₂, methane and water vapour trap outgoing infrared radiation in the atmosphere, warming the Earth's surface." },
];

// ── PHYSICS FORMULAS — one core formula per NCERT chapter (Class 11 + 12) ──
const FORMULAS_PHYSICS_ADVANCED = [
  // Class 11
  { chapter:"Units and Measurements", title:"Dimensional Formula Check", expression:"[F] = [MLT⁻²]", notes:"Every physical quantity can be expressed in terms of base dimensions M, L, T — used to verify equations and derive unit relations." },
  { chapter:"Motion in a Straight Line", title:"Kinematic Equation (velocity)", expression:"v = u + at", notes:"v=final velocity, u=initial velocity, a=acceleration, t=time. Holds only for constant acceleration." },
  { chapter:"Motion in a Straight Line", title:"Kinematic Equation (displacement)", expression:"s = ut + ½at²", notes:"s=displacement, u=initial velocity, a=acceleration, t=time." },
  { chapter:"Motion in a Plane", title:"Range of Projectile", expression:"R = u²sin(2θ)/g", notes:"Maximum range occurs at θ=45°. u=initial speed, g=9.8 m/s²." },
  { chapter:"Laws of Motion", title:"Newton's Second Law", expression:"F = ma", notes:"F=net force(N), m=mass(kg), a=acceleration(m/s²). Foundation of classical mechanics." },
  { chapter:"Work, Energy and Power", title:"Work-Energy Theorem", expression:"W = ΔKE = ½mv² − ½mu²", notes:"Net work done on an object equals its change in kinetic energy." },
  { chapter:"System of Particles and Rotational Motion", title:"Torque", expression:"τ = r × F = rF sinθ", notes:"Rotational analogue of force. Maximum when force is perpendicular to the position vector (θ=90°)." },
  { chapter:"Gravitation", title:"Universal Law of Gravitation", expression:"F = Gm₁m₂/r²", notes:"G=6.67×10⁻¹¹ N·m²/kg². Attractive force between any two masses." },
  { chapter:"Gravitation", title:"Escape Velocity", expression:"vₑ = √(2gR)", notes:"vₑ≈11.2 km/s for Earth. g=9.8 m/s², R=Earth's radius (~6400 km)." },
  { chapter:"Mechanical Properties of Solids", title:"Young's Modulus", expression:"Y = (F/A) / (ΔL/L)", notes:"Ratio of tensile stress to tensile strain — a measure of a solid's stiffness." },
  { chapter:"Mechanical Properties of Fluids", title:"Bernoulli's Equation", expression:"P + ½ρv² + ρgh = constant", notes:"Conservation of energy for flowing fluids along a streamline." },
  { chapter:"Thermal Properties of Matter", title:"Heat and Specific Heat", expression:"Q = mcΔT", notes:"Q=heat energy, m=mass, c=specific heat capacity, ΔT=temperature change." },
  { chapter:"Thermodynamics", title:"First Law of Thermodynamics", expression:"ΔU = Q − W", notes:"ΔU=change in internal energy, Q=heat added to system, W=work done by the system." },
  { chapter:"Kinetic Theory", title:"Ideal Gas Law", expression:"PV = nRT", notes:"P=pressure, V=volume, n=moles, R=8.314 J/mol·K, T=temperature(K)." },
  { chapter:"Oscillations", title:"Time Period — Simple Pendulum", expression:"T = 2π√(L/g)", notes:"L=length(m), g=9.8 m/s². Independent of mass and amplitude for small oscillations." },
  { chapter:"Waves", title:"Wave Speed", expression:"v = fλ", notes:"v=speed(m/s), f=frequency(Hz), λ=wavelength(m)." },
  // Class 12
  { chapter:"Electric Charges and Fields", title:"Coulomb's Law", expression:"F = kq₁q₂/r²", notes:"k=9×10⁹ N·m²/C². Force between two point charges, decreasing with the square of distance." },
  { chapter:"Electrostatic Potential and Capacitance", title:"Capacitor Energy", expression:"U = ½CV²", notes:"C=capacitance(F), V=voltage(V). Equivalently U = Q²/2C = QV/2." },
  { chapter:"Current Electricity", title:"Ohm's Law", expression:"V = IR", notes:"V=voltage(V), I=current(A), R=resistance(Ω). Valid for ohmic conductors at constant temperature." },
  { chapter:"Moving Charges and Magnetism", title:"Force on a Moving Charge", expression:"F = qvB sinθ", notes:"Force on a charge q moving with velocity v in magnetic field B, θ=angle between v and B." },
  { chapter:"Magnetism and Matter", title:"Magnetic Dipole Moment", expression:"M = m × 2l", notes:"m=pole strength, 2l=distance between poles. Determines torque experienced in an external field." },
  { chapter:"Electromagnetic Induction", title:"Faraday's Law", expression:"ε = −dΦ/dt", notes:"Induced EMF equals the negative rate of change of magnetic flux through a circuit." },
  { chapter:"Alternating Current", title:"RMS Value", expression:"Irms = I₀/√2", notes:"Root-mean-square value of a sinusoidal AC current — the DC-equivalent value for power calculations." },
  { chapter:"Ray Optics and Optical Instruments", title:"Lens Formula", expression:"1/v − 1/u = 1/f", notes:"Convex lens: f>0. Concave lens: f<0. Sign convention (Cartesian) applies throughout." },
  { chapter:"Wave Optics", title:"Young's Double Slit Fringe Width", expression:"β = λD/d", notes:"λ=wavelength, D=screen distance, d=slit separation. Governs interference fringe spacing." },
  { chapter:"Dual Nature of Radiation and Matter", title:"Photoelectric Equation", expression:"KEmax = hf − φ", notes:"h=6.626×10⁻³⁴ J·s, f=frequency of incident light, φ=work function of the metal." },
  { chapter:"Atoms", title:"Bohr's Radius Formula", expression:"rₙ = n²h²ε₀/(πme²)", notes:"Radius of the nth orbit in the Bohr model of the hydrogen atom, proportional to n²." },
  { chapter:"Nuclei", title:"Mass-Energy Equivalence", expression:"E = mc²", notes:"c=3×10⁸ m/s. Also used with 1 amu = 931.5 MeV to find binding energy from mass defect." },
  { chapter:"Semiconductor Electronics", title:"Diode Current Equation (concept)", expression:"I = I₀(e^(qV/kT) − 1)", notes:"Describes current through a p-n junction diode as a function of applied voltage V." },
];

// ── CHEMISTRY FORMULAS / NAMED REACTIONS — one core entry per NCERT chapter (Class 11 + 12) ──
const FORMULAS_CHEMISTRY_ADVANCED = [
  // Class 11
  { chapter:"Some Basic Concepts of Chemistry", title:"Mole Concept", expression:"n = given mass / molar mass", notes:"1 mole of any substance contains 6.022×10²³ particles (Avogadro's number)." },
  { chapter:"Structure of Atom", title:"Bohr's Energy Formula", expression:"Eₙ = −13.6/n² eV", notes:"Energy of an electron in the nth orbit of a hydrogen atom." },
  { chapter:"Classification of Elements and Periodicity", title:"Periodic Trend (concept)", expression:"Atomic radius ↓ across a period, ↑ down a group", notes:"Driven by increasing nuclear charge across a period, and added electron shells down a group." },
  { chapter:"Chemical Bonding and Molecular Structure", title:"Formal Charge", expression:"FC = V − N − B/2", notes:"V=valence electrons, N=non-bonding electrons, B=bonding electrons — used to pick the best Lewis structure." },
  { chapter:"States of Matter", title:"Ideal Gas Equation", expression:"PV = nRT", notes:"P=pressure, V=volume, n=moles, R=0.0821 L·atm/mol·K, T=temperature(K)." },
  { chapter:"Thermodynamics", title:"Gibbs Free Energy", expression:"ΔG = ΔH − TΔS", notes:"Predicts spontaneity: ΔG<0 spontaneous, ΔG>0 non-spontaneous, ΔG=0 equilibrium." },
  { chapter:"Equilibrium", title:"Henderson-Hasselbalch Equation", expression:"pH = pKa + log([A⁻]/[HA])", notes:"Used for buffer solution pH. At the half-equivalence point, pH = pKa." },
  { chapter:"Redox Reactions", title:"Oxidation Number Rule (concept)", expression:"Sum of oxidation numbers = charge on species", notes:"Used to balance redox equations and identify oxidising/reducing agents." },
  { chapter:"Hydrogen", title:"Water of Crystallisation (concept)", expression:"CuSO₄·5H₂O → CuSO₄ + 5H₂O", notes:"Hydrated salts lose fixed water molecules on heating — the basis of gravimetric hydration analysis." },
  { chapter:"The s-Block Elements", title:"Flame Test (concept)", expression:"Na⁺ → yellow, K⁺ → lilac, Ca²⁺ → brick red", notes:"Alkali/alkaline earth metal ions give characteristic flame colours due to electron transitions." },
  { chapter:"The p-Block Elements (Gr 13 & 14)", title:"Inert Pair Effect (concept)", expression:"Sn²⁺ and Pb²⁺ are more stable than Sn⁴⁺/Pb⁴⁺", notes:"Heavier p-block elements resist using their outermost s-electrons in bonding." },
  { chapter:"Organic Chemistry — Basic Principles", title:"Degree of Unsaturation", expression:"DoU = (2C+2+N−H)/2", notes:"C=carbons, N=nitrogens, H=hydrogens+halogens. Helps determine rings/π-bonds in a molecular formula." },
  { chapter:"Hydrocarbons", title:"Markovnikov's Rule (concept)", expression:"H adds to carbon with more H already attached", notes:"Governs regioselectivity of HX addition to unsymmetrical alkenes." },
  { chapter:"Environmental Chemistry", title:"BOD (concept)", expression:"Biochemical Oxygen Demand", notes:"Amount of dissolved O₂ needed by microorganisms to decompose organic matter in water — a key water-quality indicator." },
  // Class 12
  { chapter:"Solutions", title:"Henry's Law", expression:"p = KH·x", notes:"p=partial pressure of gas, KH=Henry's constant, x=mole fraction of gas dissolved." },
  { chapter:"Solutions", title:"van't Hoff Factor", expression:"ΔTf = i·Kf·m", notes:"i = 1 + (n−1)α. Electrolytes: i>1 (dissociation). Associating solutes: i<1." },
  { chapter:"Electrochemistry", title:"Nernst Equation", expression:"E = E° − (RT/nF)lnQ", notes:"At 25°C: E = E° − (0.0592/n)logQ. Relates cell EMF to reactant/product concentration." },
  { chapter:"Chemical Kinetics", title:"Arrhenius Equation", expression:"k = Ae^(−Ea/RT)", notes:"k=rate constant, A=frequency factor, Ea=activation energy, R=gas constant, T=temperature." },
  { chapter:"Surface Chemistry", title:"Freundlich Adsorption Isotherm", expression:"x/m = k·P^(1/n)", notes:"Empirical relation between amount of gas adsorbed and pressure at constant temperature." },
  { chapter:"General Principles of Isolation of Elements", title:"Ellingham Diagram (concept)", expression:"ΔG° vs T plots for metal oxide formation", notes:"Used to predict which reducing agent can extract a metal from its oxide at a given temperature." },
  { chapter:"The p-Block Elements (Gr 15-18)", title:"Oxidation States of Nitrogen (concept)", expression:"N: −3 to +5", notes:"Nitrogen shows the widest range of oxidation states of any p-block element, seen across NH₃ to HNO₃." },
  { chapter:"The d- and f-Block Elements", title:"Colour of Transition Metal Ions (concept)", expression:"d-d electronic transitions → visible colour", notes:"Partially filled d-orbitals allow electrons to absorb visible light and jump between d-orbital energy levels." },
  { chapter:"Coordination Compounds", title:"Crystal Field Splitting (concept)", expression:"Δₒ (octahedral) determines eg/t2g gap", notes:"Ligand field strength determines whether a complex is high-spin or low-spin." },
  { chapter:"Haloalkanes and Haloarenes", title:"SN1 vs SN2 (concept)", expression:"SN1: 2-step, carbocation. SN2: 1-step, backside attack", notes:"3° halides favour SN1; 1° halides favour SN2 — governs substitution product and stereochemistry." },
  { chapter:"Alcohols, Phenols and Ethers", title:"Lucas Test (concept)", expression:"ROH + HCl/ZnCl₂ → turbidity", notes:"3° alcohols turn turbid immediately, 2° in a few minutes, 1° only on heating — distinguishes alcohol classes." },
  { chapter:"Aldehydes, Ketones and Carboxylic Acids", title:"Tollens' Test (Silver Mirror)", expression:"RCHO + 2[Ag(NH₃)₂]⁺ → RCOO⁻ + 2Ag↓ + NH₄⁺", notes:"Positive for aldehydes (silver mirror forms), negative for ketones." },
  { chapter:"Amines", title:"Basicity Order (concept, aqueous)", expression:"2° > 1° > 3° > NH₃ (aliphatic amines)", notes:"A balance of +I effect, steric hindrance, and H-bonding with water determines base strength in solution." },
  { chapter:"Biomolecules", title:"Peptide Bond Formation", expression:"−COOH + H₂N− → −CO−NH− + H₂O", notes:"Condensation reaction linking amino acids to form the primary structure of a protein." },
  { chapter:"Polymers", title:"Degree of Polymerisation (concept)", expression:"n monomers → 1 polymer chain", notes:"n = number of repeating monomer units in the polymer chain, affecting molecular weight and properties." },
  { chapter:"Chemistry in Everyday Life", title:"Antibiotic Action (concept)", expression:"Bacteriostatic vs Bactericidal", notes:"Bacteriostatic drugs inhibit bacterial growth; bactericidal drugs kill bacteria outright — e.g. Penicillin is bactericidal." },
];

// ── CLASS 6 FOUNDATION CONTENT — simple, everyday-language intro to school science ──
const CLASS6_QUESTIONS = [
  {subject:"Biology",chapter:"Living World",topic:"Characteristics of Living Things",classLevel:"6th",difficulty:"easy",questionText:"Which of these is NOT a characteristic of living things?",optionA:"Growth",optionB:"Respiration",optionC:"Movement of vehicles",optionD:"Reproduction",correctOpt:2,explanation:"Living things grow, breathe, move (on their own) and reproduce. A vehicle can move, but it isn't alive — it doesn't grow, breathe, or reproduce by itself.",isPYQ:false,isRepeated:false,pyqYear:null},
  {subject:"Biology",chapter:"Plants",topic:"Parts of a Plant",classLevel:"6th",difficulty:"easy",questionText:"Which part of the plant makes food using sunlight?",optionA:"Root",optionB:"Leaf",optionC:"Stem",optionD:"Flower",correctOpt:1,explanation:"Leaves contain a green pigment called chlorophyll that traps sunlight. Using sunlight, water and carbon dioxide, leaves make food for the plant — this process is called photosynthesis.",isPYQ:false,isRepeated:false,pyqYear:null},
  {subject:"Physics",chapter:"Motion",topic:"Types of Motion",classLevel:"6th",difficulty:"easy",questionText:"A ball rolling on the ground shows which type of motion?",optionA:"Rectilinear motion",optionB:"Circular motion",optionC:"Rotatory motion",optionD:"Periodic motion",correctOpt:2,explanation:"As the ball rolls, it spins around its own centre — this turning motion is called rotatory motion, even while it also moves forward.",isPYQ:false,isRepeated:false,pyqYear:null},
  {subject:"Chemistry",chapter:"Matter",topic:"States of Matter",classLevel:"6th",difficulty:"easy",questionText:"Which state of matter has a fixed shape and fixed volume?",optionA:"Solid",optionB:"Liquid",optionC:"Gas",optionD:"Plasma",correctOpt:0,explanation:"Solids have particles packed tightly together in a fixed arrangement, giving them a definite shape and volume. Liquids take the shape of their container; gases fill any container completely.",isPYQ:false,isRepeated:false,pyqYear:null},
  {subject:"Biology",chapter:"Human Body",topic:"Body Systems",classLevel:"6th",difficulty:"easy",questionText:"Which organ pumps blood throughout the body?",optionA:"Lungs",optionB:"Heart",optionC:"Kidney",optionD:"Liver",correctOpt:1,explanation:"The heart is a muscular pump that pushes blood through blood vessels to every part of the body, carrying oxygen and nutrients to our cells.",isPYQ:false,isRepeated:false,pyqYear:null},
  {subject:"Chemistry",chapter:"Matter",topic:"Mixtures",classLevel:"6th",difficulty:"easy",questionText:"Salt dissolved in water is an example of a:",optionA:"Compound",optionB:"Element",optionC:"Solution",optionD:"Solid",correctOpt:2,explanation:"When salt fully dissolves in water, it forms a solution — a mixture where you can't see the salt separately anymore, but it's still there (you can taste it or evaporate the water to get it back).",isPYQ:false,isRepeated:false,pyqYear:null},
];
const CLASS6_FLASHCARDS = [
  { subject:"Biology", chapter:"Living World", front:"Name the 5 basic needs of living things.", back:"Food, water, air, shelter and the ability to reproduce — every living thing needs these to survive and continue its species." },
  { subject:"Biology", chapter:"Plants", front:"What do plants need to make their own food?", back:"Sunlight, water, and carbon dioxide from the air. Leaves use these, with the help of chlorophyll, to make food — this is called photosynthesis." },
  { subject:"Chemistry", chapter:"Matter", front:"What are the three common states of matter?", back:"Solid (fixed shape & volume), Liquid (fixed volume, takes container's shape), and Gas (fills any container completely)." },
];
const CLASS6_FORMULAS = [
  { subject:"Physics", chapter:"Motion", title:"Speed", expression:"Speed = Distance ÷ Time", notes:"Tells you how fast something is moving. If a bus covers 60 km in 2 hours, its speed is 30 km per hour." },
  { subject:"Chemistry", chapter:"Matter", title:"Density (intro)", expression:"Density = Mass ÷ Volume", notes:"Tells you how 'packed' something is. A denser object of the same size feels heavier." },
];

const BADGES = [
  { name:"Biology Master",   description:"Score 90%+ in a Biology test",  icon:"🧬", condition:"bio_90" },
  { name:"Physics Warrior",  description:"Score 90%+ in a Physics test",  icon:"⚛️", condition:"phy_90" },
  { name:"Chemistry Expert", description:"Score 90%+ in a Chemistry test",icon:"🧪", condition:"chem_90" },
  { name:"7-Day Streak",     description:"Study 7 consecutive days",      icon:"🔥", condition:"streak_7" },
  { name:"14-Day Streak",    description:"Study 14 consecutive days",     icon:"🔥", condition:"streak_14" },
  { name:"30-Day Streak",    description:"Study 30 consecutive days",     icon:"🏅", condition:"streak_30" },
  { name:"Mock Master",      description:"Complete 10 mock tests",        icon:"📝", condition:"mock_10" },
  { name:"Top Score",        description:"Score 600+ in a full mock",     icon:"🏆", condition:"score_600" },
  { name:"Practice Pro",     description:"Solve 100 practice questions",  icon:"📖", condition:"practice_100" },
];

async function main() {
  console.log("🌱 Seeding YNeet database...\n");

  // Clear existing data safely
  console.log("Clearing existing data...");
  await prisma.quizItem.deleteMany();
  await prisma.practiceStat.deleteMany();
  await prisma.attemptResponse.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.mistake.deleteMany();
  await prisma.question.deleteMany();
  await prisma.mockTest.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.formula.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  console.log("✓ Cleared\n");

  // Seed badges
  for (const b of BADGES) await prisma.badge.upsert({ where:{ name:b.name }, update:{}, create:b });
  console.log(`✓ ${BADGES.length} badges seeded`);

  // ── Advanced content (Class 12 syllabus, full NEET depth) is also reused for
  // Dropper students, since droppers are revising the same 11th/12th syllabus at
  // an advanced pace. Class 6 gets its own much simpler foundation set below. ──
  const ADVANCED_CLASSES = ["12th", "Dropper"];
  let totalQs = 0, totalTests = 0, totalFlash = 0, totalFormulas = 0;

  for (const classLevel of ADVANCED_CLASSES) {
    const createdQs = [];
    for (const q of QUESTIONS) {
      const created = await prisma.question.create({ data: { ...q, classLevel } });
      createdQs.push(created);
    }
    totalQs += createdQs.length;

    const bioQs  = createdQs.filter(q => q.subject === "Biology");
    const phyQs  = createdQs.filter(q => q.subject === "Physics");
    const chemQs = createdQs.filter(q => q.subject === "Chemistry");

    for (const mt of MOCK_TESTS) {
      const qToLink = mt.type === "full" ? createdQs : mt.subject === "Biology" ? bioQs : mt.subject === "Physics" ? phyQs : chemQs;
      // totalQs/totalMarks reflect what's ACTUALLY connected, not a placeholder
      // number — with a limited question bank, several tests legitimately share
      // the same underlying pool (now possible via the many-to-many relation),
      // rather than each needing its own exclusive 200 unique questions.
      const actualQs = qToLink.length;
      await prisma.mockTest.create({
        data: {
          title: `${mt.title} (${classLevel})`,
          type: mt.type,
          classLevel,
          subject: mt.subject || null,
          totalMarks: actualQs * 4,
          totalQs: actualQs,
          durationMin: mt.durationMin,
          questions: { connect: qToLink.map(q => ({ id: q.id })) },
        },
      });
      totalTests++;
    }

    for (const f of FLASHCARDS_ADVANCED) { await prisma.flashcard.create({ data: { ...f, classLevel } }); totalFlash++; }
    for (const f of FORMULAS_PHYSICS_ADVANCED) { await prisma.formula.create({ data: { ...f, subject: "Physics", classLevel } }); totalFormulas++; }
    for (const f of FORMULAS_CHEMISTRY_ADVANCED) { await prisma.formula.create({ data: { ...f, subject: "Chemistry", classLevel } }); totalFormulas++; }

    console.log(`✓ ${classLevel}: ${createdQs.length} questions, ${MOCK_TESTS.length} mock tests, ${FLASHCARDS_ADVANCED.length} flashcards, ${FORMULAS_PHYSICS_ADVANCED.length + FORMULAS_CHEMISTRY_ADVANCED.length} formulas`);
  }

  // ── Class 6 foundation content — simple language, basic concepts only ──
  for (const q of CLASS6_QUESTIONS) { await prisma.question.create({ data: q }); totalQs++; }
  for (const f of CLASS6_FLASHCARDS) { await prisma.flashcard.create({ data: { ...f, classLevel: "6th" } }); totalFlash++; }
  for (const f of CLASS6_FORMULAS) { await prisma.formula.create({ data: { ...f, classLevel: "6th" } }); totalFormulas++; }
  console.log(`✓ 6th (foundation): ${CLASS6_QUESTIONS.length} questions, ${CLASS6_FLASHCARDS.length} flashcards, ${CLASS6_FORMULAS.length} formulas`);

  console.log(`
✅ YNeet database seeded successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Questions : ${totalQs}
  Mock Tests: ${totalTests}
  Flashcards: ${totalFlash}
  Formulas  : ${totalFormulas}
  Badges    : ${BADGES.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NOTE: Full-depth content is currently seeded for 12th/Dropper (advanced) and
  6th (foundation, sample set) only. Classes 7th–11th reuse this same file's
  pattern — add QUESTIONS/FLASHCARDS/FORMULAS arrays tagged with the right
  classLevel and difficulty, matching that grade's actual syllabus depth.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Now run: npm run dev
  `);
}

main().catch(e => { console.error("❌ Seed failed:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
