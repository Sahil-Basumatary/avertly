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
import type { RouteAssessment } from "@/data/replay-events";

type RiskMapProps = {
  route: Route;
  events: Event[];
  assessments: RouteAssessment[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
};

const routeSourceId = "active-route";
const eventSourceId = "public-reports";
const eventLayerId = "public-report-points";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

function getStyle(): StyleSpecification {
  const apiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;

  return {
    version: 8,
    sources: apiKey
      ? {
          carto: {
            type: "raster",
            tiles: [
              `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(apiKey)}`,
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        }
      : {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#070809" },
      },
      ...(apiKey
        ? [
            {
              id: "carto-dark",
              type: "raster" as const,
              source: "carto",
              paint: { "raster-opacity": 0.72 },
            },
          ]
        : []),
    ],
  };
}

function getBounds(route: Route): LngLatBoundsLike {
  const longitudes = route.coordinates.map(([longitude]) => longitude);
  const latitudes = route.coordinates.map(([, latitude]) => latitude);

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
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
  assessments: RouteAssessment[],
  selectedEventId: string,
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
          selected: event.id === selectedEventId,
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
  onSelectEvent,
}: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelectEvent);
  const lastRouteIdRef = useRef(route.id);
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
        "sky-color": "#040506",
        "horizon-color": "#16181b",
        "fog-color": "#08090a",
        "sky-horizon-blend": 0.35,
        "horizon-fog-blend": 0.45,
        "atmosphere-blend": 0.75,
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
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.25, 6, 2],
          "line-opacity": 0.92,
        },
      });

      map.addSource(eventSourceId, {
        type: "geojson",
        data: eventData(
          initial.events,
          initial.assessments,
          initial.selectedEventId,
        ),
      });
      map.addLayer({
        id: eventLayerId,
        type: "circle",
        source: eventSourceId,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "score"],
            0,
            4,
            100,
            9,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "band"], "high"],
            "#a84f4f",
            "#8b8d91",
          ],
          "circle-opacity": 0.95,
          "circle-stroke-color": [
            "case",
            ["get", "selected"],
            "#ffffff",
            "#202225",
          ],
          "circle-stroke-width": ["case", ["get", "selected"], 2.5, 1],
        },
      });

      const camera = map.cameraForBounds(getBounds(initial.route), {
        padding: 70,
        maxZoom: 3.15,
      });
      if (camera) {
        map.easeTo({ ...camera, duration: 1400 });
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
      eventData(events, assessments, selectedEventId),
    );
    const camera = map.cameraForBounds(getBounds(route), {
      padding: 70,
      maxZoom: 3.15,
    });
    if (camera) {
      map.flyTo({ ...camera, duration: 1100, essential: true });
    }
  }, [assessments, events, route, selectedEventId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getSource(eventSourceId)) {
      return;
    }

    (map.getSource(eventSourceId) as GeoJSONSource).setData(
      eventData(events, assessments, selectedEventId),
    );
  }, [assessments, events, selectedEventId]);

  return (
    <div className="relative size-full bg-[#070809]">
      <div ref={containerRef} className="size-full" aria-label="Route risk map" />
      {!process.env.NEXT_PUBLIC_CARTO_API_KEY && (
        <div className="pointer-events-none absolute bottom-4 left-4 border border-white/10 bg-[#0c0d0f] px-2.5 py-1.5 text-[10px] tracking-wide text-zinc-500 uppercase">
          Basemap unavailable · route geometry only
        </div>
      )}
    </div>
  );
}
