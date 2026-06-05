import { useEffect, useState } from "react";

interface Base16Theme {
  /**   0   Black (Background)  Default Background */
  base00: string;
  /**   18  (Darkest Gray)  Lighter Background (Used for status bars) */
  base01: string;
  /**   19  (Dark Gray)   Selection Background */
  base02: string;
  /**   8   Bright Black (Gray)   Comments, Invisibles, Line Highlighting */
  base03: string;
  /**   20  (Light Gray)  Dark Foreground (Used for status bars) */
  base04: string;
  /**   7   White   Default Foreground, Caret, Delimiters, Operators */
  base05: string;
  /**   21  (Lighter White)   Light Foreground */
  base06: string;
  /**   15  Bright White  The Lightest Foreground */
  base07: string;
  /**   1 and 9   Red and Bright Red  Variables, XML Tags, Markup Link Text, Markup Lists, Diff Deleted */
  base08: string;
  /**   16  (Orange)  Integers, Boolean, Constants, XML Attributes, Markup Link Url */
  base09: string;
  /**   3 and 11  Yellow and Bright Yellow  Classes, Markup Bold, Search Text Background */
  base0A: string;
  /**   2 and 10  Green and Bright Green  Strings, Inherited Class, Markup Code, Diff Inserted */
  base0B: string;
  /**   6 and 14  Cyan and Bright Cyan  Support, Regular Expressions, Escape Characters, Markup Quotes */
  base0C: string;
  /**   4 and 12  Blue and Bright Blue  Functions, Methods, Attribute IDs, Headings */
  base0D: string;
  /**   5 and 13  Magenta and Bright Magenta  Keywords, Storage, Selector, Markup Italic, Diff Changed */
  base0E: string;
  /**   17  (Dark Red or Brown)   Deprecated, Opening/Closing Embedded Language Tags, e.g. <?php ?>} */
  base0F: string;
}

const GRUVBOX_DARK_HARD: Base16Theme = {
  base00: "#1d2021",
  base01: "#3c3836",
  base02: "#504945",
  base03: "#665c54",
  base04: "#bdae93",
  base05: "#d5c4a1",
  base06: "#ebdbb2",
  base07: "#fbf1c7",
  base08: "#fb4934",
  base09: "#fe8019",
  base0A: "#fabd2f",
  base0B: "#b8bb26",
  base0C: "#8ec07c",
  base0D: "#83a598",
  base0E: "#d3869b",
  base0F: "#d65d0e",
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Base16Theme>(GRUVBOX_DARK_HARD);
  // const renderer = useRenderer();

  // doesnt work in all terminals
  // useEffect(() => {
  //   (async () => {
  //     try {
  //       const termColors = await renderer.getPalette({ size: 256 });
  //       const p = termColors.palette;
  //
  //       const theme: Base16Theme = {
  //         base00: p[0] ?? GRUVBOX_DARK_HARD.base00,
  //         base01: p[18] ?? GRUVBOX_DARK_HARD.base01,
  //         base02: p[19] ?? GRUVBOX_DARK_HARD.base02,
  //         base03: p[8] ?? GRUVBOX_DARK_HARD.base03,
  //         base04: p[20] ?? GRUVBOX_DARK_HARD.base04,
  //         base05: p[7] ?? GRUVBOX_DARK_HARD.base05,
  //         base06: p[21] ?? GRUVBOX_DARK_HARD.base06,
  //         base07: p[15] ?? GRUVBOX_DARK_HARD.base07,
  //         base08: p[1] ?? GRUVBOX_DARK_HARD.base08,
  //         base09: p[16] ?? GRUVBOX_DARK_HARD.base09,
  //         base0A: p[3] ?? GRUVBOX_DARK_HARD.base0A,
  //         base0B: p[2] ?? GRUVBOX_DARK_HARD.base0B,
  //         base0C: p[6] ?? GRUVBOX_DARK_HARD.base0C,
  //         base0D: p[4] ?? GRUVBOX_DARK_HARD.base0D,
  //         base0E: p[5] ?? GRUVBOX_DARK_HARD.base0E,
  //         base0F: p[17] ?? GRUVBOX_DARK_HARD.base0F,
  //       };
  //
  //       setTheme(theme);
  //     } catch (err) {
  //       console.log("Failed to get terminal palette:", err as Error);
  //     }
  //   })();
  // }, [renderer]);

  return theme;
};
