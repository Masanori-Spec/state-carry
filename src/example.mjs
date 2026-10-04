import { clone } from "./core.mjs";
export function example(guarded = false) {
  const input = {
    version: 1,
    payload: {
      title: "Harbor map",
      metadata: { title: null },
      customFields: { owner: "Aya", workshop: "north" },
      items: [{ id: "dock", label: "Dock", tags: [] }],
      empty: {},
    },
  };
  const output = {
    version: 3,
    payload: {
      metadata: { title: "Harbor map" },
      customFields: { owner: "Aya", workshop: "north" },
      items: [{ id: "dock", label: "Dock", tags: [] }],
      empty: {},
      presentation: { theme: "paper", zoom: 1 },
    },
  };
  const collision = clone(input);
  collision.payload.metadata.title = "Owner-authored title";
  const intermediate = {
    version: 2,
    payload: {
      metadata: { title: "Version two project" },
      customFields: { futureField: "keep me" },
      items: [],
      empty: {},
    },
  };
  const intermediateExpected = clone(intermediate);
  intermediateExpected.version = 3;
  intermediateExpected.payload.presentation = { theme: "paper", zoom: 1 };
  return {
    schema: "statecarry/v1",
    name: guarded
      ? "Harbor editor · guarded upgrade"
      : "Harbor editor · overwrite rehearsal",
    versions: [1, 2, 3],
    transitions: [
      {
        from: 1,
        to: 2,
        ops: [
          ...(guarded
            ? [{ op: "test", path: "/metadata/title", value: null }]
            : []),
          { op: "move", from: "/title", path: "/metadata/title" },
        ],
      },
      {
        from: 2,
        to: 3,
        ops: [
          {
            op: "add",
            path: "/presentation",
            value: { theme: "paper", zoom: 1 },
          },
        ],
      },
    ],
    fixtures: [
      {
        id: "ordinary",
        name: "V1 · custom data and empty containers",
        input,
        expected: { kind: "value", value: output },
        contracts: [
          {
            kind: "preserve",
            source: "/title",
            target: "/metadata/title",
            reason: "Move the project title without changing its value",
          },
          {
            kind: "change",
            source: "/metadata/title",
            target: "/metadata/title",
            reason: "Replace the explicit null placeholder with the old title",
          },
        ],
      },
      {
        id: "collision",
        name: "V1 · existing title must reject",
        input: collision,
        expected: { kind: "error", code: "PATCH_FAILED" },
        contracts: [],
      },
      {
        id: "intermediate",
        name: "V2 · skip no version",
        input: intermediate,
        expected: { kind: "value", value: intermediateExpected },
        contracts: [],
      },
    ],
  };
}
