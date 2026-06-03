#import "variables.typ": *

#set page(paper: "a4", margin: (x: 2.5cm, y: 2.5cm), numbering: "1")
#set text(font: "New Computer Modern", size: 11pt)
#set heading(numbering: "1.1")
#show heading: set block(above: 3em, below: 1em)

#align(center)[
  #v(20%)
  #text(size: 22pt)[Software Requirements Specification] \
  #v(1em)
  #text(size: 18pt)[Dictos: Cross-platform dictionary] \

  #v(45%)
  #text(size: 14pt)[Yaroslav Zabakha] \

  #v(10%)
  #text(size: 12pt)[Social Science Academy] \
  #v(0.5em)
  #text(size: 12pt)[121546\@student.san.edu.pl] \
  #v(0.5em)
  #text(size: 12pt)[Software Engineering Project 2025/2026]
]

#pagebreak()
#outline(indent: auto)
#pagebreak()

#include "sections/01-introduction.typ"
#include "sections/02-overall-description.typ"
#include "sections/03-specific-requirements.typ"
#include "sections/04-prioritization.typ"
#include "sections/05-appendices.typ"

