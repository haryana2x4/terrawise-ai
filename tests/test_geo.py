import unittest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from geo_validator import (
    validate_and_process_polygon,
    check_parcel_overlap,
    calculate_geodesic_area_sqm,
    calculate_projected_area_sqm
)

class TestGeospatialValidation(unittest.TestCase):
    def setUp(self):
        # A valid farm parcel in Rahuri, Ahilya Nagar (~2 hectares)
        # Coordinates roughly: 74.65°E, 19.38°N
        self.valid_ahilyanagar_parcel = {
            "type": "Polygon",
            "coordinates": [[
                [74.6500, 19.3800],
                [74.6515, 19.3800],
                [74.6515, 19.3815],
                [74.6500, 19.3815],
                [74.6500, 19.3800]
            ]]
        }

        # A valid vineyard parcel in Niphad, Nashik (~2.5 hectares)
        # Coordinates roughly: 74.10°E, 20.08°N
        self.valid_nashik_parcel = {
            "type": "Polygon",
            "coordinates": [[
                [74.1000, 20.0800],
                [74.1020, 20.0800],
                [74.1020, 20.0815],
                [74.1000, 20.0815],
                [74.1000, 20.0800]
            ]]
        }

    def test_valid_polygon_metrics(self):
        res = validate_and_process_polygon(self.valid_ahilyanagar_parcel, district="Ahilya Nagar")
        self.assertTrue(res["valid"], f"Validation failed: {res.get('error')}")
        self.assertGreater(res["area_ha"], 1.0)
        self.assertGreater(res["area_acre"], 2.0)
        self.assertGreater(res["area_guntha"], 80.0)
        self.assertLess(res["discrepancy_pct"], 0.5)
        self.assertEqual(res["clean_geometry"]["type"], "Polygon")

    def test_self_intersection_rejected(self):
        # Bowtie / figure-8 polygon
        self_intersecting = {
            "type": "Polygon",
            "coordinates": [[
                [74.6500, 19.3800],
                [74.6520, 19.3820],
                [74.6520, 19.3800],
                [74.6500, 19.3820],
                [74.6500, 19.3800]
            ]]
        }
        res = validate_and_process_polygon(self_intersecting, district="Ahilya Nagar")
        self.assertFalse(res["valid"])
        self.assertIn("invalid", res["error"].lower())

    def test_close_vertices_rejected(self):
        # Two vertices closer than 0.5 meters (~0.000004 degrees)
        close_vertices = {
            "type": "Polygon",
            "coordinates": [[
                [74.650000, 19.380000],
                [74.650002, 19.380001], # ~0.2m away
                [74.651500, 19.380000],
                [74.651500, 19.381500],
                [74.650000, 19.381500],
                [74.650000, 19.380000]
            ]]
        }
        res = validate_and_process_polygon(close_vertices, district="Ahilya Nagar")
        self.assertFalse(res["valid"])
        self.assertIn("0.5m", res["error"])

    def test_district_containment_rejected(self):
        # Polygon clearly outside Ahilya Nagar (e.g. in Pune or Mumbai or Nashik coordinates evaluated against Ahilya Nagar)
        # Nashik coordinate evaluated against Ahilya Nagar
        res = validate_and_process_polygon(self.valid_nashik_parcel, district="Ahilya Nagar")
        self.assertFalse(res["valid"])
        self.assertIn("does not lie inside district", res["error"])

    def test_overlap_detection(self):
        # Overlapping polygon with Ahilya Nagar parcel (>50% overlap)
        overlapping_parcel = {
            "type": "Polygon",
            "coordinates": [[
                [74.6505, 19.3805],
                [74.6520, 19.3805],
                [74.6520, 19.3820],
                [74.6505, 19.3820],
                [74.6505, 19.3805]
            ]]
        }
        has_overlap, msg = check_parcel_overlap(overlapping_parcel, [self.valid_ahilyanagar_parcel])
        self.assertTrue(has_overlap)
        self.assertIn("overlaps by", msg.lower())

    def test_non_overlapping_parcels_allowed(self):
        # Adjacent non-overlapping parcel
        adjacent_parcel = {
            "type": "Polygon",
            "coordinates": [[
                [74.6530, 19.3800],
                [74.6545, 19.3800],
                [74.6545, 19.3815],
                [74.6530, 19.3815],
                [74.6530, 19.3800]
            ]]
        }
        has_overlap, msg = check_parcel_overlap(adjacent_parcel, [self.valid_ahilyanagar_parcel])
        self.assertFalse(has_overlap)
        self.assertIsNone(msg)

if __name__ == "__main__":
    unittest.main()
