import json
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path


SERVER = Path(__file__).with_name("ocr-server")


class WarmOcrTest(unittest.TestCase):
    def test_client_preserves_utf8_split_between_socket_reads(self):
        with tempfile.TemporaryDirectory() as folder:
            address = str(Path(folder) / "socket")
            with socket.socket(socket.AF_UNIX) as server:
                server.bind(address)
                server.listen(1)
                response = '{"words":[{"text":"coś"}]}\n'.encode("utf-8")
                split = response.index("ś".encode("utf-8")) + 1

                def serve():
                    with server.accept()[0] as client:
                        client.recv(128)
                        client.sendall(response[:split])
                        time.sleep(0.05)
                        client.sendall(response[split:])

                worker = threading.Thread(target=serve)
                worker.start()
                result = subprocess.run(
                    ["bun", str(Path(__file__).with_name("client.ts")), address, "full", "3"],
                    capture_output=True, text=True, check=True, timeout=10,
                )
                worker.join(timeout=10)
                self.assertFalse(worker.is_alive())
                self.assertEqual(json.loads(result.stdout)["words"][0]["text"], "coś")

    def test_full_crop_full_reuses_image_and_recovers_from_invalid_request(self):
        with tempfile.TemporaryDirectory() as folder:
            image = Path(folder) / "fixture.png"
            address = str(Path(folder) / "socket")
            server = subprocess.Popen([str(SERVER), address, str(image), "eng"],
                                      stdout=subprocess.PIPE, text=True)
            try:
                assert server.stdout is not None
                ready = json.loads(server.stdout.readline())
                self.assertTrue(ready["ready"])
                self.assertGreater(ready["initMs"], 0)
                self.assertFalse(image.exists())
                subprocess.run(["magick", "-size", "800x300", "xc:white", "-font", "DejaVu-Sans",
                                "-pointsize", "48", "-fill", "black", "-annotate", "+50+90", "HELLO WORLD",
                                "-annotate", "+50+240", "SECOND LINE", str(image)], check=True)

                def call(command):
                    with socket.socket(socket.AF_UNIX) as client:
                        client.settimeout(30)
                        client.connect(address)
                        client.sendall((command + "\n").encode())
                        chunks = []
                        while True:
                            data = client.recv(65536)
                            if not data:
                                break
                            chunks.append(data)
                    return json.loads(b"".join(chunks))

                first = call("FULL 6")
                crop = call("CROP 30 30 500 100 6")
                invalid = call("CROP -1 0 10 10 6")
                last = call("FULL 6")
                self.assertEqual(first["words"], last["words"])
                self.assertIn("HELLO", " ".join(word["text"] for word in first["words"]))
                self.assertNotEqual(first["words"], crop["words"])
                self.assertIn("error", invalid)
                self.assertEqual(crop["coordinateSpace"], "screenshot")
                for result in (first, crop, last):
                    self.assertGreater(result["elapsedMs"], 0)
                    self.assertGreater(result["symbolCount"], 0)
                    for word in result["words"]:
                        self.assertGreater(word["width"], 0)
                        self.assertTrue(word["symbols"])
                        for symbol in word["symbols"]:
                            self.assertGreaterEqual(symbol["x"], word["x"])
                            self.assertLessEqual(symbol["x"] + symbol["width"], word["x"] + word["width"])
                for word in crop["words"]:
                    self.assertGreaterEqual(word["x"], crop["region"]["x"])
                    self.assertLessEqual(word["y"] + word["height"],
                                         crop["region"]["y"] + crop["region"]["height"])
                client = subprocess.run(["bun", str(Path(__file__).with_name("client.ts")),
                                         address, "full", "6"], capture_output=True, text=True,
                                        check=True, timeout=30)
                self.assertEqual(json.loads(client.stdout)["words"], first["words"])
            finally:
                server.terminate()
                server.wait(timeout=5)
                if server.stdout is not None:
                    server.stdout.close()


if __name__ == "__main__":
    unittest.main()
