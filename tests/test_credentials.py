import unittest
import sys
import os

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from credential_cards import build_single_card_a6, build_batch_cards_a4

class TestCredentialCards(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "tmp"))
        os.makedirs(self.test_dir, exist_ok=True)
        self.single_pdf = os.path.join(self.test_dir, "test_card_a6.pdf")
        self.batch_pdf = os.path.join(self.test_dir, "test_cards_a4.pdf")

        self.sample_farmer = {
            "farmer_id": "AHN-001",
            "full_name": "Ramesh Vitthal Patil",
            "village": "Babhaleshwar",
            "taluka": "Rahuri",
            "district": "Ahilya Nagar",
            "one_time_password": "Mango-River-Tiger-47"
        }

    def tearDown(self):
        for p in [self.single_pdf, self.batch_pdf]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    def test_single_a6_card_generation(self):
        out = build_single_card_a6(self.sample_farmer, self.single_pdf)
        self.assertTrue(os.path.exists(out))
        self.assertGreater(os.path.getsize(out), 5000)

    def test_batch_a4_cards_generation(self):
        batch = [self.sample_farmer for _ in range(4)]
        out = build_batch_cards_a4(batch, self.batch_pdf)
        self.assertTrue(os.path.exists(out))
        self.assertGreater(os.path.getsize(out), 10000)

if __name__ == "__main__":
    unittest.main()
