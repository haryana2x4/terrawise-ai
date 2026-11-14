# Product Requirements Document (PRD)
## TERRAWISE AI: Precision Agro-Climatic Pilot for Smallholders
### Focus Districts: Ahilya Nagar (Ahmednagar) & Nashik, Maharashtra, India

**Version:** 1.0.0  
**Date:** November 2026  
**Status:** Approved for Pilot Execution  
**Authors:** Senior Full-Stack Engineer, GIS Engineer, Agronomy Researcher, UX Designer  

---

## 1. Executive Summary & Vision

Smallholder farmers in the semi-arid and horticultural zones of western Maharashtra—specifically **Ahilya Nagar** (formerly Ahmednagar) and **Nashik**—face compounding environmental pressures: unseasonal hail and winter rainstorms ruining grape and onion crops, prolonged mid-monsoon dry spells, severe groundwater depletion in rainshadow talukas, and deteriorating soil organic carbon.

While satellite remote sensing (NASA, ESA Copernicus, ISRO) and meteorological models provide rich diagnostics, existing agritech solutions are overloaded with academic jargon, cluttered tables, and complex dashboards that are unintelligible to rural growers.

**TERRAWISE AI Pilot** delivers an ultra-simple, dignified decision-support platform designed for **up to 20 pilot farmers**. Each farmer accesses their isolated land parcel on a high-resolution satellite map and receives clear, high-contrast, actionable guidance in Marathi (with Hindi and English options):
- Which crop to plant where for the upcoming season.
- 3-day weather and thermal extremes.
- Root-zone and topsoil moisture meters.
- Proactive, IPM-first pest risk advisories.
- Complete data integrity: 100% verified authentic observations with strict provenance, transparent timestamps, and zero hallucinated measurements.

---

## 2. Target Users & Personas

### 2.1 Primary User: The Smallholder Farmer
- **Demographics:** Landholding between 1 to 5 acres (40 to 200 Gunthas); limited formal education (Grade 4 reading level); primary language Marathi (मराठी).
- **Core Jobs-to-be-Done:**
  1. *“Tell me what crop will survive this season with the water I have in my well.”*
  2. *“Warn me 2 days before frost or hail strikes my vineyard or onion nursery.”*
  3. *“Show me if my soil is thirsty without making me do math.”*
- **Design Constraints:** 18px+ font size; icon + text pairing; sentences under 12 words; voice read-aloud support.

### 2.2 Secondary User: The Agricultural Extension / Field Officer
- **Role:** KVK (Krishi Vigyan Kendra) extension agronomist or district agriculture department officer.
- **Core Jobs-to-be-Done:**
  1. Register pilot farmers up to the strict 20-farmer cap.
  2. Verify cadastral boundaries and resolve parcel overlap disputes.
  3. Print bilingual credential cards (A6 individual, A4 batch).
  4. Monitor data freshness and source health across the district.

---

## 3. Scope & Pilot Constraints

| Parameter | Pilot Specification |
|---|---|
| **Districts Covered** | Ahilya Nagar (14 talukas) and Nashik (15 talukas) |
| **User Cap** | Maximum 20 farmers (`MAX_FARMERS=20`), enforced atomically |
| **Parcels per Farmer** | Maximum 4 distinct non-overlapping parcels |
| **Languages** | Marathi (Default), Hindi, English |
| **Boundary Input** | Satellite polygon drawing, GPS walk, GeoJSON/KML import, OSM farm confirmation |
| **Data Authenticity** | Real data only. Missing = "No data" / "माहिती नाही". Demo personas tagged `is_demo=True` |
| **Device Form Factors** | Mobile viewport (360px), Tablet (768px), Desktop (1280px+) |

---

## 4. Key Functional Requirements

### 4.1 Security, Privacy & Farmer Identity
- **FR-AUTH-1:** Unique Farmer ID format: 3-letter district prefix + hyphen + 3 digits (e.g., `NSK-001`, `AHN-007`). Distinct from Aadhaar or AgriStack IDs.
- **FR-AUTH-2:** Natural passwords generated via cryptographic randomness: 3 common English words + 2 digits (e.g., `Mango-River-Tiger-47`), hashed with Argon2id. Plaintext exists only in memory during generation.
- **FR-AUTH-3:** Strict 5-attempt rate limit leading to account lock; admin unlock required.
- **FR-AUTH-4:** Atomic hard cap of 20 farmers enforced using `BEGIN IMMEDIATE` transactions in SQLite. Attempt #21 fails with HTTP 409 `FARMER_LIMIT_REACHED`.

### 4.2 Geospatial Engine & Validation
- **FR-GEO-1:** Full RFC 7946 GeoJSON compliance in WGS84 (EPSG:4326), counter-clockwise rings, 6 decimal places.
- **FR-GEO-2:** Server-side Shapely validation: self-intersection checks, minimum 0.5-meter vertex spacing, strict district boundary containment.
- **FR-GEO-3:** Dual-engine geodesic area computation: WGS84 ellipsoid via PyProj Geod cross-checked with UTM Zone 43N (EPSG:32643). Discrepancies >0.5% are rejected.
- **FR-GEO-4:** Overlap prevention: Intersections >2% between any two farmer parcels are rejected.

### 4.3 Agronomic Decision Engine
- **FR-AGRO-1:** Seasonal detection: Kharif (Jun–Oct), Rabi (Oct–Mar), Summer (Mar–Jun).
- **FR-AGRO-2:** Multi-factor suitability scoring evaluating soil texture, root-zone moisture, heat tolerance, water source availability, crop rotation benefits, and mandi price trends.
- **FR-AGRO-3:** Recommendations provide Top 3 crops with Fit (Good / OK / Poor), Risk level (Low / Medium / High) with 2 plain-text reasons, water demand vs availability, and "first 3 things to do".
- **FR-AGRO-4:** IPM-first pest advisories: zero unverified synthetic pesticide recipes; fallback to biological/cultural controls and "Ask KVK" disclaimer.

### 4.4 Data Pipeline & Attribution
- **FR-DATA-1:** Open-Meteo hourly & 7-day agro-weather API integration cached with 3-hour TTL.
- **FR-DATA-2:** NASA POWER daily agro-climatology (precipitation, T2M, root/surface wetness, solar insolation, VPD, GDD).
- **FR-DATA-3:** Mandatory provenance on every measurement: source, observation timestamp, fetch timestamp, and license badge.
- **FR-DATA-4:** Missing data rule: null is never displayed as 0; explicit localized string "No data" / "माहिती नाही" rendered.

---

## 5. Non-Functional Requirements & Design Principles
1. **Accessibility & Legibility:** Minimum font size of 18px for body text; WCAG AAA contrast ratio; all status indicators combine icon and word (never color alone).
2. **Cognitive Simplicity:** Grade-4 reading level equivalent; cards limited to at most 3 quantitative metrics; sentences under 12 words.
3. **Performance:** Sub-1.5s First Contentful Paint (FCP) on simulated 4G mobile connections; PWA offline shell caching last fetched agronomic telemetry.
4. **Reliability:** Data health monitor flagging any feed stale beyond 48 hours.

---

## 6. Success Metrics & Verification Plan
- **100% Test Pass Rate:** GeoJSON geometry checks, SQLite concurrency limit, Argon2id credential generation, null-vs-zero formatter.
- **Lighthouse Targets:** Mobile Performance >= 85, Accessibility >= 95.
- **Responsiveness:** Full visual fidelity verified at 360px, 768px, and 1280px via automated browser agent screenshots.
