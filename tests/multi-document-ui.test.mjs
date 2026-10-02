import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

// All files, storage, server actions and page data are synthetic.
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const react = require("react");
function loadSource(relative, mocks = {}, stubComponents = false) {
  const filename = path.resolve(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiled = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (stubComponents && name.startsWith("@/components/")) return new Proxy({}, { get: (_, key) => String(key) });
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
      const file = [base, `${base}.ts`, `${base}.tsx`].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
      assert.ok(file, `Cannot resolve ${name}`);
      return loadSource(file, mocks, stubComponents);
    }
    return require(name);
  };
  new Function("require", "module", "exports", source)(localRequire, compiled, compiled.exports);
  return compiled.exports;
}
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}
function words(node) {
  if (Array.isArray(node)) return node.map(words).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return node?.props ? words(node.props.children) : "";
}
function hooks() {
  const values = [];
  let cursor = 0;
  return {
    reset: () => { cursor = 0; },
    react: { ...react, useEffect: () => {}, useRef: (initial) => {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    }, useState: (initial) => {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (value) => { values[index] = typeof value === "function" ? value(values[index]) : value; }];
    } },
  };
}
const pdf = (name) => new File(["%PDF-1.7\nsynthetic"], name, { type: "application/pdf" });
const { queueFiles, submitUploadQueue } = loadSource("src/lib/documents/upload-queue.ts");
function operations(override = {}) {
  const calls = [];
  return { calls, actions: {
    sign: async (name, metadata) => { calls.push(["sign", name, metadata.id]); return { id: metadata.id, path: `test/${metadata.id}.pdf`, token: "synthetic" }; },
    upload: async (path, token, file, type) => { calls.push(["upload", path, file.name, type]); return { error: null }; },
    record: async (path, id) => { calls.push(["record", path, id]); return { ok: true }; },
    ...override,
  } };
}

test("same checklist supports same-named files with separate IDs, deterministic order and append", async () => {
  let id = 0;
  const queue = queueFiles([pdf("세금.pdf"), pdf("세금.pdf")], () => `id-${++id}`);
  const { actions, calls } = operations();
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.deepEqual(queue.map((item) => [item.id, item.phase]), [["id-1", "done"], ["id-2", "done"]]);
  assert.deepEqual(calls.map((call) => call[0]), ["sign", "upload", "record", "sign", "upload", "record"]);
  queue.push(...queueFiles([pdf("지방세.pdf")], () => `id-${++id}`));
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.equal(calls.filter((call) => call[0] === "upload").length, 3);
  assert.equal(queue[0].id, "id-1");
});

test("stop completes current record and preserves queued files and prior successes", async () => {
  let stop = false;
  const queue = queueFiles([pdf("국세.pdf"), pdf("지방세.pdf")]);
  const { actions, calls } = operations({ upload: async () => { stop = true; return { error: null }; } });
  await submitUploadQueue(queue, actions, () => {}, () => stop);
  assert.deepEqual(queue.map((item) => item.phase), ["done", "queued"]);
  assert.equal(calls.filter((call) => call[0] === "record").length, 1);
  stop = false;
  await submitUploadQueue(queue, operations().actions, () => {}, () => stop);
  assert.deepEqual(queue.map((item) => item.phase), ["done", "done"]);
});

test("record retry preserves UUID and bytes, without signing or uploading again", async () => {
  let attempts = 0;
  const queue = queueFiles([pdf("국세.pdf")]);
  const identity = queue[0].id;
  const { actions, calls } = operations({ record: async () => ++attempts === 1 ? { error: "record failed" } : { ok: true } });
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.equal(queue[0].phase, "error");
  assert.equal(queue[0].uploaded, true);
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.equal(queue[0].phase, "done");
  assert.equal(queue[0].id, identity);
  assert.deepEqual(calls.map((call) => call[0]), ["sign", "upload"]);
});

test("sign failures retry same UUID and do not discard later successful files", async () => {
  let attempt = 0;
  const seen = [];
  const queue = queueFiles([pdf("국세.pdf"), pdf("지방세.pdf")]);
  const { actions } = operations({ sign: async (filename, metadata) => {
    seen.push(metadata.id);
    return ++attempt === 1 ? { error: "sign failed" } : { id: metadata.id, path: `test/${metadata.id}`, token: "synthetic" };
  } });
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.deepEqual(queue.map((item) => item.phase), ["error", "done"]);
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.equal(seen[0], seen[2]);
  assert.deepEqual(queue.map((item) => item.phase), ["done", "done"]);
});

test("uncertain upload is recovered by recording exact ID without an overwrite", async () => {
  const queue = queueFiles([pdf("국세.pdf")]);
  const { actions, calls } = operations({ upload: async () => ({ error: { message: "response lost" } }) });
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.equal(queue[0].phase, "done");
  assert.deepEqual(calls.map((call) => call[0]), ["sign", "record"]);
});

test("failed upload remains retryable with the original UUID", async () => {
  const queue = queueFiles([pdf("국세.pdf")]);
  const id = queue[0].id;
  const failing = operations({ upload: async () => ({ error: { message: "offline" } }), record: async () => ({ error: "no object" }) });
  await submitUploadQueue(queue, failing.actions, () => {}, () => false);
  assert.equal(queue[0].phase, "error");
  assert.match(queue[0].error, /offline/);
  const retry = operations();
  await submitUploadQueue(queue, retry.actions, () => {}, () => false);
  assert.equal(retry.calls[0][2], id);
  assert.equal(queue[0].phase, "done");
});

test("invalid files fail locally before creating any upload reservation", async () => {
  const files = [new File([], "empty.pdf"), new File(["test"], "script.exe"), new File(["bad"], "mislabel.pdf", { type: "image/png" })];
  const queue = queueFiles(files);
  const { actions, calls } = operations();
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.deepEqual(calls, []);
  assert.ok(queue.every((item) => item.phase === "error"));
});

function uploaderHarness({ upload } = {}) {
  const hook = hooks();
  const calls = [];
  const { MultiDocUpload } = loadSource("src/components/documents/MultiDocUpload.tsx", {
    react: hook.react,
    "next/navigation": { useRouter: () => ({ refresh: () => calls.push(["refresh"]) }) },
    "@/lib/supabase/client": { createBrowserClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: async (...args) => {
      calls.push(["upload", ...args]);
      return upload ? upload(...args) : { error: null };
    } }) } }) },
  });
  const props = { label: "세금 서류", signAction: async (name, meta) => {
    calls.push(["sign", name, meta]); return { id: meta.id, path: `test/${meta.id}.pdf`, token: "synthetic" };
  }, recordAction: async (...args) => { calls.push(["record", ...args]); return { ok: true }; } };
  function render() { hook.reset(); return elements(MultiDocUpload(props)); }
  return { calls, render, select: (files) => render().find((node) => node.type === "input").props.onChange({ currentTarget: { files, value: "" } }), start: () => render().find((node) => node.type === "button" && words(node).includes("파일 추가 업로드")) };
}

test("multi-file picker and cancelled chooser perform no mutation; explicit cancel clears pending", () => {
  const h = uploaderHarness();
  assert.equal(h.render().find((node) => node.type === "input").props.multiple, true);
  h.select([pdf("국세.pdf"), pdf("지방세.pdf")]);
  h.select([]);
  assert.match(words(h.start()), /\(2\)/);
  assert.deepEqual(h.calls, []);
  h.render().find((node) => node.type === "button" && words(node) === "선택 취소").props.onClick();
  assert.equal(h.start().props.disabled, true);
  assert.deepEqual(h.calls, []);
});

test("rapid double clicks are locked before rerender and stop preserves next file", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const h = uploaderHarness({ upload: () => pending });
  h.select([pdf("국세.pdf"), pdf("지방세.pdf")]);
  const button = h.start();
  const finished = button.props.onClick();
  await button.props.onClick();
  await Promise.resolve();
  assert.equal(h.calls.filter((call) => call[0] === "sign").length, 1);
  assert.equal(h.render().find((node) => node.type === "input").props.disabled, true);
  assert.ok(h.render().find((node) => node.type === "progress"));
  h.render().find((node) => node.type === "button" && words(node) === "현재 파일 완료 후 중지").props.onClick();
  release({ error: null });
  await finished;
  assert.equal(h.calls.filter((call) => call[0] === "record").length, 1);
  assert.match(words(h.start()), /\(1\)/);
  assert.equal(h.calls.at(-1)[0], "refresh");
});

test("empty browser MIME is normalized for direct storage upload", async () => {
  const h = uploaderHarness();
  h.select([new File(["%PDF-1.7"], "국세.pdf")]);
  await h.start().props.onClick();
  const uploaded = h.calls.find((call) => call[0] === "upload");
  assert.equal(uploaded[3].type, "application/pdf");
  assert.deepEqual(uploaded[4], { contentType: "application/pdf" });
});

const baseDocument = { customer_id: "customer-a", category: "screening_2", doc_key: "tax_payment_cert", checked: false, device_id: null, uploaded_at: "2026-10-01T01:00:00Z" };
const fixtureDocuments = [
  { ...baseDocument, id: "national", attachment_id: "national", file_path: "synthetic/national.pdf", original_name: "국세.pdf" },
  { ...baseDocument, id: "local", attachment_id: "local", file_path: "synthetic/local.pdf", original_name: "지방세.pdf" },
  { ...baseDocument, id: "removed", attachment_id: "removed", file_path: "synthetic/removed.pdf", original_name: "옛 국세.pdf", deleted_at: "2026-10-01T02:00:00Z" },
  { ...baseDocument, id: "internal", attachment_id: "internal", doc_key: "purchase_intent", file_path: "synthetic/internal.pdf" },
  { ...baseDocument, id: "contract", attachment_id: "contract", doc_key: "sale_contract", file_path: "synthetic/contract.pdf", device_id: "must-not-bypass" },
  { ...baseDocument, id: "photo", doc_key: "device_photo_synthetic", device_id: "device-a", file_path: "synthetic/photo.jpg" },
];
async function pageHarness(surface, expiry) {
  const signedCalls = [];
  const customer = { id: "customer-a", hospital_type: "individual", stage: "intake", source: "manual", share_token: "synthetic", sales_agent_id: null, share_token_expires_at: expiry };
  const query = (data) => { const builder = { select: () => builder, eq: () => builder, order: () => builder, single: async () => ({ data }), maybeSingle: async () => ({ data }), then: (resolve, reject) => Promise.resolve({ data }).then(resolve, reject) }; return builder; };
  const db = { from: (table) => query(table === "customers" ? customer : []), storage: { from: () => ({ createSignedUrls: async (paths) => { signedCalls.push(paths); return { data: paths.map((path) => ({ path, signedUrl: `https://synthetic.invalid/${path}?token=fixture` })) }; } }) } };
  const paths = { admin: "src/app/ph-console-8f27x/(app)/customers/[id]/page.tsx", sales: "src/app/sales/(portal)/customers/[id]/page.tsx", public: "src/app/s/[token]/page.tsx" };
  const { default: Page } = loadSource(paths[surface], {
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/documents/server": { listCustomerDocuments: async () => fixtureDocuments, validShareTokenExpiry: (expiry) => expiry == null || Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > Date.now() },
    "next/headers": { headers: async () => new Headers({ host: "localhost:3000" }) },
    "next/navigation": { notFound: () => { throw Error("not found"); } },
    "next/link": "a",
    "../cashflow-actions": { loadCustomerCashflow: async () => ({ error: "Synthetic fixture has no finance data" }), saveCustomerCashflow: async () => ({ error: "Not available in document fixture" }) },
    "../actions": new Proxy({}, { get: () => async () => {} }),
    "./actions": new Proxy({}, { get: () => async () => {} }),
    "@/app/sales/actions": new Proxy({}, { get: () => async () => {} }),
  }, true);
  return { tree: await Page({ params: Promise.resolve({ id: "customer-a", token: "synthetic" }) }), signedCalls };
}
for (const surface of ["sales", "public"]) test(`${surface} never signs internal or removed attachments and retains all visible files`, async () => {
  const { tree, signedCalls } = await pageHarness(surface);
  assert.deepEqual(signedCalls.flat(), ["synthetic/national.pdf", "synthetic/local.pdf", "synthetic/photo.jpg"]);
  const nodes = elements(tree);
  if (surface === "sales") {
    const lists = nodes.filter((node) => typeof node.type === "function" && node.type.name === "DocList");
    const attachments = lists.flatMap((node) => elements(node.type(node.props))).find((node) => node.type === "AttachmentList" && node.props.docKey === "tax_payment_cert");
    assert.equal(attachments.props.files.length, 3);
  } else {
    const lists = nodes.filter((node) => typeof node.type === "function" && node.type.name === "DocUpload");
    const upload = lists.flatMap((node) => elements(node.type(node.props))).find((node) => node.type === "PublicDocUpload" && node.props.docKey === "tax_payment_cert");
    assert.equal(upload.props.files.length, 3);
    assert.equal(upload.props.files.filter((file) => !file.deletedAt).length, 2);
  }
});

test("admin renders every attachment, distinct gallery identity, count and unchecked manual review", async () => {
  const { tree, signedCalls } = await pageHarness("admin");
  assert.equal(signedCalls.flat().includes("synthetic/removed.pdf"), false);
  const nodes = elements(tree);
  const lists = nodes.filter((node) => typeof node.type === "function" && node.type.name === "DocList");
  const checklist = lists.flatMap((node) => elements(node.type(node.props)));
  const attachmentList = checklist.find((node) => node.type === "AttachmentList" && node.props.docKey === "tax_payment_cert");
  assert.deepEqual(attachmentList.props.files.map((file) => file.id), ["national", "local", "removed"]);
  const review = checklist.find((node) => node.props.role === "checkbox" && node.props["aria-label"].includes("국세"));
  assert.equal(review.props["aria-checked"], false);
  assert.match(words(checklist), /국세·지방세가 모두 있는지 직접 확인/);
  const gallery = nodes.find((node) => node.type === "DocGallery");
  assert.equal(new Set(gallery.props.items.map((item) => item.key)).size, gallery.props.items.length);
  assert.equal(gallery.props.items.filter((item) => item.docKey === "tax_payment_cert").length, 2);
});
for (const expiry of ["invalid", "", "2000-01-01T00:00:00Z"]) test(`public rejects expired or malformed token expiry ${JSON.stringify(expiry)}`, async () => {
  await assert.rejects(pageHarness("public", expiry), /not found/);
});

test("soft removal/undo targets exact attachment and cancelled confirmation writes nothing", async () => {
  const hook = hooks();
  const calls = [];
  const { AttachmentList } = loadSource("src/components/documents/AttachmentList.tsx", { react: hook.react, "next/navigation": { useRouter: () => ({ refresh: () => calls.push("refresh") }) } });
  const props = { customerId: "customer-a", docKey: "tax_payment_cert", files: [{ id: "one", attachmentId: "one", filename: "같은 이름.pdf", url: "https://synthetic.invalid/one" }, { id: "two", attachmentId: "two", filename: "같은 이름.pdf", deletedAt: "yesterday" }, { id: "legacy", filename: "기존.pdf", url: "https://synthetic.invalid/legacy" }], deleteAction: async (form) => calls.push(["remove", Object.fromEntries(form)]), restoreAction: async (form) => calls.push(["restore", Object.fromEntries(form)]) };
  const render = () => { hook.reset(); return elements(AttachmentList(props)); };
  const originalWindow = globalThis.window;
  try {
    globalThis.window = { confirm: () => false };
    await render().find((node) => node.type === "button" && node.props["aria-label"].includes("(one)")).props.onClick();
    assert.deepEqual(calls, []);
    globalThis.window.confirm = () => true;
    await render().find((node) => node.type === "button" && node.props["aria-label"].includes("(one)")).props.onClick();
    await render().find((node) => node.type === "button" && node.props["aria-label"].includes("(two)")).props.onClick();
    assert.deepEqual(calls.filter(Array.isArray), [["remove", { customer_id: "customer-a", doc_key: "tax_payment_cert", attachment_id: "one" }], ["restore", { customer_id: "customer-a", doc_key: "tax_payment_cert", attachment_id: "two" }]]);
    assert.equal(render().filter((node) => node.type === "button").length, 2);
  } finally { globalThis.window = originalWindow; }
});

test("thrown transport error also recovers a file whose storage response was lost", async () => {
  const queue = queueFiles([pdf("국세.pdf")]);
  const { actions } = operations({ upload: async () => { throw new Error("connection lost"); } });
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.equal(queue[0].phase, "done");
});

for (const surface of ["admin", "sales", "public"]) test(`${surface} wires shared upload metadata and recording to its scoped actions`, async () => {
  const calls = [];
  const actionModule = surface === "admin" ? "@/app/ph-console-8f27x/(app)/customers/actions" : surface === "sales" ? "@/app/sales/actions" : "@/app/s/[token]/actions";
  const actionNames = surface === "sales" ? ["salesCreateDocUploadUrl", "salesRecordDocUpload"] : ["createDocUploadUrl", "recordDocUpload"];
  const actions = {
    [actionNames[0]]: async (...args) => { calls.push(["sign", ...args]); return { id: args[3].id, path: "synthetic/path.pdf", token: "fixture" }; },
    [actionNames[1]]: async (...args) => { calls.push(["record", ...args]); return { ok: true }; },
  };
  const paths = { admin: "src/components/admin/AdminDocUpload.tsx", sales: "src/components/sales/SalesDocUpload.tsx", public: "src/components/PublicDocUpload.tsx" };
  const names = { admin: "AdminDocUpload", sales: "SalesDocUpload", public: "PublicDocUpload" };
  const componentModule = loadSource(paths[surface], { [actionModule]: actions, "@/components/documents/MultiDocUpload": { MultiDocUpload: "MultiDocUpload" }, "@/components/documents/AttachmentList": { AttachmentList: "AttachmentList" } });
  const tree = componentModule[names[surface]]({ customerId: "customer-a", token: "token-a", docKey: "tax_payment_cert", category: "screening_2", label: "국세 및 지방세", files: [] });
  const uploader = elements(tree).find((node) => node.type === "MultiDocUpload");
  const metadata = { id: "unique-file", size: 123, type: "application/pdf" };
  await uploader.props.signAction("국세.pdf", metadata);
  await uploader.props.recordAction("synthetic/path.pdf", metadata.id);
  const scope = surface === "public" ? "token-a" : "customer-a";
  assert.deepEqual(calls, [["sign", scope, "tax_payment_cert", "국세.pdf", metadata], ["record", scope, "tax_payment_cert", "screening_2", "synthetic/path.pdf", "unique-file"]]);
});

test("gallery selects same-key attachments independently and ZIP requests exact file IDs", () => {
  const hook = hooks();
  const { DocGallery } = loadSource("src/components/admin/DocGallery.tsx", { react: hook.react, "next/navigation": { useRouter: () => ({ refresh: () => {} }) } });
  const props = { customerId: "customer-a", items: [
    { key: "id-national", attachmentId: "id-national", docKey: "tax_payment_cert", filename: "국세.pdf", label: "국세 및 지방세", isImage: false, url: "https://synthetic.invalid/national" },
    { key: "id-local", attachmentId: "id-local", docKey: "tax_payment_cert", filename: "지방세.pdf", label: "국세 및 지방세", isImage: false, url: "https://synthetic.invalid/local" },
  ], deleteAction: async () => {} };
  const render = () => { hook.reset(); return elements(DocGallery(props)); };
  const originalWindow = globalThis.window;
  try {
    globalThis.window = { location: { href: "" } };
    const checkboxes = render().filter((node) => node.type === "input");
    checkboxes[2].props.onChange();
    assert.equal(render().filter((node) => node.type === "input")[1].props.checked, false);
    assert.equal(render().filter((node) => node.type === "input")[2].props.checked, true);
    render().find((node) => node.type === "button" && words(node).includes("선택 다운로드")).props.onClick();
    const url = new URL(globalThis.window.location.href, "http://synthetic.invalid");
    assert.equal(url.searchParams.get("ids"), "id-local");
    assert.equal(url.searchParams.has("keys"), false);
  } finally { globalThis.window = originalWindow; }
});


test("retry after lost upload and finalize responses records before re-signing an existing object", async () => {
  const queue = queueFiles([pdf("national.pdf")]);
  let finalizeCalls = 0;
  let signCalls = 0;
  const { actions } = operations({
    sign: async (_name, meta) => ++signCalls === 1 ? { id: meta.id, path: `synthetic/${meta.id}.pdf`, token: "fixture" } : { error: "Object already exists; signing refused" },
    upload: async () => ({ error: { message: "upload response lost" } }),
    record: async () => ++finalizeCalls === 1 ? { error: "finalize temporarily unavailable" } : { ok: true },
  });
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.equal(queue[0].phase, "error");
  await submitUploadQueue(queue, actions, () => {}, () => false);
  assert.equal(queue[0].phase, "done");
  assert.equal(signCalls, 1);
  assert.equal(finalizeCalls, 2);
});
