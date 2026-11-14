import unittest
import sys
import os
import json

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app import app
from database import init_db

class TestFlaskAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()

    def test_health_check(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["max_farmers_cap"], 20)
        self.assertIn("Ahilya Nagar (Ahmednagar)", data["pilot_districts"])

    def test_farmer_login_and_dashboard(self):
        # Login with seeded demo farmer AHN-001
        login_resp = self.client.post("/api/auth/login", json={
            "farmer_id": "AHN-001",
            "password": "Mango-River-Tiger-47"
        })
        self.assertEqual(login_resp.status_code, 200)
        login_data = login_resp.get_json()
        self.assertTrue(login_data["success"])
        token = login_data["token"]
        self.assertEqual(login_data["farmer"]["farmer_id"], "AHN-001")
        self.assertTrue(login_data["farmer"]["is_demo"])

        # Fetch dashboard with bearer token
        dash_resp = self.client.get(
            "/api/farmer/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(dash_resp.status_code, 200)
        dash_data = dash_resp.get_json()
        self.assertTrue(dash_data["success"])
        self.assertIn("today_card", dash_data)
        self.assertIn("weather", dash_data)
        self.assertIn("advice", dash_data)
        self.assertEqual(len(dash_data["advice"]["top_crops"]), 3)

    def test_admin_flow_and_farmer_listing(self):
        # Admin login
        admin_login = self.client.post("/api/auth/login", json={
            "farmer_id": "ADM-001",
            "password": "Admin-Secure-Pass-2026"
        })
        self.assertEqual(admin_login.status_code, 200)
        token = admin_login.get_json()["token"]

        # List farmers
        list_resp = self.client.get(
            "/api/admin/farmers",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(list_resp.status_code, 200)
        data = list_resp.get_json()
        self.assertIn("of 20 farmers registered", data["count_label"])
        self.assertGreaterEqual(data["total_count"], 4)

        # Check data health
        health_resp = self.client.get(
            "/api/admin/data-health",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(health_resp.status_code, 200)
        self.assertIn("open_meteo", health_resp.get_json()["summary"])

    def test_static_geojson_endpoints(self):
        dist_resp = self.client.get("/api/geo/districts")
        self.assertEqual(dist_resp.status_code, 200)
        self.assertEqual(dist_resp.get_json()["type"], "FeatureCollection")

        tal_resp = self.client.get("/api/geo/talukas")
        self.assertEqual(tal_resp.status_code, 200)
        self.assertEqual(tal_resp.get_json()["type"], "FeatureCollection")

if __name__ == "__main__":
    unittest.main()
