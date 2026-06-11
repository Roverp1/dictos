{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  env = {
    NODE_ENV = "development";
    LOG_LEVEL = "trace";
  };

  packages = with pkgs; [bun turso turso-cli secretspec];

  processes = {
    server.exec = "secretspec run -- bun run dev:server";
    web.exec = "bun run dev:web";
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
    '';

  dotenv.disableHint = true;
}
