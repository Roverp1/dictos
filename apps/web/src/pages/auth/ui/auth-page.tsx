import { toast } from "sonner";
import { InputValidationError } from "@dictos/core";
import { useServices } from "@dictos/react";
import { useTheme } from "../../../shared/lib/theme";
import { useAuthStore } from "../model/use-auth-store";
import { useEffect } from "react";

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
    setActivePane,
  } = useAuthStore();

  const { authService } = useServices();

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const { loginEmail, loginPassword } = useAuthStore.getState();

    const performLogin = async () => {
      const result = await authService.login({
        email: loginEmail.trim(),
        password: loginPassword.trim(),
      });

      if (result instanceof InputValidationError) {
        console.error(result.fields);
        const messages = result.fields.map(f => `${f.path}: ${f.message}`).join(', ');
        throw new Error(`Validation failed: ${messages}`);
      }

      if (result instanceof Error) {
        throw result;
      }

      return result;
    };

    toast.promise(performLogin(), {
      loading: "Logging in...",
      success: "Login successful!",
      error: (err: any) => err.message || "Auth failed",
    });
  };

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const {
      registerUsername,
      registerEmail,
      registerPassword,
    } = useAuthStore.getState();

    const performRegister = async () => {
      const result = await authService.register({
        username: registerUsername.trim(),
        email: registerEmail.trim(),
        password: registerPassword.trim(),
      });

      if (result instanceof InputValidationError) {
        console.error(result.fields);
        const messages = result.fields.map(f => `${f.path}: ${f.message}`).join(', ');
        throw new Error(`Validation failed: ${messages}`);
      }

      if (result instanceof Error) {
        throw result;
      }

      return result;
    };

    toast.promise(performRegister(), {
      loading: "Registering...",
      success: "Registration successful!",
      error: (err: any) => err.message || "Registration failed",
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !["TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        if (activePane === "login") handleLogin();
        else if (activePane === "register") handleRegister();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePane]);

  const paneStyle = (isActive: boolean) => ({
    display: "flex",
    flexDirection: "column" as const,
    width: "50%",
    padding: "2rem",
    gap: "1.5rem",
    borderRight: isActive && activePane === "login" ? `2px solid ${theme.base0D}` : `1px solid ${theme.base04}`,
    borderLeft: isActive && activePane === "register" ? `2px solid ${theme.base0D}` : "none",
    backgroundColor: isActive ? theme.base01 : theme.base00,
    transition: "all 0.2s ease",
  });

  const inputGroupStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  };

  const labelStyle = {
    color: theme.base04,
    fontSize: "0.8rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };

  const inputStyle = {
    backgroundColor: theme.base00,
    color: theme.base05,
    border: `1px solid ${theme.base03}`,
    padding: "0.75rem",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", height: "100%", backgroundColor: theme.base00 }}>
      {/* Login Pane */}
      <div style={paneStyle(activePane === "login")} onClick={() => setActivePane("login")}>
        <h2 style={{ color: activePane === "login" ? theme.base0D : theme.base05, margin: 0 }}>
          Login
        </h2>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            style={inputStyle}
            placeholder="Enter email..."
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            style={inputStyle}
            placeholder="Enter password..."
          />
        </div>

        {activePane === "login" && (
          <div style={{ color: theme.base03, fontSize: "0.8rem", marginTop: "auto" }}>
            Press Enter to submit.
          </div>
        )}
      </div>

      {/* Registration Pane */}
      <div style={paneStyle(activePane === "register")} onClick={() => setActivePane("register")}>
        <h2 style={{ color: activePane === "register" ? theme.base0D : theme.base05, margin: 0 }}>
          Register
        </h2>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>Username</label>
          <input
            type="text"
            value={registerUsername}
            onChange={(e) => setRegisterUsername(e.target.value)}
            style={inputStyle}
            placeholder="Enter username..."
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={registerEmail}
            onChange={(e) => setRegisterEmail(e.target.value)}
            style={inputStyle}
            placeholder="Enter email..."
          />
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={registerPassword}
            onChange={(e) => setRegisterPassword(e.target.value)}
            style={inputStyle}
            placeholder="Enter password..."
          />
        </div>

        {activePane === "register" && (
          <div style={{ color: theme.base03, fontSize: "0.8rem", marginTop: "auto" }}>
            Press Enter to submit.
          </div>
        )}
      </div>
    </div>
  );
};
