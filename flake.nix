{
  description = "LaTeX compilation environment for Dictos report";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = [
          pkgs.texliveFull
        ];

        shellHook = ''
          echo "LaTeX environment loaded (texliveFull)."
          echo "To compile the report, run:"
          echo "cd docs/report && latexmk -pdf main.tex"
        '';
      };
    };
}
