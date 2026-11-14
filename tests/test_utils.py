import unittest
import sys
import os

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from utils import (
    safe_value,
    hash_password,
    verify_password,
    generate_natural_password,
    generate_farmer_id,
    format_provenance
)

class TestUtils(unittest.TestCase):
    def test_safe_value_null_vs_zero(self):
        # 1. Null / None must render 'No data' and 'माहिती नाही'
        res_none = safe_value(None, source="Open-Meteo", observed_at="2026-11-14")
        self.assertTrue(res_none["is_missing"])
        self.assertIsNone(res_none["value"])
        self.assertEqual(res_none["display"]["en"], "No data")
        self.assertEqual(res_none["display"]["mr"], "माहिती नाही")

        # 2. Recorded 0 must render '0' (not null or missing)
        res_zero = safe_value(0, source="Open-Meteo", observed_at="2026-11-14")
        self.assertFalse(res_zero["is_missing"])
        self.assertEqual(res_zero["value"], 0)
        self.assertEqual(res_zero["display"]["en"], "0")
        self.assertEqual(res_zero["display"]["mr"], "0")

        # 3. Recorded 0.0 must render '0.0'
        res_zero_float = safe_value(0.0, source="Open-Meteo", observed_at="2026-11-14")
        self.assertFalse(res_zero_float["is_missing"])
        self.assertEqual(res_zero_float["value"], 0.0)
        self.assertEqual(res_zero_float["display"]["en"], "0.0")

        # 4. Fill values like -999.0 must be treated as missing
        res_fill = safe_value(-999.0, source="NASA POWER", observed_at="2026-11-14")
        self.assertTrue(res_fill["is_missing"])

        # 5. Real positive values
        res_val = safe_value(28.4, source="Open-Meteo", observed_at="2026-11-14")
        self.assertFalse(res_val["is_missing"])
        self.assertEqual(res_val["value"], 28.4)
        self.assertEqual(res_val["display"]["en"], "28.4")

    def test_argon2_password_hashing(self):
        pwd = "Mango-River-Tiger-47"
        h = hash_password(pwd)
        self.assertTrue(h.startswith("$argon2id$"))
        self.assertTrue(verify_password(h, pwd))
        self.assertFalse(verify_password(h, "Wrong-Password-99"))

    def test_natural_password_generator(self):
        p1 = generate_natural_password()
        p2 = generate_natural_password()
        self.assertNotEqual(p1, p2)
        # Check format: Word-Word-Word-Digits
        parts = p1.split("-")
        self.assertEqual(len(parts), 4)
        self.assertTrue(parts[0].isalpha())
        self.assertTrue(parts[1].isalpha())
        self.assertTrue(parts[2].isalpha())
        self.assertTrue(parts[3].isdigit())

    def test_farmer_id_generation(self):
        self.assertEqual(generate_farmer_id("Ahilya Nagar", 1), "AHN-001")
        self.assertEqual(generate_farmer_id("Ahmednagar", 12), "AHN-012")
        self.assertEqual(generate_farmer_id("Nashik", 7), "NSK-007")

    def test_provenance_formatting(self):
        prov = format_provenance("Open-Meteo", "14 Nov 2026, 3:00 pm", is_stale=False)
        self.assertEqual(prov, "Source: Open-Meteo, updated 14 Nov 2026, 3:00 pm")
        
        stale = format_provenance("Open-Meteo", "12 Nov 2026, 10:00 am", is_stale=True)
        self.assertEqual(stale, "Old data from 12 Nov 2026, 10:00 am (Source: Open-Meteo)")

if __name__ == "__main__":
    unittest.main()
