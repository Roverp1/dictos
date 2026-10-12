import unittest

from compare import matched_words, overlap, replacement_stats


class WordGeometryComparisonTest(unittest.TestCase):
    def test_overlap_and_matching_ignore_distant_identical_words(self):
        reference = [
            {"text": "coś", "x": 10, "y": 10, "width": 30, "height": 20},
            {"text": "coś", "x": 210, "y": 10, "width": 30, "height": 20},
        ]
        candidates = [
            {"text": "coś", "box": [9, 9, 42, 32]},
            {"text": "coś", "box": [400, 9, 430, 32]},
        ]
        matched, median = matched_words(reference, candidates)
        self.assertEqual(matched, 1)
        if median is None:
            self.fail("Expected an overlapping word")
        self.assertGreater(median, 0.7)
        self.assertEqual(overlap([0, 0, 10, 10], [20, 20, 30, 30]), 0)

    def test_replacement_ignores_distant_words_but_counts_changed_text(self):
        reference = [{"text": "better", "x": 11, "y": 9, "width": 30, "height": 20}]
        selected = [
            {"text": "wrong", "box": [10, 10, 41, 29]},
            {"text": "far", "box": [200, 10, 220, 29]},
        ]
        self.assertEqual(replacement_stats(reference, selected), {
            "replacementCandidateCount": 1,
            "replacementTextChangedCount": 1,
            "replacementUnmatchedCount": 1,
        })


if __name__ == "__main__":
    unittest.main()
