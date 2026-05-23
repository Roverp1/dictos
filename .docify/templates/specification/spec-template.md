# Specification: [FEATURE NAME]

**Status**: Draft | **Created**: [DATE]

## 1. The Problem (Why are we doing this?)

<!--
  ACTION REQUIRED: Explain the pain point or the opportunity.
  Why does the user need this? What is broken or missing today?
  Write this as a narrative, not a checklist.
-->

[Write 2-3 paragraphs describing the context and the problem. E.g., "Currently, users can only use Dictos on one device. If their hard drive crashes, they lose their vocabulary. We need a way to let them seamlessly access their data anywhere..."]

## 2. The Solution (What are we building?)

<!--
  ACTION REQUIRED: Describe the high-level solution.
  Focus on the user experience and the business value. Do NOT mention databases, frameworks, or code architecture here.
-->

[Describe the feature. E.g., "We will introduce an opt-in cloud synchronization feature. Users will create an account, and their local captures will automatically sync in the background..."]

## 3. User Experience (How does it work?)

<!--
  ACTION REQUIRED: Describe the feature from the user's perspective.
  Use narrative scenarios or simple "When X happens, Y occurs" formats.
-->

### Core Workflows

- **Scenario: First-time setup**
  [Describe the flow. E.g., "The user opens the TUI and types `/login`. They are prompted for..."]

- **Scenario: Offline behavior**
  [Describe the flow. E.g., "If the user adds a word while disconnected from WiFi, the app saves it locally and..."]

## 4. Feature Boundaries (What is OUT of scope?)

<!--
  CRITICAL: Explicitly list what you are NOT building. This prevents scope creep.
-->

- [ ] [e.g., We are NOT building collaborative sharing in this iteration.]
- [ ] [e.g., We are NOT supporting conflict resolution UI; the server always wins for now.]

## 5. Success Criteria (How do we know we are done?)

<!--
  ACTION REQUIRED: Define measurable or binary outcomes that prove the feature works.
-->

- [ ] [e.g., A user can add a capture on Device A, and it appears on Device B within 5 seconds.]
- [ ] [e.g., The app remains fully functional and responsive even if the sync server goes down.]

## 6. Open Questions & Unknowns

<!--
  If there are things you and the agent still need to figure out during the technical `/docify.plan` phase, list them here.
-->

- [ ] [e.g., Do we need to encrypt the data before it hits the central server?]

