// Allowed package edges: core<-{garmin-client,engine,store}; ingest -> core, garmin-client; packages never import apps.
const only = (pkg, allowed) => ({
  name: `${pkg}-only-${allowed.join("-")}`,
  severity: "error",
  from: { path: `(^|/)packages/${pkg}/` },
  to: { path: "(^|/)packages/", pathNot: `(^|/)packages/(${[pkg, ...allowed].join("|")})/` },
});

module.exports = {
  forbidden: [
    only("core", []),
    only("garmin-client", ["core"]),
    only("engine", ["core"]),
    only("store", ["core"]),
    only("ingest", ["core", "garmin-client"]),
    { name: "packages-not-apps", severity: "error", from: { path: "(^|/)packages/" }, to: { path: "(^|/)apps/" } },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    parser: "swc",
    tsConfig: { fileName: "tsconfig.json" },
    // workspace symlinks resolve to real packages/x paths (default), so path rules match them
    exclude: { path: "tools/boundary-fixtures" },
  },
};
