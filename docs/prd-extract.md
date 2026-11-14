# TERRAWISE AI Pilot — PRD Extraction & Source Analysis

## 1. Source Document Overview
- **Seed Challenge**: NASA Space Apps Challenge 2026 — *Field Shift: Adapting Farms with NASA Data* (Canonical URL: `https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/`)
- **Pilot Extension**: Autonomous Farm Pilot Specification for Maharashtra (Ahilya Nagar & Nashik Districts), November 2026.
- **Lead Organizations**: NASA Earth Science Applied Sciences Program, MPKV Rahuri, ICAR-CRIDA, Maharashtra State Department of Agriculture.

---

## 2. Core Vision & Problem Statement
Farmers in semi-arid and horticultural belts of western Maharashtra (Ahilya Nagar and Nashik) face acute climate variability:
1. **Unseasonal rains & hail storms** during grape flowering/harvest (Dec–Feb) and onion curing.
2. **Prolonged monsoon dry spells** impacting rainfed bajra, soybean, and cotton.
3. **Severe groundwater overdraft** in over-exploited talukas (e.g., Sangamner, Sinnar, Kopargaon) reliant on borewells.
4. **Soil degradation & salinity** from intensive flood-irrigated sugarcane and continuous monocropping.
5. **Information overload & complexity**: Existing agritech apps present raw graphs and dense technical jargon inaccessible to smallholder farmers or their children.

**Pilot Mission**: Deliver an ultra-simple, localized decision-support pilot for up to 20 farmers across Ahilya Nagar and Nashik. Each farmer logs in with their own credential, views their real field on a satellite map, and receives straightforward advice in Marathi (or Hindi/English): which crop to plant, real-time soil water status, 3-day weather forecast, and actionable pest alerts—using **100% verified, authentic data with complete provenance**.

---

## 3. User Personas
| Persona | Role | Primary Needs | Key Constraints |
|---|---|---|---|
| **Eknath Shinde (Demo)** | Grape & Onion Farmer, Niphad, Nashik | Vineyard frost alert, onion export mandi rate, soil water meter | Low digital literacy; requires Marathi voice/large fonts |
| **Sunita Patil (Demo)** | Soybean & Gram Farmer, Rahuri, Ahilya Nagar | Kharif-to-Rabi crop shift advice, dry spell alert, seed treatment IPM | Mobile phone with 360px screen; intermittent 4G |
| **Field Extension Officer** | KVK / Agriculture Dept Officer | Admin portal: register farmers, verify boundaries, print credential cards | Strict 20-farmer quota management; audit logging |

---

## 4. Key Functional Requirements Extracted
- **FR1: Role-Based Authentication**: Support Farmer and Admin/Field Officer roles with isolated data access.
- **FR2: Hard Farmer Cap (20 Farmers)**: Enforced via atomic database locking.
- **FR3: Farmer ID & Natural Password**: Human-friendly formats (`NSK-001`, `AHN-001`; 3 words + 2 digits).
- **FR4: Field Boundary GIS Management**: RFC 7946 GeoJSON, vertex validation, geodesic area, 0% overlap tolerance.
- **FR5: Live Data Pipeline**: Weather & soil moisture (Open-Meteo), historical agro-climate (NASA POWER), satellite greenness/NDVI, mandi prices.
- **FR6: Missing != Zero Rule**: Null values strictly rendered as "No data" / "माहिती नाही".
- **FR7: Decision Engine**: Explainable scoring for top 3 seasonal crops with Fit, Risk, water balance, and "first 3 things to do".
- **FR8: Pest & Disease Advisory**: IPM-first, zero unverified chemicals, plain Marathi explanations.
- **FR9: Simplified UI (Farmer & Child Accessible)**: Grade-4 reading level, <=12 word sentences, 18px+ text, dual visual cues (icon + text).
- **FR10: Printable Credential Cards**: A6 single cards and A4 (4-per-page) batch with QR codes and embedded Devanagari typography.
