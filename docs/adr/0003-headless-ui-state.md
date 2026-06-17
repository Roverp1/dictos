# 0003 - Headless UI State Architecture (inpired by Yazi Model)

We decided to split the headless UI state into three distinct parts: `treeCursor` (for keyboard previewing), `activeItem` (for explicit locking/mobile visibility), and a `selectionPool` (for batch action targets based on the Yazi file manager model).

We chose this over a simpler, single `focusedItemIndex` because a single state cannot handle the requirement of keeping a description open on mobile while continuing to navigate the tree, nor can it elegantly handle cross-platform batch actions (like right-clicking an unselected item). This guarantees actions target the correct items regardless of whether the input is touch, mouse, or keyboard.
