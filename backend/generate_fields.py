import json
import os
import sys

# Ensure backend path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo_validator import validate_and_process_polygon

dest_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "geo"))

demo_fields = [
    {
        "farmer_ref": "AHN-001",
        "district": "Ahilya Nagar",
        "taluka": "Rahuri",
        "village": "Babhaleshwar",
        "boundary_source": "farmer_drawn",
        "accuracy_m": 1.2,
        "verified_by_officer": True,
        "is_demo": True,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [74.6510, 19.3820],
                [74.6535, 19.3820],
                [74.6535, 19.3840],
                [74.6510, 19.3840],
                [74.6510, 19.3820]
            ]]
        }
    },
    {
        "farmer_ref": "AHN-002",
        "district": "Ahilya Nagar",
        "taluka": "Sangamner",
        "village": "Ghanegaon",
        "boundary_source": "gps_walk",
        "accuracy_m": 2.4,
        "verified_by_officer": True,
        "is_demo": True,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [74.2150, 19.5700],
                [74.2175, 19.5700],
                [74.2175, 19.5725],
                [74.2150, 19.5725],
                [74.2150, 19.5700]
            ]]
        }
    },
    {
        "farmer_ref": "NSK-001",
        "district": "Nashik",
        "taluka": "Niphad",
        "village": "Lasalgaon",
        "boundary_source": "farmer_drawn",
        "accuracy_m": 1.5,
        "verified_by_officer": True,
        "is_demo": True,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [74.2250, 20.1450],
                [74.2280, 20.1450],
                [74.2280, 20.1475],
                [74.2250, 20.1475],
                [74.2250, 20.1450]
            ]]
        }
    },
    {
        "farmer_ref": "NSK-002",
        "district": "Nashik",
        "taluka": "Dindori",
        "village": "Vani",
        "boundary_source": "osm_suggested",
        "accuracy_m": 3.0,
        "verified_by_officer": True,
        "is_demo": True,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [73.9400, 20.2400],
                [73.9430, 20.2400],
                [73.9430, 20.2425],
                [73.9400, 20.2425],
                [73.9400, 20.2400]
            ]]
        }
    }
]

feature_collection = {"type": "FeatureCollection", "features": []}

for df in demo_fields:
    val = validate_and_process_polygon(df["geometry"], district=df["district"])
    if not val["valid"]:
        print(f"Validation failed for {df['farmer_ref']}: {val['error']}")
        continue
    feat = {
        "type": "Feature",
        "properties": {
            "farmer_ref": df["farmer_ref"],
            "district": df["district"],
            "taluka": df["taluka"],
            "village": df["village"],
            "area_sqm": val["area_sqm"],
            "area_ha": val["area_ha"],
            "area_acre": val["area_acre"],
            "area_guntha": val["area_guntha"],
            "boundary_source": df["boundary_source"],
            "accuracy_m": df["accuracy_m"],
            "verified_by_officer": df["verified_by_officer"],
            "is_demo": True,
            "created_at": "2026-11-14T23:49:00+05:30"
        },
        "geometry": val["clean_geometry"]
    }
    feature_collection["features"].append(feat)

out_fields = os.path.join(dest_dir, "fields.geojson")
with open(out_fields, "w", encoding="utf-8") as f:
    json.dump(feature_collection, f, indent=2)

print(f"Generated {out_fields} with {len(feature_collection['features'])} valid demo fields! File size: {os.path.getsize(out_fields)} bytes")
