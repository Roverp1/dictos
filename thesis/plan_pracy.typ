#set page(paper: "a4", margin: (
  left: 3cm,
  right: 2cm,
  top: 2.5cm,
  bottom: 2.5cm,
))
#set text(size: 12pt, lang: "en")
#set par(justify: true, leading: 1em, first-line-indent: 1.25cm)
#set heading(numbering: "1.")

#let vSpace = 2em


#align(center)[
  #v(5cm)
  #text(size: 16pt, weight: "bold")[Thesis Plan]

  #v(1cm)
  #text(
    size: 14pt,
    weight: "bold",
  )[Design and Implementation of a Local-First Cross-Platform Personal Dictionary Application with Offline Synchronization]
  #v(5cm)
]

#pagebreak()

#outline(title: "Table of Contents", indent: auto)

#pagebreak()

= Introduction
This project builds a local-first application for managing personal dictionaries. People learn languages by reading and saving new words, but the tools for this are usually disconnected. Dictos connects the process: users capture text, generate definitions using an LLM, and export the results to flashcard apps like Anki.

The goal is to build a system that works offline first. Core data stays on the device. Synchronization across devices happens in the background without forcing the user to rely on a cloud service to open the app. The thesis covers the core architecture, local storage, synchronization mechanism, and two client implementations: a Terminal UI (TUI) and a React Native mobile application.

#v(vSpace)

= Technologies Used

== Core Domain and Backend
I use TypeScript with Bun as the runtime. The core domain follows Hexagonal Architecture, keeping business rules independent of the user interface. The app uses the Turso database engine (formerly Limbo) for local storage. Turso cloud provides the synchronization layer. This setup allows the app to write data locally and sync changes to a remote database when the network is available. Drizzle ORM handles database queries and migrations.

#v(vSpace)

== Client Interfaces
The initial client is a Terminal UI built with OpenTUI, using React to manage state. The mobile client uses React Native. Both clients consume the exact same core domain logic.

#v(vSpace)

= Project Design
== Concept and Assumptions
The system assumes the user works offline most of the time. Data conflicts are resolved locally. The domain model centers around Entries (raw text), Descriptions (generated definitions), and Folders.

#v(vSpace)

== Core Architecture
I separated the application into three layers: adapters, core domain, and clients. The core domain only knows about interfaces. Adapters implement database access and API calls. This is why I can build a TUI and a mobile app without rewriting how a dictionary folder is saved.

#v(vSpace)

== User Interface: Terminal UI
The TUI focuses on keyboard speed. Users navigate folders, capture text, and trigger LLM requests without touching a mouse.

#v(vSpace)

== User Interface: React Native Mobile
The mobile client focuses on reading on the go. It provides a touch interface for the same underlying folder structure. It handles background sync when the phone connects to Wi-Fi.

#v(vSpace)

== Database Schema
The database uses deterministic UUIDv5s for primary keys instead of auto-incrementing integers or relying on SQLite UNIQUE constraints. This prevents conflicts if a user creates identical folders on two offline devices.

#v(vSpace)

== Security and Authentication
Authentication uses a thin session pattern. The central server provides a JWT and a Turso database token. These secrets stay on the local file system and never sync to the database itself.

#v(vSpace)

= Implementation
== Core Logic Implementation
This section covers writing the core services for creating entries and managing folders, including validation rules and error handling using the "errors as values" pattern.

#v(vSpace)

== Synchronization Implementation
Implementing the Turso background sync. It covers network checks, pushing the Write-Ahead Log (WAL), pulling remote changes, and handling recursive folder deletion safely.

#v(vSpace)

== TUI Client Implementation
Building the interface with OpenTUI. It includes handling keyboard events, rendering the file tree, and managing async state for LLM generation.

#v(vSpace)

== Mobile Client Implementation
Building the React Native interface. It covers screen navigation, touch interactions, and integrating the core TypeScript packages into the mobile build.

#v(vSpace)

== Testing
The core domain is tested in isolation. The tests verify that saving an entry offline generates the correct UUID and updates the local activity tracker.

#v(vSpace)

== Conclusions
This section outlines the technical findings from building the system, addressing any challenges faced during the implementation of the cross-platform clients and the offline-first synchronization.
#v(vSpace)

#v(vSpace)

= Summary
This section will summarize the final state of the project, evaluating whether the local-first approach succeeded and noting the trade-offs made to support both a terminal and mobile interface from a single core codebase.

#v(vSpace)

= Bibliography
2. Kleppmann, V., Designing Data-Intensive Applications. O'Reilly Media, 2017.
3. Official Turso documentation.
4. Additional academic and technical sources covering CRDTs, offline-first design, and spaced repetition.
