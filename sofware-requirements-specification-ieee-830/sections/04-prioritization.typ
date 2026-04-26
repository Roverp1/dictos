= Prioritization and Release Plan

== Choice of Prioritization Method
Dictos uses a Value vs Complexity matrix to prioritize requirements. This method helps identify features that provid high user value with relatively low implementation cost, while deferring high-complexity features to later releases. It fits the Rational Unified Process because the project evolves through iterative release with the core architecture validated early and extended gradually.

The prioritization criteria are:
- User value: how strongly the requirements supports the main workflow.
- Implementation complexity: how much desgin and coding effort the requirement needs.
- Risk: how likely the requirement is to introduce technical or architectural problems.

== Detailed Release Plan
1. V1: Local-first terminal application with local libSQL persistence, ReadEra and TXT imports, manual capture entry, Gemini-based definition generation, prompt management, directory organization, and export to Anki/JSON.
2. V2: Connectivity release with user accounts, cross-device synchronization, central database support, friend relationships, and public satistics.
3. V3: Mobile release with React Native support, mobile capture input, and access to core Dictos workflows from a mobile device.
