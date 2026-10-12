"""Group PP-OCRv6 recognition fragments without inventing character positions."""


def group_lines(text_lines, box_lines):
    groups = []
    ambiguous = 0

    for fragments, boxes in zip(text_lines, box_lines):
        current_text = ""
        current_box = None

        def finish():
            nonlocal current_text, current_box
            if current_text and current_box is not None:
                groups.append({"text": current_text, "box": current_box})
            current_text = ""
            current_box = None

        for fragment, box in zip(fragments, boxes):
            if not isinstance(fragment, str) or len(box) != 4:
                ambiguous += 1
                continue
            if fragment[:1].isspace():
                finish()

            core = fragment.strip()
            internal_space = len(core.split()) > 1
            if internal_space:
                ambiguous += 1
                finish()
            if core:
                left, top, right, bottom = map(float, box)
                if right <= left or bottom <= top:
                    ambiguous += 1
                    continue
                current_text += core
                current_box = (
                    [left, top, right, bottom]
                    if current_box is None
                    else [
                        min(current_box[0], left),
                        min(current_box[1], top),
                        max(current_box[2], right),
                        max(current_box[3], bottom),
                    ]
                )
            if internal_space or fragment[-1:].isspace():
                finish()

        finish()

    return groups, ambiguous
