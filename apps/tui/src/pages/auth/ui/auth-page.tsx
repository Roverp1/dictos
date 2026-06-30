import { useKeyboard } from "@opentui/react";
import { toast } from "@dictos/opentui-toast/react";

import { InputValidationError } from "@dictos/core";
import { useServices } from "@dictos/react";

import { useTheme } from "@shared/lib/theme";

import { useAuthStore } from "../model/use-auth-store";

export const AuthPage = () => {
  const theme = useTheme();

  const {
    activePane,
    loginEmail,
    loginPassword,
    registerEmail,
    registerPassword,
    registerUsername,
    setLoginEmail,
    setLoginPassword,
    setRegisterEmail,
    setRegisterPassword,
    setRegisterUsername,
    focusedField,
  } = useAuthStore();

  const { authService } = useServices();

  useKeyboard((key) => {
    if (key.name === "tab") {
      const { handleTabFocus } = useAuthStore.getState();

      handleTabFocus();
    }

    if (key.name === "return") {
      setTimeout(() => {
        const { activePane } = useAuthStore.getState();
        if (activePane === "login") handleLogin();
        else if (activePane === "register") handleRegister();
      }, 0);
    }
  });

  const handleLogin = async () => {
    const { loginEmail, loginPassword, setErrorMessage, setSuccess } =
      useAuthStore.getState();

    setErrorMessage(null);
    const performLogin = async () => {
      const result = await authService.login({
        email: loginEmail.trim(),
        password: loginPassword.trim(),
      });

      if (result instanceof InputValidationError) {
        console.error(result.fields);
      }

      if (result instanceof Error) {
        console.error(result);
        throw result;
      }

      return result;
    };

    const user = await toast
      .promise(performLogin(), {
        loading: "Logging in...",
        success: "Login successful!",
        error: (err: any) => err.message || "Auth failed",
      })
      ?.unwrap()
      .catch(() => {});

    console.log("result:", user);
  };

  const handleRegister = async () => {
    const {
      registerUsername,
      registerEmail,
      registerPassword,
      setErrorMessage,
      setSuccess,
    } = useAuthStore.getState();

    setErrorMessage(null);

    const performLogin = async () => {
      const result = await authService.register({
        username: registerUsername.trim(),
        email: registerEmail.trim(),
        password: registerPassword.trim(),
      });

      if (result instanceof InputValidationError) {
        console.error(result.fields);
      }

      if (result instanceof Error) {
        console.error(result);
        throw result;
      }

      return result;
    };

    const user = await toast
      .promise(performLogin(), {
        loading: "Registrating...",
        success: "Registration successful!",
        error: (err: any) => err.message || "Registration failed",
      })
      ?.unwrap()
      .catch(() => {});

    console.log("result:", user);
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

// // @ts-expect-error opentui type bug
// onSubmit={handleSubmit}
// keyBindings={[
//   { name: "return", action: "submit" },
//   { name: "s", ctrl: true, action: "submit" },
// ]}
