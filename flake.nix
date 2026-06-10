{
  description = "Dictos Dev Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {inherit system;};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [turso-cli turso bun];
        };
        shellHook =
          # bash
          ''
            echo "Dictos dev environment loaded."
            echo "Turso CLI: $(turso --version)"
          '';
      }
    );
}
