import contextlib
import json
import os
import select
import socket
import subprocess
import tempfile
import unittest
from pathlib import Path


SERVER = Path(__file__).with_name("ocr-server")
CLIENT = Path(__file__).parents[1] / "src/ocr-client.ts"


def fixture(path, text=True):
    args = ["magick", "-size", "800x300", "xc:white"]
    if text:
        args += ["-font", "DejaVu-Sans", "-pointsize", "48", "-fill", "black",
                 "-annotate", "+50+90", "HELLO WORLD",
                 "-annotate", "+50+240", "SECOND LINE"]
    subprocess.run(args + [str(path)], check=True, timeout=10)


@contextlib.contextmanager
def session(image, address, language="eng"):
    process = subprocess.Popen([str(SERVER), str(address), str(image), language],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert process.stdout is not None and process.stderr is not None
    try:
        if not select.select([process.stdout], [], [], 15)[0]:
            raise AssertionError("Helper did not become ready")
        ready = json.loads(process.stdout.readline())
        assert ready["ready"] is True
        yield process
    finally:
        process.terminate()
        process.wait(timeout=5)
        process.stdout.close()
        process.stderr.close()


def call(address, command):
    with socket.socket(socket.AF_UNIX) as client:
        client.settimeout(30)
        client.connect(str(address))
        client.sendall((command + "\n").encode())
        chunks = []
        while data := client.recv(65536):
            chunks.append(data)
    return json.loads(b"".join(chunks))


class WarmOcrTest(unittest.TestCase):
    def test_invalid_requests_recover_and_padding_clips_at_screenshot_edges(self):
        with tempfile.TemporaryDirectory() as folder:
            image, address = Path(folder) / "fixture.png", Path(folder) / "socket"
            fixture(image)
            with session(image, address):
                for command in ["", "FULL", "FULL 7", "FULL 6 extra", "FULL 6.0", "QUIT",
                                "CROP -1 0 10 10 6", "CROP 0 0 0 10 6",
                                "CROP 799 0 2 10 6", "CROP 0 300 1 1 6",
                                "CROP 0 0 9223372036854775807 10 6", "x" * 128]:
                    with self.subTest(command=command):
                        self.assertIn("error", call(address, command))
                result = call(address, "CROP 0 0 800 300 6")
                self.assertEqual(result["region"], {"x": 0, "y": 0, "width": 800, "height": 300})
                for psm in (3, 6, 11):
                    self.assertIn("HELLO", [word["text"] for word in call(address, f"FULL {psm}")["words"]])
                with socket.socket(socket.AF_UNIX) as client:
                    client.connect(str(address))
                    client.sendall(b"FULL 6\n")
                self.assertTrue(call(address, "FULL 6")["words"])

    def test_missing_and_invalid_screenshot_can_be_retried_and_blank_ocr_has_no_symbols(self):
        with tempfile.TemporaryDirectory() as folder:
            image, address = Path(folder) / "fixture.png", Path(folder) / "socket"
            with session(image, address):
                self.assertIn("error", call(address, "FULL 6"))
                image.write_bytes(b"not an image")
                self.assertIn("error", call(address, "FULL 6"))
                fixture(image, text=False)
                result = call(address, "FULL 6")
                self.assertEqual(result["words"], [])
                self.assertEqual(result["symbolCount"], 0)
                self.assertEqual(call(address, "CROP 0 0 10 10 6")["words"], [])
            self.assertFalse(address.exists())
            self.assertTrue(image.exists())
        self.assertFalse(Path(folder).exists())

    def test_polish_ocr_and_client_process_preserve_unicode(self):
        with tempfile.TemporaryDirectory() as folder:
            image, address = Path(folder) / "fixture.png", Path(folder) / "socket"
            subprocess.run(["magick", "-size", "800x200", "xc:white", "-font", "DejaVu-Sans",
                            "-pointsize", "48", "-fill", "black", "-annotate", "+50+90",
                            "coś żółć", str(image)], check=True, timeout=10)
            with session(image, address, "pol"):
                result = call(address, "FULL 6")
                self.assertEqual([w["text"] for w in result["words"]], ["coś", "żółć"])
                client = subprocess.run(["bun", str(CLIENT), str(address), "full", "6"],
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(client.returncode, 0, client.stderr)
                self.assertEqual(len(client.stdout.splitlines()), 1)
                self.assertEqual(json.loads(client.stdout)["words"], result["words"])
                crop = subprocess.run(["bun", str(CLIENT), str(address), "crop", "30", "30", "400", "100", "6"],
                                      capture_output=True, text=True, timeout=30)
                self.assertEqual(crop.returncode, 0, crop.stderr)
                self.assertEqual(json.loads(crop.stdout)["region"], {"x": 10, "y": 10, "width": 440, "height": 140})

    def test_startup_failures_preserve_existing_files_and_emit_no_ready_response(self):
        with tempfile.TemporaryDirectory() as folder:
            image, address = Path(folder) / "fixture.png", Path(folder) / "socket"
            address.write_text("keep me")
            for args in [[str(address), str(image), "eng"],
                         [str(Path(folder) / "new"), str(image), "missing-language"],
                         [str(Path(folder) / ("x" * 110)), str(image), "eng"], []]:
                result = subprocess.run([str(SERVER)] + args, capture_output=True, text=True, timeout=15)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")
            self.assertEqual(address.read_text(), "keep me")
            self.assertFalse((Path(folder) / "new").exists())

    def test_truncated_and_stalled_requests_do_not_recognize_or_block_next_request(self):
        with tempfile.TemporaryDirectory() as folder:
            image, address = Path(folder) / "fixture.png", Path(folder) / "socket"
            fixture(image)
            with session(image, address):
                with socket.socket(socket.AF_UNIX) as client:
                    client.settimeout(5)
                    client.connect(str(address))
                    client.sendall(b"FULL 6")
                    client.shutdown(socket.SHUT_WR)
                    self.assertIn("error", json.loads(client.recv(65536)))
                with socket.socket(socket.AF_UNIX) as client:
                    client.settimeout(5)
                    client.connect(str(address))
                    client.sendall(b"FULL 6")
                    self.assertIn("error", json.loads(client.recv(65536)))
                self.assertTrue(call(address, "FULL 6")["words"])

    def test_private_socket_is_removed_on_termination_even_with_incomplete_request(self):
        with tempfile.TemporaryDirectory() as folder:
            image, address = Path(folder) / "fixture.png", Path(folder) / "socket"
            with session(image, address) as process:
                self.assertEqual(os.stat(address).st_mode & 0o777, 0o600)
                with socket.socket(socket.AF_UNIX) as client:
                    client.connect(str(address))
                    client.sendall(b"FULL")
                    process.terminate()
                    self.assertEqual(process.wait(timeout=5), 0)
                self.assertFalse(address.exists())
                self.assertFalse(image.exists())

    def test_full_crop_full_retains_image_and_screenshot_geometry(self):
        with tempfile.TemporaryDirectory() as folder:
            image, address = Path(folder) / "fixture.png", Path(folder) / "socket"
            with session(image, address):
                fixture(image)
                first = call(address, "FULL 6")
                image.unlink()
                crop = call(address, "CROP 30 30 500 100 6")
                last = call(address, "FULL 6")
                self.assertEqual(first["words"], last["words"])
                self.assertIn("HELLO", [word["text"] for word in first["words"]])
                self.assertIn("SECOND", [word["text"] for word in last["words"]])
                self.assertNotIn("SECOND", [word["text"] for word in crop["words"]])
                self.assertEqual(crop["region"], {"x": 10, "y": 10, "width": 540, "height": 140})
                for result in (first, crop, last):
                    self.assertEqual(result["coordinateSpace"], "screenshot")
                    self.assertEqual((result["width"], result["height"]), (800, 300))
                    self.assertGreater(result["elapsedMs"], 0)
                    self.assertEqual(result["symbolCount"], sum(len(w["symbols"]) for w in result["words"]))
                    self.assertGreater(result["symbolCount"], 0)
                    for word in result["words"]:
                        self.assertTrue(word["line"])
                        for box in [word] + word["symbols"]:
                            self.assertGreater(box["width"], 0)
                            self.assertGreater(box["height"], 0)
                            region = result.get("region", {"x": 0, "y": 0, "width": 800, "height": 300})
                            self.assertGreaterEqual(box["x"], region["x"])
                            self.assertGreaterEqual(box["y"], region["y"])
                            self.assertLessEqual(box["x"] + box["width"], region["x"] + region["width"])
                            self.assertLessEqual(box["y"] + box["height"], region["y"] + region["height"])


if __name__ == "__main__":
    unittest.main()
