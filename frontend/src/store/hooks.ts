// Typed Redux hooks. Use these in components and custom hooks instead of the
// raw `useDispatch` / `useSelector` so the store types flow through correctly.
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./store";

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
