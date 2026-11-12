"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Clear previous subscription data whenever access or query scope changes. */
import { useEffect, useState } from "react";
import {
  endAt,
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
  startAt,
} from "firebase/database";
import { getFirebase } from "../lib/firebase";
import type { ValidationRecord } from "../types";
import { useAuth } from "./use-auth";
export const VALIDATION_LIMIT = 500;
export function useValidations({
  start,
  end,
}: { start?: number; end?: number } = {}) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultEnd] = useState(() => Date.now());
  const from = start ?? defaultEnd - 30 * 24 * 60 * 60 * 1000;
  const to = end ?? Number.MAX_SAFE_INTEGER;
  useEffect(() => {
    setRows([]);
    setError(null);
    if (!profile || profile.role === "VALIDADOR") {
      setLoading(false);
      return;
    }
    const client = getFirebase();
    if (!client) return;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      setError("El intervalo de fechas no es válido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    return onValue(
      query(
        ref(client.db, "validations"),
        orderByChild("timestamp"),
        startAt(from),
        endAt(to),
        limitToLast(VALIDATION_LIMIT),
      ),
      (snapshot) => {
        const result: ValidationRecord[] = [];
        snapshot.forEach((child) => {
          result.push({ ...child.val(), id: child.key });
        });
        setRows(result.reverse());
        setLoading(false);
      },
      () => {
        setRows([]);
        setError("No fue posible cargar las validaciones.");
        setLoading(false);
      },
    );
  }, [profile, from, to]);
  return { rows, loading, error, truncated: rows.length === VALIDATION_LIMIT };
}
