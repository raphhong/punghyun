import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import JSZip from "jszip";

// Compile the actual TypeScript modules in memory. All external I/O is mocked;
// these tests do not need credentials or touch customer data.
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const customerDir = "src/app/ph-console-8f27x/(app)/customers";
const componentStubs = new Proxy({}, { get: (_, name) => String(name) });

function loadSource(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const compiled = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/components/")) return componentStubs;
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/")
        ? path.join(root, "src", name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const file = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      assert.ok(file, `Cannot resolve ${name}`);
      return loadSource(file, mocks);
    }
    return require(name);
  };
  new Function("require", "module", "exports", source)(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

const pipeline = loadSource("src/lib/admin/pipeline.ts");
const intent = pipeline.PURCHASE_INTENT_DOCS[0];
const noop = () => {};

function query(data) {
  const result = { data, error: null };
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}

async function renderCustomer(docs = [], hospitalType = "individual", stage = "intake") {
  const signedCalls = [];
  const customer = { id: "customer-a", hospital_type: hospitalType, stage, source: "manual", share_token: "test-token", sales_agent_id: null };
  const db = {
    from: (table) => query(table === "customers" ? customer : table === "customer_documents" ? docs : []),
    storage: { from: (bucket) => ({ createSignedUrls: async (paths, lifetime) => {
      signedCalls.push({ bucket, paths, lifetime });
      return { data: paths.map((file) => ({ path: file, signedUrl: `https://storage.example.test/${file}?token=test` })) };
    } }) },
  };
  const actions = new Proxy({}, { get: () => noop });
  const { default: Page } = loadSource(`${customerDir}/[id]/page.tsx`, {
    "@/lib/supabase/server": { createClient: async () => db },
    "next/headers": { headers: async () => new Headers({ host: "localhost:3000" }) },
    "next/navigation": { notFound: () => { throw Error("not found"); } },
    "next/link": "a",
    "../actions": actions,
  });
  return { tree: await Page({ params: Promise.resolve({ id: customer.id }) }), signedCalls };
}

test("purchase intent has a unique optional document key and leaves customer/sales requirements unchanged", () => {
  assert.deepEqual(intent, { key: "purchase_intent", label: "매입의향서", category: "inspection" });
  assert.equal(pipeline.PURCHASE_INTENT_DOCS.length, 1);
  for (const type of [null, "individual", "corporate"]) {
    assert.equal(pipeline.docsForType(pipeline.ALL_DOCS, type).some((doc) => doc.key === intent.key), false);
  }
  const all = [...pipeline.ALL_DOCS, ...pipeline.TRANSACTION_DOCS, ...pipeline.PURCHASE_INTENT_DOCS];
  assert.equal(new Set(all.map((doc) => doc.key)).size, all.length);
});

for (const type of ["individual", "corporate"]) {
  test(`admin shows an open purchase-intent upload slot without a file (${type})`, async () => {
    const { tree, signedCalls } = await renderCustomer([], type);
    const card = elements(tree).find((el) => el.props.title === "매입의향서");
    assert.ok(card);
    assert.equal(card.props.open, true);
    assert.match(card.props.desc, /선택/);
    const list = card.props.children;
    const rows = elements(list.type(list.props));
    const upload = rows.find((el) => el.type === "AdminDocUpload");
    assert.equal(upload.props.customerId, "customer-a");
    assert.equal(upload.props.docKey, "purchase_intent");
    assert.equal(upload.props.category, "inspection");
    assert.equal(rows.some((el) => el.type === "a"), false);
    assert.deepEqual(signedCalls, []);
  });
}

for (const [ext, isImage] of [["pdf", false], ["png", true]]) {
  test(`uploaded ${ext} has signed view/download links and a Korean gallery label`, async () => {
    const file = `customer-a/purchase_intent-1.${ext}`;
    const existing = "customer-a/business_registration-1.pdf";
    const { tree, signedCalls } = await renderCustomer([
      { doc_key: intent.key, file_path: file, checked: true },
      { doc_key: "business_registration", file_path: existing, checked: true },
    ], "individual", "contract");
    assert.deepEqual(signedCalls, [{ bucket: "customer-docs", paths: [file, existing], lifetime: 3600 }]);
    const all = elements(tree);
    const list = all.find((el) => el.props.title === "매입의향서").props.children;
    const links = elements(list.type(list.props)).filter((el) => el.type === "a");
    assert.equal(links[0].props.href, `https://storage.example.test/${file}?token=test`);
    assert.equal(links[1].props.href, `${links[0].props.href}&download`);
    const gallery = all.find((el) => el.type === "DocGallery");
    assert.deepEqual(gallery.props.items.map(({ key, label, isImage }) => ({ key, label, isImage })), [
      { key: intent.key, label: "매입의향서", isImage },
      { key: "business_registration", label: "사업자등록증", isImage: false },
    ]);
  });
}

function adminActions(db, refreshed = []) {
  return loadSource(`${customerDir}/actions.ts`, {
    "@/lib/supabase/server": { createClient: async () => db },
    "next/cache": { revalidatePath: (p) => refreshed.push(p) },
    "next/navigation": { redirect: noop },
  });
}

test("existing upload URL flow keeps purchase-intent files in customer-private storage and preserves formats", async () => {
  const calls = [];
  const actions = adminActions({ storage: { from: (bucket) => ({ createSignedUploadUrl: async (file) => {
    calls.push({ bucket, file });
    return { data: { path: file, token: "test-upload-token" }, error: null };
  } }) } });
  for (const ext of ["pdf", "jpg", "docx", "xlsx"]) {
    const result = await actions.createDocUploadUrl("customer-a", intent.key, `의향서.${ext}`);
    assert.match(result.path, new RegExp(`^customer-a/purchase_intent-\\d+\\.${ext}$`));
    assert.equal(result.token, "test-upload-token");
  }
  assert.ok(calls.every((call) => call.bucket === "customer-docs"));
});

test("upload URL errors remain errors", async () => {
  const actions = adminActions({ storage: { from: () => ({ createSignedUploadUrl: async () => ({ data: null, error: { message: "Upload denied" } }) }) } });
  assert.deepEqual(await actions.createDocUploadUrl("customer-a", intent.key, "intent.pdf"), { error: "Upload denied" });
});

test("recording/replacing an intent upserts only that customer's document and refreshes admin", async () => {
  const writes = [];
  const refreshed = [];
  const actions = adminActions({ from: (table) => ({ upsert: async (row, options) => {
    writes.push({ table, row, options });
    return { error: null };
  } }) }, refreshed);
  for (const file of ["customer-a/purchase_intent-1.pdf", "customer-a/purchase_intent-2.pdf"]) {
    assert.deepEqual(await actions.recordDocUpload("customer-a", intent.key, intent.category, file), { ok: true });
  }
  assert.equal(writes.length, 2);
  for (const { table, row, options } of writes) {
    assert.equal(table, "customer_documents");
    assert.equal(row.customer_id, "customer-a");
    assert.equal(row.doc_key, intent.key);
    assert.equal(row.category, "inspection");
    assert.equal(row.checked, true);
    assert.ok(row.uploaded_at);
    assert.deepEqual(options, { onConflict: "customer_id,doc_key" });
  }
  assert.equal(writes[1].row.file_path, "customer-a/purchase_intent-2.pdf");
  assert.ok(refreshed.includes("/ph-console-8f27x/customers/customer-a"));
});

test("failed document recording reports the error without refreshing", async () => {
  const refreshed = [];
  const actions = adminActions({ from: () => ({ upsert: async () => ({ error: { message: "Write denied" } }) }) }, refreshed);
  assert.deepEqual(await actions.recordDocUpload("customer-a", intent.key, intent.category, "customer-a/intent.pdf"), { error: "Write denied" });
  assert.deepEqual(refreshed, []);
});

function downloadRoute({ authenticated = true, admin = true } = {}) {
  const db = {
    auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: "admin-a" } : null } }) },
    from: (table) => query(table === "admins" ? (admin ? { user_id: "admin-a" } : null) : table === "customers" ? { hospital_name: "테스트 고객" } : [{ doc_key: intent.key, file_path: "customer-a/purchase_intent-1.pdf" }]),
    storage: { from: (bucket) => {
      assert.equal(bucket, "customer-docs");
      return { download: async () => ({ data: new Blob(["test PDF bytes"]), error: null }) };
    } },
  };
  return loadSource(`${customerDir}/[id]/download/route.ts`, { "@/lib/supabase/server": { createClient: async () => db } });
}

const downloadArgs = [{ nextUrl: new URL("http://localhost/download?keys=purchase_intent") }, { params: Promise.resolve({ id: "customer-a" }) }];

test("admin ZIP download names the purchase-intent file in Korean", async () => {
  const response = await downloadRoute().GET(...downloadArgs);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files), ["매입의향서.pdf"]);
  assert.equal(await zip.file("매입의향서.pdf").async("string"), "test PDF bytes");
});

test("ZIP download still rejects unauthenticated and non-admin callers", async () => {
  assert.equal((await downloadRoute({ authenticated: false }).GET(...downloadArgs)).status, 401);
  assert.equal((await downloadRoute({ admin: false }).GET(...downloadArgs)).status, 403);
});

function uploadHarness({ sign, upload, record } = {}) {
  const state = [];
  let cursor = 0;
  const calls = [];
  const react = require("react");
  const { AdminDocUpload } = loadSource("src/components/admin/AdminDocUpload.tsx", {
    react: { ...react, useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    } },
    "next/navigation": { useRouter: () => ({ refresh: () => calls.push("refresh") }) },
    "@/lib/supabase/client": { createBrowserClient: () => ({ storage: { from: (bucket) => ({ uploadToSignedUrl: async (...args) => {
      calls.push({ bucket, upload: args });
      return upload ? upload(...args) : { error: null };
    } }) } }) },
    "@/app/ph-console-8f27x/(app)/customers/actions": {
      createDocUploadUrl: async (...args) => {
        calls.push({ sign: args });
        return sign ? sign(...args) : { path: "customer-a/purchase_intent-1.pdf", token: "test-upload-token" };
      },
      recordDocUpload: async (...args) => {
        calls.push({ record: args });
        return record ? record(...args) : { ok: true };
      },
    },
  });
  function render() {
    cursor = 0;
    const nodes = elements(AdminDocUpload({ customerId: "customer-a", docKey: intent.key, category: intent.category }));
    return {
      input: nodes.find((node) => node.type === "input"),
      button: nodes.find((node) => node.type === "button"),
      error: nodes.find((node) => node.type === "p"),
    };
  }
  return { render, calls };
}

test("upload waits for selection, disables submission while pending and refreshes after success", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const harness = uploadHarness({ upload: () => pending });
  assert.equal(harness.render().button.props.disabled, true);
  await harness.render().button.props.onClick();
  assert.deepEqual(harness.calls, []);
  const file = new File(["test"], "매입의향서.pdf", { type: "application/pdf" });
  harness.render().input.props.onChange({ target: { files: [file] } });
  const finished = harness.render().button.props.onClick();
  assert.equal(harness.render().button.props.disabled, true);
  assert.equal(harness.render().button.props.children, "업로드 중…");
  release({ error: null });
  await finished;
  assert.equal(harness.render().button.props.disabled, true);
  assert.equal(harness.render().error, undefined);
  assert.deepEqual(harness.calls, [
    { sign: ["customer-a", "purchase_intent", "매입의향서.pdf"] },
    { bucket: "customer-docs", upload: ["customer-a/purchase_intent-1.pdf", "test-upload-token", file] },
    { record: ["customer-a", "purchase_intent", "inspection", "customer-a/purchase_intent-1.pdf"] },
    "refresh",
  ]);
});

for (const phase of ["sign", "upload", "record"]) {
  test(`${phase} failure remains visible and allows retry without navigating away`, async () => {
    let failed = false;
    const harness = uploadHarness({ [phase]: async () => {
      if (!failed) {
        failed = true;
        return { error: phase === "upload" ? { message: "Please retry" } : "Please retry" };
      }
      return phase === "sign" ? { path: "customer-a/purchase_intent-1.pdf", token: "test-upload-token" } : phase === "upload" ? { error: null } : { ok: true };
    } });
    harness.render().input.props.onChange({ target: { files: [new File(["test"], "intent.pdf")] } });
    await harness.render().button.props.onClick();
    assert.equal(harness.render().error.props.children, "Please retry");
    assert.equal(harness.render().button.props.disabled, false);
    assert.equal(harness.calls.includes("refresh"), false);
    await harness.render().button.props.onClick();
    assert.equal(harness.render().error, undefined);
    assert.equal(harness.calls.at(-1), "refresh");
  });
}

test("cancelling file selection clears the pending selection without any upload", () => {
  const harness = uploadHarness();
  harness.render().input.props.onChange({ target: { files: [new File(["test"], "intent.pdf")] } });
  assert.equal(harness.render().button.props.disabled, false);
  harness.render().input.props.onChange({ target: { files: [] } });
  assert.equal(harness.render().button.props.disabled, true);
  assert.deepEqual(harness.calls, []);
});
