import unittest

from word_groups import group_lines


class WordGroupsTest(unittest.TestCase):
    def test_polish_fragments_attach_until_a_space(self):
        groups, ambiguous = group_lines(
            [["Podr", "óż", "ny"], ["Oj", ", ", "co", "ś ", "mnie", " ", "rwie", "."]],
            [
                [[1, 0, 21, 10], [21, 0, 31, 10], [31, 0, 42, 10]],
                [[1, 20, 11, 30], [11, 20, 15, 30], [18, 20, 26, 30],
                 [26, 20, 30, 30], [34, 20, 55, 30], [55, 20, 59, 30],
                 [60, 20, 80, 30], [80, 20, 82, 30]],
            ],
        )
        self.assertEqual([group["text"] for group in groups],
                         ["Podróżny", "Oj,", "coś", "mnie", "rwie."])
        self.assertEqual(groups[0]["box"], [1, 0, 42, 10])
        self.assertEqual(groups[-1]["box"], [60, 20, 82, 30])
        self.assertEqual(ambiguous, 0)

    def test_internal_spaces_do_not_fabricate_multiple_boxes(self):
        groups, ambiguous = group_lines([["one two", "three"]],
                                        [[[0, 0, 40, 10], [45, 0, 75, 10]]])
        self.assertEqual([group["text"] for group in groups], ["one two", "three"])
        self.assertEqual(ambiguous, 1)


if __name__ == "__main__":
    unittest.main()
