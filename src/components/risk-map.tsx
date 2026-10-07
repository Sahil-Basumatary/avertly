"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";

import type { Event } from "@/lib/events";
import type { Route } from "@/data/routes";
import type { ExposureAssessment } from "@/lib/exposure";

type RiskMapProps = {
  route: Route;
  events: Event[];
  assessments: ExposureAssessment[];
  selectedEventId: string;
  focusRequest: {
    eventId: string;
    sequence: number;
  } | null;
  onSelectEvent: (eventId: string) => void;
};

const routeSourceId = "active-route";
const eventSourceId = "public-reports";
const eventLayerId = "public-report-points";
const selectedEventLayerId = "selected-public-report";
const selectedEventRingLayerId = "selected-public-report-ring";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

function getStyle(): StyleSpecification {
  const apiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;

  return {
    version: 8,
    sources: {
      esriImagery: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Esri, Maxar, Earthstar Geographics",
      },
      ...(apiKey
        ? {
          cartoLabels: {
            type: "raster",
            tiles: ["a", "b", "c", "d"].map(
              (subdomain) =>
                `https://${subdomain}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`,
            ),
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        }
        : {}),
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#000000" },
      },
      {
        id: "esri-imagery",
        type: "raster",
        source: "esriImagery",
        paint: {
          "raster-opacity": 1,
          "raster-saturation": 0,
        },
      },
      ...(apiKey
        ? [
            {
              id: "carto-labels",
              type: "raster" as const,
              source: "cartoLabels",
              minzoom: 2.5,
              paint: { "raster-opacity": 1 },
            },
          ]
        : []),
    ],
  };
}

function getBounds(route: Route, events: Event[]): LngLatBoundsLike {
  const coordinates = [
    ...route.coordinates,
    ...events.map((event) => event.coordinates),
  ];
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

function getCameraPadding(map: MapLibreMap) {
  const width = map.getContainer().clientWidth;
  const height = map.getContainer().clientHeight;
  if (width >= 1280) {
    return { top: 80, right: 400, bottom: 48, left: 380 };
  }
  if (width >= 1024) {
    return { top: 80, right: 360, bottom: 48, left: 340 };
  }
  return {
    top: 24,
    right: 24,
    bottom: Math.min(144, Math.max(96, height * 0.32)),
    left: 24,
  };
}

function routeData(route: Route, coordinateCount = route.coordinates.length) {
  const coordinates = route.coordinates.slice(0, coordinateCount);

  return {
    type: "Feature" as const,
    properties: { routeId: route.id },
    geometry: {
      type: "LineString" as const,
      coordinates:
        coordinates.length === 1
          ? [coordinates[0], coordinates[0]]
          : coordinates,
    },
  };
}

function eventData(
  events: Event[],
  assessments: ExposureAssessment[],
) {
  const assessmentByEvent = new Map(
    assessments.map((assessment) => [assessment.eventId, assessment]),
  );

  return {
    type: "FeatureCollection" as const,
    features: events.map((event) => {
      const assessment = assessmentByEvent.get(event.id);

      return {
        type: "Feature" as const,
        id: event.id,
        properties: {
          eventId: event.id,
          score: assessment?.score ?? 0,
          band: assessment?.band ?? "guarded",
        },
        geometry: {
          type: "Point" as const,
          coordinates: event.coordinates,
        },
      };
    }),
  };
}

export default function RiskMap({
  route,
  events,
  assessments,
  selectedEventId,
  focusRequest,
  onSelectEvent,
}: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelectEvent);
  const lastRouteIdRef = useRef(route.id);
  const lastFocusSequenceRef = useRef(0);
  const initialPropsRef = useRef({
    route,
    events,
    assessments,
    selectedEventId,
  });

  useEffect(() => {
    onSelectRef.current = onSelectEvent;
  }, [onSelectEvent]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const initial = initialPropsRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getStyle(),
      center: [23, 20],
      zoom: 1.25,
      minZoom: 1,
      maxZoom: 9,
      attributionControl: false,
      renderWorldCopies: false,
    });

    mapRef.current = map;
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("load", () => {
      map.setProjection({ type: "globe" });
      map.setSky({
        "sky-color": "#000000",
        "horizon-color": "#7fa7bd",
        "fog-color": "#52788f",
        "fog-ground-blend": 0.75,
        "sky-horizon-blend": 0.28,
        "horizon-fog-blend": 0.45,
        "atmosphere-blend": 0.85,
      });

      map.addSource(routeSourceId, {
        type: "geojson",
        data: routeData(initial.route, 1),
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: routeSourceId,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#f4f4f5",
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 2, 6, 3.25],
          "line-opacity": 0.92,
        },
      });

      map.addSource(eventSourceId, {
        type: "geojson",
        data: eventData(initial.events, initial.assessments),
      });
      map.addLayer({
        id: eventLayerId,
        type: "circle",
        source: eventSourceId,
        layout: {
          "circle-sort-key": ["get", "score"],
        },
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "score"],
            0,
            3,
            100,
            7,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "band"], "high"],
            "#a84f4f",
            "#8b8d91",
          ],
          "circle-opacity": 0.95,
          "circle-stroke-color": "#050505",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: selectedEventLayerId,
        type: "circle",
        source: eventSourceId,
        filter: ["==", ["get", "eventId"], initial.selectedEventId],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "score"],
            0,
            5,
            100,
            9,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "band"], "high"],
            "#a84f4f",
            "#8b8d91",
          ],
          "circle-opacity": 1,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });
      map.addLayer({
        id: selectedEventRingLayerId,
        type: "circle",
        source: eventSourceId,
        filter: ["==", ["get", "eventId"], initial.selectedEventId],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "score"],
            0,
            9,
            100,
            13,
          ],
          "circle-color": "rgba(0, 0, 0, 0)",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.8,
          "circle-stroke-width": 1,
        },
      });

      const padding = getCameraPadding(map);
      const camera = map.cameraForBounds(
        getBounds(initial.route, initial.events),
        {
          padding,
          absolutePadding: true,
          maxZoom: 2.35,
        },
      );
      if (camera) {
        map.easeTo({
          ...camera,
          padding,
          duration: 1400,
        });
      }

      let visibleCoordinates = 1;
      const revealRoute = () => {
        visibleCoordinates += 1;
        const source = map.getSource(routeSourceId) as GeoJSONSource;
        source.setData(routeData(initial.route, visibleCoordinates));

        if (visibleCoordinates < initial.route.coordinates.length) {
          window.requestAnimationFrame(revealRoute);
        }
      };
      window.requestAnimationFrame(revealRoute);
    });

    map.on("click", eventLayerId, (event) => {
      const eventId = event.features?.[0]?.properties?.eventId;
      if (typeof eventId === "string") {
        onSelectRef.current(eventId);
      }
    });
    map.on("mouseenter", eventLayerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", eventLayerId, () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map?.isStyleLoaded() ||
      lastRouteIdRef.current === route.id
    ) {
      return;
    }

    lastRouteIdRef.current = route.id;
    (map.getSource(routeSourceId) as GeoJSONSource).setData(routeData(route));
    (map.getSource(eventSourceId) as GeoJSONSource).setData(
      eventData(events, assessments),
    );
    const padding = getCameraPadding(map);
    const camera = map.cameraForBounds(getBounds(route, events), {
      padding,
      absolutePadding: true,
      maxZoom: 2.35,
    });
    if (camera) {
      map.flyTo({
        ...camera,
        padding,
        duration: 1100,
        essential: true,
      });
    }
  }, [assessments, events, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getSource(eventSourceId)) {
      return;
    }

    (map.getSource(eventSourceId) as GeoJSONSource).setData(
      eventData(events, assessments),
    );
  }, [assessments, events]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const updateSelectionFilters = () => {
      if (
        !map.getLayer(selectedEventLayerId) ||
        !map.getLayer(selectedEventRingLayerId)
      ) {
        return;
      }
      const filter: maplibregl.FilterSpecification = [
        "==",
        ["get", "eventId"],
        selectedEventId,
      ];
      map.setFilter(selectedEventLayerId, filter);
      map.setFilter(selectedEventRingLayerId, filter);
    };

    if (map.isStyleLoaded()) {
      updateSelectionFilters();
      return;
    }

    map.once("load", updateSelectionFilters);
    return () => {
      map.off("load", updateSelectionFilters);
    };
  }, [selectedEventId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRequest) {
      return;
    }

    const focusEvent = () => {
      if (focusRequest.sequence <= lastFocusSequenceRef.current) {
        return;
      }
      const event = events.find(
        (candidate) => candidate.id === focusRequest.eventId,
      );
      if (!event) {
        return;
      }

      lastFocusSequenceRef.current = focusRequest.sequence;
      map.easeTo({
        center: event.coordinates,
        ...(map.getZoom() < 4 ? { zoom: 4 } : {}),
        padding: getCameraPadding(map),
        duration: 650,
        essential: true,
      });
    };

    if (map.isStyleLoaded()) {
      focusEvent();
      return;
    }

    map.once("load", focusEvent);
    return () => {
      map.off("load", focusEvent);
    };
  }, [events, focusRequest]);

  return (
    <div className="relative size-full bg-black">
      <div ref={containerRef} className="size-full" aria-label="Route risk map" />
      {!process.env.NEXT_PUBLIC_CARTO_API_KEY && (
        <div className="pointer-events-none absolute bottom-4 left-4 border border-white/10 bg-[#0c0d0f] px-2.5 py-1.5 text-[10px] tracking-wide text-zinc-500 uppercase">
          CARTO labels unavailable · imagery active
        </div>
      )}
    </div>
  );
}
