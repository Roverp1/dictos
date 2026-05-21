{
  description = "LaTeX compilation environment for Dictos report",

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  },

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      tex = pkgs.texlive.combine {
        inherit (pkgs.texlive)
          scheme-basic
          latexmk
          biber
          biblatex
          csquotes
          geometry
          setspace
          indentfirst
          titlesec
          caption
          footmisc
          ragged2e
          tocloft
          newtx
          babel-polish
          xetex
          fontspec
          etoolbox;
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          tex
        ];

        shellHook = ''
          echo "LaTeX environment loaded."
          echo "To compile the report, run:"
          echo "cd docs/report && latexmk -pdf main.tex"
        '';
      };
    };
}
