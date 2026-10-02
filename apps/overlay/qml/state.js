/** @typedef {{ x: number, y: number, width: number, height: number }} OcrBox */
/** @typedef {OcrBox & { text: string, confidence: number }} OcrSymbol */
/** @typedef {OcrBox & { text: string, line: string, block: number, confidence: number, symbols: OcrSymbol[] }} OcrWord */
/** @typedef {{ word: number, offset: number }} TextPosition */
/** @typedef {{ start: TextPosition, end: TextPosition, whole?: boolean }} TextRange */
/** @typedef {{ text: string, selection: TextRange | null, sourceWords: OcrWord[], edited: boolean }} SelectedText */
/** @typedef {{ key: string, type: string, text: string, edited: boolean }} TypedDescriptionDraft */
/** @typedef {{ entryText: string, descriptionText: string, instructionText: string, senseName: string, descriptions: TypedDescriptionDraft[] }} DraftSnapshot */
/** @typedef {{ before: DraftSnapshot, after: DraftSnapshot, requestRevision: number | null, generated: object | null }} DraftHistoryAction */

function newOverlayState() {
  return {
    entry: { text: "", selection: null, sourceWords: [], edited: false },
    capturedDescription: {
      text: "",
      selection: null,
      sourceWords: [],
      edited: false,
    },
    instructionText: "",
    selectedTypes: ["definition"],
    senseName: "",
    descriptions: [],
    suggestions: [],
    activeField: "entry",
    activeNodeId: null,
    drawer: "compact",
    mode: "compact-edit",
    generationRevision: 0,
    activeGenerationActionRevision: null,
    undo: [],
    redo: [],
  };
}
