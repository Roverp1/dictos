{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: let
  serverDataDir = "apps/server/.data";
in {
  env = {
    NODE_ENV = "development";
    LOG_LEVEL = "trace";
    TURSO_SYNC_URL = "http://localhost:8080";
  };

  packages = with pkgs; [bun turso turso-cli secretspec gh gemini-cli];

  processes = {
    turso-sync.exec = "tursodb ${serverDataDir}/sync-server.db --sync-server 0.0.0.0:8080";
    server.exec = "secretspec run -- bun run dev:server";
    web.exec = "secretspec run -- bun run dev:web";
  };

  tasks = {
    "dictos:init-dirs" = {
      exec =
        # bash
        ''
          if [ ! -d "${serverDataDir}" ]; then
            mkdir -p "${serverDataDir}"
            echo '{"devenv":{"messages":["Created \u001b[34mapps/server/.data\u001b[0m directory for server related data"]}}' > "$DEVENV_TASK_OUTPUT_FILE"
          fi
        '';
      before = ["devenv:enterShell"];
    };
  };

  enterShell =
    # bash
    ''
      echo "====================================="
      echo -e "🚀 Dictos Dev Environment Loaded"
      echo "Bun: $(bun --version)"
      echo "Turso: $(turso --version)"
      echo "====================================="
      echo ""

      if secretspec check -n 2>&1 | grep -q "No provider backend configured"; then
        echo -e "\x1b[1;33m================================================================="
        echo -e "      ACTION REQUIRED: Secret management is not configured."
        echo -e "=================================================================\x1b[0m"
        echo "Before you can run the project, you must initialize your secrets."
        echo ""
        echo "Please run this command, and re-enter the devenv shell:"
        echo -e "╰─▶ \x1b[34msecretspec config init\x1b[0m"
        echo ""
        echo "(Recommendation: choose 'keyring' for security, or 'dotenv for simplicity)"
        echo -e "\x1b[33m<------        End of sequence        ------>\x1b[0m"
        return
      fi

      if secretspec check -n 2>&1 | grep -q "is required but not set"; then
        echo -e "\x1b[1;33m================================================================="
        echo -e "      ACTION REQUIRED: You are missing required secrets."
        echo -e "=================================================================\x1b[0m"

        secretspec check -n
        echo ""
        echo "Please run this command to set all missing secrets:"
        echo -e "╰─▶ \x1b[34msecretspec check\x1b[0m"
        echo ""

        echo "Alternatively set individual secrets with this command:"
        echo -e "╰─▶ \x1b[34msecretspec set <SECRET_NAME>\x1b[0m"
        echo ""

        echo -e "\x1b[33m<------        End of sequence        ------>\x1b[0m"
        return
      fi

      echo "Run 'devenv up' to start the Server and Web UI."
      echo "Run 'bun run dev:tui' to start the Terminal UI."

      echo ""
    '';

  languages.typescript.enable = true;

  dotenv.disableHint = true;
}
