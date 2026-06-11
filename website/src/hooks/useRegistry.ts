"use client";

import { useEffect, useState } from "react";
import {
  PLUGIN_ID,
  REGISTRY_API_URL,
  type PluginVersion,
  type VersionsResponse,
} from "@/lib/registry";

type FetchState<T> = {
  data: T;
  loading: boolean;
  error: boolean;
};

async function fetchLatestFromRegistry(): Promise<PluginVersion | null> {
  const res = await fetch(
    `${REGISTRY_API_URL}/api/v1/plugins/${PLUGIN_ID}/versions/latest`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as PluginVersion;
}

async function fetchAllFromRegistry(): Promise<PluginVersion[]> {
  const res = await fetch(
    `${REGISTRY_API_URL}/api/v1/plugins/${PLUGIN_ID}/versions`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as VersionsResponse;
  return data.versions ?? [];
}

export function useLatestVersion(): FetchState<PluginVersion | null> {
  const [state, setState] = useState<FetchState<PluginVersion | null>>({
    data: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;

    fetchLatestFromRegistry()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useAllVersions(): FetchState<PluginVersion[]> {
  const [state, setState] = useState<FetchState<PluginVersion[]>>({
    data: [],
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;

    fetchAllFromRegistry()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ data: [], loading: false, error: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
