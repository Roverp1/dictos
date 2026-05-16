import { create } from "zustand";

type DictionaryStore = {
  inputValue: string;

  setInputValue: (newInputValue: string) => void;
};

export const useDictionaryStore = create<DictionaryStore>((set) => ({
  inputValue: "",

  setInputValue: (newInputValue) => {
    set({
      inputValue: newInputValue,
    });
  },
}));
