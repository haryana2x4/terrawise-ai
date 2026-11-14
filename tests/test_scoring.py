import unittest
import sys
import os

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from advice_engine import evaluate_crop_suitability, generate_parcel_advice, load_crops_db

class TestAdviceEngine(unittest.TestCase):
    def setUp(self):
        self.crops = load_crops_db()
        self.onion = next((c for c in self.crops if c["id"] == "onion"), None)
        self.gram = next((c for c in self.crops if c["id"] == "gram"), None)

    def test_crops_database_loaded(self):
        self.assertGreaterEqual(len(self.crops), 16)
        self.assertIsNotNone(self.onion)
        self.assertIsNotNone(self.gram)

    def test_suitability_score_bounded(self):
        res = evaluate_crop_suitability(
            crop=self.onion,
            season_id="rabi",
            district="Nashik",
            soil_type="Medium Black Soil",
            irrigation_source="Well Irrigation",
            current_temp=22.0,
            root_moisture_pct=60.0
        )
        self.assertGreaterEqual(res["score"], 0.0)
        self.assertLessEqual(res["score"], 100.0)
        self.assertIn(res["fit"]["en"], ["Good", "OK", "Poor"])
        self.assertIn(res["risk"]["en"], ["Low", "Medium", "High"])
        self.assertEqual(len(res["first_3_actions"]["mr"]), 3)
        self.assertEqual(len(res["first_3_actions"]["en"]), 3)

    def test_ipm_guidance_present(self):
        res = evaluate_crop_suitability(
            crop=self.onion,
            season_id="rabi",
            district="Nashik",
            soil_type="Medium Black Soil",
            irrigation_source="Well Irrigation",
            current_temp=22.0,
            root_moisture_pct=60.0
        )
        actions = " ".join(res["first_3_actions"]["mr"])
        # Verifies cultural/biological/trap controls
        self.assertTrue(any(term in actions for term in ["सापळे", "शेणखत", "बीजप्रक्रिया", "ट्रायकोडर्मा"]))

    def test_missing_weather_handling(self):
        # Empty weather dictionary should not crash and should show 'No data'
        empty_weather = {"current": {}}
        adv = generate_parcel_advice(
            district="Ahilya Nagar",
            taluka="Rahuri",
            soil_type="Deep Black Soil",
            irrigation_source="Canal",
            current_weather=empty_weather
        )
        self.assertEqual(len(adv["top_crops"]), 3)
        self.assertEqual(adv["diagnostics"]["temperature"]["label_en"], "No data")
        self.assertEqual(adv["diagnostics"]["soil_water"]["label_en"], "No data")

if __name__ == "__main__":
    unittest.main()
