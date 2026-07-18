/** Spatial Intelligence Engine — Engine Contract & Capability Manifest. */
export const SPATIAL_ENGINE_CONTRACT = Object.freeze({
  id: "engine.spatial",
  name: "Spatial Intelligence Engine",
  version: "1.0.0",
  ownership: {
    owns: [
      "Coordinates", "Places", "Regions", "GeoFences", "Distances",
      "Spatial relationships", "Clusters", "Corridors", "Spatial constraints",
      "Spatial index",
    ],
    doesNotOwn: [
      "Booking", "Navigation", "Maps rendering", "Directions", "Traffic",
      "Live routing", "Provider APIs", "Journey planning", "Decision making",
      "Memory", "Goals", "Trust", "Persistence",
    ],
  },
  dependencies: {
    consumesPorts: [
      "SpatialMemoryPort", "SpatialJourneyPort", "SpatialDecisionPort",
      "SpatialGoalPort", "SpatialTrustPort", "SpatialGraphPort",
      "SpatialPromptPort", "SpatialProviderPort", "SpatialKernelPort",
      "SpatialPersistencePort",
    ],
    implementsPorts: [],
  },
  events: {
    published: [
      "PlaceCreated", "PlaceUpdated", "PlaceArchived",
      "RegionCreated", "RegionValidated", "RegionUpdated",
      "ClusterBuilt", "CorridorCreated", "SpatialConstraintAdded",
      "SpatialRelationshipDetected", "DistanceCalculated",
      "SpatialIndexUpdated", "GeoFenceTriggered", "SpatialModelArchived",
      "LifecycleTransitioned",
    ],
    consumed: [],
  },
  publicApi: [
    "createSpatialRuntime", "SpatialRuntime", "SpatialManager",
    "SpatialRegistry", "createSpatialManager",
    "haversineMeters", "greatCircleMeters", "equirectangularMeters",
    "distanceMatrix", "withinRadius", "nearestIndex",
    "clusterPlaces", "buildCorridor", "buildHubAndSpoke",
    "evaluateConstraint", "evaluateAll", "assertAll",
    "SpatialIndex", "RegionHierarchy",
  ],
  extensionPoints: [
    "SpatialPersistencePort", "SpatialTelemetrySink",
    "custom distance kernels", "custom clustering strategies",
    "custom relationship detectors",
  ],
  futureHooks: [
    "Geocoding adapters", "Reverse-geocoding adapters", "PostGIS index adapters",
    "Vector tile adapters", "Isochrone providers",
  ],
} as const);

export const SPATIAL_CAPABILITY_MANIFEST = Object.freeze({
  engine: "spatial",
  version: "1.0.0",
  capabilities: {
    spatial: ["coordinate.validation", "coordinate.normalization", "coordinate.precision", "lifecycle"],
    region: ["hierarchy", "containment", "ancestor", "descendant", "bbox.lookup"],
    distance: ["haversine", "great_circle", "equirectangular", "euclidean", "matrix", "radius", "nearest"],
    relationships: ["nearby", "adjacent", "contains", "same_region", "same_country", "cross_border"],
    clustering: ["deterministic", "centroid", "density"],
    corridor: ["travel", "regional", "multi_city", "transit", "hub_and_spoke"],
    constraint: ["max_radius", "min_distance", "restricted_region", "allowed_region", "geo_fence_in", "geo_fence_out", "travel_zone", "cross_border"],
    index: ["nearest", "radius", "bbox", "validation"],
  },
  dependencies: [],
  extensionPoints: [
    "SpatialPersistencePort", "custom distance kernels",
    "custom clustering strategies", "custom relationship detectors",
  ],
  futureIntegrations: [
    "PostGIS", "Uber H3", "S2", "MapTiler", "Isochrone providers",
  ],
} as const);
