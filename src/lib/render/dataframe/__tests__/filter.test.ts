import { expect, test } from "vitest";
import { clientFilter } from "../utils/filter";

test.each([
  "2026-03-20",
  "2026-03-20T12:00:00Z",
  new Date("2026-03-20T12:00:00Z"),
])("date minimum filters compare real table values: %s", (created) => {
  expect(
    clientFilter(
      [{ created }, { created: "2026-01-10" }],
      [{ column: "created", operator: "gte", value: "2026-03-01" }],
    ),
  ).toEqual([{ created }]);
});

test("date ranges include matching rows and reject invalid values", () => {
  expect(
    clientFilter(
      [
        { created: "2026-02-15" },
        { created: "2026-03-20" },
        { created: "invalid" },
      ],
      [
        {
          column: "created",
          operator: "between",
          value: "2026-02-01",
          valueTo: "2026-02-28",
        },
      ],
    ),
  ).toEqual([{ created: "2026-02-15" }]);
});

test("numeric bounds retain numeric ordering", () => {
  expect(
    clientFilter(
      [{ score: 7 }, { score: 9 }, { score: null }],
      [{ column: "score", operator: "lte", value: "8" }],
    ),
  ).toEqual([{ score: 7 }]);
});
