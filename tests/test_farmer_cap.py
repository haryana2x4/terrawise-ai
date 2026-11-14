import unittest
import sys
import os
import shutil

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from database import init_db, create_farmer_atomic, MAX_FARMERS_CAP, SessionLocal
from models import Farmer

class TestFarmerCapAndConcurrency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Initialize database
        init_db()

    def test_farmer_cap_enforcement(self):
        session = SessionLocal()
        current_count = session.query(Farmer).filter(Farmer.role == "farmer").count()
        session.close()

        # Add farmers until we reach MAX_FARMERS_CAP (20)
        added_ids = []
        for i in range(current_count, MAX_FARMERS_CAP):
            success, data, code = create_farmer_atomic(
                full_name=f"Test Farmer {i+1}",
                village="Test Village",
                taluka="Rahuri",
                district="Ahilya Nagar",
                actor_id="test_runner"
            )
            self.assertTrue(success, f"Failed to add farmer #{i+1}: {data}")
            self.assertEqual(code, 201)
            added_ids.append(data["farmer_id"])

        # Check total count is exactly 20
        session = SessionLocal()
        final_count = session.query(Farmer).filter(Farmer.role == "farmer").count()
        session.close()
        self.assertEqual(final_count, 20, f"Expected exactly 20 farmers, got {final_count}")

        # Attempt #21 MUST be blocked with 409 FARMER_LIMIT_REACHED
        success_21, data_21, code_21 = create_farmer_atomic(
            full_name="Overflow Farmer 21",
            village="Overflow Village",
            taluka="Niphad",
            district="Nashik",
            actor_id="test_runner"
        )
        self.assertFalse(success_21, "21st farmer creation should have been blocked!")
        self.assertEqual(code_21, 409)
        self.assertEqual(data_21["error"], "FARMER_LIMIT_REACHED")
        self.assertIn("limit of 20 farmers has been reached", data_21["message"])

if __name__ == "__main__":
    unittest.main()
