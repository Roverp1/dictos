---
date: July 2025
title: "Runtime and Deployment View"
---

# Runtime View {#section-runtime-view}

::: formalpara-title
**Contents**
:::

The runtime view describes concrete behavior and interactions of the system's building blocks in form of scenarios from the following areas:

- important use cases or features: how do building blocks execute them?

- interactions at critical external interfaces: how do building blocks cooperate with users and neighboring systems?

- operation and administration: launch, start-up, stop

- error and exception scenarios

Remark: The main criterion for the choice of possible scenarios (sequences, workflows) is their **architectural relevance**. It is **not** important to describe a large number of scenarios. You should rather document a representative selection.

::: formalpara-title
**Motivation**
:::

You should understand how (instances of) building blocks of your system perform their job and communicate at runtime. You will mainly capture scenarios in your documentation to communicate your architecture to stakeholders that are less willing or able to read and understand the static models (building block view, deployment view).

::: formalpara-title
**Form**
:::

There are many notations for describing scenarios, e.g.

- numbered list of steps (in natural language)

- activity diagrams or flow charts

- sequence diagrams

- BPMN or EPCs (event process chains)

- state machines

- ...​

::: formalpara-title
**Further Information**
:::

See [Runtime View](https://docs.arc42.org/section-6/) in the arc42 documentation.

## <Runtime Scenario 1> {#_runtime_scenario_1}

- *<insert runtime diagram or textual description of the scenario>*

- *<insert description of the notable aspects of the interactions between the building block instances depicted in this diagram.>*

## <Runtime Scenario 2> {#_runtime_scenario_2}

## ...​

## <Runtime Scenario n> {#_runtime_scenario_n}

# Deployment View {#section-deployment-view}

::: formalpara-title
**Content**
:::

The deployment view describes:

1. technical infrastructure used to execute your system, with infrastructure elements like geographical locations, environments, computers, processors, channels and net topologies as well as other infrastructure elements and

2. mapping of (software) building blocks to that infrastructure elements.

Often systems are executed in different environments, e.g. development environment, test environment, production environment. In such cases you should document all relevant environments.

Especially document a deployment view if your software is executed as distributed system with more than one computer, processor, server or container or when you design and construct your own hardware processors and chips.

From a software perspective it is sufficient to capture only those elements of an infrastructure that are needed to show a deployment of your building blocks. Hardware architects can go beyond that and describe an infrastructure to any level of detail they need to capture.

::: formalpara-title
**Motivation**
:::

Software does not run without hardware. This underlying infrastructure can and will influence a system and/or some cross-cutting concepts. Therefore, there is a need to know the infrastructure.

::: formalpara-title
**Form**
:::

Maybe a highest level deployment diagram is already contained in section 3.2. as technical context with your own infrastructure as ONE black box. In this section one can zoom into this black box using additional deployment diagrams:

- UML offers deployment diagrams to express that view. Use it, probably with nested diagrams, when your infrastructure is more complex.

- When your (hardware) stakeholders prefer other kinds of diagrams rather than a deployment diagram, let them use any kind that is able to show nodes and channels of the infrastructure.

::: formalpara-title
**Further Information**
:::

See [Deployment View](https://docs.arc42.org/section-7/) in the arc42 documentation.

## Infrastructure Level 1 {#_infrastructure_level_1}

Describe (usually in a combination of diagrams, tables, and text):

- distribution of a system to multiple locations, environments, computers, processors, .., as well as physical connections between them

- important justifications or motivations for this deployment structure

- quality and/or performance features of this infrastructure

- mapping of software artifacts to elements of this infrastructure

For multiple environments or alternative deployments please copy and adapt this section of arc42 for all relevant environments.

***<Overview Diagram>***

Motivation

:   *<explanation in text form>*

Quality and/or Performance Features

:   *<explanation in text form>*

Mapping of Building Blocks to Infrastructure

:   *<description of the mapping>*

## Infrastructure Level 2 {#_infrastructure_level_2}

Here you can include the internal structure of (some) infrastructure elements from level 1.

Please copy the structure from level 1 for each selected element.

### <Infrastructure Element 1> {#_infrastructure_element_1}

*<diagram + explanation>*

### <Infrastructure Element 2> {#_infrastructure_element_2}

*<diagram + explanation>*

...​

### <Infrastructure Element n> {#_infrastructure_element_n}

*<diagram + explanation>*
