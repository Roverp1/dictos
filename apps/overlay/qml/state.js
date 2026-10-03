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
    descriptions: emptyDescriptions(),
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

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}
function emptyDescriptions() {
  return ["definition", "translation", "example", "misc"].map(function (type) {
    return { key: type + "-0", type: type, text: "", edited: false };
  });
}
function snapshot(state) {
  return {
    entryText: state.entry.text,
    descriptionText: state.capturedDescription.text,
    instructionText: state.instructionText,
    senseName: state.senseName,
    descriptions: copy(state.descriptions),
  };
}
function restore(state, saved) {
  state.entry.text = saved.entryText;
  state.capturedDescription.text = saved.descriptionText;
  state.instructionText = saved.instructionText;
  state.senseName = saved.senseName;
  state.descriptions = copy(saved.descriptions);
  return state;
}
function chooseSense(current, name) {
  var state = copy(current);
  var before = snapshot(state);
  state.senseName = name;
  state.descriptions = emptyDescriptions();
  state.generationRevision++;
  state.activeGenerationActionRevision = state.generationRevision;
  state.undo.push({
    before: before,
    after: snapshot(state),
    requestRevision: state.generationRevision,
    generated: null,
    resultApplied: false,
  });
  state.redo = [];
  return state;
}
function applyGenerated(state, generated) {
  state.senseName = generated.senseName;
  generated.descriptions.forEach(function (description) {
    var slot = state.descriptions.find(function (item) {
      return item.type === description.type && !item.text.trim();
    });
    if (slot) {
      slot.text = description.text;
      slot.edited = false;
    } else
      state.descriptions.push({
        key: description.type + "-" + state.descriptions.length,
        type: description.type,
        text: description.text,
        edited: false,
      });
  });
  state.descriptions.sort(function (a, b) {
    return (
      ["definition", "translation", "example", "misc"].indexOf(a.type) -
      ["definition", "translation", "example", "misc"].indexOf(b.type)
    );
  });
  return state;
}
function receiveGeneration(current, revision, generated) {
  var state = copy(current);
  var action = state.undo.concat(state.redo).find(function (item) {
    return item.requestRevision === revision;
  });
  if (!action) return state;
  action.generated = copy(generated);
  var after = restore(copy(state), action.after);
  applyGenerated(after, generated);
  action.after = snapshot(after);
  if (state.activeGenerationActionRevision === revision) {
    applyGenerated(state, generated);
    action.resultApplied = true;
    state.activeGenerationActionRevision = null;
  }
  return state;
}
function undoDraft(current) {
  var state = copy(current);
  var action = state.undo.pop();
  if (!action) return state;
  if (!action.generated || action.resultApplied) action.after = snapshot(state);
  restore(state, action.before);
  state.redo.push(action);
  state.generationRevision++;
  state.activeGenerationActionRevision = null;
  return state;
}
function redoDraft(current) {
  var state = copy(current);
  var action = state.redo.pop();
  if (!action) return state;
  restore(state, action.after);
  if (action.generated) action.resultApplied = true;
  state.undo.push(action);
  state.generationRevision++;
  state.activeGenerationActionRevision = action.generated
    ? null
    : action.requestRevision;
  return state;
}
function changeText(current, field, text, remember) {
  var state = copy(current);
  var before = snapshot(state);
  if (field === "entry") {
    state.entry.text = text;
    state.entry.edited = true;
  } else if (field === "description") {
    state.capturedDescription.text = text;
    state.capturedDescription.edited = true;
  } else if (field === "instruction") state.instructionText = text;
  else if (field === "sense") state.senseName = text;
  else
    state.descriptions.forEach(function (item) {
      if (item.key === field) {
        item.text = text;
        item.edited = true;
      }
    });
  state.generationRevision++;
  state.activeGenerationActionRevision = null;
  state.redo = [];
  if (remember) {
    state.undo.push({
      before: before,
      after: snapshot(state),
      requestRevision: null,
      generated: null,
    });
    state.redo = [];
  }
  return state;
}
function beginGeneration(current) {
  var state = copy(current);
  var before = snapshot(state);
  state.descriptions.forEach(function (description) {
    if (state.selectedTypes.includes(description.type)) {
      description.text = "";
      description.edited = false;
    }
  });
  state.generationRevision++;
  state.activeGenerationActionRevision = state.generationRevision;
  state.undo.push({
    before: before,
    after: snapshot(state),
    requestRevision: state.generationRevision,
    generated: null,
    resultApplied: false,
  });
  state.redo = [];
  return state;
}
function savePayload(state, mode) {
  var base = {
    kind: "entry",
    entryText: state.entry.text,
    descriptionText: state.capturedDescription.text.trim()
      ? state.capturedDescription.text
      : null,
  };
  if (mode === "entry") return base;
  base.kind = "sense";
  base.includeDescription = mode === "sense-all";
  base.senseName = state.senseName;
  base.descriptions = state.descriptions
    .filter(function (item) {
      return item.text.trim();
    })
    .map(function (item) {
      return { type: item.type, text: item.text };
    });
  return base;
}
function validSaveReceipt(data, payload) {
  function id(value) {
    return typeof value === "string" && value.trim().length > 0;
  }
  if (
    !data ||
    typeof data !== "object" ||
    !payload ||
    !id(data.entryId) ||
    (data.senseId !== null && !id(data.senseId)) ||
    (data.capturedDescriptionId !== null && !id(data.capturedDescriptionId)) ||
    !Array.isArray(data.descriptionIds) ||
    !data.descriptionIds.every(id) ||
    new Set(data.descriptionIds).size !== data.descriptionIds.length ||
    data.descriptionIds.includes(data.capturedDescriptionId)
  )
    return false;
  var captured =
    !!payload.descriptionText?.trim() &&
    (payload.kind === "entry" || payload.includeDescription);
  if (captured !== (data.capturedDescriptionId !== null)) return false;
  if (payload.kind === "entry")
    return data.senseId === null && data.descriptionIds.length === 0;
  return (
    id(data.senseId) &&
    data.descriptionIds.length ===
      payload.descriptions.filter(function (d) {
        return d.text.trim();
      }).length
  );
}
