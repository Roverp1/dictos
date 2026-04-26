---
date: July 2025
title: "Cross-cutting Concepts, Decisions and Quality"
---

# Cross-cutting Concepts {#section-concepts}

::: formalpara-title
**Content**
:::

This section describes crosscutting concepts (practices, patterns, regulations or solution ideas). Such concepts are often related to multiple building blocks. Add a diagram here if you need one.

::: formalpara-title
**Motivation**
:::

Concepts form the basis for *conceptual integrity* (consistency, homogeneity) of the architecture. Thus, they are an important contribution to achieve inner qualities of your system.

This is the place in the template that we provided for a cohesive specification of such concepts.

Many of these concepts relate to or influence several of your building blocks.

::: formalpara-title
**Form**
:::

The form can be varied:

- concept papers with any kind of structure

- example implementations,especially for technical concepts

- cross-cutting model excerpts or scenarios using notations of the architecture views

::: formalpara-title
**Structure**
:::

Pick **only** the most-needed topics for your system and assign each a level-2 heading in this section (e.g. 8.1, 8.2 etc).

DO NOT ATTEMPT to cover all of the topics of the aforementioned diagram.

::: formalpara-title
**Further Information**
:::

Some topics within systems often concern multiple building blocks, hardware elements or development processes. It might be easier to communicate or document such *cross-cutting* topics at a central location, instead of repeating them in the description of the concerned building blocks, hardware elements or development processes.

Certain concepts might concern **all** elements of a system, others might only be relevant for a few. In the diagram above, logging concerns all three components, whereas security is relevant only for two components.

See [Concepts](https://docs.arc42.org/section-8/) in the arc42 documentation.

## <Concept 1> {#_concept_1}

*<explanation>*

## <Concept 2> {#_concept_2}

*<explanation>*

## <Concept n> {#_concept_n}

*<explanation>*

# Architecture Decisions {#section-design-decisions}

::: formalpara-title
**Contents**
:::

Important, expensive, large scale or risky architecture decisions including rationales. With "decisions" we mean selecting one alternative based on given criteria.

Please use your judgement to decide whether an architectural decision should be documented here in this central section or whether you better document it locally (e.g. within the white box template of one building block).

Avoid redundancy. Refer to section 4, where you already captured the most important decisions of your architecture.

::: formalpara-title
**Motivation**
:::

Stakeholders of your system should be able to comprehend and retrace your decisions.

::: formalpara-title
**Form**
:::

Various options:

- ADR ([Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)) for every important decision

- List or table, ordered by importance and consequences or:

- more detailed in form of separate sections per decision

::: formalpara-title
**Further Information**
:::

See [Architecture Decisions](https://docs.arc42.org/section-9/) in the arc42 documentation. There you will find links and examples about ADR.

# Quality Requirements {#section-quality-scenarios}

::: formalpara-title
**Content**
:::

This section contains all relevant quality requirements.

The most important of these requirements have already been described in section 1.2. (quality goals), therefore they should only be referenced here. In this section 10 you should also capture quality requirements with lesser importance, which will not create high risks when they are not fully achieved (but might be *nice-to-have*).

::: formalpara-title
**Motivation**
:::

Since quality requirements will have a lot of influence on architectural decisions you should know what qualities are really important for your stakeholders, in a specific and measurable way.

- See [Quality Requirements](https://docs.arc42.org/section-10/) in the arc42 documentation.

- See the extensive [Q42 quality model on https://quality.arc42.org](https://quality.arc42.org).

## Quality Requirements Overview {#_quality_requirements_overview}

::: formalpara-title
**Content**
:::

An overview or summary of quality requirements.

::: formalpara-title
**Motivation**
:::

Often we encounter dozens (or even hundreds) of detailed quality requirements. In this overview section you should try to summarize, e.g. by describing categories or topics (as suggested by [ISO 25010:2023](https://www.iso.org/obp/ui/#iso:std:iso-iec:25010:ed-2:v1:en) or [Q42](https://quality.arc42.org))

If these summary descriptions are already precise, specific enough and measurable, you may skip section 10.2.

::: formalpara-title
**Form**
:::

Use a simple table in which each line contains a category or topic and a short description of the quality requirement. Alternatively, you may use a mindmap to structure these quality requirements. In literature, the idea of a *quality attribute tree* has also been described, which puts the generic term "quality" as the root and uses a tree-like refinement of the term "quality". [Bass+21] introduced the term "Quality Attribute Utility Tree" for this purpose.

## Quality Scenarios {#_quality_scenarios}

::: formalpara-title
**Content**
:::

Quality scenarios make quality requirements concrete and allow to decide whether they are fulfilled (in the sense of acceptance criteria). Ensure that your scenarios are specific and measurable.

Two kinds of scenarios are especially useful:

- *Usage scenarios* (also called application scenarios or use case scenarios) describe the system's runtime reaction to a certain stimulus. This also includes scenarios that describe the system's efficiency or performance. Example: The system reacts to a user's request within one second.

- *Change scenarios* describe the desired effect of a modification or extension of the system or of its immediate environment. Example: Additional functionality is implemented or requirements for a quality attribute change, and the effort or duration of the change is measured.

::: formalpara-title
**Form**
:::

Typical information for detailed scenarios include the following:

In short form (favoured in the Q42 model):

- **Context/Background**: What kind of system or component, what is the envirionment or situation?

- **Source/Stimulus**: Who or what initiates or triggers a behaviour, reaction or action.

- **Metric/Acceptance Criteria**: A response including a *measure* or *metric*

The long form of scenarios (favoured by the SEI and [Bass+21]) is more detailed and includes the following information:

- **Scenario ID**: A unique identifier for the scenario.

- **Scenario Name**: A short, descriptive name for the scenario.

- **Source**: The entity (user, system, or event) that initiates the scenario.

- **Stimulus**: The triggering event or condition the system must address.

- **Environment**: The operational context or condition under which the system experiences the stimulus.

- **Artifact**: The building-blocks or other elements of the system affected by the stimulus.

- **Response**: The outcome or behavior the system exhibits in reaction to the stimulus.

- **Response Measure**: The criteria or metric by which the system's response is evaluated.

::: formalpara-title
**Examples**
:::

See [the Q42 quality model website](https://quality.arc42.org) for detailed examples of quality requirements.

- Len Bass, Paul Clements, Rick Kazman: "Software Architecture in Practice", 4th Edition, Addison-Wesley, 2021.
