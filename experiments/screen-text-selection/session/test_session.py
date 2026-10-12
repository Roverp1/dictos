import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
BINARY = Path(__file__).with_name("session-probe")
IMAGE = ROOT / "tmp/screeshoots/500-words.png"


class SessionProbeTest(unittest.TestCase):
    def test_reuse_bounds_and_recovery(self):
        commands = "FULL\nCROP 100 100 400 300\nCROP -1 0 10 10\nFULL\nQUIT\n"
        run = subprocess.run([str(BINARY), str(IMAGE), "eng"], input=commands,
                             text=True, capture_output=True, check=True, timeout=120)
        ready, full, crop, invalid, again = map(json.loads, run.stdout.splitlines())
        self.assertEqual(ready["type"], "ready")
        self.assertEqual(invalid["type"], "error")
        self.assertEqual(crop["region"], [80, 80, 440, 340])
        for result in (full, crop, again):
            self.assertEqual(result["type"], "result")
            self.assertNotIn("text", result)
            self.assertGreater(result["wordCount"], 0)
            self.assertGreater(result["symbolCount"], 0)
            self.assertEqual(result["wordCount"], len(result["words"]))
            self.assertEqual(result["symbolCount"], len(result["symbols"]))
            self.assertGreaterEqual(result["recognizeMs"], 0)
            for x, y, width, height in result["words"] + result["symbols"]:
                self.assertGreater(width, 0)
                self.assertGreater(height, 0)
                self.assertGreaterEqual(x, 0)
                self.assertGreaterEqual(y, 0)
                self.assertLessEqual(x + width, ready["width"])
                self.assertLessEqual(y + height, ready["height"])
        self.assertEqual(full["words"], again["words"])
        self.assertEqual(full["symbols"], again["symbols"])
        self.assertNotEqual(full["words"], crop["words"])
        left, top, width, height = crop["region"]
        for x, y, w, h in crop["words"] + crop["symbols"]:
            self.assertGreaterEqual(x, left)
            self.assertGreaterEqual(y, top)
            self.assertLessEqual(x + w, left + width)
            self.assertLessEqual(y + h, top + height)


if __name__ == "__main__":
    unittest.main()
