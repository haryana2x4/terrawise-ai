export const BRAND = {
  name: "Field Shift",
  tagline: "Adapting Farms with NASA Data",
  challenge: "NASA Space Apps Challenge 2026",
  satellites: "SMAP · ECOSTRESS · NASA POWER · MODIS · GPM",
  legal: "Field Shift Earth Observation & Precision Agriculture",
  hq: "NASA Goddard Space Flight Center & Global Agritech Network",
  license: "NASA Open Earth Science Data & Open-Access Agronomy",
};

export type Flight = {
  code: string;
  mission: string;
  destination: string;
  vehicle: string;
  pad: string;
  window: string;
  duration: string;
  crewSize: number;
  seatsLeft: number;
  status: "final_call" | "open" | "waitlist" | "classified";
  deposit: string;
  apogee: string;
};

const DAY = 86_400_000;

/** NASA Earth Observing Satellite Passes & Farm Shift Telemetry Windows */
export const MANIFEST: Flight[] = [
  {
    code: "SMAP-01",
    mission: "Root-Zone Soil Moisture Mapping",
    destination: "Midwest Grain Belt · Parcel 4A",
    vehicle: "NASA SMAP Satellite (L-Band Radar)",
    pad: "Sun-Synchronous Polar · 685 km",
    window: "2026-12-04T03:41:00Z",
    duration: "Daily Pass",
    crewSize: 450,
    seatsLeft: 142,
    status: "final_call",
    deposit: "Open Data",
    apogee: "685 km LEO",
  },
  {
    code: "ECO-02",
    mission: "Evapotranspiration & Plant Stress Scan",
    destination: "California Central Valley · Parcel 12",
    vehicle: "NASA ECOSTRESS (ISS Instrument)",
    pad: "Low Earth Orbit · 418 km",
    window: "2027-01-22T18:05:00Z",
    duration: "4-Day Revisit",
    crewSize: 180,
    seatsLeft: 58,
    status: "final_call",
    deposit: "Open Data",
    apogee: "418 km LEO",
  },
  {
    code: "PWR-03",
    mission: "Solar Irradiance & Heatwave Risk Matrix",
    destination: "Indo-Gangetic Basin · Punjab Sector",
    vehicle: "NASA POWER Climatology Constellation",
    pad: "Global Multi-Platform Data Grid",
    window: "2027-03-09T11:30:00Z",
    duration: "Continuous Hourly",
    crewSize: 220,
    seatsLeft: 84,
    status: "open",
    deposit: "Open Data",
    apogee: "705 km LEO",
  },
  {
    code: "NDVI-04",
    mission: "Canopy Health & Vegetation Index",
    destination: "Sub-Saharan Sahel · Pastoral Zone",
    vehicle: "MODIS (Terra & Aqua) + Landsat 9",
    pad: "Polar Orbital Coverage",
    window: "2027-04-27T06:12:00Z",
    duration: "8-Day Composite",
    crewSize: 310,
    seatsLeft: 110,
    status: "waitlist",
    deposit: "Open Data",
    apogee: "705 km LEO",
  },
];

export function nextWindow(now: number): Flight {
  const upcoming = MANIFEST.find((f) => Date.parse(f.window) > now);
  if (upcoming) return upcoming;
  const last = MANIFEST[MANIFEST.length - 1];
  const roll = Math.ceil((now - Date.parse(last.window)) / (365 * DAY));
  return {
    ...last,
    window: new Date(Date.parse(last.window) + roll * 365 * DAY).toISOString(),
  };
}

export const STATUS_LABEL: Record<Flight["status"], string> = {
  final_call: "Active Pass",
  open: "Calibrated",
  waitlist: "Next Orbit",
  classified: "Processing",
};

export const TELEMETRY = [
  { label: "SMAP Soil Moisture", value: "28.4", unit: "% vol", note: "Root zone (0-100cm) volumetric hydration" },
  { label: "Canopy NDVI Vigor", value: "0.78", unit: "index", note: "MODIS / Landsat 9 healthy crop index" },
  { label: "Evaporative Stress", value: "0.22", unit: "ESI", note: "ECOSTRESS thermal water deficit: LOW" },
  { label: "Solar Irradiance", value: "5.8", unit: "kWh/m²", note: "NASA POWER daily surface solar energy" },
  { label: "Rainfall Forecast", value: "14.2", unit: "mm", note: "GPM 72-hour precipitation forecast" },
  { label: "Irrigation Savings", value: "34.6", unit: "%", note: "Water preserved via recommended crop shift" },
];

export const PROGRAM_STATS = [
  { value: "1,842", label: "Farms Shifted" },
  { value: "3.8M m³", label: "Groundwater Saved" },
  { value: "6", label: "NASA Satellites" },
  { value: "+28.4%", label: "Yield Resilience" },
];

export type Phase = {
  step: string;
  title: string;
  weeks: string;
  body: string;
  detail: string[];
};

export const PHASES: Phase[] = [
  {
    step: "01",
    title: "GIS & Soil Baseline Ingestion",
    weeks: "Day 1",
    body: "Map your farm parcels or enter GPS coordinates. Field Shift syncs local soil surveys with historical NASA satellite records.",
    detail: [
      "Field boundary polygon or pin ingestion",
      "NASA SMAP 10-year soil moisture baseline",
      "Historical drought & heatwave frequency analysis",
      "Soil texture & water-holding capacity profile",
    ],
  },
  {
    step: "02",
    title: "Live NASA Earth Observation Sync",
    weeks: "Ongoing",
    body: "Automated telemetry feeds connect directly to NASA's open Earth observation satellites.",
    detail: [
      "NASA SMAP root zone hydration radar",
      "ECOSTRESS plant evapotranspiration & thermal stress",
      "NASA POWER solar radiation & degree-day tracking",
      "GPM precipitation anomalies & flood warning",
    ],
  },
  {
    step: "03",
    title: "Adaptive Crop Shift Recommendation",
    weeks: "Pre-Season",
    body: "Our AI agronomy engine calculates optimal crop shifts that maximize net revenue while conserving critical groundwater.",
    detail: [
      "Drought-resilient cultivar modeling (e.g., Sorghum, Millet)",
      "Dynamic deficit-irrigation scheduling",
      "Cover crop sequencing for soil carbon capture",
      "Nitrogen fixation & fertilizer optimization",
    ],
  },
  {
    step: "04",
    title: "Field Deployment & Yield Harvest",
    weeks: "Harvest",
    body: "Execute the shift with confidence. Track daily vegetative index (NDVI) until successful harvest.",
    detail: [
      "Direct export to John Deere / Climate FieldView GIS",
      "Weekly satellite health anomaly alerts",
      "Verified water conservation certificate",
      "Post-harvest soil regeneration index",
    ],
  },
];

export type Voice = {
  name: string;
  role: string;
  place: string;
  flight: string;
  quote: string;
  avatar: string;
};

export const VOICES: Voice[] = [
  {
    name: "Marcus Vance",
    role: "4th Generation Grain Farmer",
    place: "Des Moines, Iowa, USA",
    flight: "450 Hectares · Corn & Soy",
    quote:
      "When NASA SMAP warned us of a deep root-zone moisture deficit 3 weeks before surface signs appeared, we shifted 140 acres to drought-tolerant sorghum. It saved our season while neighboring farms dried up.",
    avatar: "/images/portrait-a.jpg",
  },
  {
    name: "Elena Rostova",
    role: "Chief Agronomist, Sonoma Agri-Vines",
    place: "Sonoma County, California, USA",
    flight: "180 Hectares · Viticulture",
    quote:
      "ECOSTRESS evapotranspiration feeds let us pinpoint precisely which vineyard blocks were heat-stressed. We cut irrigation pumping by 32% and increased grape sugar consistency across the entire harvest.",
    avatar: "/images/portrait-d.jpg",
  },
  {
    name: "Dr. Ravi Patel",
    role: "Precision Agriculture Lead",
    place: "Ludhiana, Punjab, India",
    flight: "220 Hectares · Wheat & Legumes",
    quote:
      "Transitioning away from water-depleting paddy to climate-adapted mung bean and mustard was made possible by NASA POWER growing-degree days data. Farmers are saving aquifers and earning higher margins.",
    avatar: "/images/portrait-c.jpg",
  },
  {
    name: "Amina Ndidi",
    role: "Cooperative Agro-Ecologist",
    place: "Nakuru, Kenya",
    flight: "Sahel Smallholder Network",
    quote:
      "NASA's open satellite observations are democratizing farm science. Smallholder families are timing planting with GPM satellite rain predictions instead of gambling with unseasonal dry spells.",
    avatar: "/images/portrait-b.jpg",
  },
];

export const CLASSES = [
  {
    id: "orbital",
    name: "Family Farm Tier",
    line: "10–250 Hectares · SMAP & POWER Feeds",
    price: "100% Free & Open",
    perks: ["NASA SMAP Soil Moisture Alerts", "Daily Evapotranspiration Tracking", "Adaptive Crop Shift Matrix"],
  },
  {
    id: "cislunar",
    name: "Commercial Ag Enterprise",
    line: "250–5,000+ Hectares · Multi-Parcel",
    price: "Open Agritech Tier",
    perks: ["Sub-field Landsat 9 NDVI Heatmaps", "Automated Irrigation Prescription", "Direct GIS & Shapefile Export"],
  },
  {
    id: "research",
    name: "Research / University Tier",
    line: "Regional Watersheds · Full Archive",
    price: "NASA Space Apps Grant",
    perks: ["ECOSTRESS Thermal Anomaly Feeds", "MODIS 20-Year Baseline Archive", "Open Python & R Data APIs"],
  },
];

export const REGIONS = [
  "United States · Midwest Corn Belt (Iowa / Illinois)",
  "United States · California Central Valley",
  "United States · Great Plains Wheat Corridor",
  "India · Indo-Gangetic Basin (Punjab / Haryana)",
  "India · Deccan Plateau & Maharashtra",
  "Brazil · Cerrado Soy & Maize Belt",
  "Kenya · Rift Valley & East African Highlands",
  "Nigeria · Sub-Saharan Savannah",
  "France · Beauce Grain Plain",
  "Spain · Andalusia Olive & Arid Zone",
  "Australia · Murray-Darling Basin",
  "Canada · Prairie Saskatchewan Grain Belt",
  "Argentina · Pampas Agricultural Region",
  "Ukraine · Chernozem Black Soil Plain",
  "Other Global Agricultural Zone",
];

export type FaqItem = {
  q: string;
  a: string;
};

export const FAQ: FaqItem[] = [
  {
    q: "How does NASA satellite data help my farm adapt to climate change?",
    a: "NASA Earth observation satellites like SMAP, ECOSTRESS, and Terra/Aqua MODIS collect daily measurements of soil moisture, surface temperature, vegetation health, and solar irradiance across every hectare on Earth. Field Shift translates these raw terabytes into clear, actionable advice: when to plant, which drought-hardy crops to rotate into, and exactly how much irrigation water you need.",
  },
  {
    q: "What is a 'Field Shift' and why is it better than traditional farming?",
    a: "A Field Shift is an adaptive crop rotation and parcel allocation strategy. Instead of rigidly planting the same thirsty monoculture year after year despite worsening heat and water tables, Field Shift models climate projections to transition portions of your land into resilient crops (like Sorghum, Millet, Legumes, or Cover Crops) that conserve up to 40% water while maintaining farm profitability.",
  },
  {
    q: "Do I need expensive sensors or internet in the field?",
    a: "No! All data comes from open-source NASA Earth satellites orbiting 400–700 km overhead. You only need to register your field coordinates or boundary once. Field Shift automatically retrieves the satellite passes and delivers lightweight SMS or web advisories.",
  },
  {
    q: "How accurate is NASA SMAP for soil moisture?",
    a: "NASA's SMAP (Soil Moisture Active Passive) satellite uses an advanced L-band radiometer sensitive to the microwave emission of soil water content. It provides volumetric moisture accurate to within 4% volumetric water content, both in the top 5 cm and modeled through the deep root zone (0–100 cm).",
  },
  {
    q: "Is Field Shift free for farmers and researchers?",
    a: "Yes! Born from the NASA Space Apps Challenge, Field Shift is committed to open agricultural science. All NASA satellite feeds are public domain and free to every grower worldwide.",
  },
];

export type Frame = {
  src: string;
  title: string;
  caption: string;
  credit: string;
  span: string;
};

export const FRAMES: Frame[] = [
  {
    src: "/images/earth-night-lights.jpg",
    title: "Global Cropland & Biosphere Luminescence",
    caption: "NASA satellite nighttime imaging showing planetary energy and agricultural infrastructure.",
    credit: "NASA · Earth Observatory",
    span: "lg:col-span-7",
  },
  {
    src: "/images/artemis-pad.jpg",
    title: "Earth Observation Satellite Launch Complex",
    caption: "The orbital launch pads deploying next-generation climate and radar payloads.",
    credit: "NASA · Kennedy Space Center",
    span: "lg:col-span-5",
  },
  {
    src: "/images/spacewalk.jpg",
    title: "ECOSTRESS Payload on the ISS",
    caption: "Thermal radiometers mounted on the International Space Station measuring crop heat stress.",
    credit: "NASA · ISS Expedition",
    span: "lg:col-span-4",
  },
  {
    src: "/images/earth-limb-sunrise.jpg",
    title: "Atmospheric Moisture Horizon",
    caption: "Solar backscattering revealing water vapor dynamics and tropospheric moisture layers.",
    credit: "NASA · ISS Exp. 71",
    span: "lg:col-span-4",
  },
  {
    src: "/images/mars-jezero.jpg",
    title: "Comparative Soil Mineralogy",
    caption: "Calibrated multispectral surface sensors analyzing soil composition and drought resilience.",
    credit: "NASA / JPL-Caltech",
    span: "lg:col-span-4",
  },
];
