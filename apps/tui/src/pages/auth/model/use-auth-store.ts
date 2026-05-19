import { create } from "zustand";

// Active Pane State
//  const [activePane, setActivePane] = useState<"login" | "register">("login");

//  Form States
//  const [loginEmail, setLoginEmail] = useState("");
//  const [loginPassword, setLoginPassword] = useState("");

//  const [registerUsername, setRegisterUsername] = useState("");
//  const [registerEmail, setRegisterEmail] = useState("");
//  const [registerPassword, setRegisterPassword] = useState("");

//  const [errorMessage, setErrorMessage] = useState<string | null>(null);
//  const [success, setSuccess] = useState<User | null>(null);

import type { User } from "@dictos/core";
import type { FocusableField } from "./types";

type AuthStore = {
  focusedField: FocusableField;
  activePane: "login" | "register";
  loginEmail: string;
  loginPassword: string;
  registerUsername: string;
  registerEmail: string;
  registerPassword: string;
  errorMessage: string | null;
  success: User | null;

  setFocusedField: (newValue: FocusableField) => void;
  setActivePane: (newValue: "login" | "register") => void;
  setLoginEmail: (newValue: string) => void;
  setLoginPassword: (newValue: string) => void;
  setRegisterUsername: (newValue: string) => void;
  setRegisterEmail: (newValue: string) => void;
  setRegisterPassword: (newValue: string) => void;
  setErrorMessage: (newValue: string | null) => void;
  setSuccess: (newValue: User) => void;
  handleTabFocus: () => void;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  focusedField: "login-email",
  activePane: "login",
  loginEmail: "",
  loginPassword: "",
  registerUsername: "",
  registerEmail: "",
  registerPassword: "",
  errorMessage: null,
  success: null,

  setFocusedField: (newValue) => {
    set({
      focusedField: newValue,
    });
  },

  setActivePane: (newValue) => {
    set({
      activePane: newValue,
    });
  },

  setLoginEmail: (newValue) => {
    set({
      loginEmail: newValue,
    });
  },

  setLoginPassword: (newValue) => {
    set({
      loginPassword: newValue,
    });
  },

  setRegisterUsername: (newValue) => {
    set({
      registerUsername: newValue,
    });
  },

  setRegisterEmail: (newValue) => {
    set({
      registerEmail: newValue,
    });
  },

  setRegisterPassword: (newValue) => {
    set({
      registerPassword: newValue,
    });
  },

  setErrorMessage: (newValue) => {
    set({
      errorMessage: newValue,
    });
  },

  setSuccess: (newValue) => {
    set({
      success: newValue,
    });
  },

  handleTabFocus: () => {
    // get() дозволяє безпечно прочитати поточний стейт всередині стору
    const { focusedField } = get();

    switch (focusedField) {
      case "login-email":
        set({ focusedField: "login-password" });
        break;
      case "login-password":
        set({ activePane: "register", focusedField: "register-username" });
        break;
      case "register-username":
        set({ focusedField: "register-email" });
        break;
      case "register-email":
        set({ focusedField: "register-password" });
        break;
      case "register-password":
        set({ activePane: "login", focusedField: "login-email" });
        break;
      default:
        set({ focusedField: "login-email" });
    }
  },
}));
