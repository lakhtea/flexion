"use client";

import { useState, useEffect, useRef } from "react";
import type { Exercise } from "@/lib/tempapp/types";
import { EXERCISE_SEARCH_DEBOUNCE_MS } from "@/lib/tempapp/constants";

/**
 * Debounced exercise search hook.
 *
 * This useEffect IS legitimate synchronization: it syncs the search results
 * with the current query string, debounced to avoid hammering the API on
 * every keystroke. The "event" is the user typing; the effect synchronizes
 * the external state (API results) with the local state (query).
 */
export function useExerciseSearch(query: string) {
  const [results, setResults] = useState<Exercise[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    timerRef.current = setTimeout(() => {
      fetch(`/api/tempapp/exercises?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data);
          setSearching(false);
        })
        .catch(() => {
          setResults([]);
          setSearching(false);
        });
    }, EXERCISE_SEARCH_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  function clearResults() {
    setResults([]);
  }

  return { results, searching, clearResults };
}
