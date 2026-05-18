import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { AuthService, User } from "@dictos/core";

import { useTheme } from "@shared/lib/theme";
import { password } from "bun";

export interface AuthPageProps {
  authService: AuthService;
}

export const AuthPage = ({ authService }: AuthPageProps) => {
  const theme = useTheme();

  // Active Pane State
  const [activePane, setActivePane] = useState<"login" | "register">("login");

  // Form States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<User | null>(null);

  // Focus Management
  type FocusableField =
    | "login-email"
    | "login-password"
    | "register-username"
    | "register-email"
    | "register-password";

  const [focusedField, setFocusedField] =
    useState<FocusableField>("login-email");

  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocusedField((prev) => {
        switch (prev) {
          case "login-email":
            return "login-password";
          case "login-password":
            setActivePane("register");
            return "register-username";
          case "register-username":
            return "register-email";
          case "register-email":
            return "register-password";
          case "register-password":
            setActivePane("login");
            return "login-email";
          default:
            return "login-email";
        }
      });
    }

    if (key.name === "return") {
      if (activePane === "login") handleLogin();
      else if (activePane === "register") handleRegister();
    }
  });

  const handleLogin = async () => {
    setErrorMessage(null);
    const result = await authService.login({
      email: loginEmail,
      password: loginPassword,
    });

    if (result instanceof Error) {
      setErrorMessage(result.message);
      console.error(result);
      return;
    }

    console.log("result:", result);
    setSuccess(result);
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    const result = await authService.register({
      username: registerUsername,
      email: registerEmail,
      password: registerPassword,
    });

    if (result instanceof Error) {
      setErrorMessage(result.message);
      console.error(result);
      return;
    }

    console.log("result:", result);
    setSuccess(result);
  };

  return (
    <box
      height="100%"
      flexDirection="row"
    >
      {/* Login Pane */}
      <box
        flexDirection="column"
        border={["right"]}
        borderColor={activePane === "login" ? theme.base0D : theme.base04}
        width="50%"
        paddingX={2}
        gap={1}
      >
        <box marginBottom={1}>
          <text fg={activePane === "login" ? theme.base0D : theme.base05}>
            Login
          </text>
        </box>

        <box flexDirection="column">
          <text fg={theme.base04}>Email</text>
          <input
            value={loginEmail}
            onChange={setLoginEmail}
            focused={focusedField === "login-email"}
            placeholder="Enter email..."
          />
        </box>

        <box flexDirection="column">
          <text fg={theme.base04}>Password</text>
          <input
            value={loginPassword}
            onChange={setLoginPassword}
            focused={focusedField === "login-password"}
            placeholder="Enter password..."
          />
        </box>

        <box marginTop={2}>
          <text fg={theme.base03}>
            {activePane === "login"
              ? "Press Tab to switch fields. Press Enter to submit."
              : ""}
          </text>
        </box>
      </box>

      {/* Registration Pane */}
      <box
        flexDirection="column"
        width="50%"
        paddingX={2}
        gap={1}
        border={["left"]}
        borderColor={activePane === "register" ? theme.base0D : theme.base04}
      >
        <box marginBottom={1}>
          <text fg={activePane === "register" ? theme.base0D : theme.base05}>
            Register
          </text>
        </box>

        <box flexDirection="column">
          <text fg={theme.base04}>Username</text>
          <input
            value={registerUsername}
            onChange={setRegisterUsername}
            focused={focusedField === "register-username"}
            placeholder="Enter username..."
          />
        </box>

        <box flexDirection="column">
          <text fg={theme.base04}>Email</text>
          <input
            value={registerEmail}
            onChange={setRegisterEmail}
            focused={focusedField === "register-email"}
            placeholder="Enter email..."
          />
        </box>

        <box flexDirection="column">
          <text fg={theme.base04}>Password</text>
          <input
            value={registerPassword}
            onChange={setRegisterPassword}
            focused={focusedField === "register-password"}
            placeholder="Enter password..."
          />
        </box>

        <box marginTop={2}>
          <text fg={theme.base03}>
            {activePane === "register"
              ? "Press Tab to switch fields. Press Enter to submit."
              : ""}
          </text>
        </box>
      </box>
    </box>
  );
};
