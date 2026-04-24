= Prioritization and Release Plan
// Mandatory section for the class.

== Choice of Prioritization Method
// We use the Five-Way Priority Scheme.
// Factors: User value, implementation cost, and risk.
We use a Valllue vs Complexity matrix to prioritize requirements. This method allows us to identify low-handging fruits (features with high value and low complexity) for Release and defer high value and high complexity features to later releases. This aligns with the RUP methodology of iterative development, where the core architecture is proven in early versions.

== Detailed Release Plan
// Release 1 (MVP): Core TUI, local SQLite, Gemini integration, basic Anki export.
// Release 2: User accounts, cloud sync, and central server.
// Release 3: Mobile/Web interfaces.
1. V1: TUI application, local libSQL persistence, ReadEra/TXT imports, manual capture entry and Gemini API integration for definition generation
2. V2: Centralized sync server, optional user registration (to use cloud sync), and cross-device data consistency
3. V3: React Native mobile application supporting core features, mobile specific capture logic (select to save), and cloud synchronization
