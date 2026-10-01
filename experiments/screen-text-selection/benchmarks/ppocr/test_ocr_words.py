import unittest

from ocr_words import word_result


class OverlayWordResultTest(unittest.TestCase):
    def test_returns_reconstructed_screen_words_only(self):
        words, ambiguous = word_result({
            "text_word": [["Podr", "óż", "ny", " ", "Oj", ","]],
            "text_word_boxes": [[[10, 20, 25, 40], [25, 20, 34, 40],
                                 [34, 20, 44, 40], [44, 20, 47, 40],
                                 [50, 20, 62, 40], [62, 20, 66, 40]]],
        }, 100, 100)
        self.assertEqual([word["text"] for word in words], ["Podróżny", "Oj,"])
        self.assertEqual(words[0]["x"], 10)
        self.assertEqual(words[0]["width"], 34)
        self.assertEqual(ambiguous, 0)


if __name__ == "__main__":
    unittest.main()
