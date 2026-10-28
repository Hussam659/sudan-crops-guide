// Self-check: node js/plan.test.mjs — numbers must match the reference site (sesame natural -> hulled standard, 1.5 t/h, 2 shifts).
import assert from "node:assert/strict";
import fs from "node:fs";
import { calc } from "./plan.js";
const D = JSON.parse(fs.readFileSync(new URL("../data/planner.json", import.meta.url)));
const R = D.routes.find(r => r.p === "Hulled sesame (standard)");
const r = calc(R, D, 1.5, 2);
assert.equal(Math.round(r.rawYear), 5040);
assert.equal(Math.round(r.outYear), 4133);
// Reference site shows: 2,218 m², 204 kW, 12 staff, $819k–$1.5m equipment, $827k–$1.1m margin/year.
assert.equal(Math.round(r.area), 2218);
assert.equal(Math.round(r.kw), 204);
assert.equal(r.staff, 12);
assert.equal(Math.round(r.equip * 0.75), 819);
assert.equal(Math.round(r.marginYear[0] / 1000), 827);
// Payback: installed $1,106k–$2,064k ÷ margin $827k–$1,075k a year.
assert.equal(r.payback[0].toFixed(2), "1.03");
assert.equal(r.payback[1].toFixed(2), "2.50");
console.log("planner ok");
