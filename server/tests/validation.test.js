import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanText, isStudentEmail, parsePositiveId, validateUsername } from "../validation.js";

test("student emails must be exactly @student.upt.ro", () => {
  assert.equal(isStudentEmail("ana.pop@student.upt.ro"), true);
  assert.equal(isStudentEmail("  Ana.Pop@Student.UPT.ro "), true);
  assert.equal(isStudentEmail("ana@upt.ro"), false);
  assert.equal(isStudentEmail("ana@student.upt.ro.evil.com"), false);
  assert.equal(isStudentEmail("ana@evilstudent.upt.ro"), false);
  assert.equal(isStudentEmail("ana@sub.student.upt.ro"), false);
  assert.equal(isStudentEmail("ana@gmail.com"), false);
  assert.equal(isStudentEmail(null), false);
});

test("valid usernames are accepted and keep their capitalization", () => {
  assert.deepEqual(validateUsername("  Laica_Reader7 "), { ok: true, username: "Laica_Reader7" });
  assert.equal(validateUsername("abc").ok, true);
  assert.equal(validateUsername("a".repeat(20)).ok, true);
});

test("invalid usernames are rejected with a reason", () => {
  for (const bad of [
    "",
    "ab",
    "a".repeat(21),
    "has space",
    "me@mail.com",
    "dash-name",
    "123456",
    "_leading",
    "trailing_",
    "dou__ble",
    "Admin",
    "ｆｕｌｌｗｉｄｔｈ", // full-width letters normalize to ASCII, but this checks NFKC is applied
    "émile",
    "zero\u200Bwidth",
    42,
    null,
  ]) {
    const result = validateUsername(bad);

    if (bad === "ｆｕｌｌｗｉｄｔｈ") {
      // NFKC turns it into plain "fullwidth", which is a legitimate name.
      assert.deepEqual(result, { ok: true, username: "fullwidth" });
      continue;
    }

    assert.equal(result.ok, false, `expected "${bad}" to be rejected`);
    assert.equal(typeof result.error, "string");
  }
});

test("cleanText strips control and bidi characters and enforces limits", () => {
  assert.deepEqual(cleanText("  Hello\u0000 world\u202E ", { field: "X", max: 50 }), {
    ok: true,
    value: "Hello world",
  });

  assert.deepEqual(cleanText("line1\r\n\r\n\r\n\r\nline2", { field: "X", max: 50, multiline: true }), {
    ok: true,
    value: "line1\n\nline2",
  });

  assert.deepEqual(cleanText("   ", { field: "Title", max: 10 }), { ok: true, value: null });
  assert.equal(cleanText("   ", { field: "Title", max: 10, required: true }).ok, false);
  assert.equal(cleanText("x".repeat(11), { field: "Title", max: 10 }).ok, false);
  assert.equal(cleanText({ nope: 1 }, { field: "Title", max: 10 }).ok, false);
});

test("ids must be positive integers", () => {
  assert.equal(parsePositiveId("12"), 12);
  assert.equal(parsePositiveId(7), 7);
  for (const bad of ["0", "-1", "1.5", "1e3", "abc", "", null, undefined, "01", "1 OR 1=1"]) {
    assert.equal(parsePositiveId(bad), null, `expected ${bad} to be rejected`);
  }
});
