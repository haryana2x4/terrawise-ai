# Kshetra (क्षेत्र) — System Architecture

Kshetra (formerly TERRAWISE AI) is a production-grade agricultural decision support platform built for smallholder farmers and extension officers in **Ahilya Nagar** and **Nashik**, Maharashtra.

---

## 1. Layered System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend PWA (React 19 + TypeScript + Leaflet + Service Worker)"]
        LoginUI["Login & Public /status"]
        FarmerUI["FarmerHome + TodayCard + MiniCards"]
        MapUI["FarmMap (WGS84 / KML / GeoJSON)"]
        ChatUI["AssistantChat (Krishi Mitra AI + Voice)"]
        AdminUI["AdminPortal (N/20 Cap + 7/12 Verify + PDF/CSV)"]
    end

    subgraph API["Flask API Layer (backend/app/api/v1)"]
        AuthRoutes["/api/v1/auth/* (JWT + Refresh Rotation)"]
        ParcelRoutes["/api/v1/parcels/* (IDOR Protected)"]
        AdviceRoutes["/api/v1/advice, /climate, /soil, /water, /markets"]
        BotRoutes["/api/v1/assistant/* (Rate Limited)"]
        AdminRoutes["/api/v1/admin/* & /reports/*"]
    end

    subgraph Services["Domain Services (backend/app/services)"]
        GeoSvc["GeoValidationService (RFC 7946 + WGS84 vs UTM 43N)"]
        AdviceSvc["AdviceAndRiskService (0-100 Suitability + VPD/GDD/RSHI + IPM)"]
        BotSvc["AssistantService (Prompt Guard + Provider Adapter)"]
        CardSvc["CredentialCardService (A6 / A4 Devanagari PDF)"]
    end

    subgraph Repos["Transactional Repositories (backend/app/repositories)"]
        FarmerRepo["FarmerRepository (BEGIN IMMEDIATE 20-Farmer Cap)"]
        ParcelRepo["ParcelRepository (BEGIN IMMEDIATE <=2% Overlap)"]
        TeleRepo["TelemetryRepository & CommunityRepository"]
    end

    subgraph Integrations["SSRF-Safe Integrations (backend/app/integrations)"]
        OpenMeteo["Open-Meteo IFS/GFS"]
        SoilGrids["ISRIC SoilGrids v2.0"]
        Agmarknet["Agmarknet (data.gov.in)"]
        LLMs["Gemini / OpenAI / Grounded Engine"]
    end

    Client --> API
    API --> Services
    Services --> Repos
    Services --> Integrations
```

---

## 2. Database Entity-Relationship Diagram

```mermaid
erDiagram
    FARMER ||--o{ PARCEL : owns
    FARMER ||--o{ REFRESH_TOKEN : holds
    FARMER ||--o{ ASSISTANT_MESSAGE : converses
    FARMER ||--o{ FIELD_OBSERVATION : logs
    PARCEL ||--o{ CROP_HISTORY : rotates

    FARMER {
        int id PK
        string farmer_id UK
        string name
        string role
        string password_hash
        boolean must_change_password
        string district
        string taluka
        string village
        string mobile_encrypted
        datetime consent_accepted_at
        datetime locked_until
    }

    PARCEL {
        int id PK
        string farmer_id FK
        string name
        string survey_number_encrypted
        text geojson
        float area_acres
        float area_gunthas
        float centroid_lat
        float centroid_lon
        string soil_type
        string irrigation_source
        boolean land_verified
    }

    ASSISTANT_MESSAGE {
        int id PK
        string farmer_id FK
        string role
        text content
        string language
        string provider
        int tokens_used
        int feedback_rating
        datetime created_at
    }

    WEATHER_SNAPSHOT {
        int id PK
        string lat_grid
        string lon_grid
        string source_name
        text payload_json
        datetime fetched_at
    }
```

---

## 3. Core Architectural Invariants

1. **Zero Demo in Production**: No demo routes, no seeded fake farmers, and no synthetic fallback numbers exist in production code. `scripts/check_no_demo.py` enforces this in CI/pre-commit.
2. **Missing Is Not Zero (`G2`)**: `safe_value()` wraps every telemetry value so `None` renders `"No data"` (`"माहिती नाही"` / `"कोई जानकारी नहीं"`), while `0.0` renders `"0.0 mm"`. Every metric carries a `provenance` object with source name and UTC timestamp.
3. **Atomic 20-Farmer Cap**: `FarmerRepository.create_farmer_atomic()` acquires an immediate write lock (`BEGIN IMMEDIATE` on SQLite / `SELECT ... FOR UPDATE` on PostgreSQL) before counting active farmers and inserting a new record.
4. **Dual-CRS Geodesic Polygon Validation**: `GeoValidationService` validates RFC 7946 topology, minimum 0.5m vertex spacing, containment inside Ahilya Nagar or Nashik, and cross-checks WGS84 ellipsoid geodesic area against UTM Zone 43N (`EPSG:32643`) projected area (`< 0.5%` divergence).
