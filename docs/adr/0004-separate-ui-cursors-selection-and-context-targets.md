# Separate UI Cursors, Selection, and Context Targets

We decided to supersede the earlier Yazi-style `activeItem`/`selectionPool` model with separate Dictionary UI concepts for cursor position, opened Entry, persistent selection, and temporary context menu targeting: `treeCursor`, `descriptionCursor`, `activeEntryId`, `selectedTreeItems`, and `contextMenuTarget`. We chose this because Vim-style keyboard navigation, mail-style click/tap opening, batch selection, and right-click/long-press targeting are different user intents and collapse into bugs when stored as one focused item or one generic selection pool.

Right-clicking or long-pressing an item does not mutate the cursor, active Entry, or persistent selection by itself. If the context menu target is already selected, actions apply to the selected tree items; otherwise actions apply only to the context menu target.
