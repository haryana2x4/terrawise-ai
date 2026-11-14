# TERRAWISE AI — Image Credits & Asset Provenance

All hero scenes and agricultural imagery used in the TERRAWISE AI Maharashtra Pilot have been generated and art-directed using the pilot's internal agro-visual pipeline (`backend/generate_hero_images.py` with Pillow/Sharp processing) or verified under CC0 / Public Domain licenses.

### Hero Scenes Manifest (`/frontend/public/img/hero/hero-manifest.json`)

| Scene ID | Description | Location & Context | License |
| :--- | :--- | :--- | :--- |
| `dawn_onion_mist` | Misty dawn over onion rows | Rahuri, Ahilya Nagar | CC0 / Terrawise Production |
| `morning_vineyard_niphad` | Morning sunlight across grape vineyard rows | Niphad, Nashik | CC0 / Terrawise Production |
| `noon_lush_crops` | Midday lush green crops under bright sky | Sangamner, Ahilya Nagar | CC0 / Terrawise Production |
| `golden_hour_fields` | Golden hour backlit bajra & sugarcane | Dindori, Nashik | CC0 / Terrawise Production |
| `dusk_horizon_glow` | Warm dusk glow over Western Ghats horizon | Western Ghats Ridge | CC0 / Terrawise Production |
| `night_sky_field` | Clear night sky with fireflies over field | Niphad, Nashik | CC0 / Terrawise Production |
| `monsoon_ghats_clouds` | Monsoon cumulus clouds over verdant foothills | Igatpuri / Ghats | CC0 / Terrawise Production |
| `aerial_patchwork_fields` | Aerial top-down patchwork of smallholder parcels | Godavari Basin | CC0 / Terrawise Production |

### Resolution & Formats Generated
Each scene is generated across 4 viewport tiers in modern WebP and JPEG fallbacks:
- Desktop 2400px (`*_desktop_2400.webp`, `*_desktop_2400.jpg`)
- Desktop 1600px (`*_desktop_1600.webp`, `*_desktop_1600.jpg`)
- Tablet 1024px (`*_tablet_1024.webp`, `*_tablet_1024.jpg`)
- Mobile 640px (`*_mobile_640.webp`, `*_mobile_640.jpg`)
- Low-latency blurhash/thumb (`*_thumb.webp`)
